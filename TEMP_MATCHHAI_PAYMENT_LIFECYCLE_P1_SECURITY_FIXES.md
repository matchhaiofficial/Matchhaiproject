# MatchHai — Payment Lifecycle P1 Security Fixes

> **Status:** IMPLEMENTED (local) — not pushed, not deployed, no EAS build.
> **Branch:** `product-ready`
> **Date:** 2026-06-02
> **Builds on:** P0 commit `dfec96b` (return failed matchroom payments to wallet).
> **Source audit:** `TEMP_MATCHHAI_MATCHROOM_PAYMENT_LIFECYCLE_AUDIT.md` (P1 = security).
> **Convex target for codegen:** `dev:ardent-lynx-28` (staging). Codegen only — no deploy.

This phase implements the four **P1 (security)** items from the audit:
1. Server-side create/seat price validation (underpayment guard).
2. Inquiry-gate the hosted-finalize handler (no trusting inbound status).
3. Require deterministic references for `wallet.addFunds`.
4. Idempotency key on the wallet/free matchroom create path.

---

## Pre-flight status

| Check | Result |
|---|---|
| Branch | `product-ready` ✅ |
| P0 commit `dfec96b` present | ✅ |
| `npx tsc -p tsconfig.json --noEmit` (before) | exit 0 ✅ |
| `git diff --check` (before) | clean ✅ |
| Unrelated dirty files | present, **not modified** by this phase (except `convex/wallet.ts`, see note) ✅ |

**Unrelated dirty files (left as-is, NOT part of P1):**
`TEMP_MATCHHAI_PROFILE_EXTERNALS_AND_QR_PRIVACY_FIX.md`, `app/super-admin/users.tsx`,
`app/super-admin/withdrawals.tsx`, `convex/admin.ts`, `convex/zoneWithdrawals.ts`,
`src/services/convex/superAdminService.ts`.

> ⚠️ **`convex/wallet.ts` overlap:** this file already had a pre-existing unrelated hunk
> (`accountNumberFull` for the withdrawal-review screen). P1 FIX 3 adds a *separate* hunk
> (`addFunds` required reference). When committing P1, stage only the FIX 3 hunk (e.g.
> `git add -p convex/wallet.ts`) so the unrelated withdrawal hunk is not bundled into the
> payments commit.

---

## Files changed

**New**
- `convex/matchroomPricing.ts` — pure server-side authoritative pricing module (per-game
  formula ported verbatim from the client hook + promo-rule engine with Asia/Karachi time).

**Backend (Convex)**
- `convex/wallet.ts` — FIX 3: `addFunds.reference` now required + non-empty guard.
- `convex/easypaisa.ts` — FIX 2: `easypaisaFinalizeHandler` now verifies via REST inquiry.
- `convex/matchrooms.ts` — FIX 1 (price validation) + FIX 4 (create idempotency dedup) inside
  `createMatchroomFromValidatedArgs`; new create args; import of pricing module.
- `convex/schema.ts` — FIX 4: `matchrooms.clientCreateRequestId` field +
  `by_hostUid_and_clientCreateRequestId` index.
- `convex/_generated/api.d.ts` — codegen (new module registration / arg shapes).

**Frontend / services**
- `src/services/convex/matchService.ts` — forward `branchId`, `seriesType`, `overs`,
  `durationHours`, `clientCreateRequestId` to the create mutation; `Matchroom` type +field.
- `app/matchrooms/create/utils/matchroomCreatePayloads.ts` — payload carries `branchId` +
  `clientCreateRequestId`.
- `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts` — per-attempt
  `clientCreateRequestId` ref (cleared on success), threads `selectedBranchId`.
- `app/matchrooms/create/index.tsx` — passes `selectedBranchId` to the submit hook.

---

## FIX 1 — Server-side price validation

**Threat:** the client supplied `pricing.perPlayer` / `paymentAmount`; a modified client could
underpay (e.g. `perPlayer=1`) or claim an unpaid free room at a priced venue.

**Design (chosen: underpayment-floor + server-charge).** New `convex/matchroomPricing.ts`
recomputes pricing from the authoritative zone/branch pricing buckets + enabled `pricingRules`:
- **floorPerPlayer** — cheapest *legitimate* price across every plausible config (max possible
  promo discount, minimum series hours, most-generous player divisor, cheapest branch when
  branch unknown). The reject is governed by this conservative floor, so branch/timezone/rounding
  divergence **cannot false-reject** a real booking.
- **expectedPerPlayer** — best estimate for the exact config (selected branch, series/format/overs,
  promos evaluated at the scheduled time in **Asia/Karachi** to match the client's device-local
  evaluation). Used only to **cap** the charge.

