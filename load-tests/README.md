# MatchHai Load Testing (k6)

> **⚠️ STAGING ONLY. These tests must NEVER be pointed at production, and must
> NEVER hit Easypaisa production endpoints. Use the staging Convex deployment
> (`https://quick-panda-920.convex.cloud` / `https://quick-panda-920.convex.site`)
> and mock/test payment paths only.**

This directory contains [k6](https://k6.io) load-test scenarios for the MatchHai
Convex backend. It is instrumentation: it defines *what* and *how* to load test.
Running the tests is a separate, deliberate step (see the warning above).

---

## Contents

```
load-tests/
  README.md                 # this file
  .env.load.example         # env template (copy, fill staging values, never commit secrets)
  config/options.js         # shared k6 options, ramp profiles, thresholds
  lib/http.js               # base-URL + auth + check() helpers
  scenarios/smoke.js        # quick sanity check (npm run load:smoke)
  scenarios/stress.js       # read-heavy ramp (npm run load:100 / :500 / :1000)
  scenarios/race.js         # race-condition skeleton (booking slot / duplicate join)
```

---

## Installing k6

k6 is a standalone binary; it is **not** an npm dependency and is **not**
installed by this repo. Install it yourself:

- Official install guide: <https://grafana.com/docs/k6/latest/set-up/install-k6/>
- Windows (Chocolatey): `choco install k6`
- Windows (winget): `winget install k6 --source winget`
- macOS (Homebrew): `brew install k6`

Verify: `k6 version`.

The `npm run load:*` scripts in `package.json` simply shell out to `k6 run ...`.

---

## How Convex auth and HTTP work (read this before writing scenarios)

Convex is **not** a plain REST backend. There are two origins:

| Origin | Purpose | What's reachable |
| --- | --- | --- |
| `*.convex.site` | Custom `httpAction` routes registered in `convex/http.ts` | Better Auth routes (`/api/auth/*`), Easypaisa payment routes (`/payments/easypaisa/{checkout,token,finalize,ipn}`), support agent tools (`/support/agentTools`), KYC webhook (`/kyc/didit/webhook`) |
| `*.convex.cloud` | The deployment's generic function API | `/api/query`, `/api/mutation`, `/api/action` — how the client SDK drives all queries/mutations under the hood |

**Honest reality:** the app's core flows (discover, matchrooms, notifications,
bookings) are ordinary Convex **queries/mutations**, not custom HTTP routes.
They are normally invoked by the client SDK over a WebSocket/HTTP transport with
an authenticated token. k6 cannot speak the reactive WebSocket protocol, but it
**can** call the generic function API on the `.cloud` origin:

```
POST https://quick-panda-920.convex.cloud/api/query
Content-Type: application/json
Authorization: Bearer <token>

{ "path": "discover:listDiscoverMatchrooms", "args": { "limit": 20 }, "format": "json" }
```

`lib/http.js` wraps this as `convexQuery(funcRef, args)` /
`convexMutation(...)` / `convexAction(...)`.

### Authentication

Most of these functions call `getAuthUserId` / read the signed-in identity, so
**they require a valid bearer token** or they return an unauthenticated error
(not a 5xx). Supply one via `CONVEX_TEST_TOKEN`.

How to obtain a **staging-only** test token (pick one, document which you used):

1. **Capture from a real staging session.** Sign in to the app pointed at the
   staging deployment, then read the Better Auth session/JWT the client sends.
   This is the least invasive option and touches no backend code.
2. **Mint via Better Auth on `.site`.** The auth routes under
   `https://quick-panda-920.convex.site/api/auth/*` can issue a session for a
   dedicated staging test user. Drive sign-in once, capture the bearer/JWT, and
   feed it to `CONVEX_TEST_TOKEN`.

When `CONVEX_TEST_TOKEN` is **absent**, the scenarios still run but only assert
"reachable, no 5xx" for authenticated reads (they will see unauthenticated
responses). With a token they assert full `2xx` + body checks.

> Do **not** put a real token in any committed file. Pass it at runtime via
> `-e CONVEX_TEST_TOKEN=...` or an uncommitted local env file.

### Write flows and the test harness (NOT created here)

Write flows (create matchroom, join request, booking intent, payment confirm,
result verification) and the **race-condition** assertions need more than a
read token: they need disposable, per-VU staging data and a clean way to assert
post-conditions and clean up. The realistic and safe way to enable them is a
**staging-only test-harness HTTP endpoint** in `convex/http.ts`. **This was
intentionally NOT added** (it touches backend code). If/when it is added, it
must be built safely:

