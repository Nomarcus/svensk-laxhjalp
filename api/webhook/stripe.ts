import Stripe from 'stripe';
import { getServerFirestore } from '../../server/lib/serverFirestore';
export const config = { api: { bodyParser: false } };
async function getRawBody(req: any): Promise<Buffer> { return new Promise((resolve, reject) => { const chunks: Buffer[] = []; req.on('data', (chunk: Buffer) => chunks.push(chunk)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject); }); }
async function getFirebaseAdmin() { const mod = await import('firebase-admin'); const admin = mod.default; if (!admin.apps?.length) { const sa = process.env.FIREBASE_SERVICE_ACCOUNT; if (sa) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) }); else admin.initializeApp(); } return admin; }
function getSubscriptionPeriodEnd(sub: Stripe.Subscription | Stripe.Response<Stripe.Subscription>): string | null { const ts = (sub as any).current_period_end; return typeof ts === 'number' ? new Date(ts * 1000).toISOString() : null; }
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !webhookSecret) return res.status(400).json({ error: 'Missing signature.' });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await getRawBody(req), sig, webhookSecret); } catch { return res.status(400).json({ error: 'Signature failed.' }); }
  await getFirebaseAdmin();
  const db = getServerFirestore();
  try {
    if (event.type === 'checkout.session.completed') { const s = event.data.object as Stripe.Checkout.Session; const uid = s.metadata?.firebaseUID; if (uid && s.subscription) { const sub = await stripe.subscriptions.retrieve(s.subscription as string); await db.doc('users/' + uid).set({ tier: 'pro', subscriptionStatus: 'active', stripeSubscriptionId: sub.id, stripeCustomerId: s.customer as string, currentPeriodEnd: getSubscriptionPeriodEnd(sub), cancelAtPeriodEnd: sub.cancel_at_period_end }, { merge: true }); } }
    else if (event.type === 'customer.subscription.updated') { const sub = event.data.object as Stripe.Subscription; const uid = sub.metadata?.firebaseUID; if (uid) await db.doc('users/' + uid).set({ tier: sub.status === 'active' ? 'pro' : 'free', subscriptionStatus: sub.status === 'active' ? 'active' : 'past_due', currentPeriodEnd: getSubscriptionPeriodEnd(sub), cancelAtPeriodEnd: sub.cancel_at_period_end }, { merge: true }); }
    else if (event.type === 'customer.subscription.deleted') { const sub = event.data.object as Stripe.Subscription; const uid = sub.metadata?.firebaseUID; if (uid) await db.doc('users/' + uid).set({ tier: 'free', subscriptionStatus: 'none', stripeSubscriptionId: null, currentPeriodEnd: null, cancelAtPeriodEnd: false }, { merge: true }); }
    else if (event.type === 'invoice.payment_failed') { const inv = event.data.object as Stripe.Invoice; const snap = await db.collection('users').where('stripeCustomerId', '==', inv.customer as string).limit(1).get(); if (!snap.empty) await snap.docs[0].ref.set({ subscriptionStatus: 'past_due' }, { merge: true }); }
    res.json({ received: true });
  } catch (error: any) { console.error('Webhook error:', error.message); res.status(500).json({ error: 'Webhook failed.' }); }
}
