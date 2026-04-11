import Stripe from 'stripe';
import { getServerFirestore } from '../../server/lib/serverFirestore';
import { applyApiSecurity } from '../_lib/httpSecurity';
const CLIENT_URL = process.env.CLIENT_URL || 'https://svensk-laxhjalp.vercel.app';
async function getFirebaseAdmin() { const mod = await import('firebase-admin'); const admin = mod.default; if (!admin.apps?.length) { const sa = process.env.FIREBASE_SERVICE_ACCOUNT; if (sa) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) }); else admin.initializeApp(); } return admin; }
export default async function handler(req: any, res: any) {
  if (!applyApiSecurity(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Ingen autentisering.' });
  try {
    const admin = await getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    const customerId = (await getServerFirestore().doc('users/' + decoded.uid).get()).data()?.stripeCustomerId;
    if (!customerId) return res.status(400).json({ error: 'Inget abonnemang.' });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: CLIENT_URL });
    res.json({ url: session.url });
  } catch (error: any) { console.error('Portal error:', error.message); res.status(500).json({ error: 'Portalen misslyckades.' }); }
}
