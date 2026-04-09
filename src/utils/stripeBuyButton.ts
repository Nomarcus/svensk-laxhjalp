export const STRIPE_BUY_BUTTON_ENABLED = import.meta.env.VITE_ENABLE_STRIPE_BUY_BUTTON === 'true';
// Owner-provided defaults; can be overridden via VITE_* env vars.
const DEFAULT_BUY_BUTTON_ID = 'buy_btn_1TKNE64oQsUeST1NUUUDVkWL';
const DEFAULT_PUBLISHABLE_KEY = 'pk_live_51TKMlH4oQsUeST1NP1i8kZ5hvVCT1s5QqPnA7QMBaAo4fzn3pQLoJeQAvEl4pj2zphioL0G8FU4ULtvXmwdoxIa800PILjG8jf';

export const STRIPE_BUY_BUTTON_ID = import.meta.env.VITE_STRIPE_BUY_BUTTON_ID?.trim() || DEFAULT_BUY_BUTTON_ID;
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() || DEFAULT_PUBLISHABLE_KEY;
export const STRIPE_TRIAL_DAYS = Number(import.meta.env.VITE_STRIPE_TRIAL_DAYS || 10) || 10;

export const STRIPE_BUY_BUTTON_READY =
  STRIPE_BUY_BUTTON_ENABLED &&
  STRIPE_BUY_BUTTON_ID.length > 0 &&
  STRIPE_PUBLISHABLE_KEY.length > 0;

