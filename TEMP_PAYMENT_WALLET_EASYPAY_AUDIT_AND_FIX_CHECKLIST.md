# TEMP - Payment / Wallet / Easypaisa Audit & Fix Checklist

## Context

We are fixing confusing and risky payment behavior in Matchhai.

Known customer issue:
- User paid through Easypaisa.
- App showed "Payment Not Completed".
- App showed raw gateway error: `INVALID ORDER ID`.
- Wallet showed `Pending Amount` even though the user thought money was deducted.
- Audit found that Wallet "Pending Amount" currently means unpaid booking intents, not actual Easypaisa pending money or wallet-held balance.
- Rs 22 likely means two unpaid Rs 11 booking intents or duplicate unpaid attempts.

Important findings from audit:
- Easypaisa uses `paymentTransactions.orderRefNum`.
- Wallet top-up uses `kind: "wallet_topup"` with `MHW...`.
- Booking intent payment uses `kind: "booking_intent"` with `MHB...`.
- Successful provider payment credits wallet first.
- Booking intent payment then creates a wallet hold.
- Host matchroom creation currently uses wallet top-up first, then wallet deduction.
- Raw provider descriptions are currently user-facing.
- Retry may reuse an active `orderRefNum`.
- Some booking validations happen after provider payment instead of before payment starts.

Important constraints:
- Do not change money logic without approval.
- Do not change wallet balances without approval.
- Do not write production data during audit.
- Do not expose raw provider errors to users.
- Keep backend idempotency safe.
- Avoid duplicate wallet credits, holds, refunds, or bookings.

---

## Phase 0 - Tracking File

Goal:
Create this temporary tracking file before implementing payment/wallet/Easypaisa fixes.

Sub-tasks:
- [x] Create `TEMP_PAYMENT_WALLET_EASYPAY_AUDIT_AND_FIX_CHECKLIST.md`.
- [x] Include project context, known issue, audit findings, constraints, phases, and handoff areas.
- [x] Do not store secrets, phone numbers, CNIC, bank details, or raw sensitive provider payloads.

Handoff summary:
- Status: Created.
- Files changed: `TEMP_PAYMENT_WALLET_EASYPAY_AUDIT_AND_FIX_CHECKLIST.md`.
- Known risks: Temporary file should remain uncommitted unless explicitly approved.
- Next phase starting point: Phase 1 user-facing UI hotfixes.

---

## Phase 1 - Safe UI Hotfixes

Goal:
Reduce user confusion without changing payment logic or wallet math.

Sub-tasks:
- [x] Identify all user-facing payment failure modals/screens.
- [x] Stop showing raw `providerDescription` / gateway errors like `INVALID ORDER ID` to users.
- [x] Keep `orderRefNum` visible for support.
- [x] Replace user-facing failure copy with safe text:
  - "We could not verify this payment yet."
  - "If money was deducted, please wait a few minutes or contact support with this order number."
- [x] Rename Wallet "Pending Amount" to "Unpaid Bookings" if calculation stays the same.
- [x] Add helper copy:
  - "Bookings you started but have not paid for yet."
- [x] Do not change wallet calculations in this phase.
- [x] Do not change Easypaisa reconciliation logic in this phase.
- [x] Run `npx tsc --noEmit`.
- [ ] Manual test payment failure modal.
- [ ] Manual test wallet overview labels.

Expected files:
- `app/matchrooms/create/index.tsx`
- `app/(player)/wallet.tsx`
- `app/matchrooms/book/status/[intentId].tsx`
- Any shared payment status/modal component if found.

Files actually changed:
- `TEMP_PAYMENT_WALLET_EASYPAY_AUDIT_AND_FIX_CHECKLIST.md`
- `src/utils/paymentUiCopy.ts`
- `app/matchrooms/create/index.tsx`
- `app/(player)/wallet.tsx`
- `app/(player)/wallet.styles.ts`
- `app/matchrooms/book/status/[intentId].tsx`

Handoff summary:
- Status: Implemented; manual device checks still pending.
- Files changed: Added shared user-facing copy constants and replaced player-facing raw gateway/provider text in matchroom create, wallet, and booking status UI.
- UI copy changed: Provider/gateway descriptions now show `Status: We could not verify this payment yet. If money was deducted, please wait a few minutes or contact support with this order number.`
- UI copy changed: Wallet overview card label changed from `Pending Amount` to `Unpaid Bookings`, with helper `Bookings you started but have not paid for yet.`
- Logic intentionally unchanged: No wallet calculations, backend Easypaisa reconciliation, payment status transitions, retry behavior, wallet balances, holds, refunds, or booking logic changed.
- Tests run: `npx tsc --noEmit` passed.
- Known risks: Manual mobile/simulator visual checks are still needed for long helper text inside the two-column wallet stat card.
- Next phase starting point: Phase 2 pre-payment validation gate.

