import Stripe from 'stripe';
import { MONTHLY_CREDITS } from '../../src/lib/subscription';

export const config = { api: { bodyParser: false } };

async function getRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function getFirebaseAdmin() {
  const mod = await import('firebase-admin');
  const admin = mod.default;
  if (!admin.apps?.length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (sa) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
    else admin.initializeApp();
  }
  return admin;
}

function resolvePlanFromPrice(subscription: Stripe.Subscription): 'plus' | 'pro' {
  const priceId = subscription.items?.data?.[0]?.price?.id || '';
  if (priceId.includes('pro')) return 'pro';
  // Check amount: Pro is 79 kr (7900 öre), Plus is 49 kr (4900 öre)
  const amount = subscription.items?.data?.[0]?.price?.unit_amount || 0;
  if (amount >= 7000) return 'pro';
  return 'plus';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !webhookSecret) return res.status(400).json({ error: 'Missing signature.' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await getRawBody(req), sig, webhookSecret);
  } catch {
    return res.status(400).json({ error: 'Signature failed.' });
  }

  const admin = await getFirebaseAdmin();
  const db = admin.firestore();

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session;
      const uid = s.metadata?.firebaseUID;
      if (uid && s.subscription) {
        const sub = await stripe.subscriptions.retrieve(s.subscription as string);
        const plan = resolvePlanFromPrice(sub);
        const total = MONTHLY_CREDITS[plan];
        const now = new Date();
        const periodEnd = new Date(sub.current_period_end * 1000);

        await db.doc(`users/${uid}`).set({
          tier: plan,
          planType: plan,
          subscriptionStatus: 'active',
          stripeSubscriptionId: sub.id,
          stripeCustomerId: s.customer as string,
          currentPeriodEnd: periodEnd.toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          monthlyCreditsTotal: total,
          monthlyCreditsUsed: 0,
          monthlyCreditsRemaining: total,
          billingPeriodStart: now.toISOString(),
          billingPeriodEnd: periodEnd.toISOString(),
        }, { merge: true });
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.firebaseUID;
      if (uid) {
        const isActive = sub.status === 'active';
        const plan = isActive ? resolvePlanFromPrice(sub) : 'none';
        const total = isActive ? MONTHLY_CREDITS[plan as 'plus' | 'pro'] : 0;

        const updates: Record<string, any> = {
          tier: isActive ? plan : 'free',
          planType: plan,
          subscriptionStatus: isActive ? 'active' : 'past_due',
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        };

        // Only reset credits if plan changed or new period
        if (isActive) {
          updates.monthlyCreditsTotal = total;
        }

        await db.doc(`users/${uid}`).set(updates, { merge: true });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.firebaseUID;
      if (uid) {
        await db.doc(`users/${uid}`).set({
          tier: 'free',
          planType: 'none',
          subscriptionStatus: 'none',
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          monthlyCreditsTotal: 0,
          monthlyCreditsUsed: 0,
          monthlyCreditsRemaining: 0,
        }, { merge: true });
      }
    } else if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object as Stripe.Invoice;
      const snap = await db.collection('users').where('stripeCustomerId', '==', inv.customer as string).limit(1).get();
      if (!snap.empty) {
        await snap.docs[0].ref.set({ subscriptionStatus: 'past_due' }, { merge: true });
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    res.status(500).json({ error: 'Webhook failed.' });
  }
}
