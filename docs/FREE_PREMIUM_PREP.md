# Gratis och Premium - forberedelseplan

Syfte: forbereda gratis- och betalversion utan att aktivera betalvaggar,
begransningar eller nya kopfloden annu.

## Mal

- Skydda mot ovantade AI-kostnader om manga anvandare kommer snabbt.
- Behalla en tydlig gratisupplevelse sa appen kan vaxa.
- Forbereda Premium for iOS, Android och webb utan att bryta App Store/Play-regler.
- Gora det enkelt att sla pa betalning senare med minimal kodrisk.

## Rekommenderad produktmodell

### Gratis

- Konto med e-post, Google, Apple eller anonym inloggning.
- Begransat antal AI-fragor per dag.
- Begransat antal bildanalyser/laxbilder per dag.
- Ett barn.
- Grundlaggande chatt och forklaring.
- Enkel historik eller kort historik.

### Premium

- Fler AI-fragor per dag eller hogre fair-use-grans.
- Fler bildanalyser.
- Flera barn.
- Veckoplanering.
- Ratta laxor med foto.
- Dela kalender/familjefunktioner.
- Langre historik.
- Prioriterad eller mer avancerad AI-modell.

## Plattformar och betalning

### iOS

- Anvand App Store In-App Purchase / auto-renewable subscription.
- Stripe ska inte anvandas inne i iOS-appen for digitala funktioner som konsumeras i appen.
- Rekommenderad produkt:
  - Product ID: `premium_monthly`
  - Namn: `Foraldrahjalpen Premium`
  - Pris: 79 kr/manad

### Android

- Anvand Google Play Billing for appversionen.
- Rekommenderad produkt:
  - Product ID: `premium_monthly`
  - Namn: `Foraldrahjalpen Premium`
  - Pris: 79 kr/manad

### Webb

- Stripe kan anvandas for webbversionen.
- Webb-Premium ska mappa till samma interna `premium`-status som appbutikerna.
- Anvand inte webbcheckout-lankar inne i iOS-appen innan reglerna ar kontrollerade.

## Datamodell som ska forberedas

### User subscription

Lagra per anvandare:

```ts
type SubscriptionTier = 'free' | 'premium';
type SubscriptionSource = 'app_store' | 'play_store' | 'stripe' | 'manual';
type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
```

Foreslagna falt:

- `tier`
- `status`
- `source`
- `currentPeriodEnd`
- `originalTransactionId` for Apple
- `purchaseToken` for Google Play
- `stripeCustomerId`
- `stripeSubscriptionId`
- `updatedAt`

### Usage tracking

Lagra per anvandare och dag:

- `aiQuestions`
- `photoScans`
- `homeworkCorrections`
- `plannerGenerations`
- `tokensIn`
- `tokensOut`
- `estimatedCostSek`
- `dateKey`, exempel `2026-08-11`

Foreslagen path:

```text
users/{uid}/usageDaily/{yyyy-mm-dd}
```

## Gratisgranser - forslag

Starta konservativt:

- AI-fragor: 3 per dag
- Bildanalyser: 2 per dag
- Rattning: 1 per dag
- Planering: 1 per vecka
- Barn: 1

Premium fair-use:

- AI-fragor: 50 per dag
- Bildanalyser: 20 per dag
- Rattning: 10 per dag
- Planering: 10 per vecka
- Barn: 5

Obs: dessa ska vara konfigurerbara pa serversidan.

## Backend-skydd

Det viktigaste ar att granskontrollen sitter i API/backend, inte bara i frontend.

For varje AI-anrop:

1. Hamta anvandarens subscription-status.
2. Hamta dagens usage.
3. Jamfor med grans for tier.
4. Stoppa anrop om gransen ar uppnadd.
5. Logga usage efter lyckat anrop.
6. Satt max tokens/svarslangd beroende pa tier.

## Frontend-forberedelse

Forbered, men visa inte aggressivt annu:

- `UpgradeModal`
- `UsageLimitBanner`
- `PremiumBadge`
- `ManageSubscriptionButton`
- tomma states for "du har natt dagens gratisgrans"

Dessa kan ligga bakom feature flag:

```text
VITE_ENABLE_PREMIUM=false
```

## Feature flags

Rekommenderade flaggor:

- `VITE_ENABLE_PREMIUM`
- `VITE_ENABLE_USAGE_LIMITS`
- `VITE_ENABLE_APP_STORE_IAP`
- `VITE_ENABLE_PLAY_BILLING`
- `VITE_ENABLE_STRIPE_CHECKOUT`

Produktionsstandard tills betalning ska aktiveras:

```text
VITE_ENABLE_PREMIUM=false
VITE_ENABLE_USAGE_LIMITS=false
VITE_ENABLE_APP_STORE_IAP=false
VITE_ENABLE_PLAY_BILLING=false
VITE_ENABLE_STRIPE_CHECKOUT=false
```

## App Store Connect - forberedelser

Skapa inte nodvandigtvis aktivt saljflode annu, men forbered:

- Subscription group: `Foraldrahjalpen Premium`
- Auto-renewable subscription:
  - Product ID: `premium_monthly`
  - Pris: 79 kr/manad
  - Lokaliserat namn: `Foraldrahjalpen Premium`
  - Beskrivning: `Fler AI-fragor, bildanalyser, flera barn och planering.`

Innan aktivering:

- Kontrollera App Review-notes.
- Kontrollera att gratisversionen fungerar utan kop.
- Kontrollera Restore Purchases.
- Kontrollera Account deletion.

## Google Play Console - forberedelser

Forbered:

- Subscription: `premium_monthly`
- Base plan: monthly
- Pris: 79 kr/manad
- Grace period och account hold enligt standardrekommendation.

Innan aktivering:

- Kontrollera Play Billing Library.
- Testa med license testers.
- Kontrollera Data Safety om betaldata hanteras via Google.

## Stripe webb - forberedelser

Stripe kan anvandas for webbversionen.

Forbered:

- Product: `Foraldrahjalpen Premium`
- Price: `premium_monthly_sek_79`
- Webhookar:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Webhook ska uppdatera samma subscription-falt som appbutikerna.

## Kostnadsbroms

Lagg senare in global nodbroms:

- daglig maxkostnad for hela appen
- maxkostnad per anvandare/dag
- max antal bildanalyser per minut
- rate limit per IP och UID
- admin-flagga for att temporart stanga av dyra AI-funktioner

## Implementationsordning nar det ska aktiveras

1. Backend usage tracking, utan att stoppa anvandare.
2. Admin/loggvy for usage och kostnad.
3. Backend limit-check i "observe only"-lage.
4. Frontend UI for usage.
5. Feature flag for faktiska gratisgranser.
6. App Store IAP.
7. Google Play Billing.
8. Stripe webb.
9. Gemensam subscription entitlement service.
10. Sluttest i TestFlight, Play Internal Testing och webben.

## Ej implementerat annu

Detta dokument ar endast forberedelse.

- Inga gratisgranser ar aktiverade.
- Ingen betalvagg ar aktiverad.
- Ingen StoreKit/Play Billing/Stripe-kod ar tillagd.
- Inga befintliga anvandare paverkas.
