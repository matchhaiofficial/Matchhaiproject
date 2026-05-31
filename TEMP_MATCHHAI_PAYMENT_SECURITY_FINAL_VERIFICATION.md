# MatchHai Payment Security Final Verification

Started: 2026-05-28

Scope: final focused verification before commit for actor-scoped payment compatibility, Easypaisa authenticity hardening, idempotency guards, and Super Admin anomaly visibility. No pagination/performance work, no UI/store-readiness work, no EAS build, no production deploy, no payout formula or credential changes.

## Files Inspected

- `convex/easypaisa.ts`
- `convex/matchrooms.ts`
- `convex/bookings.ts`
- `convex/wallet.ts`
- `convex/admin.ts`
- `convex/notifications.ts`
- `convex/zoneWithdrawals.ts`
- `src/services/convex/easypaisaService.ts`
- `src/services/convex/matchService.ts`
- `src/services/convex/bookingService.ts`
- `src/services/convex/superAdminService.ts`
- `app/matchrooms/book/pay/[intentId].tsx`
- `app/matchrooms/book/status/[intentId].tsx`
- `app/(player)/wallet.tsx`
- `app/super-admin/(tabs)/payments.tsx`
- `app/super-admin/payment/[orderRefNum].tsx`

## Payment Callsite Verification

- No frontend/service code calls `internal.*` Convex functions directly.
- Frontend/service code does not mark provider payments as paid. `src/services/convex/bookingService.ts` refuses `updateIntentPaymentStatus(..., "paid")` before calling Convex.
- Booking "Refresh Payment Status" calls `easypaisa.syncTransactionStatus`; it does not mark paid locally.
- Booking "Dashboard" exits safely without mutating payment state.
- Wallet top-up starts `easypaisa.startCheckout` and refreshes via `easypaisa.syncTransactionStatus`; it does not expose raw provider payloads.
- Provider-confirmed booking reconciliation uses `internal.matchrooms.confirmPaidMatchroomSeatIntentFromProvider` from `convex/easypaisa.ts`.
- Player screens show safe order references and support copy; raw provider payload/description remains admin-only.

## Idempotency Guard Matrix

| Path | Guard used | Duplicate behavior | Result |
|---|---|---|---|
| Wallet top-up credit | `walletTransactions.by_reference` with `reference=easypaisa:{orderRefNum}` in `internal.wallet.addFunds`; `paymentTransactions.processedAt/status=paid` short-circuit in `applyProviderUpdate`. | Existing wallet transaction returns current balance; paid/processed transaction re-patches metadata only and does not credit again. | Guard present. |
| Booking payment confirmation | `applyProviderUpdate` paid/processed guard; `payMatchroomSeatIntent` returns `alreadyConfirmed` when intent is already `paid/confirmed`; provider path validates intent owner. | Duplicate provider callback returns paid safely and does not add roster/hold twice. | Guard present. |
| Wallet hold | Deterministic `hold:booking_intent:{intentId}:{source}` reference; `wallet.holdFunds` checks `by_reference`. | Duplicate hold returns `alreadyApplied: true`. | Guard present. |
| Capture / settlement | Intent `heldStatus === "held"` required; deterministic `capture:booking_intent:{intentId}` reference; merchant settlement checks `merchantSettlementStatus === "captured"`. | Duplicate capture returns `not_held` or `alreadyApplied`; duplicate merchant capture returns existing captured summary. | Guard present. |
| Release/refund | Intent `heldStatus === "held"` for release and `heldStatus === "captured"` for refund; deterministic `release:booking_intent:{intentId}` / `refund:booking_intent:{intentId}` references; wallet mutations check `by_reference`. | Duplicate cancel/expire/refund returns `not_held/not_captured` or wallet `alreadyApplied`. | Guard present. |
| Zone payout | Room `venuePayoutStatus === "paid"` guard; deterministic `venue_payout:{matchroomId}` wallet reference; `wallet.addFunds` checks `by_reference`. | Duplicate payout returns existing paid summary or no-op wallet credit. | Guard present. |
| Zone withdrawal approval | Withdrawal must be `pending`; non-pending approvals/rejections return no-op and audit log. | Duplicate approve/reject returns `{ changed: false }`. | Guard present. |

## Super Admin Anomaly Visibility

- Existing reconciliation visibility confirmed:
  - paid payment missing wallet transaction,
  - wallet transaction exists while payment is not paid,
  - booking intent unpaid while payment is paid,
  - failed payment has wallet transaction,
  - pending payment past expiry,
  - missing booking intent / matchroom.
- Added explicit payment detail visibility for provider mismatch anomalies:
  - `provider_amount_mismatch`,
  - `provider_order_reference_mismatch`.
- Super Admin payment detail exposes copyable order/payment/wallet/booking/matchroom/user IDs.
- Raw provider payloads, auth tokens, phone/CNIC, and secrets are not rendered on payment detail. Provider description is truncated and sanitized by admin query logic.

## Staging Runtime QA Checklist

### A. Wallet top-up

- Successful top-up credits wallet exactly once.
- Duplicate callback does not double-credit wallet.
- Failed payment does not credit wallet.
- Expired payment does not credit wallet.
- Wrong amount callback is rejected and visible as anomaly.
- Wrong orderRef callback is rejected and visible as anomaly.

### B. Booking payment

- Successful booking payment confirms seat once.
- Duplicate callback does not double-confirm seat or double-hold funds.
- Failed payment does not reserve seat.
- Expired payment does not reserve seat.
- Wrong amount callback is rejected and visible as anomaly.
- Wrong orderRef callback is rejected and visible as anomaly.
- "Refresh Payment Status" only syncs provider state.
- "Dashboard" exits without mutating payment state.

### C. Super Admin

- Payment anomaly notification is generated.
- Payment detail shows anomaly fields safely.
- Reconciliation flags are visible.
- Support IDs are copyable.

### D. Regression

- Player wallet opens.
- Booking status opens.
- Seat is confirmed after provider-paid reconciliation.
- Wallet top-up credit remains exactly once.

## Validation

- `npx tsc -p tsconfig.json --noEmit`: PASS.
- `git diff --check`: PASS, with line-ending warnings only.
- Convex codegen: not run in this final verification pass; no schema/API/index changes were made.

## Remaining Risks

- No provider signature/hash field was found for callbacks; strongest implemented validation is order/amount matching plus REST inquiry on IPN.
- The IPN path now depends on Easypaisa REST inquiry availability; provider outage may leave orders pending for retry/admin review.
- Runtime QA on staging Easypaisa is still required before production launch.
