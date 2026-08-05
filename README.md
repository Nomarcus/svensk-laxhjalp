<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8af631ef-cd5d-43bc-94dd-19902f5cf06f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Android app (Capacitor)

The project is set up for Android using Capacitor.

### Local Android development

1. Build web + sync into Android:
   `npm run cap:sync`
2. Open Android Studio project:
   `npm run android:open`
3. Run from Android Studio on emulator or Samsung device.

### CLI builds

- Debug APK:
  `npm run android:build:debug`
- Release APK (unsigned by default):
  `npm run android:build:release`
- Release AAB for Google Play:
  `npm run android:bundle:release`

Build outputs are created under `android/app/build/outputs/`.

### Google Play release checklist

1. Generate a release keystore and create `android/keystore.properties` (see that section's comments in `android/app/build.gradle`) — never commit the keystore or its passwords.
2. Build signed AAB (`npm run android:bundle:release`).
3. Upload `.aab` to Google Play Console.
4. Fill app content requirements: Privacy Policy URL → `https://foraldrahjalpen.se/privacy` (loads directly, no login needed), Terms → `https://foraldrahjalpen.se/terms`, data safety form, target SDK, screenshots (produce real device-frame screenshots per Play's size requirements — the files under `public/screenshots/` are marketing images for the web landing page, not pre-sized store screenshots).
5. Account deletion: the in-app self-service flow (Subscription tab → "Radera mitt konto") satisfies Play's Account Deletion requirement; you can link `https://foraldrahjalpen.se/privacy#radering` (or just the privacy URL) as the account-deletion web reference if Play Console asks for one.

## iOS app (Capacitor)

The project is also set up for iOS using Capacitor (`ios/` folder). Building and signing requires **macOS with Xcode** — none of this can be done from a Linux/CI-only environment.

### Local iOS development (on a Mac)

1. Install CocoaPods once: `sudo gem install cocoapods` (or `brew install cocoapods`).
2. Build web + sync into iOS: `npm run ios:sync`
3. Open the Xcode workspace: `npm run ios:open` (opens `ios/App/App.xcworkspace` — always open the `.xcworkspace`, not the `.xcodeproj`, once CocoaPods is installed).
4. In Xcode: select your Apple Developer Team under Signing & Capabilities, then Run on a simulator or a connected device.

### App Store release checklist

1. In Xcode, set up automatic signing with your Apple Developer account (or manual provisioning profiles), and bump the build number for each submission.
2. Archive the app (Product → Archive) and upload via Xcode Organizer or Transporter.
3. In App Store Connect: fill Privacy Policy URL (`https://foraldrahjalpen.se/privacy`), Support URL, App Privacy "nutrition label" (data types collected — see `PrivacyPolicy.tsx` for what's actually collected), age rating questionnaire (this app is for parents, not children directly), and real device screenshots per required size for each device class you support.
4. Subscriptions: the app currently links out to a Stripe Payment Link for the paid plan (opened via `@capacitor/browser`, i.e. outside the app's own WebView). Apple generally requires **StoreKit In-App Purchase** for digital subscriptions consumed inside an app — review Apple's guidelines (§3.1.1) before re-enabling `STRIPE_BUY_BUTTON_ENABLED`; a native IAP integration is the safer path for approval and isn't implemented yet.
5. Account deletion: the in-app self-service flow (Subscription tab → "Radera mitt konto") satisfies Apple's Account Deletion requirement (Guideline 5.1.1(v)).
