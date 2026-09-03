# MatchHai — Team Challenge Payment Rebuild

> **Status:** IN PROGRESS (local) — not pushed, not deployed, no EAS build.
> **Branch:** `product-ready`
> **Date:** 2026-06-02
> **Builds on:** P0 (`dfec96b`) + P1 (uncommitted in working tree).
> **Convex target for codegen:** `dev:ardent-lynx-28` (staging). Codegen only — no deploy.

Rebuilds Team Challenge payments on the **same safe hold/capture/refund/payout model** as
solo/zone matchrooms. **Product rule: only the captain of each team pays** (full team amount);
team members never pay individually.

**Decisions (confirmed with product owner):**
- Execution: inline, sequential.
- Provider: **Wallet + Easypaisa** both supported now.
- Zone approval: linked matchroom **routes through the existing zone-admin pipeline**.
- Linked matchroom is created **server-side** once both captain holds exist (no client-driven
  payment-linked room creation — that was the core unsafe pattern).

---

## Phase 1 — Audit of current model (BEFORE changes)

**Schema `teamChallenges`** (`schema.ts:1067`): `status ∈ {pending, accepted, venue_proposed,
venue_confirmed, admin_pending, completed, rejected, expired}`; `teamA/BPaymentStatus ∈
{unpaid,pending,paid}`; `teamA/BPaymentAmount`; `pricePerPlayer`, `zoneRateKey/Label/Price`;
`captainA/BUid`, `matchroomId`, `zoneId`, `confirmedVenue`, `maxPlayers`, `scheduledAt`.
Indexes: `by_challengerTeamId`, `by_opponentTeamId`, `by_status`, `by_matchroomId`.

**Backend `teamChallenges.ts`:**
- `create` / `createFull` — insert challenge. **P0 hard-codes both payment statuses to `"unpaid"`
  and never persists amounts** (free/social only). Captain-A auth enforced.
- `respond(accept|reject)` — accept → status `accepted`, coerces `teamBPaymentStatus="unpaid"`;
  reject → `refundChallengerPaymentForRejectedChallenge`.
- `proposeVenue` / `confirmVenue` — captains converge on a zone; `venue_confirmed` when both pick same.
- `complete` / `cancel` / `update` — captain-gated; `update` lets the client set `matchroomId`.
- `refundChallengerPaymentForRejectedChallenge` — **legacy**: directly patches `walletBalance` +
  inserts a `refund` row (ref `team_challenge_refund:<id>:teamA`); scans for an old bare-`deductFunds`
  withdrawal. Tied to the disabled old model; Team-A only.

**Client `teamMatchService.ts`:** `createFull` → server; `wallet.deductFunds` (bare, line 491,
legacy); builds the **linked matchroom client-side** (`:713`) with `bookingSource:"challenge"`,
`paymentStatus:"unpaid"`, **no `zoneOwnerUid`**, `zoneAdminApproved:false`, then
`teamChallenges.update` stores `matchroomId`.

**Gaps vs new model:** client-asserted/absent paid status; bare deduct (no escrow hold); legacy
Team-A-only refund; no capture; no zone payout; linked room bypasses zone pipeline & lacks
`zoneOwnerUid`; no challenge expiry cron; `admin_pending`/`adminReviewStatus` unwired.

---

## Phase 2 — New payment state machine (per side A/B)

New fields on `teamChallenges` (additive, optional):
- `teamAPaymentState` / `teamBPaymentState` ∈
  `unpaid | payment_required | held | captured | released | refunded | failed | expired`
  (kept alongside the legacy `teamA/BPaymentStatus` for back-compat reads).
- `teamA/BPayerUid`, `teamA/BAmountDue`, `teamA/BHoldReference`, `teamA/BProviderOrderRef`,
  `teamA/BHeldAt`, `teamA/BCapturedAt`, `teamA/BReleasedAt`.
- `paymentMode` (`free` | `paid`), `paidFlowEnabled` marker.
Index added: `by_captainAUid`, `by_captainBUid` (for provider/captain lookups) — only if needed.

**Deterministic wallet references** (reuse `wallet.holdFunds/releaseHeldFunds/captureHeldFunds/refundFunds`):
- hold: `team_challenge_hold:<challengeId>:teamA|teamB`
- capture: `team_challenge_capture:<challengeId>:teamA|teamB`
- release: `team_challenge_release:<challengeId>:teamA|teamB`  (distinct from legacy refund ref)
- provider top-up: `easypaisa:<orderRef>` (existing) → then hold above.

**Invariants:** payment state is server-owned; client may only *start* payment or *read* status;
amount recomputed server-side (`teamSize × authoritative perPlayer`); no client paid assertion;
only the respective captain may pay/accept for a side.

---

