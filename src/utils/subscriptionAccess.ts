import type { UserSubscription } from '../types';

/** In-app and UI: full Pro access (paid period or free trial). */
export function hasPremiumAccess(sub: Pick<UserSubscription, 'tier' | 'status'>): boolean {
  return sub.tier === 'pro' && (sub.status === 'active' || sub.status === 'trialing');
}
