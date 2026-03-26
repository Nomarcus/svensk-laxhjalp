import admin from 'firebase-admin';

export type ActionType = 'chat' | 'imageAnalysis' | 'illustration';

const LIMITS: Record<string, Record<ActionType, number>> = {
  trial: { chat: 3, imageAnalysis: 1, illustration: 1 },
  plus:  { chat: 10, imageAnalysis: 3, illustration: 1 },
  pro:   { chat: 30, imageAnalysis: 10, illustration: 3 },
};

const CREDITS: Record<ActionType, number> = {
  chat: 1,
  imageAnalysis: 3,
  illustration: 5,
};

const MONTHLY_CREDITS: Record<string, number> = {
  trial: 100,
  plus: 400,
  pro: 900,
};

const DAILY_FIELD: Record<ActionType, string> = {
  chat: 'chatCount',
  imageAnalysis: 'imageCount',
  illustration: 'illustrationCount',
};

export interface CheckResult {
  allowed: boolean;
  statusCode: number;
  error: string;
}

function resolveEffectiveTier(userData: Record<string, any>): {
  tier: string | null;
  blocked: boolean;
  reason: string;
} {
  const tier: string = userData.tier || 'none';
  const status: string = userData.subscriptionStatus || 'none';

  // No plan
  if (tier === 'none' || tier === 'free') {
    return { tier: null, blocked: true, reason: 'no_plan' };
  }

  // Trial — check expiry
  if (tier === 'trial') {
    const endsAt = userData.trialEndsAt;
    if (!endsAt) return { tier: null, blocked: true, reason: 'no_plan' };
    const endsAtDate = endsAt.toDate ? endsAt.toDate() : new Date(endsAt);
    if (endsAtDate < new Date()) {
      return { tier: null, blocked: true, reason: 'trial_expired' };
    }
    return { tier: 'trial', blocked: false, reason: '' };
  }

  // Plus / Pro — must be active or canceled-but-within-period
  if (tier === 'plus' || tier === 'pro') {
    if (status === 'active' || status === 'canceled') {
      // For canceled: check currentPeriodEnd
      if (status === 'canceled') {
        const periodEnd = userData.currentPeriodEnd;
        if (periodEnd) {
          const endDate = periodEnd.toDate ? periodEnd.toDate() : new Date(periodEnd);
          if (endDate < new Date()) {
            return { tier: null, blocked: true, reason: 'subscription_ended' };
          }
        }
      }
      return { tier, blocked: false, reason: '' };
    }
    if (status === 'past_due') {
      return { tier: null, blocked: true, reason: 'payment_failed' };
    }
    return { tier: null, blocked: true, reason: 'no_plan' };
  }

  return { tier: null, blocked: true, reason: 'no_plan' };
}

function blockedError(reason: string): CheckResult {
  if (reason === 'trial_expired') {
    return {
      allowed: false,
      statusCode: 403,
      error: 'Din gratisperiod är slut. Välj Plus eller Pro för att fortsätta använda tjänsten.',
    };
  }
  if (reason === 'payment_failed') {
    return {
      allowed: false,
      statusCode: 402,
      error: 'Din betalning misslyckades. Uppdatera din betalningsmetod för att fortsätta.',
    };
  }
  return {
    allowed: false,
    statusCode: 403,
    error: 'Ingen aktiv plan. Välj en plan för att använda AI-funktionerna.',
  };
}

export async function checkSubscription(uid: string, actionType: ActionType): Promise<CheckResult> {
  const db = admin.firestore();

  // Read user doc
  const userDoc = await db.doc(`users/${uid}`).get();
  const userData = userDoc.data() || {};

  // Resolve tier
  const { tier, blocked, reason } = resolveEffectiveTier(userData);
  if (blocked || !tier) return blockedError(reason);

  const limits = LIMITS[tier];
  const creditCost = CREDITS[actionType];
  const dailyField = DAILY_FIELD[actionType];

  // Check credits
  const creditsTotal: number = userData.monthlyCreditsTotal ?? MONTHLY_CREDITS[tier];
  const creditsUsed: number = userData.monthlyCreditsUsed ?? 0;
  const creditsRemaining = creditsTotal - creditsUsed;

  if (creditsRemaining < creditCost) {
    return {
      allowed: false,
      statusCode: 402,
      error: 'Din användning för denna period är slut. Uppgradera eller vänta till nästa period.',
    };
  }

  // Check daily limit
  const today = new Date().toISOString().split('T')[0];
  const usageRef = db.doc(`users/${uid}/usage/${today}`);
  const usageDoc = await usageRef.get();
  const usage = usageDoc.data() || {};
  const dailyUsed: number = usage[dailyField] ?? 0;
  const dailyLimit = limits[actionType];

  if (dailyUsed >= dailyLimit) {
    return {
      allowed: false,
      statusCode: 429,
      error: `Du har nått dagens gräns för denna funktion (${dailyLimit}/dag). Försök igen imorgon eller uppgradera din plan.`,
    };
  }

  // Deduct credits and increment daily counter
  await Promise.all([
    usageRef.set(
      {
        [dailyField]: admin.firestore.FieldValue.increment(1),
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    ),
    db.doc(`users/${uid}`).update({
      monthlyCreditsUsed: admin.firestore.FieldValue.increment(creditCost),
      monthlyCreditsTotal: creditsTotal, // ensure field exists
    }),
  ]);

  return { allowed: true, statusCode: 200, error: '' };
}