---

## Phase 2 - Pre-Payment Validation Gate

Goal:
Ensure users are blocked before Easypaisa opens if the booking/matchroom/team challenge cannot proceed.

Sub-tasks:
- [x] Audit current validation before `easypaisa.startCheckout`.
- [x] Add or plan backend validation gate before checkout for booking intents.
- [x] Validate matchroom exists.
- [x] Validate matchroom is not expired/cancelled.
- [x] Validate matchroom is not locked.
- [x] Validate slot is still available.
- [x] Validate user is not already joined.
- [x] Validate no duplicate active payable intent for same matchroom/slot.
- [x] Validate no duplicate/conflicting booking at same time.
- [x] Validate amount is correct and server-derived.
- [x] Validate KYC/access gate if required.
- [x] Validate team challenge conflicts if applicable.
- [x] Return clear user-facing errors before payment starts.
- [x] Run `npx convex codegen` if backend APIs change.
- [x] Run `npx tsc --noEmit`.
- [ ] Manual test blocked payment before Easypaisa opens.

Expected files:
- `convex/easypaisa.ts`
- `convex/matchrooms.ts`
- `convex/teamChallenges.ts`
- `src/services/convex/easypaisaService.ts`
- `app/matchrooms/create/*`
- `app/matchrooms/book/pay/[intentId].tsx`
- `app/teams/*`

Files actually changed:
- `TEMP_PAYMENT_WALLET_EASYPAY_AUDIT_AND_FIX_CHECKLIST.md`
- `convex/easypaisa.ts`

Handoff summary:
- Status: Implemented; manual checkout-block checks still pending.
- Files changed: Added booking-intent-only Convex pre-payment validation inside `internal.easypaisa.getStartCheckoutContext`, before active `paymentTransactions` reuse.
- Validations added: KYC/access gate, intent ownership/payable/expiry/payment status, server-derived positive amount, matchroom existence/availability/join-lock, already-joined guard, selected slot presence/side/availability, duplicate active unpaid intent for same slot, and best-effort scheduled-time conflict.
- Validations deferred: No `wallet_topup` validation changes; no provider retry/reference changes; no reconciliation behavior changes; no wallet math changes. Team challenge Easypaisa top-ups remain outside this booking-intent gate.
- Tests run: `npx tsc --noEmit` passed. No Convex/vitest tests were added because this repo does not currently include `vitest`, `convex-test`, `@edge-runtime/vm`, or a test config.
- Codegen: Not run; no Convex function args, return validators, schema, or generated API surface changed.
- Known risks: Best-effort time conflict still uses the existing recent-matchroom scan shape (`by_createdAt`, latest 100), matching current app behavior but not a complete indexed schedule-conflict model.
- Next phase starting point: Phase 3 retry/reference/idempotency cleanup should review active transaction reuse UX, stale active attempts, and duplicate unpaid intent impact on wallet summaries.

---

## Phase 3 - Retry / Reference / Idempotency Cleanup

Goal:
Make payment retry behavior clear and safe.

Sub-tasks:
- [x] Audit active transaction reuse rules for `wallet_topup`.
- [x] Audit active transaction reuse rules for `booking_intent`.
- [x] Decide UI behavior when backend reuses an old active `orderRefNum`.
- [x] Add copy if reusing:
  - "Continuing previous payment attempt."
- [x] Decide behavior for terminal failure:
  - create new attempt only after old attempt is terminal/expired/cancelled.
- [x] Prevent duplicate active payable booking intents from inflating wallet summary.
- [x] Ensure retry does not create duplicate holds.
- [x] Ensure retry does not create duplicate wallet credits.
- [x] Ensure retry does not leave stale active attempts.
- [x] Run `npx convex codegen` if backend APIs change.
- [x] Run `npx tsc --noEmit`.
- [ ] Manual test Try Again behavior.

Expected files:
- `convex/easypaisa.ts`
- `convex/schema.ts`
- `src/services/convex/easypaisaService.ts`
- `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts`
- `app/(player)/wallet.tsx`
- `app/matchrooms/book/pay/[intentId].tsx`
- `app/teams/challenge.tsx`
- `app/teams/challenge-create.tsx`

