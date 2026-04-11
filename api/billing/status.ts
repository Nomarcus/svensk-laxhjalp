import { getServerFirestore } from '../../server/lib/serverFirestore';
import { applyApiSecurity } from '../_lib/httpSecurity';
async function getFirebaseAdmin() { const mod = await import('firebase-admin'); const admin = mod.default; if (!admin.apps?.length) { const sa = process.env.FIREBASE_SERVICE_ACCOUNT; if (sa) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) }); else admin.initializeApp(); } return admin; }
export default async function handler(req: any, res: any) {
  if (!applyApiSecurity(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Ingen autentisering.' });
  try {
    const admin = await getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    const db = getServerFirestore();
    const data = (await db.doc('users/' + decoded.uid).get()).data() || {};
    const today = new Date().toISOString().split('T')[0];
    const usage = (await db.doc('users/' + decoded.uid + '/usage/' + today).get()).data() || { chatCount: 0, imageCount: 0, aiTtsCount: 0 };
    res.json({ tier: data.tier || 'free', status: data.subscriptionStatus || 'none', currentPeriodEnd: data.currentPeriodEnd || null, cancelAtPeriodEnd: data.cancelAtPeriodEnd || false, usage: { chatCount: usage.chatCount || 0, imageCount: usage.imageCount || 0, aiTtsCount: usage.aiTtsCount || 0 } });
  } catch (error: any) { console.error('Status error:', error.message); res.status(500).json({ error: 'Status misslyckades.' }); }
}
