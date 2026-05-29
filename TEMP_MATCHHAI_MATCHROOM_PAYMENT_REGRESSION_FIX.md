# Matchroom Payment Regression Fix Tracker

## Issue Summary
- Valorant matchroom creation can fail with `[CONVEX M(matchrooms:create)] Not authenticated`.
- Paid matchroom flow confirms payment, then attempts completion through a fragile path that can fail with `Not authenticated`.
- Payment UI can show stale pending-payment actions after payment is already confirmed.
- Raw backend/auth errors can leak into user-facing payment UI.

## Root Cause
- Paid host matchroom creation used Easypaisa as a generic `wallet_topup`, then tried to finish by re-running the normal client submit path after payment confirmation.
- That retry called public `matchrooms:create` from the client. Recent auth hardening correctly requires a Better Auth actor for that mutation, so any auth-token bridge gap surfaced as raw `Not authenticated`.
- Valorant uses the same CS-style create path, so its failure shares the same protected public create mutation/auth-token dependency rather than a separate Valorant backend mutation.
- The payment modal treated `confirmed`, `completing`, and `completion_failed` like pending payment states, so stale "Do this later" / "I've paid" actions stayed visible after payment was confirmed.

## Files Inspected
- `convex/_generated/ai/guidelines.md`
- `src/services/convex/matchService.ts`
- `app/matchrooms/create/index.tsx`
- `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts`
- `app/matchrooms/book/status/[intentId].tsx`
- `src/services/convex/easypaisaService.ts`
- `convex/easypaisa.ts`
- `convex/matchrooms.ts`
- `convex/wallet.ts`
- `convex/schema.ts`
- `src/lib/convex.ts`
- `src/providers/AuthenticatedConvexProvider.tsx`
- `src/utils/userFacingErrors.ts`

## Files Changed
- `TEMP_MATCHHAI_MATCHROOM_PAYMENT_REGRESSION_FIX.md`
- `src/services/convex/matchService.ts`
- `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts`
- `app/matchrooms/create/index.tsx`
- `convex/schema.ts`
- `convex/matchrooms.ts`
- `convex/easypaisa.ts`
- `convex/wallet.ts`

## Affected Flows
- Valorant matchroom creation.
- Paid matchroom creation after Easypaisa confirmation.
- Confirmed-payment completion retry/resume.
- Payment status modal pending/confirmed/completion-pending/error states.

## Auth/Session Findings
- `matchrooms:create` correctly requires an authenticated actor and verifies `hostUid` matches that actor.
- Direct service calls use the active Convex client proxy registered by `AuthenticatedConvexProvider`; if the token bridge is temporarily unavailable, public create can still fail.
- Direct create now retries once on auth/session errors and maps auth failures to safe user-facing copy instead of logging raw Convex errors.
- Paid Easypaisa completion no longer calls the public client create path.

## Payment Modal/State Findings
- Confirmed/completing states previously showed pending-payment buttons.
- Completion failed previously offered "Do this later" and retried `handleSubmit({ skipPaymentPrompt: true })`, which called public create again.
- Recovery banner previously showed "I've paid / Continue" for confirmed/completing states.
- Updated UI only shows "Do this later" while payment is genuinely pending. Confirmed/completing show a single continue action, and completion pending retries finishing.

## Fixes Implemented
- Extracted `buildMatchroomCreateMutationArgs` so the app can prepare the exact backend create args before starting Easypaisa.
- The create screen now attaches the prepared matchroom-create args to the Easypaisa checkout transaction.
- Easypaisa stores matchroom-create args in `paymentTransactions.providerPayload.checkoutContext`.
- Provider reconciliation now finalizes paid matchroom creation internally from Convex with `internal.matchrooms.finalizePaidCreateFromProvider`.
- Added `matchrooms.sourcePaymentOrderRefNum` plus `by_sourcePaymentOrderRefNum` idempotency lookup to prevent duplicate matchrooms for the same paid order.
- Added internal wallet deduction with reference idempotency and made wallet deduction reference-safe.
- After provider wallet credit, backend finalization creates the matchroom and deducts the credited wallet amount once using `matchroom_create:<matchroomId>`.
- `getCheckoutStatus` now returns `finalizedMatchroomId`; the create UI navigates once that appears.
- Confirmed-payment retry now refreshes/syncs provider status to resume backend finalization instead of calling public create.
- Removed raw `console.error` leakage from `createMatchroom` and maps auth/internal failures through safe user-facing copy.

## Manual QA Checklist

### A. Valorant Matchroom
- [ ] Create Valorant matchroom without payment issues.
- [ ] Confirm no `Not authenticated`.
- [ ] Confirm matchroom completes properly.

### B. Normal Paid Matchroom Flow
- [ ] Create matchroom.
- [ ] Start payment.
- [ ] Confirm payment.
- [ ] Ensure UI shows confirmed/finishing correctly.
- [ ] Ensure matchroom gets created successfully.
- [ ] Ensure user lands in correct next state.
- [ ] Ensure no raw errors.

### C. Confirmed-Payment Completion Retry
- [ ] Simulate payment confirmed but completion pending.
- [ ] Retry/continue.
- [ ] Ensure it completes safely.
- [ ] Ensure no duplicate matchroom.
- [ ] Ensure no duplicate payment side effects.

### D. Payment State UI
- [ ] Pending payment shows correct actions.
- [ ] Confirmed payment does not show "Do this later".
- [ ] Confirmed payment shows only correct action/state.
- [ ] Error state uses safe text only.

### E. Safety Checks
- [ ] Duplicate callback does not duplicate creation.
- [ ] Duplicate continue tap does not duplicate creation.
- [ ] Refresh after confirmed payment resumes safely.
- [ ] Existing wallet/payment protections still hold.

## Tests Run
- `npx convex codegen`
  - Target inspected first via Convex MCP: non-production deployment `https://ardent-lynx-28.convex.cloud` (`kind: unspecified`). Production `https://acoustic-raccoon-242.convex.cloud` was read-only and was not deployed.
- `npx tsc -p tsconfig.json --noEmit` passed.
- `git diff --check` passed. Git emitted only CRLF normalization warnings for existing Windows line-ending behavior.

## Known Risks
- Existing in-flight paid wallet-topup transactions created before this change do not have stored matchroom-create args, so they cannot be backend-finalized automatically. The user may need support/manual recovery for those historical orders.
- Manual device QA is still required against Easypaisa sandbox/live-like callbacks to verify provider timing and UI transitions.
- `npx convex codegen` uploaded functions to the configured non-production Convex deployment as part of codegen; no production deploy or EAS build was run.