Files actually changed:
- `TEMP_PAYMENT_WALLET_EASYPAY_AUDIT_AND_FIX_CHECKLIST.md`
- `convex/schema.ts`
- `convex/easypaisa.ts`
- `src/services/convex/easypaisaService.ts`
- `app/(player)/wallet.tsx`
- `app/matchrooms/book/pay/[intentId].tsx`
- `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts`
- `app/teams/challenge.tsx`
- `app/teams/challenge-create.tsx`

Handoff summary:
- Status: Implemented; manual device checks still pending.
- Schema fields added: optional `bookingIntents.activePaymentTransactionId`, `bookingIntents.activePaymentOrderRefNum`, `bookingIntents.activePaymentExpiresAt`, `users.activeTopupPaymentTransactionId`, `users.activeTopupAmount`, and `users.activeTopupExpiresAt`.
- Backend response fields added: `attempt: "reused" | "created"` and `attemptMessage: "Continuing previous payment attempt." | "Starting a new payment attempt."`.
- Booking intent reuse rules: Phase 2 validation still runs first; active unexpired transactions for the same booking intent are returned with `attempt: "reused"`; new transactions are created only when no active transaction exists or previous transactions are terminal/expired.
- Wallet top-up reuse rules: one active unexpired top-up per user; same amount reuses the active transaction; different amount is blocked with `You already have a top-up in progress. Continue it or wait for it to finish.`
- Idempotency checks: start checkout now uses a lock-aware internal mutation that re-reads the booking intent/user, checks the active pointer and fallback active transactions inside the mutation, returns existing active transactions, or inserts and immediately patches the pointer.
- Pointer cleanup: terminal checkout failure and `applyProviderUpdate` terminal outcomes clear booking/top-up pointers only when the pointer still matches the same `paymentTransactions` id, so late old failures do not clear newer active attempts.
- UI copy changed: existing checkout toast flows prepend the backend `attemptMessage`; `app/matchrooms/book/status/[intentId].tsx` was inspected but left unchanged because it does not consume the start checkout result.
- Wallet unpaid bookings display: `app/(player)/wallet.tsx` dedupes unpaid booking intents by `matchroomId` plus sorted selected slot identifiers before summing/displaying; no backend data or wallet balances are changed.
- Tests run: `npx convex codegen` passed after one type inference fix; `npx tsc --noEmit` passed; `git diff --check` passed with only existing line-ending warnings.
- Manual tests pending: double-tap booking pay, terminal booking retry, same-amount top-up retry, different-amount top-up block, unpaid-bookings duplicate display, and unchanged wallet/held balances.
- Known risks: Checkout sessions created before phone/email validation can still remain active until expiry if profile data is missing; historical duplicate active `paymentTransactions` are not mutated and the latest active transaction is reused; both were left unchanged to avoid expanding checkout/reconciliation semantics.
- Next phase starting point: Phase 4 should address uncertain provider inquiry/finalization states like `INVALID ORDER ID`, stale active attempts, manual review/verification state, and provider failure timing without changing wallet math.

---

## Phase 4 - Payment Verification State Model

Goal:
Avoid marking uncertain provider inquiry failures as final failure too early.

Sub-tasks:
- [ ] Audit current `syncTransactionStatus` handling for inquiry failures.
- [ ] Identify cases like `INVALID ORDER ID`.
- [ ] Decide safe backend state:
  - keep pending with verification note
  - verifying
  - confirmation_pending
  - manual_review
- [ ] Do not terminally fail uncertain inquiry errors while inside confirmation window.
- [ ] Mark failed only when provider clearly confirms failure, TTL expires, or manual review confirms.
- [ ] Keep raw provider error in admin/support metadata only.
- [ ] Update UI states for verifying/confirmation pending.
- [ ] Add expiry/stale cleanup if required.
- [ ] Run `npx convex codegen` if schema/API changes.
- [ ] Run `npx tsc --noEmit`.
- [ ] Manual test delayed verification.

Expected files:
- `convex/easypaisa.ts`
- `convex/schema.ts` if new status added
- `app/matchrooms/create/index.tsx`
- `app/(player)/wallet.tsx`
- `app/matchrooms/book/status/[intentId].tsx`
- `app/super-admin/(tabs)/payments.tsx`

Files actually changed:
- TBD

