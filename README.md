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

1. Create/upload keystore and configure signing in Android Studio (or `android/app/build.gradle` signing config).
2. Build signed AAB (`bundleRelease`).
3. Upload `.aab` to Google Play Console.
4. Fill app content requirements (privacy policy, data safety, target SDK, screenshots, etc.).
