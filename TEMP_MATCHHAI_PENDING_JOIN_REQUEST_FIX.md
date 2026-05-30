# Matchroom Pending Join Request Hotfix

Branch: `product-ready`

## Root cause

`useMatchroomDetailActions.handleRespondToRequest` was reading `req.id`
from each pending-request row, but the rows returned by
`useIncomingJoinRequests` (which calls
`api.notifications.listMatchroomJoinRequests`) are serialized
notifications whose identifier lives on `req._id` (string). `req.id`
was `undefined`, so two things broke at once:

1. The Convex mutation `matchrooms:respondToMatchroomJoinRequest`
   received `notificationId: undefined`, producing:
   `ArgumentValidationError: Object is missing the required field `notificationId`.`
2. `setProcessingRequestId(undefined)` made the per-row check
   `processingRequestId === req.id` (`undefined === undefined`) match
   every row's Accept *and* Reject button, so both buttons spun.

## Files inspected

- `app/matchrooms/[id].tsx`
- `app/matchrooms/components/MatchroomPendingRequestsPanel.tsx`
- `app/matchrooms/hooks/useMatchroomDetailActions.ts`
- `app/matchrooms/hooks/useMatchroomDetailState.ts`
- `src/services/convex/matchService.ts` (`respondToMatchJoinRequest`)
- `src/services/convex/matchroomActionService.ts`
- `src/hooks/useMatchroomData.ts` (`useIncomingJoinRequests`)
- `convex/notifications.ts` (`listMatchroomJoinRequests`,
  `serializeNotification`)
- `convex/matchrooms.ts` (`respondToMatchroomJoinRequest`)
- `src/utils/userFacingErrors.ts`

## Files changed

- `app/matchrooms/components/MatchroomPendingRequestsPanel.tsx`
- `app/matchrooms/hooks/useMatchroomDetailActions.ts`

## notificationId fix

`handleRespondToRequest` now resolves the notification id from
`req._id || req.notificationId || req.id` and passes that to
`respondToMatchJoinRequest` (which is the existing service wrapper that
sends `notificationId` to Convex). If no id can be resolved the call is
aborted with a safe toast and a Logger.error — no fake id is ever sent.

Backend (`convex/matchrooms.ts`) and validators are left untouched.
The rows truly are notifications, so the existing
`v.id("notifications")` requirement is correct and authorization stays
intact (the mutation still verifies the actor is a captain).

## Accept/Reject loading-state fix

`processingRequestId` is now an action-scoped composite key
`${notificationId}:accept` or `${notificationId}:reject`.

`MatchroomPendingRequestsPanel` derives:
- `isAccepting = processingRequestId === \`${notifId}:accept\``
- `isRejecting = processingRequestId === \`${notifId}:reject\``
- `rowBusy = isAccepting || isRejecting`

Only the tapped button shows the spinner; the sibling button is
`disabled` but renders its normal label. Other rows are unaffected
because the key includes the notification id.

## Safe error handling

In `handleRespondToRequest`:
- Validation-shaped failures
  (`ArgumentValidationError`, `missing the required field`,
  `validator`) are replaced with the safe copy
  *"Could not update this request. Please refresh and try again."* in
  the toast. The raw message is still logged via `Logger.error` for
  developers.
- The generic `catch` branch now uses the same safe copy instead of
  *"An unexpected error occurred."*
- The missing-notificationId early-return also shows the same safe
  copy.

No raw `[CONVEX ...]` or `ArgumentValidationError` text is rendered to
the user.

## React key warning status

`MatchroomPendingRequestsPanel` already had a stable
`getRequestKey(req, index)` fallback chain
(`_id → notificationId → id → matchroomId:fromUid → uid:fromUid →
pending-request-{index}`). No change required — refactored the helper
to share a single `getNotificationId(req)` accessor with the
per-button loading logic, so both stay consistent.

## Tests run

- `npx tsc -p tsconfig.json --noEmit` — clean (no output).
- `git diff --check` — clean (only an unrelated CRLF warning on
  `app/(player)/inbox.tsx`).
- No Convex schema/API changes ⇒ no `convex codegen` needed.
- No production deploy. No EAS build.

## Known risks

- The loading key now embeds the action. Any future code that reads
  `processingRequestId` and assumes it is a bare notification id will
  need to split on `:`. Today only `MatchroomPendingRequestsPanel`
  consumes it, and it does so via the derived booleans above.
- If a pending row ever truly lacks a notification id (legacy data),
  the action is now refused with a toast instead of silently sending
  `undefined`. This is the desired behavior — the data model requires
  a notification — but operators should watch for the
  `"Respond aborted: missing notificationId on request"` log line.

## Manual QA checklist

1. As a host, open a matchroom that has a pending join request.
2. Tap **Accept**:
   - Only the Accept button shows a spinner.
   - Reject is disabled but still shows its label.
   - Other request rows are unaffected.
   - Toast: *Request updated.* (success).
   - Row disappears; the joining player appears in the roster.
3. Open another pending request and tap **Reject**:
   - Only the Reject button shows a spinner.
   - Accept is disabled but still shows its label.
   - Toast: *Request updated.* (success); row disappears.
4. Force a stale request (e.g., accept the same request twice quickly):
   - Toast shows safe copy *"Could not update this request. Please
     refresh and try again."*
   - No `ArgumentValidationError` text in the toast.
5. Open and close the panel a few times — no React "unique key"
   warning in the dev console.

## Recommended commit message

```
fix(matchrooms): repair pending join request actions
```
