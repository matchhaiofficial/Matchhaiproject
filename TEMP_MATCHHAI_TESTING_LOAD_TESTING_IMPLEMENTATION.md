# MatchHai — Testing & Load-Testing Implementation Tracker

Branch: `product-ready`
Started: 2026-06-03
Scope: Testing/instrumentation only. **No** changes to payment money movement, payout
formula, ELO/rating formulas, KYC provider logic, or Super Admin/withdrawal logic —
except adding tests, mocks, and test hooks.

> Guardrails (do not violate):
> - No production deploy, no EAS production build.
> - No high-load tests against production. Staging/dev only.
> - No real Easypaisa production calls. Mock/test payment only.
> - Do not push unless explicitly instructed.
> - Do not delete previous TEMP files.

---

## PREFLIGHT BASELINE (captured 2026-06-03)

### Git
- `git branch --show-current` → `product-ready`
- `git status --porcelain` → clean (no dirty files at start)
- `git diff --stat` → empty
- `git diff --check` → clean (OK)
- Recent commits: 709f479 (merge), d3e632d (Share functionality), b6fa37b (sharing), 273018e (matchrooms), d22cd4c (team-challenges)

### Existing test setup
- **None.** No project-level `*.test.ts(x)` / `*.spec` files (only inside `node_modules`).
- No `jest.config.*`, no jest key in `package.json`.
- `package.json` scripts: only `start`, `android`, `ios`, `web` (no `test`).
- `babel.config.js`: `babel-preset-expo` + `react-native-reanimated/plugin`.
- `tsconfig.json`: extends `expo/tsconfig.base`, `strict: true`, `jsx: react-native`.
- `eas.json`: `development`, `preview` (Convex `quick-panda-920` = staging/dev), `production` (placeholders, not configured).

### Missing dependencies (test stack)
- MISSING: `jest-expo`, `jest`, `jest-circus`, `@testing-library/react-native`,
  `@testing-library/jest-native`, `@types/jest`.
- PRESENT: `react-test-renderer@19.1.0` (devDep, matches React 19.1.0).

### Key source map (targets)
- Pure helpers: `src/utils/*` (gameLabels, matchroomLifecycle, matchroomTime,
  notificationCategories, paymentUiCopy, statusLabels, scheduleTime, timeFilters,
  zoneLifecycle, phoneUtils, teamRosterDisplay, userFacingErrors, accountRouting).
- Services: `src/services/*` (bookingRequestService, pricingRuleService,
  skillRatingService, teamMatchService, userService, authService).
- Constants: `constants/*` (gameAvailability, matchConfig, profileOptions), `src/constants/timing`.
- Convex backend: `convex/*` (matchrooms, bookings, ratingEngine, authz, superAdminAccess,
  zoneWithdrawals, wallet, easypaisa*, kyc*, notifications, teams, teamChallenges).
- App routes: `app/` (auth, matchrooms, teams, zone, super-admin, (player), debug).

### Known dirty files before start
- None. Working tree clean.

### Baseline `tsc` result (PRE-EXISTING, not caused by testing work)
- `npx tsc -p tsconfig.json --noEmit` → exit 2, **1 error** (pre-existing):
  - `src/theme/icons.ts(122,8): TS7016: Could not find a declaration file for module 'lucide-react-native'`.
- Acceptance bar for this work: **introduce no NEW tsc errors** (count stays at 1).

---

## DEPENDENCIES ADDED (devDependencies)
- `jest-expo@~54.0.0` (resolved 54.0.17) — Expo SDK 54 jest preset.
- `jest@^29.7.0`
- `@testing-library/react-native@^12.9.0` (v12; v13/14 exist but v12 is stable for RN 0.81/React 19 here)
- `@types/jest@^29.5.14`
- (already present) `react-test-renderer@19.1.0`
- Install note: needed `NODE_OPTIONS=--max-old-space-size=8192` — default heap OOM'd during resolution on this Windows box.

## SCRIPTS ADDED (package.json)
- `test` = `jest`
- `test:watch`, `test:unit` (`jest __tests__/unit`), `test:ui` (`jest __tests__/ui`), `test:security`, `test:coverage`
- `e2e:maestro`, `e2e:maestro:android`, `e2e:maestro:ios`
- `load:smoke`, `load:100`, `load:500`, `load:1000`

