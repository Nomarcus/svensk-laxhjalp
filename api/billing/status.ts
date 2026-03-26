import { DAILY_LIMITS, MONTHLY_CREDITS, CREDIT_COSTS } from '../../src/lib/subscription';

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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  const guestId = req.headers['x-guest-user-id'] as string | undefined;

  if (!authHeader?.startsWith('Bearer ') && !guestId) {
    return res.status(401).json({ error: 'Ingen autentisering.' });
  }

  try {
    // Guest user - return from in-memory store
    if (!authHeader?.startsWith('Bearer ') && guestId) {
      const { getGuestUsageProfile } = await import('../../src/lib/guest-usage');
      const profile = getGuestUsageProfile(guestId);
      const planType = profile.plan_type || 'none';
      const limits = DAILY_LIMITS[planType] || DAILY_LIMITS.none;

      return res.json({
        tier: planType === 'trial' ? 'free' : planType,
        status: planType === 'trial' ? 'active' : 'none',
        plan_type: planType,
        trial_ends_at: profile.trial_ends_at || null,
        daily_limits: limits,
        monthly_credits_total: profile.monthly_credits_total || 0,
        monthly_credits_used: profile.monthly_credits_used || 0,
        monthly_credits_remaining: profile.monthly_credits_remaining || 0,
        usage: {
          ai_questions_used: profile.daily_ai_questions_used || 0,
          image_analyses_used: profile.daily_image_analyses_used || 0,
          illustrations_used: profile.daily_illustrations_used || 0,
        },
        credit_costs: CREDIT_COSTS,
        guest: true,
      });
    }

    // Authenticated user
    const admin = await getFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(authHeader!.split('Bearer ')[1]);
    const db = admin.firestore();
    const data = (await db.doc(`users/${decoded.uid}`).get()).data() || {};

    const planType = data.planType || data.plan_type || 'none';
    const limits = DAILY_LIMITS[planType] || DAILY_LIMITS.none;

    // Reset daily usage if needed
    const today = new Date().toISOString().split('T')[0];
    let aiUsed = data.dailyAiQuestionsUsed || 0;
    let imageUsed = data.dailyImageAnalysesUsed || 0;
    let illustrationUsed = data.dailyIllustrationsUsed || 0;

    if (data.dailyUsageDate !== today) {
      aiUsed = 0;
      imageUsed = 0;
      illustrationUsed = 0;
    }

    res.json({
      tier: data.tier || 'free',
      status: data.subscriptionStatus || 'none',
      plan_type: planType,
      trial_ends_at: data.trialEndsAt || null,
      currentPeriodEnd: data.currentPeriodEnd || null,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
      daily_limits: limits,
      monthly_credits_total: data.monthlyCreditsTotal || MONTHLY_CREDITS[planType] || 0,
      monthly_credits_used: data.monthlyCreditsUsed || 0,
      monthly_credits_remaining: data.monthlyCreditsRemaining || 0,
      usage: {
        ai_questions_used: aiUsed,
        image_analyses_used: imageUsed,
        illustrations_used: illustrationUsed,
        chatCount: aiUsed,
        imageCount: imageUsed,
      },
      credit_costs: CREDIT_COSTS,
    });
  } catch (error: any) {
    console.error('Status error:', error.message);
    res.status(500).json({ error: 'Status misslyckades.' });
  }
}
