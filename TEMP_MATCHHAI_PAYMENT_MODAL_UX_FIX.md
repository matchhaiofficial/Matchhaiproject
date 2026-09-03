# Matchroom Payment Modal UX Fix Tracker

## Issue Summary
- Paid matchroom modal can still look like a pending-payment modal after payment is confirmed.
- Matchroom payment copy uses wallet top-up wording.
- Confirmed-payment delayed finalization needs a clear retry state without stale payment actions.
- Raw or technical errors must not be shown in the payment-confirmed flow.

## Files Inspected
- `app/matchrooms/create/index.tsx`
- `app/matchrooms/create/create.styles.ts`
- `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts`
- `app/matchrooms/book/status/[intentId].tsx`
- `app/matchrooms/book/pay/[intentId].tsx`
- `src/services/convex/easypaisaService.ts`
- `src/services/convex/matchService.ts`
- `src/utils/userFacingErrors.ts`
- `src/utils/paymentUiCopy.ts`

## Files Changed
- `app/matchrooms/create/index.tsx`
- `app/matchrooms/create/create.styles.ts`
- `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts`
- `app/matchrooms/book/status/[intentId].tsx`

## Modal State Machine Findings
- The create-flow Easypaisa modal reused pending-payment actions for paid states.
- Confirmed payment without `finalizedMatchroomId` now remains in a finishing state instead of switching back to client-side create.
- `finalizedMatchroomId` now maps to a distinct finalized UI phase with a single open-matchroom action.
- Confirmed delayed finalization now maps to a retryable payment-received state.

## Copy Changes
- Replaced matchroom payment `Top-up amount` wording with `Matchroom payment` before confirmation and `Amount paid` after confirmation.
- Replaced confirmed-payment copy with `MatchHai is finishing your matchroom.`
- Replaced delayed finalization copy with safe support/retry wording and order reference.
- Replaced wallet auth fallback copy with `Your session has expired. Please log in again.`
- Normalized booking status failed-payment title to `Payment not completed`.

## Button Behavior Changes
- Pending payment: `Do this later` plus `I've paid / Refresh`.
- Confirmed/finishing payment: no payment action buttons, only a passive `This may take a few seconds.` note.
- Finalized matchroom: one primary `Open matchroom` action.
- Retryable finalization delay: `Retry finishing` plus `Close`.
- Failed/expired payment: `Try again` plus `Do this later`.
- Recovery banner no longer shows `Open payment status` once a matchroom is finalized.

## Navigation Behavior
- When `finalizedMatchroomId` exists, the primary action routes to `/matchrooms/{id}`.
- The sticky create CTA changes to `Open Matchroom` for finalized paid creation.
- Closing the modal after confirmed/finalized payment keeps the resumable paid state instead of resetting to pending/create-failed UI.

## Error Handling Changes
- Confirmed-payment states hide stale submit feedback such as `Create failed`.
- Retryable confirmed-payment failure uses safe user copy and keeps technical detail in logs.
- No raw Convex/auth/provider payload text is surfaced by the create payment modal.

## Manual QA Checklist
- [ ] Before payment confirmation: pending modal shows `Do this later` and `I've paid / Refresh`.
- [ ] After payment confirmation: no `Do this later`.
- [ ] After payment confirmation: no `I've paid`.
- [ ] After payment confirmation: modal says payment confirmed/finishing.
- [ ] After finalization: modal shows `Matchroom created`.
- [ ] After finalization: primary action opens matchroom.
- [ ] If finalization is delayed: user sees retry finishing/support copy.
- [ ] If finalization is delayed: order reference is visible.
- [ ] No `Top-up amount` wording for matchroom payment.
- [ ] No raw `Not authenticated` or Convex errors.
- [ ] Closing modal does not leave stale `Create failed` if payment was received.
- [ ] Duplicate tap does not duplicate matchroom/payment side effects.

## Tests Run
- `npx tsc -p tsconfig.json --noEmit` - passed.
- `git diff --check` - passed, with existing CRLF normalization warnings only.
- Copy scan for stale payment modal phrases - no stale create/book payment UI phrases found.

## Codegen
- Not run. No API/schema/internal Convex function surface changes were made in this UI-only pass.

## Known Risks
- Manual device QA is still required for exact modal layout on small Android screens.
- The normal non-payment direct create path can still show `Create failed` with safe generic copy, which is outside the confirmed-payment modal flow.
