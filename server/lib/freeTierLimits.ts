/** Gratisnivå — samma siffror som i subscription-middleware och TTS. */
export const FREE_CHAT_LIMIT = 5;
export const FREE_IMAGE_LIMIT = 2;
/**
 * Höjt från 1 → 20/dag: med Standard-röst kostar varje anrop ~$0.004 (max 880 tecken),
 * så 20 anrop/dag ≈ $0.08/dag max per gratisanvändare. Google ger första 4 M tecken/mån gratis.
 */
export const FREE_AI_TTS_PER_DAY = 20;

export function isUnmeteredSubscription(
  tier: string | undefined,
  subscriptionStatus: string | undefined,
): boolean {
  const t = tier || 'free';
  const s = subscriptionStatus || 'none';
  const paid = t === 'pro' || t === 'plus';
  return paid && (s === 'active' || s === 'trialing' || s === 'canceled');
}

