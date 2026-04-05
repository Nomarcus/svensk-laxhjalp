import { isSoleAdminFromEnv } from '../../server/lib/adminOverviewPayload';
import { buildAdminAnalyticsPayload } from '../../server/lib/adminAnalyticsPayload';
import { getServerFirestore } from '../../server/lib/serverFirestore';

function parseServiceAccountJson(): object {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  try {
    return JSON.parse(raw) as object;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }
}

async function getFirebaseAdmin() {
  const mod = await import('firebase-admin');
  const adm = mod.default;
  if (!adm.apps?.length) {
    const cred = adm.credential.cert(parseServiceAccountJson() as Parameters<typeof adm.credential.cert>[0]);
    adm.initializeApp({ credential: cred });
  }
  return adm;
}

export default async function handler(req: { method?: string; query?: { range?: string }; headers: { authorization?: string } }, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Ingen autentisering.' });
  try {
    const admin = await getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    if (!isSoleAdminFromEnv(decoded.uid, decoded.email)) {
      return res.status(403).json({ error: 'Forbidden', code: 'admin_forbidden' });
    }
    const range = typeof req.query?.range === 'string' ? req.query.range : 'month';
    const db = getServerFirestore();
    const payload = await buildAdminAnalyticsPayload(db, range);
    return res.status(200).json(payload);
  } catch (err: unknown) {
    const e = err as { code?: string | number; message?: string };
    if (typeof e?.code === 'string' && e.code.startsWith('auth/')) {
      return res.status(401).json({ error: 'Ogiltig session.', code: e.code });
    }
    console.error('Admin analytics error:', e?.message ?? '', err);
    return res.status(500).json({ error: 'Admin analytics failed.' });
  }
}
