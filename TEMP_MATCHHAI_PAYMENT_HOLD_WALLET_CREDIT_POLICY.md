# MatchHai — Payment Hold / Wallet-Credit Policy (P0 implementation)

> **Status:** IMPLEMENTED on branch `product-ready` (uncommitted). TypeScript clean. Convex codegen run against **dev:ardent-lynx-28 (matchhai-staging, non-production)**.
> **Date:** 2026-06-02
> **Companion audit:** `TEMP_MATCHHAI_MATCHROOM_PAYMENT_LIFECYCLE_AUDIT.md` (not deleted).
>
> **Policy:** A provider payment means money reached the MatchHai merchant account; internally the
> player receives equivalent MatchHai value that stays **held/reserved** until the matchroom/challenge
> outcome is clear. If it becomes valid/final → **captured/completed**. If it fails/expires/cancels →
> the amount is **returned to the player's MatchHai wallet** (usable in-app, not a bank refund), and the
> player + Super Admin are notified.
>
> **Untouched (per instructions):** payout formula (`payVenueWalletForCompletedMatchroom`), ELO/rating,
> KYC provider logic, withdrawal-review redesign, super-admin onboarding, unrelated wallet UI/pagination.
> No production deploy. No EAS build. No git push.

---

## ⚠️ Commit scope (read first)

Only **these 8 files are this task's changes** — commit only these (plus this tracker):

```
convex/matchrooms.ts          convex/easypaisa.ts        convex/teamChallenges.ts   convex/crons.ts
src/services/convex/teamMatchService.ts   src/services/teamMatchService.ts
app/teams/challenge-create.tsx            app/teams/challenge.tsx
+ TEMP_MATCHHAI_PAYMENT_HOLD_WALLET_CREDIT_POLICY.md (new)
+ TEMP_MATCHHAI_MATCHROOM_PAYMENT_LIFECYCLE_AUDIT.md (new, prior task)
```

The working tree **also** contains pre-existing, unrelated edits that were **already dirty at session
start and are NOT part of this task** — do **not** fold them into this commit:
`convex/admin.ts`, `convex/wallet.ts`, `convex/zoneWithdrawals.ts`, `app/super-admin/users.tsx`,
`app/super-admin/withdrawals.tsx`, `src/services/convex/superAdminService.ts`,
`TEMP_MATCHHAI_PROFILE_EXTERNALS_AND_QR_PRIVACY_FIX.md`. (The QA sub-agent flagged these — including a
full-bank-account-number exposure in withdrawal review — as out-of-scope and security-sensitive; they
belong in their own branch/review.)

---

## TASK 1 — Current payment statuses mapped to the new policy

### Money states (current fields)
| Policy state | Field(s) today | Notes |
|---|---|---|
| Provider paid | `paymentTransactions.status="paid"`, `processedAt` | inquiry-gated; set only by `applyProviderUpdate` |
| App hold/reserved | `bookingIntents.heldStatus="held"` + `users.walletHeldBalance` | per booking intent; ref `hold:booking_intent:<id>:<src>` |
| Completed/captured | `bookingIntents.heldStatus="captured"`; `walletHeldBalance -=` | at `scheduledStartAt` or on matchroom `completed` |
| Released/refunded to wallet | `heldStatus="released"`/`"refunded"`; `walletBalance +=` | refs `release:/refund:booking_intent:<id>` |

### Money primitives (unchanged — reused)
`wallet.addFunds / holdFunds / releaseHeldFunds / captureHeldFunds / refundFunds / deductFundsInternal`
— all idempotent via `walletTransactions.by_reference`.

### Where provider-paid becomes wallet value
`easypaisa.applyProviderUpdate` → `wallet.addFunds(ref easypaisa:<orderRef>)`, then booking-intent
funding places the hold, or create finalizes and deducts. All in one mutation (atomic).

### Gaps vs policy that this task closes
| Gap (from audit) | Status |
|---|---|
| Player leaves before lock → hold NOT released (wrongful capture) | **FIXED** (Task 2) |
| Expiry/cancel/reject release money but send **no notification** | **FIXED** (Task 2/6) |
| Provider-paid create that can't finalize → no clear player notice | **FIXED** (Task 3) |
| No server reconciliation of stuck/abandoned pending payments | **FIXED** (Task 7) |
| Team Challenge collects money unsafely / client-asserted paid status | **DISABLED** (Task 5) |

---

## What changed (by task)

### Task 2 + 6 — Join hold: release-to-wallet + notifications  (`convex/matchrooms.ts`)
- New `notifyBookingWalletCredit(ctx, {intent, amount, kind, reason})` + `getBookingWalletCreditReasonText`.
  Sends an idempotent **player** notification (`wallet.booking_credit`, dedupe `…:<intentId>:<kind>`,
  route `/(player)/wallet`, copy uses "added back to your MatchHai wallet" — never "refund") and a
  **Super Admin** notification (`payments.booking_credit`, per-admin dedupe).
