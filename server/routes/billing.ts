import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '../../src/lib/supabase-server';
import { AuthenticatedRequest } from '../middleware/auth';

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

const CLIENT_URL = process.env.CLIENT_URL || 'https://svensk-laxhjalp.vercel.app';

// POST /api/billing/create-checkout-session
router.post('/billing/create-checkout-session', async (req: AuthenticatedRequest, res: Response) => {
  try {
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
    const stripePriceId = priceMap[req.body.priceId] || req.body.priceId;

    if (!stripePriceId) {
      res.status(400).json({ error: 'Ogiltigt pris-ID.' });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: userData } = await supabase.from('users').select('stripe_customer_id').eq('id', uid).single();
    let customerId = userData?.stripe_customer_id;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email,
        metadata: { uid },
      });
      customerId = customer.id;
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', uid);
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${CLIENT_URL}?subscription=success`,
      cancel_url: `${CLIENT_URL}?subscription=canceled`,
      metadata: { uid },
      subscription_data: {
        metadata: { uid },
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

    const supabase = getSupabaseAdmin();
    const { data: userData } = await supabase.from('users').select('stripe_customer_id').eq('id', uid).single();
    const customerId = userData?.stripe_customer_id;

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

    const supabase = getSupabaseAdmin();
    const { data: userData } = await supabase.from('users').select('tier, subscription_status, current_period_end, cancel_at_period_end').eq('id', uid).single();

    const today = new Date().toISOString().split('T')[0];
    const { data: usageData } = await supabase.from('daily_usage').select('chat_count, image_count').eq('user_id', uid).eq('date', today).single();

    res.json({
      tier: userData?.tier || 'free',
      status: userData?.subscription_status || 'none',
      currentPeriodEnd: userData?.current_period_end || null,
      cancelAtPeriodEnd: userData?.cancel_at_period_end || false,
      usage: {
        chatCount: usageData?.chat_count || 0,
        imageCount: usageData?.image_count || 0,
      },
    });
  } catch (error: any) {
    console.error('Billing status error:', error.message);
    res.status(500).json({ error: 'Kunde inte hämta abonnemangsstatus.' });
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

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.metadata?.uid;
        if (!uid) break;

        if (session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription as string);
          await supabase.from('users').update({
            tier: 'pro',
            subscription_status: 'active',
            stripe_subscription_id: subscription.id,
            stripe_customer_id: session.customer as string,
            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
            cancel_at_period_end: (subscription as any).cancel_at_period_end,
          }).eq('id', uid);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const uid = subscription.metadata?.uid;
        if (!uid) break;

        const statusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'canceled',
          unpaid: 'past_due',
        };

        await supabase.from('users').update({
          tier: subscription.status === 'active' ? 'pro' : 'free',
          subscription_status: statusMap[subscription.status] || 'none',
          current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
          cancel_at_period_end: (subscription as any).cancel_at_period_end,
        }).eq('id', uid);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const uid = subscription.metadata?.uid;
        if (!uid) break;

        await supabase.from('users').update({
          tier: 'free',
          subscription_status: 'none',
          stripe_subscription_id: null,
          current_period_end: null,
          cancel_at_period_end: false,
        }).eq('id', uid);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: users } = await supabase.from('users').select('id').eq('stripe_customer_id', customerId).limit(1);
        if (users && users.length > 0) {
          await supabase.from('users').update({ subscription_status: 'past_due' }).eq('id', users[0].id);
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