**Enforcement point:** `createMatchroomFromValidatedArgs` — covers BOTH player-facing create
paths (public `matchrooms.create` and provider `finalizePaidCreateFromProvider`). Applies to all
`locationMode==="zone"` rooms with a resolvable rate:
- `clientPerPlayer < floor − 1 PKR` → **hard reject** (throws).
- `clientPerPlayer > expected + 1 PKR` → **cap** `pricing.perPlayer` and `paymentAmount` down to
  the authoritative expected (server is source of truth; never overcharges above expected).
- otherwise → untouched (legitimate flow is byte-identical).
- pricing **unresolved** (free venue / missing config / unknown resource) → skipped (no false reject).

**Join/seat payment (criterion 4):** the seat hold amount is derived **server-side** from the
stored `room.pricing.perPlayer` (`matchrooms.ts` `createSingleSeatBookingIntent` /
hold at `:4664`), never from seat-payer client input — so validating create-time pricing makes
join/seat payment authoritative transitively.

**Walk-in / zone-admin booking-request creates** (`zoneAdminBooking.ts`) are **not** gated: those
prices are set by the venue operator (the payee), not the player — not the underpayment threat model.

**Provider-path note:** if a provider-paid create is below floor, `finalizePaidCreateFromProvider`
throws → caught by `applyProviderUpdate` → the already-credited wallet top-up is **preserved as
MatchHai credit** (no underpriced room) + Super Admin alerted (deterministic-retry, see Known risks).

---

## FIX 2 — Inquiry-gate hosted finalize handler

**Threat:** `easypaisaFinalizeHandler` trusted the inbound `status`/`desc` request params. A party
that knew a still-pending 24-char checkout token could POST `status=SUCCESS` and flip the order to
paid (crediting a wallet) with no provider verification.

**Fix:** the finalize handler now treats the inbound return purely as a **trigger**. After validating
the token + order-ref match, it performs the same server-to-server REST inquiry used by IPN/polling
(`easypaisaNode.inquireRestTransaction`) and applies the result via the idempotent
`applyProviderUpdate("inquiry")` path. The inbound `status`/`desc` are kept only as diagnostics in
`rawPayload.finalize` and never drive the resolved status. If the inquiry fails (provider
unreachable), it renders a **pending** page and leaves the transaction untouched (IPN + the
stuck-pending reconciler cron settle it later). User-facing HTML/copy preserved; no raw provider
payload leaked. Idempotency (processedAt / status guards / reference dedupe) unchanged.

---

## FIX 3 — Require references for `wallet.addFunds`

**Threat:** `addFunds` was idempotent **only** when a `reference` was passed; a missing reference fell
back to the non-unique `"manual_topup"` string and could double-credit on retry.

**Fix:** `addFunds.reference` is now a **required** `v.string()` with a non-empty runtime guard;
the dedupe via `walletTransactions.by_reference` is now unconditional. Both existing callers already
pass deterministic references (`easypaisa:<orderRef>`, `venue_payout:<matchroomId>`), so no caller
needed repair — the change *enforces* the invariant for all future callers (Easypaisa deposit,
venue payout, expiry/leave credits, admin adjustments).

---

## FIX 4 — Idempotency key for wallet/free create

**Threat:** the wallet/free create path had no idempotency key; a double-tap, or
`matchService.createMatchroom`'s auth-error replay of `api.matchrooms.create`, could create a
duplicate room **and** a duplicate wallet debit.

**Fix:**
- New `matchrooms.clientCreateRequestId` field + `by_hostUid_and_clientCreateRequestId` index.
- Client generates a stable key once per create attempt (`useRef`), baked into the create args so
  in-attempt retries reuse it; cleared after a room is created so a genuinely-new attempt gets a
  fresh key.
- `createMatchroomFromValidatedArgs` looks up `(hostUid, clientCreateRequestId)` and returns the
  existing room if found — so the retry yields the **same** room. Because the wallet debit reference
  is `matchroom_create:<matchroomId>`, returning the same id also makes the debit a no-op (deduct is
  idempotent by reference). Net: no duplicate room, no double charge.
- Provider-paid create idempotency (`sourcePaymentOrderRefNum`) is unchanged.

---

## Backend schema / API / index changes

