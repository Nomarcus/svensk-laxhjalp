import { startGuestTrial, MONTHLY_CREDITS } from '../../src/lib/subscription';

const TRIAL_DAYS = 7;

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let uid: string | null = null;
    const guestId = req.headers['x-guest-user-id'] as string | undefined;
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const admin = await getFirebaseAdmin();
        const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
        uid = decoded.uid;
      } catch {
        if (!guestId) return res.status(401).json({ error: 'Ogiltig token.' });
      }
    } else if (!guestId) {
      return res.status(401).json({ error: 'Ingen autentisering.' });
    }

    if (!uid && guestId) {
      const guestTrial = startGuestTrial(guestId);
      if (!guestTrial.ok) return res.status(400).json({ error: guestTrial.error });
      return res.json({ ok: true, plan_type: 'trial', trial_ends_at: guestTrial.trial_ends_at, guest: true });
    }

    const admin = await getFirebaseAdmin();
    const db = admin.firestore();
    const userRef = db.doc(`users/${uid}`);
    const userData = (await userRef.get()).data() || {};

    if (userData.trialStartedAt || userData.planType === 'trial') {
      return res.status(400).json({ error: 'Gratisperioden har redan använts.' });
    }

    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

    await userRef.update({
      planType: 'trial',
      trialStartedAt: now.toISOString(),
      trialEndsAt: trialEnd.toISOString(),
      monthlyCreditsTotal: MONTHLY_CREDITS.trial,
      monthlyCreditsUsed: 0,
      monthlyCreditsRemaining: MONTHLY_CREDITS.trial,
      dailyAiQuestionsUsed: 0,
      dailyImageAnalysesUsed: 0,
      dailyIllustrationsUsed: 0,
      dailyUsageDate: now.toISOString().split('T')[0],
    });

    return res.json({ ok: true, plan_type: 'trial', trial_ends_at: trialEnd.toISOString() });
  } catch (error: any) {
    console.error('Start trial error:', error.message);
    return res.status(500).json({ error: 'Kunde inte starta gratisperioden.' });
  }
}
