import { Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { AuthenticatedRequest } from './auth';
import { getServerFirestore } from '../lib/serverFirestore';
import { enforceSubscriptionLimits } from '../subscriptionEnv';
import { getCachedUserSubscription, setCachedUserSubscription } from '../lib/subscriptionUserCache';

export interface SubscriptionRequest extends AuthenticatedRequest {
  tier?: 'free' | 'pro';
  dailyChatCount?: number;
  dailyImageCount?: number;
}

const FREE_CHAT_LIMIT = 3;
const FREE_IMAGE_LIMIT = 1;

export async function subscriptionMiddleware(
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (
    req.path.startsWith('/billing')
    || req.path.startsWith('/admin')
    || req.path === '/health'
  ) {
    next();
    return;
  }

  if (!req.uid) {
    res.status(401).json({ error: 'Inte autentiserad.' });
    return;
  }

  try {
    let tier: string;
    let subscriptionStatus: string;
    const cached = getCachedUserSubscription(req.uid);
    if (cached) {
      tier = cached.tier;
      subscriptionStatus = cached.subscriptionStatus;
    } else {
      const userDoc = await getServerFirestore().doc(`users/${req.uid}`).get();
      const userData = userDoc.data() || {};
      tier = userData.tier || 'free';
      subscriptionStatus = userData.subscriptionStatus || 'none';
      setCachedUserSubscription(req.uid, tier, subscriptionStatus);
    }

    req.tier = tier as 'free' | 'pro';

    const today = new Date().toISOString().split('T')[0];
    const usageRef = getServerFirestore().doc(`users/${req.uid}/usage/${today}`);

    const recordChatUsage = async (): Promise<void> => {
      if (req.path !== '/chat') return;
      const chatHasImage =
        Boolean(req.body?.imageBase64)
        || (Array.isArray(req.body?.imageBase64s) && req.body.imageBase64s.length > 0);
      const field = chatHasImage ? 'imageCount' : 'chatCount';
      await usageRef.set(
        {
          [field]: admin.firestore.FieldValue.increment(1),
          lastUpdated: new Date().toISOString(),
        },
        { merge: true },
      );
    };

    if (!enforceSubscriptionLimits()) {
      await recordChatUsage();
      next();
      return;
    }

    if (
      (tier === 'pro' || tier === 'plus')
      && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing' || subscriptionStatus === 'canceled')
    ) {
      next();
      return;
    }
    const usageDoc = await usageRef.get();
    const usage = usageDoc.data() || { chatCount: 0, imageCount: 0 };

    const chatCount = usage.chatCount || 0;
    const imageCount = usage.imageCount || 0;

    req.dailyChatCount = chatCount;
    req.dailyImageCount = imageCount;

    if (req.path === '/image') {
      res.status(403).json({
        error: 'Bildgenerering kräver Pro-abonnemang. Uppgradera för att skapa illustrationer.',
        upgradeRequired: true,
      });
      return;
    }

    const chatHasImage =
      Boolean(req.body?.imageBase64)
      || (Array.isArray(req.body?.imageBase64s) && req.body.imageBase64s.length > 0);

    if (req.path === '/chat' && chatHasImage) {
      if (imageCount >= FREE_IMAGE_LIMIT) {
        res.status(403).json({
          error: `Du har använt din gratis bildanalys idag (${FREE_IMAGE_LIMIT}/dag). Uppgradera till Pro för obegränsade bildanalyser.`,
          upgradeRequired: true,
          limit: FREE_IMAGE_LIMIT,
          used: imageCount,
        });
        return;
      }
      await usageRef.set(
        { imageCount: admin.firestore.FieldValue.increment(1), lastUpdated: new Date().toISOString() },
        { merge: true },
      );
      next();
      return;
    }

    if (req.path === '/chat') {
      if (chatCount >= FREE_CHAT_LIMIT) {
        res.status(429).json({
          error: `Du har använt dina ${FREE_CHAT_LIMIT} gratis frågor idag. Uppgradera till Pro för obegränsade frågor.`,
          upgradeRequired: true,
          limit: FREE_CHAT_LIMIT,
          used: chatCount,
        });
        return;
      }
      await usageRef.set(
        { chatCount: admin.firestore.FieldValue.increment(1), lastUpdated: new Date().toISOString() },
        { merge: true },
      );
      next();
      return;
    }

    next();
  } catch (error: unknown) {
    console.error(
      'Subscription middleware error:',
      error instanceof Error ? error.message : String(error),
    );
    res.status(503).json({
      error: 'Kunde inte verifiera abonnemang just nu. Försök igen om en stund.',
      code: 'subscription_check_failed',
    });
  }
}
