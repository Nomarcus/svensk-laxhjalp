import { getServerFirestore } from '../../server/lib/serverFirestore';
import { applyApiSecurity } from '../_lib/httpSecurity';
import {
  FREE_AI_TTS_PER_DAY,
  FREE_CHAT_LIMIT,
  FREE_IMAGE_LIMIT,
  isUnmeteredSubscription,
} from '../../server/lib/freeTierLimits';
import { enforceSubscriptionLimits } from '../../server/subscriptionEnv';

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
  if (!applyApiSecurity(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Ingen autentisering.' });
  try {
    const admin = await getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    const db = getServerFirestore();
    const data = (await db.doc('users/' + decoded.uid).get()).data() || {};
    const tier = data.tier || 'free';
    const subscriptionStatus = data.subscriptionStatus || 'none';
    const today = new Date().toISOString().split('T')[0];
    const usage =
      (await db.doc('users/' + decoded.uid + '/usage/' + today).get()).data() || {
        chatCount: 0,
        imageCount: 0,
        aiTtsCount: 0,
      };
    const chatCount = usage.chatCount || 0;
    const imageCount = usage.imageCount || 0;
    const aiTtsCount = usage.aiTtsCount || 0;
    const isUnmetered = isUnmeteredSubscription(tier, subscriptionStatus);
    const metered = enforceSubscriptionLimits() && !isUnmetered;
    const showFreeQuota = !isUnmetered;
    const limits = showFreeQuota
      ? {
          chatDaily: FREE_CHAT_LIMIT,
          imageInChatDaily: FREE_IMAGE_LIMIT,
          aiTtsDaily: FREE_AI_TTS_PER_DAY,
        }
      : null;
    const remaining = showFreeQuota
      ? {
          chat: Math.max(0, FREE_CHAT_LIMIT - chatCount),
          imageInChat: Math.max(0, FREE_IMAGE_LIMIT - imageCount),
          aiTts: Math.max(0, FREE_AI_TTS_PER_DAY - aiTtsCount),
        }
      : null;
    res.json({
      tier,
      status: subscriptionStatus,
      currentPeriodEnd: data.currentPeriodEnd || null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
      usage: { chatCount, imageCount, aiTtsCount },
      metered,
      showFreeQuota,
      limits,
      remaining,
    });
  } catch (error: any) {
    console.error('Status error:', error.message);
    res.status(500).json({ error: 'Status misslyckades.' });
  }
}