Handoff summary:
- Status:
- Files changed:
- New/changed statuses:
- User-facing behavior:
- Admin-facing behavior:
- Tests run:
- Known risks:
- Next phase starting point:

---

## Phase 5 - Wallet Summary Cleanup

Goal:
Separate wallet concepts clearly so users understand what each number means.

Sub-tasks:
- [ ] Define Wallet Balance.
- [ ] Define Reserved / Held Amount.
- [ ] Define Unpaid Bookings.
- [ ] Define Pending Provider Payments.
- [ ] Update wallet overview cards.
- [ ] Decide whether to show `walletHeldBalance` as "Reserved Amount".
- [ ] Keep unpaid booking intents separate from held balance.
- [ ] Update transaction tab labels/copy if needed.
- [ ] Avoid changing backend wallet math unless approved.
- [ ] Run `npx tsc --noEmit`.
- [ ] Manual wallet UI check.

Expected files:
- `app/(player)/wallet.tsx`
- `src/services/convex/walletService.ts` if data mapping needs adjustment
- `convex/wallet.ts` only if a new read-only summary query is needed

Files actually changed:
- TBD

Handoff summary:
- Status:
- Files changed:
- Wallet cards final labels:
- Data source for each card:
- Tests run:
- Known risks:
- Next phase starting point:

---

## Phase 6 - Super Admin Payment Detail / Reconciliation Visibility

Goal:
Give Super Admin a read-only way to investigate payment problems.

Sub-tasks:
- [ ] Add or plan Payment Detail screen.
- [ ] Show paymentTransaction details.
- [ ] Show linked walletTransaction by `reference = easypaisa:{orderRefNum}`.
- [ ] Show linked bookingIntent if available.
- [ ] Show linked matchroom if available.
- [ ] Show user summary without exposing sensitive data.
- [ ] Show provider status, providerDescription, last inquiry/IPN/finalize timestamps.
- [ ] Show reconciliation state.
- [ ] Keep this read-only.
- [ ] Do not add manual repair actions without approval.
- [ ] Run `npx convex codegen` if backend API changes.
- [ ] Run `npx tsc --noEmit`.
- [ ] Manual check failed/pending/paid payment.

Expected files:
- `convex/admin.ts`
- `app/super-admin/(tabs)/payments.tsx`
- `app/super-admin/payment/[orderRefNum].tsx` or chosen route
- `src/services/convex/superAdminService.ts`

Files actually changed:
- TBD

Handoff summary:
- Status:
- Files changed:
- New read-only APIs:
- New route:
- Fields shown:
- Sensitive fields hidden:
- Tests run:
- Known risks:
- Next phase starting point:

---

## Phase 7 - Notifications and User-Safe Payment Errors

Goal:
Notify users/admins about payment states without spam or raw gateway noise.

Sub-tasks:
- [ ] Audit existing `wallet.topup_result`.
- [ ] Audit existing `match.payment_result`.
- [ ] Add or improve "verification pending" notification if needed.
- [ ] Add payment stuck/manual review alert for Super Admin if needed.
- [ ] Keep raw provider errors admin-only.
- [ ] Add dedupe keys.
- [ ] Avoid duplicate notifications from repeated polling.
- [ ] Run `npx convex codegen` if backend APIs change.
- [ ] Run `npx tsc --noEmit`.

Expected files:
- `convex/easypaisa.ts`
- `convex/notifications.ts`
- `app/(player)/inbox.tsx`
- `app/super-admin/notifications.tsx`

Files actually changed:
- TBD

Handoff summary:
- Status:
- Files changed:
- Notification types:
- Dedupe strategy:
- Tests run:
- Known risks:
- Next phase starting point:

---

## Global Reference Graph

Canonical intended flow:
`orderRefNum`
-> `paymentTransactions`
-> `walletTransactions.reference = easypaisa:{orderRefNum}`
-> `bookingIntentId` if kind is booking_intent
-> `matchroomId`
-> final UI state

Important prefixes:
- `MHW...` = wallet top-up
- `MHB...` = booking intent

Important user-facing rule:
Do not show raw providerDescription to users.

Important admin-facing rule:
Raw providerDescription may be visible to Super Admin/support for investigation.

---

## Global Rules

- Do not delete this file without asking me first.
- Keep it updated after each phase.
- Do not include this file in a production commit unless approved.
- Do not change money logic without approval.
- Do not change wallet balances without approval.
- Do not run production writes during audit.
- Keep backend idempotency safe.
- Do not expose raw provider errors to users.
- Redact sensitive provider/customer data.
