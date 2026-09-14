# EAS production configuration inventory

The repository is linked to the shared `@matchhai/matchhai` EAS project and
keeps only the `production` build profile. QA runs through Expo Go with the
ignored local QA environment. Do not create a development or preview EAS build
for this workstream.

The production profile intentionally does not contain a Convex URL. Until the
approved production Convex deployment exists, `src/lib/convex.ts` must reject a
production app because the required values are absent. Before an approved
production build, add these build-time values to the EAS `production`
environment (do not commit them to `eas.json`):

| Variable | Required value | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_CONVEX_URL` | Exact approved `https://<deployment>.convex.cloud` URL | Client API endpoint |
| `EXPO_PUBLIC_CONVEX_SITE_URL` | Matching `https://<deployment>.convex.site` URL | Auth/site endpoint |
| `EXPO_PUBLIC_CONVEX_DEPLOYMENT_CLASS` | `production` | Explicit production boundary |
| `EXPO_PUBLIC_CONVEX_ALLOWED_URLS` | Exact same cloud URL as `EXPO_PUBLIC_CONVEX_URL` | Production allowlist |
| `EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN` | Future production public ingestion token | Production analytics |
| `EXPO_PUBLIC_POSTHOG_HOST` | Approved PostHog host | Production analytics host |

The profile already commits the non-secret build metadata
`EXPO_PUBLIC_ENV=production`, `EXPO_PUBLIC_APP_SCHEME=matchhai`, and
`EXPO_PUBLIC_TOUCH_DEBUG=0`. Do not add `EXPO_PUBLIC_SKIP_PHONE_OTP` or
`EXPO_PUBLIC_SKIP_KYC_VERIFICATION` to the production environment. Store
credentials, provider secrets, signing keys, and Convex server variables in
their respective managed systems; they are outside this client inventory.

No EAS environment mutation, build, credential operation, or submission is
part of this preparation.

On the production Convex deployment, set `MATCHHAI_ENABLE_PUSH_DELIVERY=1`
only after the Firebase/Expo push credentials have been verified. Keep it `0`
in local/QA deployments when native push is intentionally out of scope; this
prevents in-app notifications from spawning delivery actions that can only end
in `no_device` or missing-provider failures.
