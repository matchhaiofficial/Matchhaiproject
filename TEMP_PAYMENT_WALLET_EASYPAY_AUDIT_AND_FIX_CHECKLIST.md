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
- [x] Audit current `syncTransactionStatus` handling for inquiry failures.
- [x] Identify cases like `INVALID ORDER ID`.
- [x] Decide safe backend state:
  - keep active status (`redirected` / `token_received`) or set `pending`
  - use `lastError = "inquiry_unverified"` as a safe internal code
  - do not add `verifying`, `confirmation_pending`, or `manual_review` statuses
- [x] Do not terminally fail uncertain inquiry errors while inside confirmation window.
- [x] Mark failed only when provider clearly confirms failure, TTL expires, or manual review confirms.
- [x] Keep raw provider error in admin/support metadata only.
- [x] Update UI states for verifying/confirmation pending.
- [x] Add expiry/stale cleanup if required.
- [x] Run `npx convex codegen` if schema/API changes.
- [x] Run `npx tsc --noEmit`.
- [ ] Manual test delayed verification.

Expected files:
- `convex/easypaisa.ts`
- `convex/schema.ts` if new status added
- `app/matchrooms/create/index.tsx`
- `app/(player)/wallet.tsx`
- `app/matchrooms/book/status/[intentId].tsx`
- `app/super-admin/(tabs)/payments.tsx`

Files actually changed:
- `TEMP_PAYMENT_WALLET_EASYPAY_AUDIT_AND_FIX_CHECKLIST.md`
- `convex/easypaisa.ts`
- `convex/wallet.ts`

Handoff summary:
- Status: Implemented; manual gateway simulation still pending.
- Files changed: `convex/easypaisa.ts`, `convex/wallet.ts`, and this tracking file.
- New/changed statuses: None. Existing `created`, `redirected`, `token_received`, `pending`, `paid`, `failed`, `expired`, and `cancelled` statuses are unchanged.
- Backend inquiry rules: `source === "inquiry"` plus normalized `resolvedStatus === "failed"` plus an inquiry payload/description/code containing invalid-order style text (`INVALID ORDER`, `INVALID_ORDER_ID`, etc.) is treated as uncertain only while `Date.now() < paymentTransactions.expiresAt`.
- Active-window behavior: uncertain invalid-order inquiry keeps `redirected` or `token_received` as-is; otherwise it stores `status: "pending"` and `lastError: "inquiry_unverified"` so Phase 3 retry reuse still returns the same active `orderRefNum`.
- Expiry behavior: after `expiresAt`, invalid-order inquiry ambiguity is not kept pending; existing expiry/terminal handling is allowed to run.
- Definitive failures: cancelled, declined, rejected, reversed, expired, and non-invalid-order failed inquiry responses still follow existing terminal handling.
- Paid behavior: IPN/finalize/callback paid flow and wallet-first reconciliation are unchanged; `wallet.addFunds` and booking hold logic were not edited.
- User-facing behavior: existing checkout/status screens continue polling active statuses and already show safe copy instead of raw provider strings; `orderRefNum` remains visible.
- Wallet history sanitization: `convex/wallet.ts` no longer uses `providerDescription` as player-facing `subtitle`; payment method/source label can still be shown, while raw provider details remain in payment/admin/debug records.
- Tests run: `npx tsc --noEmit` passed.
- Tests run: `git diff --check` passed with line-ending warnings for touched files only.
- Codegen: Not run because no schema, generated API, or public API type changes were made.
- Known risks: Manual provider simulation is still needed for INVALID ORDER ID during active checkout, definitive rejection, paid IPN after ambiguity, retry reuse, and post-expiry behavior.
- Next phase starting point: Phase 5 should separate wallet balance, reserved/held amount, unpaid bookings, and pending provider payment concepts without changing wallet math.

---

## Phase 5 - Wallet Summary Cleanup

Goal:
Separate wallet concepts clearly so users understand what each number means.

