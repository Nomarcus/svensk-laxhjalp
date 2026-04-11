import Stripe from 'stripe';
import { getServerFirestore } from '../../server/lib/serverFirestore';
import { patchFromStripeSubscription } from '../../server/lib/stripeUserSubscriptionSync';
import { reserveStripeWebhookEvent } from '../../server/lib/stripeWebhookIdempotency';
import { applyApiSecurity } from '../_lib/httpSecurity';

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

async function findUserByStripeCustomerId(customerId?: string | null) {
  if (!customerId) return null;
  const db = getServerFirestore();
  const snapshot = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0];
}

export default async function handler(req: any, res: any) {
  if (!applyApiSecurity(req, res)) return;
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
  await getFirebaseAdmin();
  const db = getServerFirestore();
  try {
    const accepted = await reserveStripeWebhookEvent(event.id);
    if (!accepted) {
      return res.json({ received: true, duplicate: true });
    }
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const firebaseUID = session.metadata?.firebaseUID || session.client_reference_id || null;
      if (firebaseUID && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const patch = patchFromStripeSubscription(sub, { stripeCustomerId: session.customer as string });
        await db.doc(`users/${firebaseUID}`).set(patch, { merge: true });
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      let firebaseUID = sub.metadata?.firebaseUID || null;
      if (!firebaseUID) {
        const doc = await findUserByStripeCustomerId(sub.customer as string);
        firebaseUID = doc?.id || null;
      }
      if (firebaseUID) {
        const patch = patchFromStripeSubscription(sub);
        await db.doc(`users/${firebaseUID}`).set(patch, { merge: true });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      let firebaseUID = sub.metadata?.firebaseUID || null;
      if (!firebaseUID) {
        const doc = await findUserByStripeCustomerId(sub.customer as string);
        firebaseUID = doc?.id || null;
      }
      if (firebaseUID) {
        await db.doc(`users/${firebaseUID}`).set(
          {
            tier: 'free',
            subscriptionStatus: 'none',
            stripeSubscriptionId: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          },
          { merge: true },
        );
      }
    } else if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object as Stripe.Invoice;
      const doc = await findUserByStripeCustomerId(inv.customer as string);
      if (doc) {
        await doc.ref.set({ subscriptionStatus: 'past_due' }, { merge: true });
      }
    }
    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    res.status(500).json({ error: 'Webhook failed.' });
  }
}
