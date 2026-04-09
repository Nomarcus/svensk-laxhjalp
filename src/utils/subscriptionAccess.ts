import type { UserSubscription } from '../types';

/** Aktiv Plus- eller Premium-prenumeration (samma apptillgång). */
export function hasPaidPlanAccess(sub: Pick<UserSubscription, 'tier' | 'status'>): boolean {
  const paid = sub.tier === 'pro' || sub.tier === 'plus';
  return paid && (sub.status === 'active' || sub.status === 'trialing');
}

/** @deprecated Använd hasPaidPlanAccess; alias kvar för bakåtkompabilitet. */
export function hasPremiumAccess(sub: Pick<UserSubscription, 'tier' | 'status'>): boolean {
  return hasPaidPlanAccess(sub);
}