## Phase 3–4 — Captain holds (Team A on create, Team B on accept)
Wallet: `holdFunds(team_challenge_hold:<id>:side)` (idempotent → no double-hold on retry).
Provider: Easypaisa `wallet_topup` with `checkoutContext.teamChallengeHold = {challengeId, side,
captainUid, amount}`; on inquiry-verified paid → `addFunds(easypaisa:<orderRef>)` then place the
hold via an internal mutation. Failure after top-up → funds stay as wallet credit + Super Admin alert.

## Phase 5 — Linked matchroom + zone pipeline (server-side)
When both sides `held` + venue confirmed → server creates the linked matchroom with `zoneOwnerUid`,
`bookingSource:"team_challenge"`, team sizes, schedule, and dispatches the zone-admin request.

## Phase 6–8 — Capture / release / payout
Single internal helper `settleTeamChallengeForMatchroom(matchroomId, action)` invoked alongside the
existing bookingIntent hooks in `updateStatus` (complete→capture, cancel/expire→release),
`adminCancel`, `expireMatchroomForInvalidLifecycle`, and the zone-reject path. Capture both sides on
valid/final; release both on any failure. Zone payout reuses `payVenueWalletForCompletedMatchroom`
(idempotent, pilot/90-10) — unchanged.

## Phase 9 — Provider flow (Easypaisa) — see Phase 3–4.
## Phase 11 — Notifications: held/released/captured to each captain; zone-admin approval; Super Admin on wallet-credit/anomaly.
## Phase 12 — Security: captain-only per side; server-owned state/amount; no cross-wallet; zone-owner-only management.

(Sections below filled in as implementation proceeds.)

---

## Implementation status (incremental, validated slices)

**DONE — Slice 1: wallet captain-hold money core** (`convex/teamChallenges.ts`)
- Per-side state machine helpers (`held/captured/released` via `wallet.holdFunds/captureHeldFunds/releaseHeldFunds`, idempotent by deterministic reference `team_challenge_{hold,capture,release}:<id>:teamA|teamB`).
- Server amount = `ceil(pricePerPlayer × teamSize)`, teamSize = `floor(maxPlayers/2)` — computed server-side; client cannot set amount.
- `payTeamChallengeSideFromWallet` (captain-gated; Team B blocked until Team A held; idempotent — re-pay while held/captured is a no-op).
- `getChallengePaymentSummary` query (captain-gated, drives UI).
- `settleForMatchroom` internal mutation (capture|release both sides) + `releaseChallengeHolds` helper.
- Reject (`respond`) and `cancel` now release held funds **before** deleting/closing (no stranded escrow). Legacy `teamA/BPaymentStatus` deliberately untouched so the legacy refund path stays dormant (no double-credit).

**DONE — Slice 2a: matchroom lifecycle capture/release hooks** (`convex/matchrooms.ts`)
- `settleForMatchroom` invoked on: completion → **capture**; cancel/expire (`updateStatus`), invalid-lifecycle expiry, `adminCancel`, and `releaseHoldsForMatchroom` (zone-reject) → **release**. No-ops for non-challenge rooms via `by_matchroomId` lookup.

**DONE — Slice 2b: server-side linked matchroom + zone dispatch** (`convex/matchrooms.ts`)
- `createTeamChallengeMatchroom` internal mutation: validates both `held` + `confirmedVenue` + not-already-linked; resolves `zoneOwnerUid` from the confirmed zone; builds captain player records defensively (never throws on skill gate); generates `slotsA/slotsB` (captain confirmed in seat 1); inserts the room with `bookingSource:"team_challenge"`, `paymentStatus:"paid"`, `paymentAmount = perPlayer × maxPlayers` (so venue payout is correct); links `matchroomId` + sets challenge `admin_pending`; **force-dispatches the zone-admin request** (`dispatchZoneAdminRequestForFullMatchroom(..., {force:true})` — challenge "fullness" = both captains paid, not per-seat confirmation).
- Triggered from `maybeFinalizeChallengeBooking` on the second hold AND on venue confirmation (`proposeVenue` bothConfirmed / `confirmVenue`). Idempotent (returns existing room if linked).

**DONE — Slice 3: Easypaisa provider flow** (`convex/easypaisa.ts`)
- `teamChallengeHold` checkout context threaded through `getStartCheckoutContext` / `createCheckoutTransactionWithLock` / `startCheckout` (+ the 3 active-transaction-preservation guards generalized to domain contexts). Stored in `providerPayload.checkoutContext.teamChallengeHold`.
- In `applyProviderUpdate` paid branch, after `addFunds` tops up the wallet, `holdSideFromProvider` moves that exact amount into the captain's team escrow hold. **Defensive**: if the hold can't be placed (challenge gone / wrong captain / inactive), the credited top-up is preserved as wallet credit + Super Admin alerted (no rollback of paid money).

