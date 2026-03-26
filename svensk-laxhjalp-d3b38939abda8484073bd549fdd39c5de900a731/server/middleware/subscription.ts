import { Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { AuthenticatedRequest } from './auth';

export interface SubscriptionRequest extends AuthenticatedRequest {
  tier?: string;
  dailyChatCount?: number;
  dailyImageCount?: number;
  dailyIllustrationCount?: number;
}

const LIMITS: Record<string, Record<string, number>> = {
  trial: { chat: 3, imageAnalysis: 1, illustration: 1 },
  plus:  { chat: 10, imageAnalysis: 3, illustration: 1 },
  pro:   { chat: 30, imageAnalysis: 10, illustration: 3 },
};

const CREDITS: Record<string, number> = {
  chat: 1,
  imageAnalysis: 3,
  illustration: 5,
};

const MONTHLY_CREDITS: Record<string, number> = {
  trial: 100,
  plus: 400,
  pro: 900,
};

function resolveEffectiveTier(userData: Record<string, any>): string | null {
  const tier: string = userData.tier || 'none';
  const status: string = userData.subscriptionStatus || 'none';

  if (tier === 'none' || tier === 'free') return null;

  if (tier === 'trial') {
    const endsAt = userData.trialEndsAt;
    if (!endsAt) return null;
    const endsAtDate = endsAt.toDate ? endsAt.toDate() : new Date(endsAt);
    return endsAtDate >= new Date() ? 'trial' : null;
  }

  if ((tier === 'plus' || tier === 'pro') && (status === 'active' || status === 'canceled')) {
    if (status === 'canceled') {
      const periodEnd = userData.currentPeriodEnd;
      if (periodEnd) {
        const endDate = periodEnd.toDate ? periodEnd.toDate() : new Date(periodEnd);
        if (endDate < new Date()) return null;
      }
    }
    return tier;
  }

  return null;
}

export async function subscriptionMiddleware(
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.path.startsWith('/billing') || req.path === '/health') {
    next();
    return;
  }

  if (!req.uid) {
    res.status(401).json({ error: 'Inte autentiserad.' });
    return;
  }

  try {
    const db = admin.firestore();
    const userDoc = await db.doc(`users/${req.uid}`).get();
    const userData = userDoc.data() || {};
    const effectiveTier = resolveEffectiveTier(userData);

    if (!effectiveTier) {
      const tier = userData.tier || 'none';
      const isExpiredTrial = tier === 'trial';
      res.status(403).json({
        error: isExpiredTrial
          ? 'Din gratisperiod är slut. Välj Plus eller Pro för att fortsätta använda tjänsten.'
          : 'Ingen aktiv plan. Välj en plan för att använda AI-funktionerna.',
        upgradeRequired: true,
      });
      return;
    }

    req.tier = effectiveTier;
    const limits = LIMITS[effectiveTier];

    // Determine action type
    let actionType: string;
    if (req.path === '/image') {
      actionType = 'illustration';
    } else if (req.path === '/chat' && req.body?.imageBase64) {
      actionType = 'imageAnalysis';
    } else if (req.path === '/chat') {
      actionType = 'chat';
    } else {
      next();
      return;
    }

    // Check credits
    const creditsTotal: number = userData.monthlyCreditsTotal ?? MONTHLY_CREDITS[effectiveTier];
    const creditsUsed: number = userData.monthlyCreditsUsed ?? 0;
    const creditCost = CREDITS[actionType];
    if ((creditsTotal - creditsUsed) < creditCost) {
      res.status(402).json({
        error: 'Din användning för denna period är slut. Uppgradera eller vänta till nästa period.',
        upgradeRequired: true,
      });
      return;
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const usageRef = db.doc(`users/${req.uid}/usage/${today}`);
    const usageDoc = await usageRef.get();
    const usage = usageDoc.data() || {};

    const dailyField = actionType === 'chat' ? 'chatCount' : actionType === 'imageAnalysis' ? 'imageCount' : 'illustrationCount';
    const dailyUsed: number = usage[dailyField] ?? 0;
    const dailyLimit = limits[actionType];

    if (dailyUsed >= dailyLimit) {
      res.status(429).json({
        error: `Du har nått dagens gräns för denna funktion (${dailyLimit}/dag). Försök igen imorgon eller uppgradera din plan.`,
        upgradeRequired: true,
        limit: dailyLimit,
        used: dailyUsed,
      });
      return;
    }

    // Deduct credits and increment daily counter
    await Promise.all([
      usageRef.set(
        { [dailyField]: admin.firestore.FieldValue.increment(1), lastUpdated: new Date().toISOString() },
        { merge: true }
      ),
      db.doc(`users/${req.uid}`).update({
        monthlyCreditsUsed: admin.firestore.FieldValue.increment(creditCost),
        monthlyCreditsTotal: creditsTotal,
      }),
    ]);

    next();
  } catch (error: any) {
    console.error('Subscription middleware error:', error.message);
    next();
  }
}
