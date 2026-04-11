import Stripe from 'stripe';
import { getServerFirestore } from '../../server/lib/serverFirestore';
import { applyApiSecurity } from '../_lib/httpSecurity';
const CLIENT_URL = process.env.CLIENT_URL || 'https://svensk-laxhjalp.vercel.app';
async function getFirebaseAdmin() { const mod = await import('firebase-admin'); const admin = mod.default; if (!admin.apps?.length) { const sa = process.env.FIREBASE_SERVICE_ACCOUNT; if (sa) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) }); else admin.initializeApp(); } return admin; }

function resolveCheckoutPriceId(priceId: unknown): string | null {
  const value = typeof priceId === 'string' ? priceId.trim() : '';
  if (!value) return null;
  const monthly = process.env.STRIPE_PRICE_ID_MONTHLY?.trim();
  const yearly = process.env.STRIPE_PRICE_ID_YEARLY?.trim();
  const aliases: Record<string, string | undefined> = { monthly, yearly };
  const allowlist = new Set([monthly, yearly].filter(Boolean) as string[]);
  const resolved = aliases[value] || value;
  return allowlist.has(resolved) ? resolved : null;
}

export default async function handler(req: any, res: any) {
  if (!applyApiSecurity(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Ingen autentisering.' });
  try {
    const admin = await getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    if (!decoded.email) return res.status(400).json({ error: 'E-post kravs.' });
    const { priceId } = req.body;
    const stripePriceId = resolveCheckoutPriceId(priceId);
    if (!stripePriceId) return res.status(400).json({ error: 'Ogiltigt pris.' });
    const db = getServerFirestore();
    let customerId = (await db.doc('users/' + decoded.uid).get()).data()?.stripeCustomerId;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    if (!customerId) { const c = await stripe.customers.create({ email: decoded.email, metadata: { firebaseUID: decoded.uid } }); customerId = c.id; await db.doc('users/' + decoded.uid).set({ stripeCustomerId: customerId }, { merge: true }); }
    const session = await stripe.checkout.sessions.create({ customer: customerId, mode: 'subscription', line_items: [{ price: stripePriceId, quantity: 1 }], success_url: CLIENT_URL + '?subscription=success', cancel_url: CLIENT_URL + '?subscription=canceled', metadata: { firebaseUID: decoded.uid }, subscription_data: { metadata: { firebaseUID: decoded.uid } }, locale: 'sv' });
    res.json({ url: session.url });
  } catch (error: any) { console.error('Checkout error:', error.message); res.status(500).json({ error: 'Betalning misslyckades.' }); }
}
