import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getServerFirestore } from '../lib/serverFirestore';
import {
  FREE_AI_TTS_PER_DAY,
  FREE_CHAT_LIMIT,
  FREE_IMAGE_LIMIT,
  isUnmeteredSubscription,
} from '../lib/freeTierLimits';
import { enforceSubscriptionLimits } from '../subscriptionEnv';

const router = Router();

// GET /api/billing/status
router.get('/billing/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.uid;
    if (!uid) {
      res.status(401).json({ error: 'Inte autentiserad.' });
      return;
    }

    const userDoc = await getServerFirestore().doc(`users/${uid}`).get();
    const data = userDoc.data() || {};
    const tier = data.tier || 'free';
    const subscriptionStatus = data.subscriptionStatus || 'none';

    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const usageDoc = await getServerFirestore().doc(`users/${uid}/usage/${today}`).get();
    const usage = usageDoc.data() || { chatCount: 0, imageCount: 0, aiTtsCount: 0 };
    const chatCount = usage.chatCount || 0;
    const imageCount = usage.imageCount || 0;
    const aiTtsCount = usage.aiTtsCount || 0;
    const isUnmetered = isUnmeteredSubscription(tier, subscriptionStatus);
    /** API blockerar vid tak när denna är true (kräver ENFORCE_SUBSCRIPTION_LIMITS på servern). */
    const metered = enforceSubscriptionLimits() && !isUnmetered;
    /** Visa kvarvarande gratis-kvot i UI även om tak tillfälligt är avstängt på servern. */
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
      usage: {
        chatCount,
        imageCount,
        aiTtsCount,
      },
      metered,
      showFreeQuota,
      limits,
      remaining,
    });
  } catch (error: any) {
    console.error('Billing status error:', error.message);
    res.status(500).json({ error: 'Kunde inte hämta abonnemangsstatus.' });
  }
});

export { router as billingRouter };