## PHASE 0 — FOUNDATION (DONE, verified)
- `jest.config.js` (jest-expo preset, transformIgnorePatterns tuned, asset moduleNameMapper, roots/testMatch).
- `jest/setupBeforeEnv.ts` (env vars so `src/lib/convex.ts` import doesn't throw; marks test env).
- `jest/setup.ts` (reusable mocks: AsyncStorage, SecureStore, expo-haptics/clipboard/linking/notifications/web-browser, expo-router, convex/react hooks+client, reanimated, gesture-handler, toast).
- `jest/mocks/fileMock.js` (asset stub).
- Sanity tests pass: `__tests__/unit/sanity.test.ts` + `__tests__/ui/sanity.test.tsx` → 2 suites / 2 tests PASS.
- Gotcha fixed: transformIgnorePatterns must NOT require a trailing slash, else `expo-modules-core` (pulled by the preset) fails to transform with "Cannot use import statement outside a module".

---

## PHASE STATUS

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Jest/jest-expo foundation (config, setup, mocks) | DONE ✅ verified |
| 1 | Unit/service tests + fixtures | DONE ✅ 16 suites |
| 2 | UI/component tests + testIDs | DONE ✅ 5 suites |
| 3 | E2E Maestro flows | DONE ✅ (sub-agent) |
| 4 | k6 load tests | DONE ✅ (sub-agent) syntax-validated |
| 5 | Race-condition/security/abuse tests | DONE ✅ 4 suites |
| 6 | Monitoring/error logging | DONE ✅ (sub-agent) + redaction test |
| 7 | Test data/seed setup | DONE ✅ (sub-agent) |
| 8 | Missing pages coverage | DONE ✅ map + it.todo tracker |
| 9 | Documentation + final report | DONE ✅ |

## FINAL RESULTS

- **`npm test` (jest --runInBand):** 27 suites, **178 passed, 43 todo, 0 failed.**
- **`tsc`:** exit 2 with **1 error = the pre-existing baseline** (`src/theme/icons.ts` lucide types). **No new tsc errors introduced.**
- **`git diff --check`:** clean (exit 0).
- **k6 scripts:** all 5 pass `node --check`.

### Tracked-file edits (5)
- `package.json` (+test/e2e/load scripts, +devDeps), `package-lock.json`.
- `app/_layout.tsx` (wrap `AppErrorBoundary`, call `initMonitoring()` — surgical).
- `app/auth/login.tsx` (+3 testIDs), `app/matchrooms/create/index.tsx` (+1 testID).

### New files (high level)
- `jest.config.js`, `jest/setupBeforeEnv.ts`, `jest/setup.ts`, `jest/mocks/fileMock.js`.
- `__tests__/` fixtures + unit (17) + ui (5) + security (4) + coverage (1).
- `.maestro/` (9 flows + README + config + .env.e2e.example + .gitignore).
- `load-tests/` (README + config/options.js + lib/http.js + scenarios smoke/stress/race + .env.load.example).
- `src/lib/monitoring/` (index, redact, events, sentryAdapter, types) + `src/components/AppErrorBoundary.tsx`.
- Docs: `TESTING.md`, `docs/MONITORING.md`, `docs/TEST_DATA.md`, `docs/SECURITY_TESTS.md`, `docs/PAGE_COVERAGE.md`, `.env.test.example`.

### KNOWN RISKS / DEFERRED
- Fixture↔schema field-name divergence (visibility vs isPrivate, slots `team` field, ownerUserId vs ownerUid, role strings). Client-helper tests are unaffected (helpers read slotsA/slotsB/status/scheduledStartAt). Documented in docs/TEST_DATA.md — reconcile before writing convex-test mutation tests.
- End-to-end mutation negative-auth (17 `it.todo`) needs the `convex-test` harness + mock identity provider (not installed). Setup steps in docs/SECURITY_TESTS.md.
- Full-screen RNTL smoke tests deferred (heavy provider trees) — tracked as `it.todo` in `__tests__/coverage/pageCoverage.test.ts` with conversion recipe in docs/PAGE_COVERAGE.md.
- Sentry native SDK intentionally NOT installed (needs native rebuild/EAS). Monitoring no-ops safely without a DSN; enable steps in docs/MONITORING.md.
- MatchroomCard render is slow under jest-expo on Windows (~10–80s) — functional, not a failure.
- Install required `NODE_OPTIONS=--max-old-space-size=8192` on this machine (default heap OOM).

### MANUAL QA REMAINING (staging only)
- Run Maestro flows on an EAS dev/preview build against seeded staging.
- Run `npm run load:smoke` against staging with a real test token; then ramp 100/500/1000.
- Execute the payment-expiry-vs-success and simultaneous-slot-booking procedures in docs/SECURITY_TESTS.md.

---

## NOTES / DECISIONS LOG
- 2026-06-03: Baseline captured. No prior test infra; building from scratch with jest-expo.
