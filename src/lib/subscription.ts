import type { SupabaseClient } from '@supabase/supabase-js';
import { getGuestUsageProfile, resetGuestDailyUsageIfNeeded, saveGuestUsageProfile, setGuestAccessState } from './guest-usage';

export type PlanType = 'trial' | 'plus' | 'pro' | 'none';
export type AccessState = 'trial_active' | 'plus_active' | 'pro_active' | 'expired' | 'blocked_no_credits';
export type UsageAction =
  | 'ai_question'
  | 'image_analysis'
  | 'illustration'
  | 'show_facit'
  | 'fordjupning'
  | 'study_plan'
  | 'create_homework'
  | 'curriculum_link';

export const DAILY_LIMITS: Record<PlanType, { ai_question: number; image_analysis: number; illustration: number }> = {
  trial: { ai_question: 3, image_analysis: 1, illustration: 1 },
  plus: { ai_question: 10, image_analysis: 3, illustration: 1 },
  pro: { ai_question: 30, image_analysis: 10, illustration: 3 },
  none: { ai_question: 0, image_analysis: 0, illustration: 0 },
};

export const MONTHLY_CREDITS: Record<PlanType, number> = {
  trial: 100,
  plus: 400,
  pro: 900,
  none: 0,
};

export const CREDIT_COSTS: Record<UsageAction, number> = {
  ai_question: 1,
  image_analysis: 3,
  illustration: 5,
  show_facit: 2,
  fordjupning: 2,
  study_plan: 3,
  create_homework: 2,
  curriculum_link: 1, // 0 om redan inkluderat i grundsvaret utan extra AI-anrop
};

function dateOnly(now = new Date()) {
  return now.toISOString().split('T')[0];
}

function isPast(isoDate: string | null | undefined, now = new Date()) {
  if (!isoDate) return true;
  return new Date(isoDate).getTime() < now.getTime();
}

function resolvePlanType(profile: any): PlanType {
  if (profile?.plan_type) return profile.plan_type;
  if (profile?.tier === 'plus' || profile?.tier === 'pro') return profile.tier;
  return 'none';
}

function hasPaidAccess(profile: any, now = new Date()) {
  const status = profile?.subscription_status;
  if (status === 'active') return true;
  if (status === 'canceled' && profile?.current_period_end && !isPast(profile.current_period_end, now)) return true;
  return false;
}

function consumesAiQuestionLimit(action: UsageAction) {
  return action !== 'image_analysis' && action !== 'illustration';
}

export function creditCostFor(action: UsageAction): number {
  return CREDIT_COSTS[action] ?? 0;
}

export function detectActionFromPrompt(prompt: string, hasImage: boolean): UsageAction {
  const lower = (prompt || '').toLowerCase();
  if (hasImage) return 'image_analysis';
  if (lower.includes('komplett facit') || lower.includes('facit')) return 'show_facit';
  if (lower.includes('fördjupa') || lower.includes('fördjupning')) return 'fordjupning';
  if (lower.includes('studieplan') || lower.includes('planera') || lower.includes('dagsschema')) return 'study_plan';
  if (lower.includes('skapa') && lower.includes('läxa')) return 'create_homework';
  if (lower.includes('läroplan')) return 'curriculum_link';
  return 'ai_question';
}

export async function resetDailyUsageIfNeeded(supabase: SupabaseClient, uid: string, dailyUsageDate?: string | null) {
  const today = dateOnly();
  if (dailyUsageDate === today) return;

  await supabase
    .from('users')
    .update({
      daily_ai_questions_used: 0,
      daily_image_analyses_used: 0,
      daily_illustrations_used: 0,
      daily_usage_date: today,
    })
    .eq('id', uid);
}

export async function resetMonthlyCreditsIfNeeded(supabase: SupabaseClient, uid: string, profile: any, now = new Date()) {
  const planType: PlanType = resolvePlanType(profile);
  if (planType !== 'plus' && planType !== 'pro') return;

  const periodEnd = profile?.billing_period_end ? new Date(profile.billing_period_end) : null;
  if (periodEnd && periodEnd.getTime() > now.getTime()) return;

  const periodStart = now.toISOString();
  const next = new Date(now);
  next.setMonth(next.getMonth() + 1);

  const total = MONTHLY_CREDITS[planType];

  await supabase
    .from('users')
    .update({
      billing_period_start: periodStart,
      billing_period_end: next.toISOString(),
      monthly_credits_total: total,
      monthly_credits_used: 0,
      monthly_credits_remaining: total,
    })
    .eq('id', uid);
}

