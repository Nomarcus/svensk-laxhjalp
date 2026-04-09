import { enforceSubscriptionLimits } from '../server/subscriptionEnv';
import { getServerFirestore } from '../server/lib/serverFirestore';

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

const FREE_AI_TTS_PER_DAY = 1;
const MAX_TTS_CHARS = 4500;

function isProUser(userData: { tier?: string; subscriptionStatus?: string } | undefined): boolean {
  const tier = userData?.tier || 'free';
  const subscriptionStatus = userData?.subscriptionStatus || 'none';
  return (
    tier === 'pro'
    && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing' || subscriptionStatus === 'canceled')
  );
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  const apiKey = process.env.GOOGLE_TTS_API_KEY || '';
  if (!apiKey) {
    return res.status(503).json({ error: 'Premiumröst är inte aktiverad på servern.', code: 'tts_unconfigured' });
  }

  const { stripMarkdownForTts } = await import('../server/lib/stripForTts');
  const { synthesizeMp3 } = await import('../server/lib/googleCloudTts');

  const { text, lang = 'sv' } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text krävs.' });
  }

  const plain = stripMarkdownForTts(text).slice(0, MAX_TTS_CHARS);
  if (!plain.trim()) {
    return res.status(400).json({ error: 'Ingen läsbar text efter formattering.' });
  }

  try {
    const admin = await getFirebaseAdmin();
    const db = getServerFirestore();
    const userDoc = await db.doc(`users/${uid}`).get();
    const userData = userDoc.data();
    const pro = isProUser(userData);

    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.doc(`users/${uid}/usage/${today}`);

    if (enforceSubscriptionLimits() && !pro) {
      const usageDoc = await usageRef.get();
      const usage = usageDoc.data() || {};
      const aiTtsCount = usage.aiTtsCount || 0;
      if (aiTtsCount >= FREE_AI_TTS_PER_DAY) {
        return res.status(403).json({
          error: `Du har använt din premiumröst för idag (${FREE_AI_TTS_PER_DAY}/dag). Vi läser upp med webbläsarens röst istället, eller uppgradera till Pro för obegränsad premiumröst.`,
          code: 'tts_limit',
          limit: FREE_AI_TTS_PER_DAY,
          used: aiTtsCount,
        });
      }
    }

    const audio = await synthesizeMp3(apiKey, plain, typeof lang === 'string' ? lang : 'sv');

    if (!pro) {
      await usageRef.set(
        {
          aiTtsCount: admin.firestore.FieldValue.increment(1),
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(audio);
  } catch (error: unknown) {
    console.error('TTS error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Kunde inte skapa uppläsning. Försök igen.' });
  }
}