- **Schema:** `matchrooms.clientCreateRequestId: v.optional(v.string())`.
- **Index:** `matchrooms.by_hostUid_and_clientCreateRequestId: ["hostUid", "clientCreateRequestId"]`.
- **API:** new module `convex/matchroomPricing.ts` (pure functions, no Convex registration of its
  own; imported by `matchrooms.ts`). New optional create args: `branchId`, `seriesType`, `overs`,
  `durationHours`, `clientCreateRequestId` (only `clientCreateRequestId` is persisted; the rest are
  validation-only/transient).
- **Mutation signature:** `wallet.addFunds.reference` changed `v.optional(v.string())` → `v.string()`.
- **Codegen:** ran `npx convex codegen` against `dev:ardent-lynx-28` → exit 0.

---

## Tests run

| Check | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` (after edits) | exit 0 ✅ |
| `npx convex codegen` (`dev:ardent-lynx-28`) | exit 0 ✅ |
| `npx tsc` (after codegen, against regenerated bindings) | exit 0 ✅ |
| `git diff --check` | clean ✅ |

No automated unit/integration test suite was run for payment flows (none wired for these paths);
see manual QA checklist.

---

## Known risks

1. **Pricing fidelity (FIX 1).** The server formula is ported verbatim from the client hook, but
   the **reject** uses a conservative floor specifically so branch / Asia-Karachi-promo / rounding
   divergence cannot block a legitimate booking. The residual risk is the *opposite*: a server-side
   under-estimate of `expected` (e.g. a promo the server resolves that the client did not) could
   **undercharge** within the legit range — bounded, rare, and only ever in the host's favour. The
   floor still prevents blatant underpayment.
2. **Provider-path underpayment** results in **wallet credit preserved + no room + Super Admin
   alert**, not a clean client-side rejection, and `applyProviderUpdate` returns `shouldRetry:true`
   → the reconciler will re-attempt and re-alert (idempotent, no money movement) until TTL. Noisy
   but safe. (Wallet/direct create rejects cleanly with full rollback.)
3. **FIX 4 concurrency.** The `clientCreateRequestId` dedup uses a read-then-insert (`.first()`),
   matching the existing `sourcePaymentOrderRefNum` pattern. Two *truly simultaneous* in-flight
   creates with the same key (both pass the read before either inserts) could still duplicate —
   mitigated in practice by the client `setSubmitting` guard and the single-attempt key. Convex has
   no unique-constraint primitive; a stronger guarantee would need a dedicated dedupe doc.
4. **`branchId` accuracy.** Threaded from the route param / walk-in branch; if absent the server
   falls back to zone-level pricing for `expected` and the cheapest branch for the floor.

---

## Deferred (P2 / P3) — not in this phase

- Venue-payout clearing window + reversal/clawback; payout-after-verification.
- Refund state modeling (`refunded` terminal status).
- Abandoned-pending & booking-intent server-side expiry sweeps; orphaned-hold watchdog;
  account-deletion hold release.
- Shared secret / allowlist on IPN + finalize routes (FIX 2 closes the status-trust hole; route
  authentication is still P2).
- Stronger create-idempotency (unique dedupe doc) if concurrency proves real.
- Team Challenge money-model rebuild (P3).
- Flip FIX 1 to strict-equality reject once real-world divergence data confirms parity.

---

## Manual QA checklist

**FIX 1 (pricing)**
- [ ] Create a zone matchroom at the correct displayed price → succeeds; stored `pricing.perPlayer`
      and `paymentAmount` match; wallet debited correctly.
- [ ] Modified client sends `perPlayer=1` (below floor) → create rejected, no room, no debit.
- [ ] Modified client sends an inflated `perPlayer` (above expected) → charge capped to expected.
- [ ] Join/seat payment on a validated room holds the correct server-derived amount.
- [ ] Free / broadcast / unpriced-venue create still works (validation skipped).
- [ ] Promo-discounted booking at scheduled time still passes (Karachi-time window).

**FIX 2 (finalize)**
- [ ] Legit Easypaisa hosted return finalizes correctly (inquiry → paid → wallet/room).
- [ ] Forged `GET/POST /finalize?token=...&status=SUCCESS` with provider NOT paid → no credit.
- [ ] Duplicate finalize → no double credit.
- [ ] Provider unreachable at finalize → pending page; IPN/cron settles later.

**FIX 3 (addFunds)**
- [ ] Easypaisa deposit still credits wallet once.
- [ ] Venue payout still credits once; duplicate payout no-ops.
- [ ] Expiry/leave wallet credit still works.

**FIX 4 (create idempotency)**
- [ ] Tap create once → one room, one debit.
- [ ] Rapid double-tap / network-timeout retry → one room, one debit (same room returned).
- [ ] New create attempt after success → a new room is created.
- [ ] Provider-paid create unaffected.
