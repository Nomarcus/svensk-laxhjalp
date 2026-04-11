import type Stripe from 'stripe';

export function subscriptionPeriodEndIso(sub: Stripe.Subscription): string | null {
  const ts = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof ts === 'number' ? new Date(ts * 1000).toISOString() : null;
}

export type FirestoreSubscriptionPatch = {
  tier: 'free' | 'plus' | 'pro';
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
  stripeCustomerId?: string;
};

/** En betalplan (49 kr/mån): all aktiv eller provande prenumeration blir `plus`. Äldre `pro` i Firestore behandlas fortfarande som betalande i middleware. */
function paidTierFromSubscription(sub: Stripe.Subscription): 'free' | 'plus' | 'pro' {
  const status = sub.status;
  const paid = status === 'active' || status === 'trialing';
  if (!paid) return 'free';
  return 'plus';
}

/** Maps a Stripe subscription object to fields stored on `users/{uid}` (merged with set(..., { merge: true })). */
export function patchFromStripeSubscription(
  sub: Stripe.Subscription,
  opts?: { stripeCustomerId?: string },
): FirestoreSubscriptionPatch {
  const status = sub.status;
  let subscriptionStatus: FirestoreSubscriptionPatch['subscriptionStatus'];
  if (status === 'trialing') subscriptionStatus = 'trialing';
  else if (status === 'active') subscriptionStatus = 'active';
  else if (status === 'past_due' || status === 'unpaid') subscriptionStatus = 'past_due';
  else if (status === 'canceled') subscriptionStatus = 'canceled';
  else subscriptionStatus = 'none';

  const patch: FirestoreSubscriptionPatch = {
    tier: paidTierFromSubscription(sub),
    subscriptionStatus,
    currentPeriodEnd: subscriptionPeriodEndIso(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    stripeSubscriptionId: sub.id,
  };
  if (opts?.stripeCustomerId) {
    patch.stripeCustomerId = opts.stripeCustomerId;
  }
  return patch;
}
