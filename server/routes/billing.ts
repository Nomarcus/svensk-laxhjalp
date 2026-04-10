import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { AuthenticatedRequest } from '../middleware/auth';
import { getServerFirestore } from '../lib/serverFirestore';
import { patchFromStripeSubscription } from '../lib/stripeUserSubscriptionSync';

const router = Router();

// Stripe is lazily initialized — only fails when actually used, not at import
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('Stripe är inte konfigurerat ännu.');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

function normalizeStripeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function escapeStripeSearchEmail(email: string): string {
  return normalizeStripeEmail(email).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** List customers page-by-page (cap) and match e-post — backup om `customers.search` failar eller hittar inget. */
async function findCustomersByEmailListPages(
  stripe: Stripe,
  normalizedEmail: string,
): Promise<Stripe.Customer[]> {
  const matches: Stripe.Customer[] = [];
  let startingAfter: string | undefined;
  const maxPages = 8;
  for (let p = 0; p < maxPages; p++) {
    const page = await stripe.customers.list({ limit: 100, starting_after: startingAfter });
    for (const c of page.data) {
      if ((c.email || '').trim().toLowerCase() === normalizedEmail) {
        matches.push(c);
      }
    }
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }
  return matches;
}

/**
 * Hitta Stripe customer id från inloggad användares e-post (sök först, sedan sidvis listing).
 */
async function findStripeCustomerIdForEmail(
  stripe: Stripe,
  email: string,
  uid: string,
  existingCustomerId?: string | null,
): Promise<string | undefined> {
  if (existingCustomerId) return existingCustomerId;
  const normalized = normalizeStripeEmail(email);
  const escapedEmail = escapeStripeSearchEmail(email);
  const escapedUid = uid.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  let candidates: Stripe.Customer[] = [];
  // Best-effort: prefer explicit firebaseUID mapping when present.
  try {
    const byUid = await stripe.customers.search({ query: `metadata['firebaseUID']:'${escapedUid}'`, limit: 10 });
    if (byUid.data.length > 0) candidates = byUid.data;
  } catch (searchErr) {
    console.warn(
      'Stripe customers.search by metadata failed, falling back:',
      searchErr instanceof Error ? searchErr.message : searchErr,
    );
  }
  try {
    if (candidates.length === 0) {
      const found = await stripe.customers.search({ query: `email:'${escapedEmail}'`, limit: 25 });
      candidates = found.data;
    }
  } catch (searchErr) {
    console.warn(
      'Stripe customers.search failed, using list fallback:',
      searchErr instanceof Error ? searchErr.message : searchErr,
    );
  }
  if (candidates.length === 0) {
    candidates = await findCustomersByEmailListPages(stripe, normalized);
  }
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0].id;
  for (const c of candidates) {
    const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 5 });
    if (subs.data.some((s) => s.status === 'active' || s.status === 'trialing')) {
      return c.id;
    }
  }
  return candidates[0].id;
}

function syncErrorPayload(err: unknown): { status: number; body: { error: string; detail: string } } {
  const raw = err instanceof Error ? err.message : String(err);
  const detail = raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
  if (raw.includes('Stripe är inte konfigurerat') || raw.includes('STRIPE_SECRET_KEY')) {
    return {
      status: 503,
      body: {
        error: 'Kunde inte synka prenumeration.',
        detail:
          'STRIPE_SECRET_KEY saknas eller är ogiltig på servern. Lägg in Stripe secret key under Cloud Run → Variables.',
      },
    };
  }
  return {
    status: 500,
    body: { error: 'Kunde inte synka prenumeration.', detail },
  };
}

async function findUserByStripeCustomerId(customerId?: string | null) {
  if (!customerId) return null;
  const snapshot = await getServerFirestore()
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0];
}

const CLIENT_URL = process.env.CLIENT_URL || 'https://lead-agent-489101.web.app';

