/** Sätt `ENFORCE_SUBSCRIPTION_LIMITS=true` på Cloud Run när abonnemang/gratis-tak ska gälla igen. */
export function enforceSubscriptionLimits(): boolean {
  return process.env.ENFORCE_SUBSCRIPTION_LIMITS === 'true';
}
