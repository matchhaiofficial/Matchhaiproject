# MatchHai — Testing Guide

Master index for the testing & load-testing foundation. Detailed docs:
- Load testing → [`load-tests/README.md`](./load-tests/README.md)
- E2E (Maestro) → [`.maestro/README.md`](./.maestro/README.md)
- Monitoring → [`docs/MONITORING.md`](./docs/MONITORING.md)
- Test data / seeding → [`docs/TEST_DATA.md`](./docs/TEST_DATA.md)
- Security / race / abuse → [`docs/SECURITY_TESTS.md`](./docs/SECURITY_TESTS.md)
- Page coverage map → [`docs/PAGE_COVERAGE.md`](./docs/PAGE_COVERAGE.md)

> **Never run load tests or E2E against production. Never call real Easypaisa.
> Use the staging Convex deployment + seeded test data only.**

## Stack
- **Jest** with the **jest-expo** preset (Expo SDK 54).
- **@testing-library/react-native** for component tests.
- Config: [`jest.config.js`](./jest.config.js); global mocks in
  [`jest/setup.ts`](./jest/setup.ts) + [`jest/setupBeforeEnv.ts`](./jest/setupBeforeEnv.ts).
- Shared fixtures: [`__tests__/fixtures/index.ts`](./__tests__/fixtures/index.ts).

## Running tests

```bash
# all tests
npm test
# (on this machine larger runs may need more heap)
#   NODE_OPTIONS=--max-old-space-size=8192 npm test -- --runInBand

npm run test:unit       # __tests__/unit  (pure logic / services)
npm run test:ui         # __tests__/ui    (component render)
npm run test:security   # __tests__/security
npm run test:watch      # watch mode
npm run test:coverage   # coverage report -> ./coverage
```

### What's covered
| Suite | Location | Notes |
|-------|----------|-------|
| Unit / service | `__tests__/unit` | game labels & roles, availability, match config, matchroom lifecycle/time, status labels, notification taxonomy, payment copy & safe errors, phone utils, pricing rules, skill rating, zone lifecycle, team roster, super-admin access. |
| UI / component | `__tests__/ui` | MatchroomCard (full/expired/completed/seats/price/request/joined, no match code), ZonePicker (loading/empty/rate), SegmentedTabs, SkillBadge. |
| Security | `__tests__/security` | backend auth gates (negative), super-admin escalation, matchroom lock/overfill abuse, mutation negative-auth matrix (`it.todo`). |
| Coverage tracker | `__tests__/coverage` | `it.todo` smoke list for screens pending RNTL automation. |

## E2E (Maestro)
```bash
npm run e2e:maestro            # all flows in .maestro/
npm run e2e:maestro:android
npm run e2e:maestro:ios
```
Requires Maestro installed + an EAS **development**/**preview** build (staging
Convex). Seed staging first (see TEST_DATA.md). Credentials come from a
gitignored `.maestro/.env.e2e` (copy `.maestro/.env.e2e.example`).

### Build for E2E (staging only)
```bash
eas build --profile development --platform android   # or ios
# or preview (apk, internal):
eas build --profile preview --platform android
```
Do **not** build the `production` profile here.

## Load testing (k6)
```bash
npm run load:smoke
npm run load:100   # ramp to 100 VUs
npm run load:500
npm run load:1000
```
Set `CONVEX_SITE_URL`, `CONVEX_TEST_TOKEN`, target ids in `load-tests/.env.load`
(copy `.env.load.example`). Thresholds: failed reqs <1%, checks >99%, custom
no-5xx rate, p95 SLO documented. Read-only flows run today; write flows need the
documented staging test-harness/token (see load-tests/README.md). **Staging only.**

## Monitoring
Provider-agnostic monitoring at `src/lib/monitoring/` + `AppErrorBoundary`, wired
in `app/_layout.tsx`. No-ops safely with no DSN; redacts PII/secrets. To enable
Sentry later see docs/MONITORING.md (install + native rebuild required).

## Collecting evidence (screenshots / videos / logs)
- Maestro: `maestro test --format junit` and `maestro record` for video; store
  under `artifacts/e2e/` (placeholder).
- k6: `k6 run --summary-export=artifacts/load/summary.json ...`.
- Jest: `npm run test:coverage` → `coverage/`.

## Guardrails recap
No production deploy/build, no production load, no real payment provider calls,
no payout/ELO/KYC formula changes — tests/mocks/hooks only.
