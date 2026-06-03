# MatchHai — Security, Race-Condition & Abuse Testing

This document covers Phase 5: what is automated today, and the staging/manual
procedures for cases that cannot be safely or fully automated yet.

> **Guardrails:** never run these against production. No real Easypaisa calls.
> Use the staging Convex deployment (`quick-panda-920`) with seeded test data
> (see [TEST_DATA.md](./TEST_DATA.md)).

## Automated coverage (`npm run test:security`)

| File | What it proves |
|------|----------------|
| `__tests__/security/backendAuth.test.ts` | The real `convex/authz.ts` gates reject unauthenticated callers, callers with no profile, non-super-admins, acting on another user's id, and wrong-zone admins. `publicUser()` never leaks email/phone/cnic/bank/token/raw provider payload. |
| `__tests__/security/superAdminAbuse.test.ts` | Privilege-escalation attempts fail closed (wrong-case roles, spoofed/look-alike emails, client-claimed roles). Legacy `super-admin` role still works (no lockout). |
| `__tests__/security/matchroomAbuse.test.ts` | Overfill prevention, join-after-lock blocked, leave-after-venue-confirm blocked, expired (dead) rooms not joinable — the rule layer the mutations enforce. |
| `__tests__/security/authzMatrix.test.ts` | `it.todo()` matrix of every critical mutation's negative-auth case (visible each run as outstanding e2e coverage). |

### How the backend-auth tests work without a deployment
They import `convex/authz.ts` and inject a minimal fake `ctx` (`auth.getUserIdentity`,
`db.query().withIndex().unique()`, `db.get()`). `convex/auth.ts` is mocked because
it pulls the better-auth ESM chain Jest can't transform; `authz` only uses
`authComponent.getAuthUser`, which `getCurrentUser` already guards in try/catch.

## Deferred: end-to-end mutation negative-auth (needs `convex-test`)

Calling the **real** Convex functions with a forged/low-privilege identity and
asserting they throw requires the in-memory [`convex-test`](https://docs.convex.dev/testing/convex-test)
harness. It is **not yet installed** because the auth layer (`@convex-dev/better-auth`)
needs a mock identity provider wired into the harness first. Recommended setup:

1. `npm i -D convex-test @edge-runtime/vm` (matching the Convex version).
2. Add `jest`/`vitest` project that uses `convexTest(schema)` and stubs
   `ctx.auth` with `t.withIdentity({ subject, email })`.
3. Port each `it.todo()` in `authzMatrix.test.ts` to a real assertion.

## Race-condition procedures

### 1. Two users booking the same slot simultaneously
- **Automated (load):** `load-tests/scenarios/race.js` fires two VUs at the same
  slot with a wall-clock barrier; expect exactly one 2xx winner, the loser a clean
  4xx (`SLOT_ALREADY_FILLED`), **no 5xx**, no double-hold, no overfill.
- **Manual (staging):** two seeded devices/sessions tap "confirm slot" together;
  verify one succeeds, the other shows the safe slot-filled copy, and the slot
  count never exceeds capacity.

### 2. Duplicate join requests
- Send the same `requestJoin` twice rapidly (race.js duplicate-join scenario, or
  two manual taps). Expect a single active request and **no duplicate notification
  spam**.

### 3. Payment expiry vs. provider success
- **Cannot be load-tested against real Easypaisa.** Use the staging/mock payment
  path only. Simulate: (a) local payment expires, then provider posts success;
  (b) provider success arrives, local state already expired. Verify no money is
  lost, wallet credit/finalize is idempotent, and the seat state is consistent.
- Reference backend hardening: `convex/easypaisa*.ts`, `TEMP_MATCHHAI_PAYMENT_PROVIDER_IDEMPOTENCY_FIX.md`.

### 4. Fake result submission payloads
- As a non-participant / non-captain, attempt `submitResult`; expect rejection.
- Submit a wrong winner/team; expect validation rejection. Submit twice; expect
  idempotent finalize (ELO applied once). Automate once `convex-test` is wired.

## Privacy assertions
- `publicUser` projection test guarantees public profiles never expose tokens,
  secrets, CNIC, bank, phone/email, or raw PSN payloads — aligned with the
  monitoring redaction rules in [MONITORING.md](./MONITORING.md).
