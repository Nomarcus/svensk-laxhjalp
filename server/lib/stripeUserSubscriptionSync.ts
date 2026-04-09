import type Stripe from 'stripe';

export function subscriptionPeriodEndIso(sub: Stripe.Subscription): string | null {
  const ts = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof ts === 'number' ? new Date(ts * 1000).toISOString() : null;
}

export type FirestoreSubscriptionPatch = {
  tier: 'free' | 'pro';
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
  stripeCustomerId?: string;
};

/** Maps a Stripe subscription object to fields stored on `users/{uid}` (merged with set(..., { merge: true })). */
export function patchFromStripeSubscription(
  sub: Stripe.Subscription,
  opts?: { stripeCustomerId?: string },
): FirestoreSubscriptionPatch {
  const status = sub.status;
  const pro = status === 'active' || status === 'trialing';
  let subscriptionStatus: FirestoreSubscriptionPatch['subscriptionStatus'];
  if (status === 'trialing') subscriptionStatus = 'trialing';
  else if (status === 'active') subscriptionStatus = 'active';
  else if (status === 'past_due' || status === 'unpaid') subscriptionStatus = 'past_due';
  else if (status === 'canceled') subscriptionStatus = 'canceled';
  else subscriptionStatus = 'none';

  const patch: FirestoreSubscriptionPatch = {
    tier: pro ? 'pro' : 'free',
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
