# MatchHai Payment Provider Authenticity + Idempotency Fix

Started: 2026-05-28

Scope: `PAY-IPN-01` and `PAY-IDEMP-01`. No payout formula changes, no Easypaisa credential changes, no production deploy, no EAS build.

## Files Inspected

- `convex/easypaisa.ts`
- `convex/easypaisaRest.ts`
- `convex/easypaisaNode.ts`
- `convex/http.ts`
- `convex/wallet.ts`
- `convex/bookings.ts`
- `convex/matchrooms.ts`
- `convex/schema.ts`
- `app/(player)/wallet.tsx`
- `app/matchrooms/book/pay/[intentId].tsx`
- `app/matchrooms/book/status/[intentId].tsx`
- `app/super-admin/(tabs)/payments.tsx`
- `app/super-admin/payment/[orderRefNum].tsx`
- `src/services/convex/easypaisaService.ts`
- `src/services/convex/matchService.ts`
- `src/services/convex/superAdminService.ts`

## Authenticity Findings

- Existing hosted checkout requests use merchant hash generation for checkout initiation.
- No independently verifiable callback signature/hash field was present in the callback handler payloads inspected.
- IPN already restricted remote `ipnUrl` fetches to HTTPS and allowed Easypaisa hosts, but direct IPN payloads could still claim a status for an order reference.
- Hosted finalize used the checkout token to find a session, but accepted an order reference from query/form fields.
- Provider amount and order reference were not centrally checked against the server-side `paymentTransactions` row before state transitions.

## Idempotency Findings

- Wallet credits already use `walletTransactions.by_reference` and `reference=easypaisa:{orderRefNum}` to avoid duplicate deposits.
- Booking holds already use deterministic hold references and `wallet.holdFunds` is idempotent by reference.
- `applyProviderUpdate` already short-circuits paid/processed transactions before applying side effects again.
- The compatibility pass added `internal.matchrooms.confirmPaidMatchroomSeatIntentFromProvider` so provider reconciliation no longer needs a user-authenticated public mutation.

## Fixes

- Added provider payload validation in `applyProviderUpdate`:
  - rejects provider order-reference mismatches,
  - rejects amount mismatches when a provider amount is available,
  - records a safe anomaly object in `providerPayload.anomaly`,
  - notifies super admins using the existing payment-attention notification path.
- Hosted finalize now rejects an order reference that does not match the checkout-token session.
- Hosted finalize no longer returns raw Easypaisa status/description text in player-facing HTML.
- IPN handling now treats callback payloads as a trigger and verifies state through the Easypaisa REST inquiry endpoint before applying reconciliation.
- Terminal failed/expired/cancelled payments cannot be flipped to paid from a non-inquiry callback.

## Codegen

- Not run for Step 2; no new generated API/schema/index changes were made after the Step 1 codegen.
- Step 1 codegen target remained `dev:ardent-lynx-28`.

## Validation

- `npx tsc -p tsconfig.json --noEmit`: PASS.
- `git diff --check`: PASS, with line-ending warnings only.

## Manual QA

- Top-up success credits wallet exactly once.
- Duplicate top-up callback does not double-credit.
- Booking payment confirms the seat once.
- Duplicate booking callback does not double-confirm.
- Failed payment does not credit wallet.
- Expired payment cannot become paid from a stale direct callback; provider inquiry must prove the paid state.
- Callback with wrong amount is rejected and appears as a payment anomaly for admins.
- Callback with wrong order reference is rejected and appears as a payment anomaly for admins.
- Callback after a newer active attempt does not clear the newer active pointer.
- "I've paid" refreshes provider state and does not manually mark paid.
- "Do this later" exits without changing payment state.
- Super admin payment detail shows reconciliation flags safely.
- Player UI does not show raw provider payload/description.
