# Monitoring & Error Instrumentation

MatchHai uses a **provider-agnostic monitoring abstraction** (`src/lib/monitoring`).
It is **Sentry-ready** but has **no hard dependency** on the native Sentry SDK.
When no DSN is configured (the default in dev/test), every call **no-ops safely**
to the existing local `Logger` — the app compiles and runs without any provider
installed.

## Files

| File | Purpose |
| --- | --- |
| `src/lib/monitoring/index.ts` | Public API: `initMonitoring`, `captureException`, `captureMessage`, `addBreadcrumb`, `setUser`, `clearUser`, `triggerTestMonitoringEvent`. |
| `src/lib/monitoring/redact.ts` | Pure redaction helpers + sensitive-key denylist + safe-key allowlist. Unit-testable. |
| `src/lib/monitoring/events.ts` | Typed domain event loggers + failure counters/markers. |
| `src/lib/monitoring/sentryAdapter.ts` | Lazy, optional Sentry adapter (require wrapped in try/catch). |
| `src/lib/monitoring/types.ts` | Shared types. |
| `src/components/AppErrorBoundary.tsx` | React error boundary that reports to monitoring and renders a safe fallback. |

## Environment variables

| Var | Meaning | Example |
| --- | --- | --- |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN. **Empty / unset = monitoring disabled** (Logger-only mode). | `https://abc@o0.ingest.sentry.io/123` |
| `EXPO_PUBLIC_ENV` | Environment tag forwarded to the provider and used to gate dev-only behaviour. | `development` \| `staging` \| `production` \| `test` |

### Staging vs production separation

Separation is **purely via env var** — there is no code branch per environment.

- Use a **different DSN per environment** (separate Sentry projects):
  - Staging build profile sets `EXPO_PUBLIC_SENTRY_DSN=<staging-dsn>` and
    `EXPO_PUBLIC_ENV=staging`.
  - Production build profile sets `EXPO_PUBLIC_SENTRY_DSN=<prod-dsn>` and
    `EXPO_PUBLIC_ENV=production`.
- The `environment` field is sent to Sentry so you can filter staging vs prod
  inside one project as well, if you prefer a single project.

### Disabling in dev

Leave `EXPO_PUBLIC_SENTRY_DSN` **unset** (the default). Monitoring then routes
everything through the local `Logger` only. No network calls, no provider.
The Jest setup (`jest/setupBeforeEnv.ts`) sets `EXPO_PUBLIC_ENV=test` and no DSN,
so tests run in Logger-only mode automatically.

## What is captured

### Lifecycle / errors

- **Global JS errors** via `ErrorUtils.setGlobalHandler` (installed by
  `initMonitoring()`, preserving any previously-registered handler such as the
  keep-awake filter in `app/_layout.tsx`).
- **Unhandled promise rejections** via `global.onunhandledrejection` (best effort,
  preserves previous handler).
- **React render errors** via `AppErrorBoundary` (`componentDidCatch`).

### Domain events (`src/lib/monitoring/events.ts`)

Each takes **ids / enums only** and funnels through the strict allowlist redactor:

- `logBookingIntentCreated`, `logBookingIntentFailed`
- `logPaymentConfirmation`, `logPaymentConfirmationFailed`
- `logMatchroomLock`, `logMatchroomExpiry`, `logMatchroomCreationFailed`
- `logResultVerification`, `logResultVerificationFailed`
- `logNotificationFailure`
- `logApiFailure`, `markSlowScreen`
- generic `logEvent(name, props, level?)`

### Counters / markers (failure-rate tracking)

Exposed via `Counters` / `incr` / `getCounter` and mirrored into the perf event
buffer (`recordCountMetric`):

failed API calls, slow screens, payment failure, booking failure, matchroom
creation failures, booking intent creation failures, payment confirmation
failures, room lock / expiry events, result verification failures, notification
send failures.

## Privacy rules (enforced in code)

`src/lib/monitoring/redact.ts` enforces:

1. **Denylist (always obfuscated, any depth):** keys containing `cnic`, `nic`,
   `phone`, `mobile`, `email`, `bankAccount`/`accountNumber`/`iban`, `card`,
   `cvv`, `token`, `password`, `pin`, `secret`, `apiKey`, `authorization`,
   `auth`, `credential`, `providerPayload`/`rawPayload`/`payload`, `otp`,
   `address`, `fullName`, `dob` → replaced with `[redacted]`.
2. **Allowlist mode for events (`pickAllowed`):** domain events keep **only**
   known-safe keys (ids, enums, counts, timings). Anything not allowlisted is
   dropped entirely.
3. **`hashId()`** produces a short non-reversible token for correlating a user
   without exposing the raw id.
4. `setUser({ id })` stores an **opaque id only** — never email/phone/CNIC.
5. Strings are length-capped; objects/arrays are size- and depth-capped.
6. The Sentry adapter sets `sendDefaultPii: false` as defence in depth.

**Never pass** raw provider payloads, tokens, payment secrets, CNIC, full
phone/email, or bank details into any monitoring call.

## Dev-only test trigger

`triggerTestMonitoringEvent()` fires a synthetic message + breadcrumb +
exception to verify the pipeline. It is **guarded** to never run in production
(`EXPO_PUBLIC_ENV=production`/`prod`), so it is safe to leave wired in.

```ts
import { triggerTestMonitoringEvent } from "../src/lib/monitoring"; // adjust relative path

// e.g. behind a dev menu button:
triggerTestMonitoringEvent();
```

In Logger-only mode you will see the events in the console; with a DSN set they
appear in your Sentry project.

## How to enable Sentry later

The native SDK requires a **config plugin + native rebuild via EAS** — that is
why it is intentionally not installed here. When you are ready:

1. **Install the SDK** (this is the only step that touches `package.json`):
   ```bash
   npx @sentry/wizard@latest -i reactNative
   # or, manually:
   npx expo install @sentry/react-native
   ```
2. **Add the Expo config plugin** in `app.json` / `app.config.js`:
   ```json
   {
     "expo": {
       "plugins": [
         ["@sentry/react-native/expo", {
           "organization": "your-org",
           "project": "matchhai"
         }]
       ]
     }
   }
   ```
3. **Native rebuild required.** Sentry hooks native crash reporting, so you must
   rebuild the native projects — `expo prebuild` + a new dev client / EAS build.
   A pure JS/OTA update is **not** sufficient.
4. **Set the DSN** per environment (`EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_ENV`).
5. **No app code changes needed.** `sentryAdapter.ts` lazily `require`s
   `@sentry/react-native`; once installed + DSN present, `initMonitoring()`
   automatically routes through Sentry. If you want native crash handling and
   performance tracing wrappers (e.g. `Sentry.wrap(App)`, navigation
   instrumentation), extend `sentryAdapter.ts` — its interface already matches
   the monitoring core.

### Verify the wiring

After enabling, build a dev client and call `triggerTestMonitoringEvent()` from
a staging build — confirm the event appears under the **staging** environment in
Sentry, then repeat for production with the prod DSN.
