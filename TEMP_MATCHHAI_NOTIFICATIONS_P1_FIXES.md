# MatchHai Notification P1 Fixes

Branch: product-ready

Scope: Notification P1 only. P0 was not redone. P2/P3 items remain deferred. No production deploy, EAS build, or push was run.

## Audit Findings Addressed

- Expo push delivery now uses chunked sends, ticket tracking, scheduled receipt polling, invalid token pruning, and more accurate push states.
- Zone Admin notification visibility now uses a role/category allowlist instead of keyword matching.
- Team Challenge captain payment-required notifications now exist for paid challenge sides that require captain action.
- Action-required notification deep links now normalize to safe, current-state routes.
- App badge synchronization now writes local OS badge counts from live unread/actionable notification counts and clears on logout/account switch.
- Team Challenge chat `clientMessageId` retries now return the existing message before push/unread side effects.

## Files Changed

- `app/super-admin/(tabs)/index.tsx`
- `app/super-admin/notifications.tsx`
- `app/zone/modules/notifications.tsx`
- `convex/bookings.ts`
- `convex/kycNotifications.ts`
- `convex/matchrooms.ts`
- `convex/notifications.ts`
- `convex/pushNotifications.ts`
- `convex/pushNotificationsActions.ts`
- `convex/schema.ts`
- `convex/teamChallengeChat.ts`
- `convex/teamChallenges.ts`
- `src/components/NotificationRuntimeBridge.tsx`
- `src/features/zoneAdmin/notificationFilters.ts`
- `src/hooks/useNotifications.ts`
- `src/navigation/routes.ts`
- `src/services/convex/superAdminService.ts`
- `src/services/localNotifications.ts`
- `__tests__/security/teamChallengeChatIdempotency.test.ts`
- `__tests__/unit/notificationRoutes.test.ts`
- `__tests__/unit/zoneAdminNotificationFilters.test.ts`
- `TEMP_MATCHHAI_NOTIFICATIONS_P1_FIXES.md`

## Push Delivery Reliability

- Added additive `pushTickets` schema and device metadata for Expo ticket/receipt tracking.
- New notification push state starts at `queued`, then moves through `sending`, `sent`, `receipt_ok`, `failed`, `no_device`, or `skipped`.
- `sendForNotification` atomically claims a notification before sending to avoid duplicate push attempts.
- Stale `sending` claims older than 10 minutes can be retried, and unexpected post-claim action failures mark the notification `failed` instead of leaving it stuck.
- Expo sends are chunked at 100 messages per request.
- Expo receipt checks are scheduled after send and checked in batches up to 1000 receipt ids.
- Ticket and receipt failures update device state and notification push state.
- `DeviceNotRegistered` deactivates the device and clears its Expo push token.
- Chat push uses the same chunked sender and invalid-token pruning path.
- Sensitive raw Expo payloads are not logged; stored errors are sanitized/short codes.

Known push risk: Expo receipt `ok` means APNs/FCM accepted the message, not guaranteed device display. Receipt polling is scheduled from the action, so delayed scheduler execution can delay `receipt_ok`/`failed` finalization.

## Zone Admin Filter and Badge

- Replaced keyword matching with a shared category allowlist for Zone Admin relevant notifications.
- Allowed categories: booking, matchroom, report, support, KYC, withdrawal, and zone.
- Explicitly excludes `player`, `super_admin`, and `super-admin` recipient roles.
- Zone notification center and dashboard badge both use `isPendingZoneAdminNotification`.
- Added regression coverage for withdrawal, KYC, support, zone status, pilot notifications, and player/super-admin exclusions.

Risk: Legacy records with no explicit recipient role can still pass by category. Current serialized Convex notifications include `recipientRole`.

## Team Challenge Payment-Required Notification

- Added canonical type `team.challenge_payment_required`.
- Team B captain receives a deduped notification after accepting a paid challenge when Team B payment remains required.
- Team A captain receives the analogous notification after paid challenge creation when Team A payment remains required.
- Recipient is captain only.
- Notification is push eligible through the canonical notification pipeline.
- Route is `/teams/challenge?id=<challengeId>`.
- Copy:
  - Title: `Payment required for Team Challenge`
  - Body: `Complete your team's payment to confirm the challenge.`
- Dedupe key is per challenge + side.
- No payment money movement was changed.

## Deep-Link Normalization

- Added `buildNotificationRoute` in `src/navigation/routes.ts`.
- Runtime push taps normalize `route`/`href` payloads before calling `router.push`.
- Convex canonical notification serialization now normalizes actionable routes.
- Booking request notifications route to `/zone/modules/bookings` with request focus query params.
- Match payment-required notifications route to `/matchrooms/book/pay/<intentId>` when an intent id exists.
- Team Challenge received/updated/payment-required notifications route to challenge detail.
- Withdrawal notifications route to zone wallet or Super Admin withdrawals list.
- KYC notifications route to zone profile, player verification, or Super Admin identity verification list.
- Support/report notifications route to valid support/report screens or list fallbacks.
- Safe fallbacks:
  - Booking counter-offer remains `/(player)/inbox` because the response UI currently lives in inbox cards.
  - Missing match payment `intentId` falls back to matchroom detail.
  - Missing challenge/report/support ids fall back to safe list screens.
  - `zone.matchroom_full` routes to zone bookings matchrooms tab with `matchroomId`; exact focus depends on existing bookings screen behavior.

