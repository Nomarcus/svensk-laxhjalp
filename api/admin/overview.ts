import { buildAdminOverviewPayload, isSoleAdminFromEnv } from '../../server/lib/adminOverviewPayload';

async function getFirebaseAdmin() {
  const mod = await import('firebase-admin');
  const adm = mod.default;
  if (!adm.apps?.length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (sa) adm.initializeApp({ credential: adm.credential.cert(JSON.parse(sa)) });
    else adm.initializeApp();
  }
  return adm;
}

export default async function handler(req: { method?: string; headers: { authorization?: string } }, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Ingen autentisering.' });
  try {
    const admin = await getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    if (!isSoleAdminFromEnv(decoded.uid, decoded.email)) {
      return res.status(403).json({ error: 'Forbidden', code: 'admin_forbidden' });
    }
    const db = admin.firestore();
    const payload = await buildAdminOverviewPayload(db);
    return res.status(200).json(payload);
  } catch (err: unknown) {
    console.error('Admin overview error:', err instanceof Error ? err.message : err);
    return res.status(500).json({ error: 'Admin overview failed.' });
  }
}
