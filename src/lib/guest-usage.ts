import type { AccessState, PlanType } from './subscription';

export interface GuestUsageProfile {
  id: string;
  plan_type: PlanType;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  monthly_credits_total: number;
  monthly_credits_used: number;
  monthly_credits_remaining: number;
  daily_ai_questions_used: number;
  daily_image_analyses_used: number;
  daily_illustrations_used: number;
  daily_usage_date: string;
  state: AccessState;
}

const guestUsageStore = new Map<string, GuestUsageProfile>();

function todayIso(now = new Date()) {
  return now.toISOString().split('T')[0];
}

export function getGuestUsageProfile(guestId: string): GuestUsageProfile {
  const existing = guestUsageStore.get(guestId);
  if (existing) return existing;

  const profile: GuestUsageProfile = {
    id: guestId,
    plan_type: 'none',
    trial_started_at: null,
    trial_ends_at: null,
    billing_period_start: null,
    billing_period_end: null,
    monthly_credits_total: 0,
    monthly_credits_used: 0,
    monthly_credits_remaining: 0,
    daily_ai_questions_used: 0,
    daily_image_analyses_used: 0,
    daily_illustrations_used: 0,
    daily_usage_date: todayIso(),
    state: 'expired',
  };

  guestUsageStore.set(guestId, profile);
  return profile;
}

export function saveGuestUsageProfile(guestId: string, profile: GuestUsageProfile) {
  guestUsageStore.set(guestId, profile);
}

export function setGuestAccessState(guestId: string, state: AccessState) {
  const profile = getGuestUsageProfile(guestId);
  profile.state = state;
  saveGuestUsageProfile(guestId, profile);
}

export function resetGuestDailyUsageIfNeeded(guestId: string, now = new Date()) {
  const profile = getGuestUsageProfile(guestId);
  const today = todayIso(now);
  if (profile.daily_usage_date === today) return profile;

  profile.daily_ai_questions_used = 0;
  profile.daily_image_analyses_used = 0;
  profile.daily_illustrations_used = 0;
  profile.daily_usage_date = today;
  saveGuestUsageProfile(guestId, profile);
  return profile;
}
