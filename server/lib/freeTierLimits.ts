/** Gratisnivå — samma siffror som i subscription-middleware och TTS. */
export const FREE_CHAT_LIMIT = 5;
export const FREE_IMAGE_LIMIT = 2;
export const FREE_AI_TTS_PER_DAY = 1;

export function isUnmeteredSubscription(
  tier: string | undefined,
  subscriptionStatus: string | undefined,
): boolean {
  const t = tier || 'free';
  const s = subscriptionStatus || 'none';
  const paid = t === 'pro' || t === 'plus';
  return paid && (s === 'active' || s === 'trialing' || s === 'canceled');
}

