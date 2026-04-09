// Enabled by default for operator testing. Can still be disabled explicitly via env.
export const STRIPE_BUY_BUTTON_ENABLED = import.meta.env.VITE_ENABLE_STRIPE_BUY_BUTTON !== 'false';

/** Standardlänk tills motsvarande Payment Link sätts via env (produkt i Stripe ska vara 49 kr/mån). */
const DEFAULT_SUBSCRIBE_PAYMENT_LINK = 'https://buy.stripe.com/bJe28kb9Y13F1xt6wJ8bS01';

/**
 * En gemensam månadsprenumeration (49 kr). Första icke-tomma: VITE_STRIPE_PAYMENT_LINK,
 * sedan PLUS/PREMIUM-variabler (bakåtkompat), sedan default ovan.
 */
export const STRIPE_PAYMENT_LINK_SUBSCRIBE =
  import.meta.env.VITE_STRIPE_PAYMENT_LINK?.trim() ||
  import.meta.env.VITE_STRIPE_PAYMENT_LINK_PLUS?.trim() ||
  import.meta.env.VITE_STRIPE_PAYMENT_LINK_PREMIUM?.trim() ||
  DEFAULT_SUBSCRIBE_PAYMENT_LINK;

// Owner-provided defaults; can be overridden via VITE_* env vars (om du fortfarande använder inbäddad knapp någonstans).
const DEFAULT_BUY_BUTTON_ID = 'buy_btn_1TKNE64oQsUeST1NUUUDVkWL';
const DEFAULT_PUBLISHABLE_KEY = 'pk_live_51TKMlH4oQsUeST1NP1i8kZ5hvVCT1s5QqPnA7QMBaAo4fzn3pQLoJeQAvEl4pj2zphioL0G8FU4ULtvXmwdoxIa800PILjG8jf';

export const STRIPE_BUY_BUTTON_ID = import.meta.env.VITE_STRIPE_BUY_BUTTON_ID?.trim() || DEFAULT_BUY_BUTTON_ID;
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() || DEFAULT_PUBLISHABLE_KEY;
export const STRIPE_TRIAL_DAYS = Number(import.meta.env.VITE_STRIPE_TRIAL_DAYS || 10) || 10;

export const STRIPE_BUY_BUTTON_READY =
  STRIPE_BUY_BUTTON_ENABLED &&
  STRIPE_BUY_BUTTON_ID.length > 0 &&
  STRIPE_PUBLISHABLE_KEY.length > 0;

/** Betalningslänk krävs för att visa checkout. */
export const STRIPE_PAYMENT_LINKS_READY =
  STRIPE_BUY_BUTTON_ENABLED && STRIPE_PAYMENT_LINK_SUBSCRIBE.length > 0;

export function buildStripePaymentLinkUrl(baseUrl: string, uid: string, email: string): string {
  const u = new URL(baseUrl);
  u.searchParams.set('client_reference_id', uid);
  u.searchParams.set('prefilled_email', email);
  return u.toString();
}
