# EAS Release Configuration Inventory

## Project and Store Identity

The repository is linked to the transferred `@matchhai/matchhai` EAS project:

- EAS project ID: `cc63aac8-7e68-4dbc-9e95-c59e145fb7b4`
- Android package / iOS bundle ID: `com.ovaisto.matchhai`
- App Store Connect app ID: `6800853996`
- Last known store builds: Android version code 27 and iOS build 15

The EAS-managed Android keystore has upload SHA-1
`FA:5D:E9:13:B7:53:DF:94:9E:E1:3E:9B:EF:9E:AD:C9:3C:10:2D:CE`, which
matches the Play Console upload certificate. Do not reset the upload key.

Recent iOS builds and submissions succeeded, but a fresh Apple credential check
still requires Ovais to authenticate or provide an App Store Connect API key.
The EAS project currently has no Google Play submission service account and no
FCM V1 service account.

## QA Preview

The `preview` profile creates an Expo-hosted internal-distribution Android APK.
It uses the EAS `preview` environment and QA Convex deployment
`striped-dog-623`; PostHog, live EasyPaisa, and bypass flags are absent. Because
it keeps the production package ID, installing it may replace the store app on
the same device. Do not submit a preview artifact to either store.

## Production Client Environment

The `production` profile intentionally has no committed Convex URL. Before the
approved production build, configure these values in the EAS `production`
environment:

| Variable | Required value |
| --- | --- |
| `EXPO_PUBLIC_CONVEX_URL` | Exact new production `https://<deployment>.convex.cloud` URL |
| `EXPO_PUBLIC_CONVEX_SITE_URL` | Matching `https://<deployment>.convex.site` URL |
| `EXPO_PUBLIC_CONVEX_DEPLOYMENT_CLASS` | `production` |
| `EXPO_PUBLIC_CONVEX_ALLOWED_URLS` | Exact same cloud URL |
| `EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN` | Approved production public token |
| `EXPO_PUBLIC_POSTHOG_HOST` | Approved PostHog host |

The profile already supplies `EXPO_PUBLIC_ENV=production`,
`EXPO_PUBLIC_APP_SCHEME=matchhai`, and `EXPO_PUBLIC_TOUCH_DEBUG=0`. Never add
`EXPO_PUBLIC_SKIP_PHONE_OTP` or `EXPO_PUBLIC_SKIP_KYC_VERIFICATION`.

Production secrets belong in the new Convex production deployment, not EAS or
Git. Set `MATCHHAI_ENABLE_PUSH_DELIVERY=1` only after FCM credentials and a real
device test succeed. Store submission can initially be performed manually with
the EAS-generated AAB; configure Play/App Store service credentials only if
cloud submission is desired.