**DONE — Slice 4 (service layer + correctness guard)** (`src/services/convex/teamMatchService.ts`)
- `payTeamChallengeWithWallet` now calls `payTeamChallengeSideFromWallet` (server escrow hold) instead of a bare `deductFunds`.
- New `startTeamChallengeEasypaisaCheckout` (provider) + `getTeamChallengePaymentSummary` services.
- **Critical fix:** `proposeTeamChallengeVenue` no longer creates the linked matchroom client-side for **paid** challenges — it defers to the server (prevents a duplicate, unpaid, `zoneOwner`-less room). Free/social challenges keep the existing client path.

**DONE — UI wiring + flag flip** (`app/teams/challenge.tsx`, `challenge-create.tsx`, service flag)
- `TEAM_CHALLENGE_PAYMENTS_ENABLED = true`.
- **Create screen:** no longer pays before the challenge exists. It creates the challenge, then (paid) routes the challenging captain to the detail screen to pay. The old pre-create payment prompt + create-screen Easypaisa modal path are now inert (never triggered).
- **Detail screen:** reads `getChallengePaymentSummary` and renders a **"Team Payment"** card with per-side states (`Unpaid/Payment required/Held/Confirmed/Returned to wallet/…`) + a **"Pay your team"** action (Wallet + Easypaisa) for the viewing captain when their side is unpaid and allowed to pay (Team B only after acceptance). Accept is now **payment-free** (server requires accept-before-pay for Team B); payment is the explicit captain step. The existing Easypaisa modal was repurposed to fund the **hold** via the `teamChallengeHold` checkout context (provider places the hold server-side; no client-side double-charge).

**DONE — Challenge expiry cron** (`convex/teamChallenges.ts` + `convex/crons.ts`)
- `expireStaleChallenges` internal mutation (cron: "team challenge expiry sweep", every 30 min, batchSize 25). Expires non-terminal, **non-linked** challenges that are past their scheduled time, OR `pending` past a 7-day accept TTL, OR abandoned (no schedule) past 14 days — and **releases any held captain funds** to wallets (idempotent) + notifies both captains. Linked-matchroom challenges are skipped (the matchroom lifecycle sweep owns their expiry/release).

**REMAINING:**
- Manual visual QA of the two screens (couldn't be run here) — see checklist.
- Provider checkout-amount server validation — P2.

## Files changed
- `convex/schema.ts` — `teamChallenges` payment state-machine fields (additive, optional).
- `convex/teamChallenges.ts` — money core + reject/cancel release + `settleForMatchroom` + `holdSideFromProvider` + finalize triggers.
- `convex/matchrooms.ts` — lifecycle capture/release hooks; `createTeamChallengeMatchroom`; `force` option on zone dispatch.
- `convex/easypaisa.ts` — `teamChallengeHold` checkout context + provider hold placement.
- `src/services/convex/teamMatchService.ts` — wallet/provider/summary services + server-defer guard.
- `convex/_generated/api.d.ts` — codegen.

## Tests run
- `npx convex codegen` (`dev:ardent-lynx-28`) → exit 0 (run after each backend slice).
- `npx tsc -p tsconfig.json --noEmit` → exit 0 (after each slice).
- `git diff --check` → clean.

## Known risks
- **UI not yet wired / flag off:** paid Team Challenge UI is not rendered and `TEAM_CHALLENGE_PAYMENTS_ENABLED` is `false`. The backend + services are complete and safe, but end-to-end paid flow is not user-reachable until the screens are wired (intentional — avoids a half-rendered paid UI).
- **Provider checkout amount** is currently set client-side (= server-computed team amount) and the hold uses the actually-paid amount. A server-side checkout-amount validation (à la P1 FIX 1) is recommended P2 so a tampered provider checkout can't underpay. Wallet path is fully server-enforced.
- **Concurrency:** side holds are idempotent via `wallet.holdFunds` reference dedupe; re-pay is a no-op. Two truly-simultaneous finalizes are guarded by the `matchroomId` linked-check (read-then-write; matches the existing `sourcePaymentOrderRefNum` pattern).
- **Roster fidelity:** the linked matchroom seats only the two captains by default (lineup members aren't force-added to avoid skill-gate throws); the zone booking is what matters for payout. Full roster population can be a later enhancement.

## Deferred (P2/P3)
- UI screen wiring + flag flip (final enablement step).
- Challenge expiry cron (paid-but-unaccepted auto-release after TTL).
- Zone-authoritative price recompute for challenge create + provider checkout amount validation.
- Full lineup→slot population on the linked matchroom.

## Manual QA checklist (see prompt §MANUAL QA)
Runnable now (wallet path, pre-Slice-2b): captain pays from wallet → hold; non-captain blocked;
Team B blocked until Team A held; reject/cancel returns held funds to wallet; duplicate pay no-ops;
notifications fire. Full end-to-end (zone approval, capture, payout, provider) pending Slices 2b–4.
