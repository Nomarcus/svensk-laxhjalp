import { verifyToken, getSupabaseAdmin } from '../../src/lib/supabase-server';
import { checkPlanAccess, getPlanConfig, resetDailyUsageIfNeeded, resetMonthlyCreditsIfNeeded } from '../../src/lib/subscription';
import { getGuestUsageProfile, resetGuestDailyUsageIfNeeded } from '../../src/lib/guest-usage';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let uid: string | null = null;
    const guestId = req.headers['x-guest-user-id'] as string | undefined;
    try {
      const verified = await verifyToken(req.headers.authorization);
      uid = verified.uid;
    } catch {
      if (!guestId) throw new Error('MISSING_AUTH_OR_GUEST');
    }

    if (!uid && guestId) {
      resetGuestDailyUsageIfNeeded(guestId);
      const profile = getGuestUsageProfile(guestId);
      const planAccess = checkPlanAccess(profile);
      const planConfig = getPlanConfig(planAccess.planType);

      return res.json({
        tier: 'free',
        planType: profile.plan_type || 'none',
        status: 'none',
        currentPeriodEnd: profile.billing_period_end || null,
        cancelAtPeriodEnd: false,
        state: planAccess.state,
        trialEndsAt: profile.trial_ends_at || null,
        billingPeriodStart: profile.billing_period_start || null,
        billingPeriodEnd: profile.billing_period_end || null,
        usage: {
          chatCount: profile.daily_ai_questions_used || 0,
          imageCount: profile.daily_image_analyses_used || 0,
          illustrationCount: profile.daily_illustrations_used || 0,
        },
        limits: {
          chatLimit: planConfig.dailyLimits.ai_question,
          imageLimit: planConfig.dailyLimits.image_analysis,
          illustrationLimit: planConfig.dailyLimits.illustration,
        },
        hasCredits: (profile.monthly_credits_remaining || 0) > 0,
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: userData } = await supabase
      .from('users')
      .select(`
        tier, subscription_status, current_period_end, cancel_at_period_end, plan_type,
        trial_ends_at, daily_ai_questions_used, daily_image_analyses_used, daily_illustrations_used, daily_usage_date,
        billing_period_start, billing_period_end, monthly_credits_remaining
      `)
      .eq('id', uid!)
      .single();

    await resetDailyUsageIfNeeded(supabase, uid!, userData?.daily_usage_date);
    await resetMonthlyCreditsIfNeeded(supabase, uid!, userData);

    const { data: refreshed } = await supabase
      .from('users')
      .select(`
        tier, subscription_status, current_period_end, cancel_at_period_end, plan_type,
        trial_ends_at, daily_ai_questions_used, daily_image_analyses_used, daily_illustrations_used, daily_usage_date,
        billing_period_start, billing_period_end, monthly_credits_remaining
      `)
      .eq('id', uid!)
      .single();

    const planAccess = checkPlanAccess(refreshed);
    const planConfig = getPlanConfig(planAccess.planType);

    res.json({
      tier: refreshed?.tier || 'free',
      planType: refreshed?.plan_type || 'none',
      status: refreshed?.subscription_status || 'none',
      currentPeriodEnd: refreshed?.current_period_end || null,
      cancelAtPeriodEnd: refreshed?.cancel_at_period_end || false,
      state: planAccess.state,
      trialEndsAt: refreshed?.trial_ends_at || null,
      billingPeriodStart: refreshed?.billing_period_start || null,
      billingPeriodEnd: refreshed?.billing_period_end || null,
      usage: {
        chatCount: refreshed?.daily_ai_questions_used || 0,
        imageCount: refreshed?.daily_image_analyses_used || 0,
        illustrationCount: refreshed?.daily_illustrations_used || 0,
      },
      limits: {
        chatLimit: planConfig.dailyLimits.ai_question,
        imageLimit: planConfig.dailyLimits.image_analysis,
        illustrationLimit: planConfig.dailyLimits.illustration,
      },
      hasCredits: (refreshed?.monthly_credits_remaining || 0) > 0,
    });
  } catch (error: any) {
    console.error('Status error:', error.message);
    if (error.message === 'MISSING_AUTH_OR_GUEST') {
      return res.status(401).json({ error: 'Ogiltig token. Logga in igen.' });
    }
    res.status(500).json({ error: 'Status misslyckades.' });
  }
}
