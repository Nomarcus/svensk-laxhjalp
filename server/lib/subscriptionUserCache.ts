/** In-memory cache for users/{uid} subscription fields to cut Firestore reads (per Node process). */
export interface CachedUserSub {
  tier: string;
  subscriptionStatus: string;
  cachedAt: number;
}

const cache = new Map<string, CachedUserSub>();
const TTL_MS = 5 * 60 * 1000;

export function getCachedUserSubscription(uid: string): CachedUserSub | null {
  const row = cache.get(uid);
  if (!row) return null;
  if (Date.now() - row.cachedAt >= TTL_MS) {
    cache.delete(uid);
    return null;
  }
  return row;
}

export function setCachedUserSubscription(uid: string, tier: string, subscriptionStatus: string): void {
  cache.set(uid, { tier, subscriptionStatus, cachedAt: Date.now() });
}