- Guard it behind an env flag, e.g. only register the route when
  `process.env.LOAD_TEST_HARNESS === "1"`, and **assert the deployment is not
  production** inside the handler (refuse if the deployment name/URL looks
  prod-like).
- Expose only narrow, idempotent operations: `seed` (create a disposable
  matchroom/slot, return ids), `mintTestToken` (issue a short-lived token for a
  dedicated staging test user), and `cleanup` (delete what `seed` created).
- Use a **mock** payment path — never call Easypaisa production. The existing
  `/payments/easypaisa/finalize` route can be driven with test credentials only.
- Never deploy the flag to production; document it in the staging env config.

Until that exists, the write-flow steps in `scenarios/stress.js` and
`scenarios/race.js` are present as **commented plans / inert skeletons**.

---

## Running the tests

> Re-read the staging-only warning at the top first.

```powershell
# Smoke (1-2 VUs, 30s)
npm run load:smoke

# Read-heavy ramps
npm run load:100    # PROFILE=load100
npm run load:500    # PROFILE=load500
npm run load:1000   # PROFILE=load1000
```

Supplying a token and optional targets (PowerShell, one -e per var):

```powershell
k6 run -e CONVEX_TEST_TOKEN=<staging-token> -e PROFILE=load100 `
  -e TARGET_ZONE_ID=<id> -e TARGET_MATCHROOM_ID=<id> `
  load-tests/scenarios/stress.js
```

Race skeleton (needs a token + a disposable `TARGET_MATCHROOM_ID` to do more
than a no-5xx probe):

```powershell
k6 run -e CONVEX_TEST_TOKEN=<staging-token> -e TARGET_MATCHROOM_ID=<id> `
  load-tests/scenarios/race.js
```

Defaults: if `CONVEX_SITE_URL` / `CONVEX_URL` are unset, `lib/http.js` uses the
staging origins. `lib/http.js` also **refuses to run** if a URL looks
production-like.

---

## Profiles (config/options.js)

| Profile | Executor | Shape |
| --- | --- | --- |
| `smoke` | constant-vus | 2 VUs for 30s |
| `load100` | ramping-vus | 0→50→100, hold 3m, ramp down (~100 peak) |
| `load500` | ramping-vus | 0→200→500, hold 5m, ramp down (~500 peak) |
| `load1000` | ramping-vus | 0→300→700→1000, hold 5m, ramp down (~1000 peak) |

Ramps are gradual on purpose so you can see *where* latency starts to degrade
rather than just whether a giant spike fails.

---

## Thresholds and how to read results

Defined once in `config/options.js` and applied to every profile:

| Threshold | Meaning |
| --- | --- |
| `http_req_failed: rate<0.01` | < 1% of requests may fail (network error or status ≥ 400). |
| `http_req_duration: p95<800` | 95th-percentile latency target of **800ms** (documented SLO; tune to the staging baseline). |
| `checks: rate>0.99` | > 99% of functional assertions must pass. |
| `server_errors: rate<0.001` | **No 5xx expectation.** A custom metric in `lib/http.js` records every 5xx; it must stay effectively zero. Any 5xx is a hard failure, not acceptable degradation. |

`race.js` deliberately loosens `http_req_failed` (an intentionally-contended
test expects the losing attempt to get a clean 4xx) but keeps the zero-5xx bar.

Reading the k6 end-of-test summary:

- **`checks`** — pass rate of named assertions; failures point at the exact
  scenario/endpoint (checks are tagged by name).
- **`http_req_duration`** — look at `p95` against the 800ms target, plus `avg`
  and `max`.
- **`http_req_failed`** — overall error rate.
- **`server_errors`** — must be 0. If non-zero, stop and investigate before
  going higher in load.
- A red ✗ next to a threshold means that threshold was breached → the run is a
  failure even if it completed.

Useful flags: `--summary-export=summary.json` (machine-readable),
`--out json=raw.json` (per-request stream).

---

## What NOT to run on production

- Do **not** set `CONVEX_URL` / `CONVEX_SITE_URL` to any production deployment.
- Do **not** run `load:500` / `load:1000` against any shared/staging environment
  without coordinating — they generate real, sustained load.
- Do **not** hit Easypaisa production. Payment steps are mock-only.
- Do **not** enable the write-flow / race mutations against production data; they
  create and (should) clean up disposable records and require the guarded
  staging test harness described above.
```