- Called inside `releaseBookingIntentHold` and `refundCapturedBookingIntentHold` (after the terminal
  patch) → **covers leave, matchroom expiry, host cancel, and zone-reject uniformly** because every
  release/refund flows through these two helpers.
- `leave` mutation now releases the leaver's held booking intent(s) (index `by_createdByUid_matchroomId`)
  with reason `left_before_lock`. Funds return to wallet; player + Super Admin notified.

### Task 4 — Capture guard (verified, no change needed)
`captureBookingIntentHold` already returns `not_held` when `heldStatus !== "held"`. After `leave` sets
`"released"`, the scheduled capture no-ops — no charge for a departed player. Also releases (not captures)
if the room is cancelled/expired at fire time.

### Task 3 — Provider-paid create that can't finalize → wallet credit + accurate notice  (`convex/easypaisa.ts`)
In the reconcile "paid" path for a `wallet_topup` order, if `matchroomCreateArgs` was present but the
room did **not** finalize (`matchroomCreate.matchroomId` absent), the player now gets the
`wallet_credit_only` message ("Payment added to wallet… booking could not be confirmed. Funds are
available in your MatchHai wallet.") instead of the generic "Top-up successful". Money was already
credited atomically (`addFunds`); Super Admin attention flags already fire. Normal top-ups (no create
args) still resolve to `"paid"`.

### Task 7 — Stuck/abandoned payment reconciler cron  (`convex/easypaisa.ts`, `convex/crons.ts`)
- Refactor: extracted `performProviderInquiryAndApply(ctx, row)` (inquiry → `applyProviderUpdate`),
  shared by `syncTransactionStatus` (behavior unchanged) and the cron.
- `listStaleActivePaymentTransactions` (internalQuery): scans active statuses
  (`created/redirected/token_received/pending`) via index `by_provider_and_status_and_createdAt`,
  age window 10 min–7 days, bounded `take(limit)`. **No schema/index change required** (index existed).
- `reconcileStalePayments` (internalAction): re-fetches each row, re-checks it is still active,
  **throttles** via `lastCallbackAt` (≥30 min cooldown), then re-inquires through the idempotent
  `applyProviderUpdate` path — which credits the wallet + notifies payer/Super Admin when the provider
  confirms paid but the booking/create can no longer complete.
- Registered in `crons.ts`: `"stale payment reconciler"`, every **5 min**, `batchSize 15`.
- Idempotency: `applyProviderUpdate` short-circuits on `processedAt || status==="paid"` before any credit;
  all wallet ops are reference-keyed. Re-running on the same row is a safe no-op.

### Task 5 — Disable paid Team Challenge flow
- **Backend (`convex/teamChallenges.ts`) — authoritative:** `createFull` forces
  `teamAPaymentStatus=teamBPaymentStatus="unpaid"` and drops both amounts (`undefined`); `respond` on
  accept forces `teamBPaymentStatus="unpaid"` (was defaulting to `"paid"`) and drops the amount. A
  crafted client **cannot** assert a paid challenge.
- **Service (`src/services/convex/teamMatchService.ts` + barrel):** new
  `TEAM_CHALLENGE_PAYMENTS_ENABLED=false` + `TEAM_CHALLENGE_PAYMENTS_DISABLED_COPY`.
  `payTeamChallengeWithWallet` **hard-stops with no wallet deduction** when disabled;
  send/accept submit `"unpaid"`.
- **UI (`app/teams/challenge-create.tsx`, `app/teams/challenge.tsx`):** payment alert / wallet / Easypaisa
  top-up blocks are gated behind `TEAM_CHALLENGE_PAYMENTS_ENABLED` → challenges create/accept as
  free/social; disabled-copy banner shown; the price note no longer claims the captain pays.
- **Recovery for any previously-paid test challenges:** none are created going forward (statuses coerced
  unpaid). Any historical `team_challenge` wallet deduction sits as a normal `walletTransactions`
  `withdrawal` row; reverse manually via an `addFunds` credit with a deterministic reference if needed
  (no automated reversal added — out of P0 scope, documented).

---

## Idempotency / security summary
- **Leave/expiry/cancel/reject release:** status-guarded (`heldStatus`) + reference-keyed wallet ops
  (early-return on repeat) → no double credit. Notifications dedupe-keyed → no spam.
- **Reconciler:** `processedAt`/`status==="paid"` short-circuit + reference dedupe + per-row re-check +
  30-min cooldown → no double-credit, bounded provider load.
- **Team Challenge:** server coercion is the source of truth (client cannot assert paid); service +
  UI provide defense-in-depth so no wallet deduction path remains.
- **No client can mark a payment paid**, set a create price, or move another user's money via these paths.

## Backend schema / API / index changes
- **Schema/indexes:** none.
- **New Convex functions:** `easypaisa.listStaleActivePaymentTransactions` (internalQuery),
  `easypaisa.reconcileStalePayments` (internalAction); new cron entry. Activated on staging-dev via
  codegen; a normal `convex deploy` activates them elsewhere.

## Validation
- `npx tsc -p tsconfig.json --noEmit` → **exit 0** (clean).
- `git diff --check` → **exit 0** (only benign LF→CRLF warnings).
- `npx convex codegen` → **exit 0**, target **dev:ardent-lynx-28** (matchhai-staging, non-production).
  (Codegen synced functions to the staging-dev deployment as part of its normal operation; production
  untouched.)
- QA/regression sub-agent verdict: payment-policy core **correct and idempotent, safe to ship**; only
  flag was the pre-existing out-of-scope super-admin/withdrawal edits (see Commit scope above).

## Known risks / deferred (P1+)
- **Non-withdrawable credit:** policy says returned funds should be in-app-only (not withdrawable).
  Current `releaseHeldFunds`/`refundFunds` return to `walletBalance` (withdrawable). Kept existing model
  per instructions; a separate non-withdrawable credit bucket is a P1 schema change.
- **Hard-failing create finalize** (deterministically invalid args) loops as `pending` + Super Admin
  alerts (money safe in wallet). A max-attempts → finalize-as-wallet-credit is a P1 refinement.
- **Reconciler** has a 30-min cooldown but no absolute attempt cap before forcing `expired`; relies on
  the 15-min `expiresAt` expiry inside `applyProviderUpdate` to terminate abandoned rows.
- **Abandoned booking-intent / pending-payment server-side expiry sweep** not added here (audit P2).
- **Team Challenge** is disabled, not rebuilt; safe escrow model (bookingIntent holds per team, zone
  pipeline, atomic pay+create) remains the larger P3 effort.
- Verify the notification renderer/route table handles the new types `wallet.booking_credit` /
  `payments.booking_credit` (out of this diff's scope).

---

## MANUAL QA CHECKLIST (to run on staging-dev)

**Matchroom join hold → wallet credit**
1. Player requests join → captain accepts → player pays (wallet or Easypaisa). Confirm `walletHeldBalance`
   increases (hold), seat assigned.
2. Player leaves before lock → confirm hold returns to `walletBalance`; player gets "Wallet credited";
   Super Admin gets "Booking hold released to wallet".
3. Let the scheduled capture time pass → confirm it does **not** charge the departed player.
4. Repeat leave/retry → confirm **no** duplicate credit and **no** duplicate notification.

**Matchroom expiry / cancel**
5. Full room with held participants expires before valid/final → all held amounts return to wallets;
   notifications sent once each; no duplicate credits.

**Provider stuck payment**
6. Create a pending Easypaisa transaction, kill the app (no IPN). Within ~10–15 min the cron re-inquires;
   if provider paid → wallet credited (+ player/Super Admin notified); if the create can't finalize →
   `wallet_credit_only` message; if never paid → row expires. Confirm no duplicate credit across ticks.

**Team Challenge**
7. Create a challenge → confirm **no** payment prompt, challenge stored `teamAPaymentStatus="unpaid"`,
   disabled-copy banner visible, **no** wallet deduction.
8. Accept a challenge → stored `teamBPaymentStatus="unpaid"`, no deduction.
9. Attempt to assert paid via a crafted `createFull`/`respond` call → server stores `"unpaid"`.

**Regression**
10. Existing wallet balances correct; existing provider create + join payment still work; zone payout
    formula unchanged; no ELO/KYC change.

---

## Recommended commit message
```
fix(payments): return failed matchroom payments to wallet

- leave-before-lock releases the booking hold to the player's MatchHai wallet
  and notifies player + super admin (prevents wrongful capture of a departed
  player's funds); expiry/cancel/zone-reject now notify on release/refund too
- provider-paid matchroom create that can't finalize tells the payer funds
  landed in their wallet (wallet_credit_only) instead of a generic top-up notice
- add stale-payment reconciler cron (every 5m) that re-inquires abandoned/stuck
  Easypaisa transactions through the idempotent applyProviderUpdate path so a
  payment taken while the app was killed still credits the wallet
- disable paid Team Challenge flow: server coerces challenge payment status to
  unpaid (no client-asserted paid), service performs no wallet deduction, UI
  creates/accepts free/social with disabled copy

No schema/index changes. No payout-formula/ELO/KYC changes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
