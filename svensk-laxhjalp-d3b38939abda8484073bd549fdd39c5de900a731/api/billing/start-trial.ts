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

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Ingen autentisering. Logga in först.' });
  }

  let uid: string;
  try {
    const admin = await getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Ogiltig token. Logga in igen.' });
  }

  try {
    const admin = await getFirebaseAdmin();
    const db = admin.firestore();
    const userRef = db.doc(`users/${uid}`);
    const userDoc = await userRef.get();
    const userData = userDoc.data() || {};

    if (userData.hadTrial === true) {
      return res.status(403).json({ error: 'Du har redan använt din gratis trial-period.' });
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await userRef.set(
      {
        tier: 'trial',
        hadTrial: true,
        trialStartedAt: admin.firestore.Timestamp.fromDate(now),
        trialEndsAt: admin.firestore.Timestamp.fromDate(trialEnd),
        monthlyCreditsTotal: 100,
        monthlyCreditsUsed: 0,
        creditPeriodStart: admin.firestore.Timestamp.fromDate(now),
        creditPeriodEnd: admin.firestore.Timestamp.fromDate(trialEnd),
      },
      { merge: true }
    );

    return res.json({ success: true, trialEndsAt: trialEnd.toISOString() });
  } catch (error: any) {
    console.error('Start trial error:', error.message);
    return res.status(500).json({ error: 'Kunde inte starta trial. Försök igen.' });
  }
}
