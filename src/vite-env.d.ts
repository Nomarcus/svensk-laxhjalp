/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_UID?: string;
  readonly VITE_ADMIN_EMAIL?: string;
  /** Valfri override av API-rot (standard i prod: Cloud Run i apiBase.ts). */
  readonly VITE_API_ORIGIN?: string;
  /** Feature flag: sätt till "true" för att visa Stripe Buy Button i abonnemangssidan. */
  readonly VITE_ENABLE_STRIPE_BUY_BUTTON?: string;
  /** Stripe Buy Button id, t.ex. buy_btn_xxx */
  readonly VITE_STRIPE_BUY_BUTTON_ID?: string;
  /** Stripe publishable key, t.ex. pk_live_xxx eller pk_test_xxx */
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  /** Visningscopy för gratisperiod i dagar (standard 10). */
  readonly VITE_STRIPE_TRIAL_DAYS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'stripe-buy-button': {
          'buy-button-id': string;
          'publishable-key': string;
          'client-reference-id'?: string;
          'customer-email'?: string;
        };
      }
    }
  }
}

export {};
