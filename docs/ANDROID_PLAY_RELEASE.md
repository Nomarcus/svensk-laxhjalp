# Android / Google Play release

This project is prepared to build a signed Android App Bundle (`.aab`) through Codemagic.

## App identity

- App name: Föräldrahjälpen
- Android package name: `se.foraldrahjalpen.app`
- Google Play app language: Swedish
- Category: Education

## Codemagic workflow

Use the `android-google-play` workflow. It runs when a tag matching `android-*` is pushed, for example:

```bash
git tag android-1.0.0
git push origin android-1.0.0
```

The workflow builds `android/app/build/outputs/bundle/release/app-release.aab` and emails the result to `nomarcus@hotmail.com`.

## Required Codemagic secrets

Create an environment variable group named `google_play` with these variables:

| Variable | Value |
| --- | --- |
| `CM_KEYSTORE` | Base64 encoded Android upload keystore file |
| `CM_KEYSTORE_PASSWORD` | Keystore password |
| `CM_KEY_ALIAS` | Key alias |
| `CM_KEY_PASSWORD` | Key password |

Keep the keystore and passwords private. They must never be committed to git.

## Google Play Console setup

Create a new app in Google Play Console:

- App name: `Föräldrahjälpen`
- Default language: Swedish
- App or game: App
- Free or paid: Free, unless the business model changes
- Package name: `se.foraldrahjalpen.app`

Use:

- Privacy Policy URL: `https://foraldrahjalpen.se/privacy`
- Support URL: `https://foraldrahjalpen.se`
- Category: Education

Complete the Play Console questionnaires before production release:

- App access
- Ads: No, unless ads are added later
- Content rating
- Target audience and content
- Data safety
- Privacy policy

For a new personal Google Play developer account, Google may require closed testing before production access. If required, create a closed testing track, add testers, upload the `.aab`, and complete the required testing period before applying for production.

## Firebase / Google sign-in checklist

In Firebase, add an Android app for package `se.foraldrahjalpen.app`.

Add the SHA-1 and SHA-256 fingerprints for the Android upload/signing key, then download `google-services.json` and place it at:

```text
android/app/google-services.json
```

Do not commit production secrets unless the project intentionally treats the Firebase client config as public client configuration.