// POST /api/billing/create-checkout-session
router.post('/billing/create-checkout-session', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { priceId } = req.body;
    const uid = req.uid;
    const email = req.email;

    if (!uid) {
      res.status(401).json({ error: 'Inte autentiserad.' });
      return;
    }

    if (!email) {
      res.status(400).json({ error: 'Du behöver ett konto med e-post för att prenumerera. Gästkonton stöds inte.' });
      return;
    }

    // Map billing period to Stripe Price ID
    const priceMap: Record<string, string | undefined> = {
      monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
      yearly: process.env.STRIPE_PRICE_ID_YEARLY,
    };
    const stripePriceId = priceMap[priceId] || priceId;

    if (!stripePriceId) {
      res.status(400).json({ error: 'Ogiltigt pris-ID.' });
      return;
    }

    // Look up or create Stripe customer
    const userDoc = await getServerFirestore().doc(`users/${uid}`).get();
    const userData = userDoc.data();
    let customerId = userData?.stripeCustomerId;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email,
        metadata: { firebaseUID: uid },
      });
      customerId = customer.id;
      await getServerFirestore().doc(`users/${uid}`).set(
        { stripeCustomerId: customerId },
        { merge: true }
      );
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${CLIENT_URL}?subscription=success`,
      cancel_url: `${CLIENT_URL}?subscription=canceled`,
      metadata: { firebaseUID: uid },
      subscription_data: {
        metadata: { firebaseUID: uid },
      },
      locale: 'sv',
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout session error:', error.message);
    res.status(500).json({ error: 'Kunde inte skapa betalningssession.' });
  }
});

// POST /api/billing/create-portal-session
router.post('/billing/create-portal-session', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.uid;
    if (!uid) {
      res.status(401).json({ error: 'Inte autentiserad.' });
      return;
    }

    const userDoc = await getServerFirestore().doc(`users/${uid}`).get();
    const customerId = userDoc.data()?.stripeCustomerId;

    if (!customerId) {
      res.status(400).json({ error: 'Inget aktivt abonnemang hittades.' });
      return;
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: CLIENT_URL,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Portal session error:', error.message);
    res.status(500).json({ error: 'Kunde inte öppna abonnemangsportalen.' });
  }
});

// GET /api/billing/status
router.get('/billing/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.uid;
    if (!uid) {
      res.status(401).json({ error: 'Inte autentiserad.' });
      return;
    }

    const userDoc = await getServerFirestore().doc(`users/${uid}`).get();
    const data = userDoc.data() || {};

    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const usageDoc = await getServerFirestore().doc(`users/${uid}/usage/${today}`).get();
    const usage = usageDoc.data() || { chatCount: 0, imageCount: 0, aiTtsCount: 0 };

    res.json({
      tier: data.tier || 'free',
      status: data.subscriptionStatus || 'none',
      currentPeriodEnd: data.currentPeriodEnd || null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
      usage: {
        chatCount: usage.chatCount || 0,
        imageCount: usage.imageCount || 0,
        aiTtsCount: usage.aiTtsCount || 0,
      },
    });
  } catch (error: any) {
    console.error('Billing status error:', error.message);
    res.status(500).json({ error: 'Kunde inte hämta abonnemangsstatus.' });
  }
});

/** Om webhook inte nått servern (fel URL i Stripe): koppla Firebase-användaren till Stripe via e-post och skriv tier/status till Firestore. */
router.post('/billing/sync-stripe-subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.uid;
    const email = req.email;
    if (!uid) {
      res.status(401).json({ error: 'Inte autentiserad.' });
      return;
    }
    if (!email) {
      res.status(400).json({ error: 'E-post krävs för att hitta Stripe-kund.' });
      return;
    }
    if (!process.env.STRIPE_SECRET_KEY?.trim()) {
      res.status(503).json({
        error: 'Kunde inte synka prenumeration.',
        detail:
          'STRIPE_SECRET_KEY saknas på servern. Lägg in den under Cloud Run → laxhjalp-api → Edit → Variables.',
      });
      return;
    }

    const userRef = getServerFirestore().doc(`users/${uid}`);
    const userSnapshot = await userRef.get();
    const existingCus = userSnapshot.data()?.stripeCustomerId as string | undefined;
    const stripe = getStripe();

    let customerId = await findStripeCustomerIdForEmail(stripe, email, uid, existingCus);
    if (customerId && customerId !== existingCus) {
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    if (!customerId) {
      res.json({ ok: true, synced: false, reason: 'no_stripe_customer' });
      return;
    }

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 25,
    });
    const activeOrTrial = subs.data
      .filter((s) => s.status === 'active' || s.status === 'trialing')
      .sort((a, b) => b.created - a.created);
    const best = activeOrTrial[0];
    if (!best) {
      res.json({ ok: true, synced: false, reason: 'no_active_subscription' });
      return;
    }

    const patch = patchFromStripeSubscription(best, { stripeCustomerId: customerId });
    await userRef.set(patch, { merge: true });
    res.json({
      ok: true,
      synced: true,
      status: best.status,
      duplicateActiveCount: Math.max(0, activeOrTrial.length - 1),
    });
  } catch (error: unknown) {
    console.error('Sync stripe subscription error:', error);
    const { status, body } = syncErrorPayload(error);
    res.status(status).json(body);
  }
});

// Stripe webhook handler (called from index.ts with raw body)
export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).json({ error: 'Missing signature or webhook secret.' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).json({ error: 'Webhook signature verification failed.' });
    return;
  }

  try {
    console.info('[stripe webhook]', event.type);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const firebaseUID = session.metadata?.firebaseUID || session.client_reference_id || null;
        if (!firebaseUID) break;

        if (session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription as string);
          const patch = patchFromStripeSubscription(subscription, {
            stripeCustomerId: session.customer as string,
          });
          await getServerFirestore().doc(`users/${firebaseUID}`).set(patch, { merge: true });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        let firebaseUID = subscription.metadata?.firebaseUID || null;
        if (!firebaseUID) {
          const userDoc = await findUserByStripeCustomerId(subscription.customer as string);
          firebaseUID = userDoc?.id || null;
        }
        if (!firebaseUID) break;

        const patch = patchFromStripeSubscription(subscription);
        await getServerFirestore().doc(`users/${firebaseUID}`).set(patch, { merge: true });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        let firebaseUID = subscription.metadata?.firebaseUID || null;
        if (!firebaseUID) {
          const userDoc = await findUserByStripeCustomerId(subscription.customer as string);
          firebaseUID = userDoc?.id || null;
        }
        if (!firebaseUID) break;

        await getServerFirestore().doc(`users/${firebaseUID}`).set({
          tier: 'free',
          subscriptionStatus: 'none',
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        }, { merge: true });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const userDoc = await findUserByStripeCustomerId(customerId);
        if (userDoc) {
          await userDoc.ref.set({
            subscriptionStatus: 'past_due',
          }, { merge: true });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error.message);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
}

export { router as billingRouter };
