# Föräldrahjälpen iOS-app

Detta är en separat Expo/React Native-app för iOS. Den ligger i `ios-app/` för att inte ändra den befintliga webbplatsen.

## Vad som återanvänds

- Samma Firebase-projekt som webben (`lead-agent-489101`).
- Samma Firebase Auth-konton.
- Samma Firestore-datamodell för barnprofiler, chattsessioner och meddelanden.
- Samma Cloud Run API som produktionen använder: `https://laxhjalp-api-288867992327.europe-west1.run.app`.
- Samma server-side AI-nycklar och Stripe-nycklar som redan finns i backendmiljön. Inga AI- eller betalningshemligheter ligger i iOS-appen.

## Kom igång

```bash
cd ios-app
npm install
npm run start
```

Kör iOS:

```bash
npm run ios
```

## Apple In-App Purchase

Appen använder `react-native-iap` för iOS-prenumerationer. Standardprodukt-id är:

```text
foraldrahjalpen_monthly
```

Detta måste skapas i App Store Connect innan köp kan testas i TestFlight/App Store. Om produkt-id ändras uppdateras `APPLE_SUBSCRIPTION_PRODUCT_IDS` i `src/config.ts` och backendmiljöns `APPLE_SUBSCRIPTION_PRODUCT_IDS`.

Backend verifierar Apple-kvitton via:

- `POST /api/billing/apple/verify-purchase`
- `POST /api/billing/apple/restore`

Backend behöver miljövariabeln:

```text
APPLE_SHARED_SECRET=...
```

Det är App Store Connects app-specific shared secret för auto-renewable subscriptions.

## Viktigt

- Stripe ska fortsätta användas på webben.
- iOS-appen ska använda Apple In-App Purchase för digitala abonnemang.
- Webbplatsens filer i `src/`, `index.html`, `firebase.json` och `vercel.json` behöver inte ändras för att köra denna app.
