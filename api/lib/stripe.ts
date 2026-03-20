import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('Stripe är inte konfigurerat ännu.');
    _stripe = new Stripe(key);
  }
  return _stripe;
}