Sub-tasks:
- [x] Define Wallet Balance.
- [x] Define Reserved / Held Amount.
- [x] Define Unpaid Bookings.
- [x] Define Pending Provider Payments.
- [x] Update wallet overview cards.
- [x] Decide whether to show `walletHeldBalance` as "Reserved Amount".
- [x] Keep unpaid booking intents separate from held balance.
- [x] Update transaction tab labels/copy if needed.
- [x] Avoid changing backend wallet math unless approved.
- [x] Run `npx convex codegen`.
- [x] Run `npx tsc --noEmit`.
- [x] Run `git diff --check`.
- [ ] Manual wallet UI check.

Expected files:
- `app/(player)/wallet.tsx`
- `src/services/convex/walletService.ts` if data mapping needs adjustment
- `convex/wallet.ts` only if a new read-only summary query is needed

Files actually changed:
- `TEMP_PAYMENT_WALLET_EASYPAY_AUDIT_AND_FIX_CHECKLIST.md`
- `convex/wallet.ts`
- `src/utils/paymentUiCopy.ts`
- `app/(player)/wallet.tsx`
- `app/(player)/wallet.styles.ts`

Handoff summary:
- Status: Implemented; manual device checks still pending.
- Files changed: `convex/wallet.ts`, `src/utils/paymentUiCopy.ts`, `app/(player)/wallet.tsx`, `app/(player)/wallet.styles.ts`, and this tracking file.
- New API: `api.wallet.getSummary({ userId })` returns `{ balance: users.walletBalance ?? 0, heldBalance: users.walletHeldBalance ?? 0 }` without reading wallet transactions or recomputing balances.
- Security note: `getSummary` follows existing `getBalance` userId pattern for Phase 5 only. A future security cleanup should derive user from auth/session and avoid arbitrary userId wallet reads.
- Wallet cards final labels: `Wallet Balance`, `Reserved`, `Unpaid Bookings`, and `Pending Easypaisa Payment`.
- Wallet Balance definition/data source: available funds to pay for bookings and withdraw; `api.wallet.getSummary.balance`.
- Reserved definition/data source: wallet-held funds for bookings, captured later or released if cancelled; `api.wallet.getSummary.heldBalance` from `users.walletHeldBalance`.
- Unpaid Bookings definition/data source: bookings started but not paid; existing deduped booking intents sum, unchanged from Phase 3 semantics.
- Pending Easypaisa definition/data source: active provider attempts only; `api.easypaisa.getCheckoutStatus` shown only for `created`, `redirected`, `token_received`, and `pending`.
- User-facing provider safety: player wallet no longer gates any displayed copy on `providerDescription`; booking status and matchroom create were scanned and do not render raw `providerDescription` values, only safe copy.
- Tests run: `npx convex codegen` passed; `npx tsc --noEmit` passed; `git diff --check` passed with line-ending warnings only.
- Known risks: Manual wallet UI checks are still needed for live held-balance scenarios and active Easypaisa checkout display.
- Next phase starting point: Phase 6 should add read-only Super Admin visibility for payment detail and reconciliation investigation.

---

## Phase 6 - Super Admin Payment Detail / Reconciliation Visibility

Goal:
Give Super Admin a read-only way to investigate payment problems.

Sub-tasks:
- [x] Add Payment Detail screen.
- [x] Show paymentTransaction details.
- [x] Show linked walletTransaction by `reference = easypaisa:{orderRefNum}`.
- [x] Show linked bookingIntent if available.
- [x] Show linked matchroom if available.
- [x] Show user summary without exposing sensitive data.
- [x] Show provider status, providerDescription, provider context timestamps/status.
- [x] Show reconciliation state.
- [x] Keep this read-only.
- [x] Do not add manual repair actions without approval.
- [x] Run `npx convex codegen` if backend API changes.
- [x] Run `npx tsc --noEmit`.
- [ ] Manual check failed/pending/paid payment.

Expected files:
- `convex/admin.ts`
- `app/super-admin/(tabs)/payments.tsx`
- `app/super-admin/payment/[orderRefNum].tsx` or chosen route
- `src/services/convex/superAdminService.ts`

