
import type Stripe from 'stripe';
import { getStripe } from '../lib/stripe';
import { getDb } from '../lib/firebase';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).json({ error: 'Missing signature or webhook secret.' });
    return;
  }

  const db = await getDb();
  let event: Stripe.Event;
  try {
    const rawBody = await getRawBody(req);
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).json({ error: 'Webhook signature verification failed.' });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const firebaseUID = session.metadata?.firebaseUID;
        if (!firebaseUID) break;
        if (session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription as string);
          await db.doc(`users/${firebaseUID}`).set({
            tier: 'pro',
            subscriptionStatus: 'active',
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: session.customer as string,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          }, { merge: true });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const firebaseUID = subscription.metadata?.firebaseUID;
        if (!firebaseUID) break;
        const statusMap: Record<string, string> = { active: 'active', past_due: 'past_due', canceled: 'canceled', unpaid: 'past_due' };
        await db.doc(`users/${firebaseUID}`).set({
          tier: subscription.status === 'active' ? 'pro' : 'free',
          subscriptionStatus: statusMap[subscription.status] || 'none',
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        }, { merge: true });
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const firebaseUID = subscription.metadata?.firebaseUID;
        if (!firebaseUID) break;
        await db.doc(`users/${firebaseUID}`).set({
          tier: 'free', subscriptionStatus: 'none', stripeSubscriptionId: null, currentPeriodEnd: null, cancelAtPeriodEnd: false,
        }, { merge: true });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const snapshot = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (!snapshot.empty) {
          await snapshot.docs[0].ref.set({ subscriptionStatus: 'past_due' }, { merge: true });
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