export function checkPlanAccess(profile: any, now = new Date()): { ok: boolean; state: AccessState; message?: string; planType: PlanType } {
  const planType: PlanType = resolvePlanType(profile);

  if (planType === 'trial') {
    if (!profile?.trial_ends_at || isPast(profile.trial_ends_at, now)) {
      return {
        ok: false,
        state: 'expired',
        planType,
        message: 'Din gratisperiod är slut. Välj Plus eller Pro för att fortsätta använda tjänsten.',
      };
    }
    return { ok: true, state: 'trial_active', planType };
  }

  if (planType === 'plus') {
    if (!hasPaidAccess(profile, now)) {
      return {
        ok: false,
        state: 'expired',
        planType,
        message: 'Din gratisperiod är slut. Välj Plus eller Pro för att fortsätta använda tjänsten.',
      };
    }
    return { ok: true, state: 'plus_active', planType };
  }

  if (planType === 'pro') {
    if (!hasPaidAccess(profile, now)) {
      return {
        ok: false,
        state: 'expired',
        planType,
        message: 'Din gratisperiod är slut. Välj Plus eller Pro för att fortsätta använda tjänsten.',
      };
    }
    return { ok: true, state: 'pro_active', planType };
  }

  return {
    ok: false,
    state: 'expired',
    planType: 'none',
    message: 'Din gratisperiod är slut. Välj Plus eller Pro för att fortsätta använda tjänsten.',
  };
}

export function checkDailyLimit(profile: any, action: UsageAction, planType: PlanType): { ok: boolean; message?: string } {
  const daily = DAILY_LIMITS[planType] || DAILY_LIMITS.none;

  const aiUsed = profile?.daily_ai_questions_used || 0;
  const imageUsed = profile?.daily_image_analyses_used || 0;
  const illustrationUsed = profile?.daily_illustrations_used || 0;

  if (consumesAiQuestionLimit(action) && aiUsed >= daily.ai_question) {
    return { ok: false, message: 'Du har nått dagens gräns för denna funktion. Försök igen imorgon eller uppgradera din plan.' };
  }
  if (action === 'image_analysis' && imageUsed >= daily.image_analysis) {
    return { ok: false, message: 'Du har nått dagens gräns för denna funktion. Försök igen imorgon eller uppgradera din plan.' };
  }
  if (action === 'illustration' && illustrationUsed >= daily.illustration) {
    return { ok: false, message: 'Du har nått dagens gräns för denna funktion. Försök igen imorgon eller uppgradera din plan.' };
  }

  return { ok: true };
}

export function checkCredits(profile: any, action: UsageAction): { ok: boolean; state?: AccessState; message?: string; cost: number } {
  const cost = creditCostFor(action);
  const remaining = Number(profile?.monthly_credits_remaining ?? profile?.monthly_credits_total ?? 0);

  if (remaining < cost) {
    return {
      ok: false,
      state: 'blocked_no_credits',
      message: 'Din användning för denna period är slut. Uppgradera eller vänta till nästa period.',
      cost,
    };
  }

  return { ok: true, cost };
}

export async function deductCredits(supabase: SupabaseClient, uid: string, action: UsageAction) {
  const cost = creditCostFor(action);

  const { data: profile } = await supabase
    .from('users')
    .select('monthly_credits_used, monthly_credits_remaining, daily_ai_questions_used, daily_image_analyses_used, daily_illustrations_used')
    .eq('id', uid)
    .single();

  const updates: Record<string, any> = {
    monthly_credits_used: Number(profile?.monthly_credits_used || 0) + cost,
    monthly_credits_remaining: Math.max(0, Number(profile?.monthly_credits_remaining || 0) - cost),
  };

  if (consumesAiQuestionLimit(action)) updates.daily_ai_questions_used = Number(profile?.daily_ai_questions_used || 0) + 1;
  if (action === 'image_analysis') updates.daily_image_analyses_used = Number(profile?.daily_image_analyses_used || 0) + 1;
  if (action === 'illustration') updates.daily_illustrations_used = Number(profile?.daily_illustrations_used || 0) + 1;

  await supabase.from('users').update(updates).eq('id', uid);
}