Files actually changed:
- `convex/admin.ts`
- `src/services/convex/superAdminService.ts`
- `app/super-admin/(tabs)/payments.tsx`
- `app/super-admin/_layout.tsx`
- `app/super-admin/payment/[orderRefNum].tsx`
- `TEMP_PAYMENT_WALLET_EASYPAY_AUDIT_AND_FIX_CHECKLIST.md`

Handoff summary:
- Status: Implemented Phase 6 read-only Super Admin payment detail visibility.
- Files changed: `convex/admin.ts`, `src/services/convex/superAdminService.ts`, `app/super-admin/(tabs)/payments.tsx`, `app/super-admin/_layout.tsx`, `app/super-admin/payment/[orderRefNum].tsx`, this checklist.
- New read-only APIs: `api.admin.getPaymentDetailByOrderRefNum({ sessionToken, orderRefNum })`, sessionToken-gated with existing `getAuthenticatedAdmin`.
- New route: `/super-admin/payment/[orderRefNum]`.
- Fields shown: payment core fields, provider status/reference/short description, provider context `flow`/`lastSyncAt`/`lastProviderStatus`, linked wallet transaction summary, booking intent summary, matchroom summary, masked linked user summary, support IDs.
- Reconciliation flags: `paymentPaidNoWalletTx`, `walletTxWithoutPaid`, `bookingIntentUnpaidButPaymentPaid`, `paymentFailedButWalletTxExists`, `paymentPendingPastExpiry`, `bookingIntentMissing`, `matchroomMissing`.
- Sensitive fields hidden: raw `providerPayload`, IPN bodies, hosted payloads, phone numbers, CNIC, bank/account details, raw secrets, full raw gateway payloads, authId, unmasked email.
- Tests run: `npx convex codegen` passed; `npx tsc --noEmit` passed; `git diff --check` passed with line-ending warnings only.
- Manual test notes: click wallet_topup and booking_intent rows from Super Admin Payments using "View detail"; verify safe empty states for missing wallet/booking/matchroom; verify providerDescription truncation; verify non-admin is blocked by the existing Super Admin layout and backend guard.
- Known risks: Manual verification still needs seeded/live examples for paid wallet top-up, paid booking intent, missing wallet link, expired pending payment, and non-admin access.
- Next phase starting point: Phase 7 should add notifications/user-safe payment errors without exposing provider payloads or changing payment/wallet behavior.

---

## Phase 7 - Notifications and User-Safe Payment Errors

Goal:
Notify users/admins about payment states without spam or raw gateway noise.

Sub-tasks:
- [x] Audit existing `wallet.topup_result`.
- [x] Audit existing `match.payment_result`.
- [x] Add or improve "verification pending" notification if needed.
- [x] Add payment stuck/manual review alert for Super Admin if needed.
- [x] Keep raw provider errors admin-only.
- [x] Add dedupe keys.
- [x] Avoid duplicate notifications from repeated polling.
- [x] Run `npx convex codegen` if backend APIs change.
- [x] Run `npx tsc --noEmit`.

Notification inventory:
- `wallet.topup_result`: triggered in `convex/easypaisa.ts` from Easypaisa provider update outcomes for wallet top-up paid/failed/expired; recipient role is player; dedupe key format is `wallet_topup:payment_result:{paymentTransactionId}:{paid|failed|expired}` with `replace_active`; low spam risk because each final outcome uses a deterministic payment transaction id; player copy is now curated and does not include `providerDescription`; covers wallet top-up paid/failed/expired.
- `match.payment_result`: triggered in `convex/easypaisa.ts` for booking-intent Easypaisa failed/expired/wallet-credit-only outcomes and in `convex/matchrooms.ts` for booking intent paid/expired/slot-unavailable outcomes; recipient role is player; dedupe key formats are `booking_intent:payment_result:{paymentTransactionId}:{failed|expired|wallet_credit_only}` and `match.payment_result:{intentId}:{paid|expired|slot_unavailable}`; repeated outcomes replace the active notification; player copy is now curated and gateway-safe; orderRefNum is included when the result comes from Easypaisa.
- `match.payment_required`: triggered in `convex/matchrooms.ts` when an invite/join request creates a booking payment intent; recipient role is player; dedupe key format is `match.payment_required:{matchroomId}:{userId}:{intentId}` with `upsert_active`; low spam risk per intent; copy is now direct "payment required" text with no provider details.
- Existing `operations.general`: triggered in `convex/easypaisa.ts` when reconciliation throws after provider payment handling; recipient role is Super Admin; dedupe key format is `payment.reconciliation_failure:{paymentTransactionId}:{superAdminId}` with `replace_active`; retained for continuity, but body and route are now safe and deep-link to the payment detail screen instead of exposing the raw exception message.
- New `payments.attention_required`: triggered only from existing Easypaisa write/update paths after stored payment state changes; recipient role is Super Admin; dedupe key format is `payments.attention_required:{orderRefNum}:{flagName}:{superAdminId}` with `upsert_active`; covers `paid_no_wallet_tx`, `wallet_tx_without_paid`, `booking_intent_unpaid_but_payment_paid`, `payment_pending_past_expiry`, and `failed_but_wallet_tx_exists`.

