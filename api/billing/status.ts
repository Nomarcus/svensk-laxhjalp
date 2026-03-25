import { verifyToken, getSupabaseAdmin } from '../../src/lib/supabase-server';
import { checkPlanAccess, getPlanConfig, resetDailyUsageIfNeeded, resetMonthlyCreditsIfNeeded } from '../../src/lib/subscription';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { uid } = await verifyToken(req.headers.authorization);
    const supabase = getSupabaseAdmin();

    const { data: userData } = await supabase
      .from('users')
      .select(`
        tier, subscription_status, current_period_end, cancel_at_period_end, plan_type,
        trial_ends_at, daily_ai_questions_used, daily_image_analyses_used, daily_illustrations_used, daily_usage_date,
        billing_period_start, billing_period_end, monthly_credits_remaining
      `)
      .eq('id', uid)
      .single();

    await resetDailyUsageIfNeeded(supabase, uid, userData?.daily_usage_date);
    await resetMonthlyCreditsIfNeeded(supabase, uid, userData);

    const { data: refreshed } = await supabase
      .from('users')
      .select(`
        tier, subscription_status, current_period_end, cancel_at_period_end, plan_type,
        trial_ends_at, daily_ai_questions_used, daily_image_analyses_used, daily_illustrations_used, daily_usage_date,
        billing_period_start, billing_period_end, monthly_credits_remaining
      `)
      .eq('id', uid)
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
    res.status(500).json({ error: 'Status misslyckades.' });
  }
}