## Badge Synchronization

- Added `setLocalBadgeCount`, `clearLocalBadgeCount`, and `adjustLocalBadgeCount` wrappers around Expo badge APIs.
- `NotificationRuntimeBridge` syncs badge count from live Convex unread counts and reconciles on foreground/resume.
- Logout and account switch clear the local OS badge.
- Player read/archive/status actions optimistically adjust local badge counts and are reconciled by live counts.
- Zone Admin notification center updates badge on mark-seen and mark-all-read and uses the same allowlist predicate.
- Super Admin dashboard/inbox syncs badge counts and refreshes after read/archive.

Risk: Expo badge writes are best-effort. Unsupported Android launchers or missing iOS badge permission can no-op.

## Team Challenge Chat Idempotency

- `teamChallengeChat.sendMessage` now checks for an existing same sender + chat + `clientMessageId` message before inserting.
- Duplicate retries return the existing message id.
- Duplicate retries do not update chat metadata, unread counts, or schedule duplicate push.
- Different `clientMessageId` values still create new messages.

Risk: The duplicate lookup is bounded to the latest 100 challenge chat messages using the existing index, matching the current no-additional-index scope.

## Tests Run

- `npx tsc -p tsconfig.json --noEmit` - passed.
- `npm test -- --runTestsByPath __tests__/unit/zoneAdminNotificationFilters.test.ts --runInBand` - passed.
- `npm test -- --runTestsByPath __tests__/security/teamChallengeChatIdempotency.test.ts --runInBand` - passed.
- `npm test -- --runInBand` - passed, 32 suites, 195 passed, 43 todo.
- `git diff --check` - passed with Windows line-ending warnings only.
- QA regression sub-agent also ran targeted P1/P0 overlap suites and found one stuck-`sending` risk; this was fixed with stale claim recovery and action failure marking.

## Backend Schema/API/Index Changes

- `notifications.pushState` accepts `queued`, `sending`, `receipt_ok`, and `no_device`.
- `pushDevices` adds `lastTicketId` and `lastReceiptCheckedAt`.
- New `pushTickets` table tracks Expo tickets/receipts with indexes:
  - `by_receiptId`
  - `by_notificationId`
  - `by_pushKind_and_createdAt`
  - `by_ticketStatus_and_receiptCheckedAt`
- New internal notification helpers:
  - `claimPushSend`
  - `refreshPushStateFromTickets`
- New internal push helper mutations/queries:
  - `recordExpoPushTicket`
  - `getTicketsByReceiptIds`
  - `markTicketReceiptResult`
- New internal action:
  - `pushNotificationsActions.checkReceipts`

## Codegen

Convex schema changed additively. Target was confirmed as staging/dev from `.env.local`: `dev:ardent-lynx-28`, project `matchhai-staging`, URL `https://ardent-lynx-28.convex.cloud`. Shell `CONVEX_DEPLOYMENT` was unset.

`npx convex codegen` was run successfully. It generated TypeScript bindings and changed no files under `convex/_generated`. No production deploy was run.

## Known Risks

- Expo receipt success is delivery-provider acceptance, not guaranteed display.
- Receipt polling depends on scheduled action execution.
- Push retry after an action crash depends on the new 10-minute stale-claim window unless the action catches the failure and marks `failed` immediately.
- Team Challenge chat duplicate prevention is bounded to recent messages without a dedicated schema index.
- Some route focus behavior depends on existing screen support for query params.
- Badge writes can no-op on unsupported devices/permissions.
- Manual device testing is still needed for push receipt pruning and OS badge behavior.

## Manual QA Checklist

- Register multiple devices for one user and confirm pushes send without duplicates.
- Simulate Expo ticket error and verify notification `pushState` becomes `failed`.
- Simulate `DeviceNotRegistered` ticket/receipt error and verify device is deactivated.
- Verify receipt success updates notification to `receipt_ok`.
- Verify a user with no active devices gets `no_device`.
- Send chat push to an invalid token and verify pruning.
- As Zone Admin, verify withdrawal/KYC/support/zone status/pilot notifications appear in inbox and dashboard badge.
- Confirm player-only and Super Admin-only notifications do not appear in Zone Admin inbox.
- Accept a paid Team Challenge as Team B captain and verify only Team B captain gets payment-required notification.
- Create paid Team Challenge requiring Team A async payment and verify Team A captain gets equivalent notification.
- Tap Team Challenge payment-required push and verify challenge payment state opens safely.
- Tap booking request/counter-offer/KYC/support/report/withdrawal notifications and verify safe routes.
- Mark read/archive/mark-all-read and verify app badge decreases or clears.
- Logout/account switch and verify badge clears before the next user's count appears.
- Retry Team Challenge chat send with the same `clientMessageId` and verify one message and one push.

## Deferred P2/P3 Items

- Dedicated Convex integration tests with `convex-test`/Vitest for push tickets and receipt state transitions.
- Optional dedicated index for Team Challenge chat `clientMessageId` idempotency if high-volume retry windows become a concern.
- Server-side push payload badge counts, if a reliable per-role count can be computed cheaply at send time.
- More granular route focus support inside destination screens where current fallbacks use list views.
- Device-level QA across iOS and Android badge support.