Player-safe copy rules implemented:
- Player notifications never include `providerDescription`, gateway response codes, raw provider payloads, phone/CNIC/payment token, or secrets.
- Player notifications answer what happened and what to do next: use wallet funds, retry/start a new payment, choose another slot, wait, or contact support with the order number.
- Player inbox now treats `wallet.topup_result` and `match.payment_result` as first-class payment notifications, shows title/body directly, and shows `Order: {orderRefNum}` only when that safe reference exists.

Super Admin anomaly alert rules implemented:
- `paid_no_wallet_tx`: payment status is `paid` and no wallet transaction exists with `reference = easypaisa:{orderRefNum}`.
- `wallet_tx_without_paid`: a linked wallet transaction exists while payment status is not `paid`.
- `booking_intent_unpaid_but_payment_paid`: booking-intent payment status is `paid` while linked booking intent `paymentStatus` is `unpaid`.
- `payment_pending_past_expiry`: payment status is `created`, `redirected`, `token_received`, or `pending` after `expiresAt`.
- `failed_but_wallet_tx_exists`: payment status is `failed` while a linked wallet transaction exists.
- Alert route/href is `/super-admin/payment/{orderRefNum}` and data contains only `orderRefNum`, `paymentTransactionId`, `flagName`, `route`, and `href`.

Expected files:
- `convex/easypaisa.ts`
- `convex/notifications.ts`
- `app/(player)/inbox.tsx`
- `app/super-admin/notifications.tsx`

Files actually changed:
- `TEMP_PAYMENT_WALLET_EASYPAY_AUDIT_AND_FIX_CHECKLIST.md`
- `convex/easypaisa.ts`
- `convex/matchrooms.ts`
- `convex/notifications.ts`
- `src/hooks/useNotifications.ts`
- `app/(player)/components/InboxNotificationCard.tsx`

Handoff summary:
- Status: Implemented; validation commands passed.
- Files changed: see list above.
- Notification types: updated `wallet.topup_result`, `match.payment_result`, `match.payment_required`, retained safer `operations.general`, added `payments.attention_required`.
- Dedupe strategy: player result notifications continue using deterministic `replace_active`; `match.payment_required` continues `upsert_active`; Super Admin anomaly notifications use `payments.attention_required:{orderRefNum}:{flagName}:{superAdminId}` with `upsert_active`.
- Tests run: `npx convex codegen` passed; `npx tsc --noEmit` passed; `git diff --check` passed with line-ending warnings only.
- Manual matrix: verify wallet top-up paid/failed/expired inbox copy; booking payment paid/failed/expired inbox copy; orderRefNum appears when present; providerDescription does not appear for players; Super Admin alert opens `/super-admin/payment/{orderRefNum}`; repeated reconciliation keeps one active alert per orderRefNum + flag + Super Admin.
- Known risks: No historical anomaly backfill by design; anomaly alerts only emit when existing Easypaisa write/update paths run.
- Next phase starting point: Phase 8 can focus on operational follow-up workflows or support tooling only after explicit approval, without introducing manual money repair actions by default.

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