export async function enforceUsageAccess(supabase: SupabaseClient, uid: string, action: UsageAction) {
  const { data: profile } = await supabase
    .from('users')
    .select(`
      id, tier, subscription_status, current_period_end, cancel_at_period_end, plan_type,
      trial_started_at, trial_ends_at,
      billing_period_start, billing_period_end,
      monthly_credits_total, monthly_credits_used, monthly_credits_remaining,
      daily_ai_questions_used, daily_image_analyses_used, daily_illustrations_used, daily_usage_date
    `)
    .eq('id', uid)
    .single();

  if (!profile) {
    return { ok: false, status: 403, error: 'Konto hittades inte.' };
  }

  await resetDailyUsageIfNeeded(supabase, uid, profile.daily_usage_date);
  await resetMonthlyCreditsIfNeeded(supabase, uid, profile);

  const { data: refreshed } = await supabase
    .from('users')
    .select(`
      id, tier, subscription_status, current_period_end, cancel_at_period_end, plan_type,
      trial_started_at, trial_ends_at,
      billing_period_start, billing_period_end,
      monthly_credits_total, monthly_credits_used, monthly_credits_remaining,
      daily_ai_questions_used, daily_image_analyses_used, daily_illustrations_used, daily_usage_date
    `)
    .eq('id', uid)
    .single();

  const plan = checkPlanAccess(refreshed);
  if (!plan.ok) return { ok: false, status: 403, state: plan.state, error: plan.message };

  const daily = checkDailyLimit(refreshed, action, plan.planType);
  if (!daily.ok) return { ok: false, status: 429, error: daily.message };

  const credits = checkCredits(refreshed, action);
  if (!credits.ok) return { ok: false, status: 429, state: credits.state, error: credits.message };

  return { ok: true, profile: refreshed, planType: plan.planType };
}

export function startGuestTrial(guestId: string, now = new Date()) {
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);

  const profile = getGuestUsageProfile(guestId);
  if (profile.trial_started_at || profile.plan_type === 'trial') {
    return { ok: false, error: 'Gratisperioden har redan använts.' };
  }

  const startedAt = now.toISOString();
  const endsAt = trialEnd.toISOString();
  const total = MONTHLY_CREDITS.trial;

  saveGuestUsageProfile(guestId, {
    ...profile,
    plan_type: 'trial',
    trial_started_at: startedAt,
    trial_ends_at: endsAt,
    monthly_credits_total: total,
    monthly_credits_used: 0,
    monthly_credits_remaining: total,
    daily_ai_questions_used: 0,
    daily_image_analyses_used: 0,
    daily_illustrations_used: 0,
    daily_usage_date: dateOnly(now),
    state: 'trial_active',
  });

  return { ok: true, trial_ends_at: endsAt };
}

export function enforceGuestUsageAccess(guestId: string, action: UsageAction) {
  const profile = resetGuestDailyUsageIfNeeded(guestId);
  const plan = checkPlanAccess(profile);
  if (!plan.ok) {
    setGuestAccessState(guestId, plan.state);
    return { ok: false, status: 403, state: plan.state, error: plan.message };
  }

  const daily = checkDailyLimit(profile, action, plan.planType);
  if (!daily.ok) return { ok: false, status: 429, error: daily.message };

  const credits = checkCredits(profile, action);
  if (!credits.ok) {
    setGuestAccessState(guestId, 'blocked_no_credits');
    return { ok: false, status: 429, state: 'blocked_no_credits' as AccessState, error: credits.message };
  }

  setGuestAccessState(guestId, plan.state);
  return { ok: true, planType: plan.planType, profile };
}

export function deductGuestCredits(guestId: string, action: UsageAction) {
  const profile = getGuestUsageProfile(guestId);
  const cost = creditCostFor(action);
  profile.monthly_credits_used = Number(profile.monthly_credits_used || 0) + cost;
  profile.monthly_credits_remaining = Math.max(0, Number(profile.monthly_credits_remaining || 0) - cost);

  if (consumesAiQuestionLimit(action)) profile.daily_ai_questions_used = Number(profile.daily_ai_questions_used || 0) + 1;
  if (action === 'image_analysis') profile.daily_image_analyses_used = Number(profile.daily_image_analyses_used || 0) + 1;
  if (action === 'illustration') profile.daily_illustrations_used = Number(profile.daily_illustrations_used || 0) + 1;

  saveGuestUsageProfile(guestId, profile);
}

export function getPlanConfig(planType: PlanType) {
  return {
    planType,
    dailyLimits: DAILY_LIMITS[planType],
    monthlyCredits: MONTHLY_CREDITS[planType],
  };
}
