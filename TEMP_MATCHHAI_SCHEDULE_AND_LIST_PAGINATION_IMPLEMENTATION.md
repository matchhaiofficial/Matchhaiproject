# MatchHai Schedule + List Pagination Implementation

Implementation date: 2026-05-27

Scope note: implementation started from an already-dirty repo. The safe completed implementation in this pass is Phase S1 plus additive Convex indexes that support the audited list pagination work. Broad Zone Admin, Super Admin, Discover, Wallet, Inbox, chat, and report UI pagination rewrites are not completed in this pass because the workspace already contains overlapping dirty edits in those exact files and a single-pass mass rewrite would be high regression risk.

## 1. Files changed by this pass

- `app/(player)/schedule.tsx`
- `src/services/convex/matchService.ts`
- `convex/matchrooms.ts`
- `convex/schema.ts`
- `TEMP_MATCHHAI_SCHEDULE_AND_LIST_PAGINATION_IMPLEMENTATION.md`

Pre-existing dirty files are still present and were not intentionally rewritten for list pagination in this pass.

## 2. Schedule correction implemented

- Player Schedule now uses matchroom lifecycle data through `matchrooms.listForUserSchedule`.
- Schedule tabs are `Upcoming / Waiting / History`.
- Generic inbox notifications no longer create Schedule rows.
- Player reports no longer create Schedule rows.
- Schedule remains a `FlatList`.
- Load-more is wired through `onEndReached` with a `PAGE_SIZE` of 20.
- Hosted and joined matchrooms are deduplicated by matchroom id.
- Cancelled, expired, completed, and past matchrooms are classified into History by the backend derived schedule state.

## 3. Backend query added

- `convex/matchrooms.ts`: added `listForUserSchedule`.
- Args:
  - `uid`
  - `tab: "upcoming" | "waiting" | "history"`
  - `limit`
  - `cursor`
  - `filters.game`
  - `filters.dateRange`
  - `filters.venue`
  - `filters.paymentStatus`
  - `filters.searchText`
  - `filters.statusGroup`
- Return:
  - `page`
  - `isDone`
  - `continueCursor`
  - `total`

Implementation limitation: the query currently uses an offset cursor over a deduped hosted/member candidate set because the existing `matchroomMembers` table does not denormalize schedule sort fields. It is functionally paginated for the UI, but a future digest/member-schedule table would be more scalable.

## 4. Indexes added

- `walletTransactions`: `by_userId_and_createdAt`, `by_userId_and_status_and_createdAt`, `by_type_and_status_and_createdAt`
- `paymentTransactions`: `by_userId_and_createdAt`, `by_userId_and_status_and_createdAt`, `by_provider_and_createdAt`, `by_provider_and_status_and_createdAt`, `by_provider_and_kind_and_createdAt`
- `matchrooms`: `by_hostUid_and_scheduledStartAt`, `by_hostUid_and_createdAt`, `by_status_and_game_and_scheduledStartAt`, `by_zoneId_and_createdAt`, `by_zoneId_and_status_and_createdAt`, `by_zoneId_and_bookingSource_and_createdAt`
- `matchroomMembers`: `by_uid_and_createdAt`
- `bookingIntents`: `by_createdByUid_status_updatedAt`
- `bookingRequests`: `by_zoneId_and_status_and_updatedAt`, `by_zoneId_and_requestKind_and_status_and_updatedAt`
- `zoneOffers`: `by_zoneId_and_status_and_updatedAt`, `by_zoneId_and_status_and_expiresAt`
- `reports`: `by_reporterUid_and_updatedAt`, `by_reporterUid_and_status_and_updatedAt`, `by_matchroomId_and_updatedAt`, `by_zoneId_and_status_and_updatedAt`
- `supportTickets`: `by_priority_createdAt`, `by_assignedAdminId_createdAt`
- `superAdminAuditLogs`: `by_status_createdAt`

Codegen was not run because schema/API changed and the user required deployment-target confirmation before running `npx convex codegen`.

## 5. Pagination implemented by screen

- Player Schedule: implemented load-more pagination and matchroom-only data.

## 6. Filters moved server-side

- Schedule game filter.
- Schedule date range filter.
- Schedule venue/source filter.
- Schedule payment filter.
- Schedule search text filter.
- Schedule status group filter.

## 7. Deferred/page-scoped work

- My Matchrooms still needs migration to a user-scoped paginated service/query.
- Wallet history still needs UI migration to a paginated history query.
- Zone Admin bookings/matchrooms/walk-ins still need UI migration away from polling/full zone loads.
- Super Admin users/zones/payments/withdrawals/reports/identity/audit/notifications/matchrooms/support still need page-query wrappers and UI `onEndReached`.
- Discover players/matchrooms/teams/zones still need paginated backend exports and frontend load-more state.
- Inbox/reports/chat messages/chatrooms still need dedicated pagination work.

## 8. Validation

- `npx tsc -p tsconfig.json --noEmit`: passed.
- `git diff --check`: passed with line-ending warnings only.
- `npx convex codegen`: not run; target deployment confirmation required first.

## 9. Known risks

- `matchrooms.listForUserSchedule` is a safe functional page model, but not a fully index-native participant schedule query yet.
- Added schema indexes require Convex codegen/deploy/dev to become available in the target deployment.
- Existing dirty changes in admin/zone/list files remain outside this pass and should be reviewed before layering broad pagination changes on top.

## 10. Manual QA checklist

- Schedule Upcoming shows only confirmed future matchrooms.
- Schedule Waiting shows not-ready matchrooms.
- Schedule History shows completed/cancelled/expired/past matchrooms.
- Schedule does not show inbox notifications.
- Schedule does not show reports.
- Schedule load-more appends without duplicates.
- Schedule filters/search reset and return expected matchroom rows.
- Booking status CTA still opens booking status when a row has an intent id.

## 11. Recommended next implementation step

Implement L1 in smaller, isolated PR-sized slices:

1. My Matchrooms + Schedule schedule-member digest/query refinement.
2. Wallet history paginated query + Wallet UI load-more.
3. Zone Admin bookings/matchrooms/walk-ins paginated reactive queries.
4. Super Admin page-by-page pagination.
5. Discover page-by-page pagination.

Recommended commit message:

`fix(schedule): show matchroom lifecycle and add schedule pagination`
