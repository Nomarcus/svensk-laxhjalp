import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { getServerFirestore } from '../lib/serverFirestore';
import { enforceSubscriptionLimits } from '../subscriptionEnv';
import { getCachedUserSubscription, setCachedUserSubscription } from '../lib/subscriptionUserCache';
import { FREE_CHAT_LIMIT, FREE_IMAGE_LIMIT, isUnmeteredSubscription } from '../lib/freeTierLimits';
import { reserveDailyUsage } from '../lib/dailyUsageQuota';

export interface SubscriptionRequest extends AuthenticatedRequest {
  tier?: 'free' | 'pro';
}

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
      await reserveDailyUsage(getServerFirestore(), usageRef, field, null);
    };

    if (!enforceSubscriptionLimits()) {
      await recordChatUsage();
      next();
      return;
    }

    if (isUnmeteredSubscription(tier, subscriptionStatus)) {
      next();
      return;
    }
    if (req.path === '/image') {
      res.status(403).json({
        error:
          'AI-illustrationer ingår i abonnemanget (49 kr/mån). Som gratis användare kan du fortfarande analysera läxfoton i chatten inom dagens kvot.',
        upgradeRequired: true,
      });
      return;
    }

    const chatHasImage =
      Boolean(req.body?.imageBase64)
      || (Array.isArray(req.body?.imageBase64s) && req.body.imageBase64s.length > 0);

    if (req.path === '/chat' && chatHasImage) {
      const reservation = await reserveDailyUsage(
        getServerFirestore(), usageRef, 'imageCount', FREE_IMAGE_LIMIT,
      );
      if (!reservation.allowed) {
        res.status(403).json({
          error: `Du har använt dagens gratis bildanalyser (${FREE_IMAGE_LIMIT}/dag). Med abonnemang (49 kr/mån) får du obegränsat.`,
          upgradeRequired: true,
          limit: FREE_IMAGE_LIMIT,
          used: reservation.previousCount,
        });
        return;
      }
      next();
      return;
    }

    if (req.path === '/chat') {
      const reservation = await reserveDailyUsage(
        getServerFirestore(), usageRef, 'chatCount', FREE_CHAT_LIMIT,
      );
      if (!reservation.allowed) {
        res.status(429).json({
          error: `Du har använt dagens ${FREE_CHAT_LIMIT} gratis AI-svar. Imorgon nollställs kvoten — eller välj abonnemang (49 kr/mån) för obegränsat.`,
          upgradeRequired: true,
          limit: FREE_CHAT_LIMIT,
          used: reservation.previousCount,
        });
        return;
      }
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
