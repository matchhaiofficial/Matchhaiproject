# MatchHai Schedule + Pagination/List Performance Phase

Phase date: 2026-05-29

## Pre-flight

- Branch: `product-ready`
- Latest commit at phase resume: `a2adf3f Fixed Payment and Results Issues`
- Previous emergency matchroom/payment regression and payment modal fixes: committed before continuing this phase.
- Dirty state at resume: clean.
- `git diff --stat` at resume: empty.

## Schedule S1 verification

- Verified existing Schedule S1 implementation; no redo needed.
- `app/(player)/schedule.tsx` still uses matchroom lifecycle data through `getUserScheduleMatchroomsPage`.
- Tabs remain `Upcoming / Waiting / History`.
- Notifications do not create Schedule rows.
- Reports do not create Schedule rows.
- `convex/matchrooms.ts:listForUserSchedule` still exists.
- Schedule still uses `FlatList` with `onEndReached` load-more.
- Supporting indexes from the older pass remain present in `convex/schema.ts`.

## My Matchrooms pagination

- Already present in the committed baseline at resume.
- `convex/matchrooms.ts:listUserMatchroomsPage` provides a user-scoped page model for hosted/joined rooms.
- `src/services/convex/matchService.ts:getUserMatchroomsPage` wraps the page API.
- `app/matchrooms/my.tsx` uses cursor/load-more with `FlatList`.
- Hosted and joined rooms are deduped client-side by id when appending.
- Filters supported by the page API: status, game, date range, search text.
- Limitation: page cursor is offset-based over user-scoped candidate rows, not native Convex `.paginate()`.

## Wallet history pagination

- Already present in the committed baseline at resume.
- `convex/wallet.ts:listHistoryPage` returns paginated wallet/payment history rows.
- `app/(player)/wallet.tsx` uses load-more with `FlatList`.
- Balance/math and Easypaisa/IPN/finalize logic were not changed in this continuation.
- Limitation: wallet history still merges `walletTransactions` and `paymentTransactions` after user-scoped reads to preserve existing transaction semantics.

## Zone Admin pagination

- Added service page wrappers:
  - `fetchZoneBookingQueuePage`
  - `fetchZoneMatchroomsPage`
- Updated `app/zone/modules/bookings.tsx` to load booking queue and matchrooms through page APIs instead of the old 5-second polling subscriptions.
- Added load-more support to:
  - Zone booking requests
  - Pending request list
  - Zone matchrooms
  - Walk-ins
- Preserved accept/reject/counter-offer action wiring.
- Preserved zone ownership checks in backend page APIs.
- Walk-ins use `bookingSource: "walkin"` when the walk-ins segment loads/appends.
- Zone booking history remains on the existing bounded query and is deferred.

## Super Admin pagination

Implemented critical minimum pagination for:

- Payments
  - Added `admin.listPaymentsPageV2`.
  - Added `getAdminPaymentsPage`.
  - Updated payments screen with cursor append and `onEndReached`.
- Withdrawals
  - Added `admin.listZoneWithdrawalRequestsPage`.
  - Added `getZoneWithdrawalRequestsPage`.
  - Updated withdrawals screen with cursor append and `onEndReached`.
- Reports
  - Added `admin.listReportsPage`.
  - Added `getReportsPage`.
  - Updated reports screen with cursor append and `onEndReached`.

Remaining Super Admin lists deferred:

- Users
- Zones
- Matchrooms
- Support tickets
- Audit logs
- Identity verifications
- Notifications

Reason: continuing across every admin list in one patch would be high regression risk; the requested minimum critical set is now covered.

## Discover pagination

- Deferred.
- Reason: Discover has four segment-specific query/card systems with bounded candidate windows and many JS filters. A partial rewrite risks breaking segment state and card behavior.

## Remaining player lists

Deferred:

- Inbox
- Player reports history
- Chat messages
- Chatrooms
- Friends
- My Teams/Profile My Teams

Reason: safe low-risk pass was exhausted by Zone Admin and critical Super Admin work; chat and social list pagination need separate focused handling.

## Filters moved server-side

- Zone Admin requests: request kind, status, branch id, game, date range, search text where safe.
- Zone Admin matchrooms/walk-ins: status, booking source, payment status, date range, search text where safe.
- Super Admin payments: payment status, kind, date lower bound/range, amount range, order/provider reference search over scanned backend window.
- Super Admin withdrawals: status, date range, amount range, reference/owner/branch/bank search over scanned backend window.
- Super Admin reports: status, type group, game, date range, text search over scanned backend window.

## Page-scoped or deferred filters

- Super Admin payment provider-status and reconciliation UI filters remain page-scoped.
- Super Admin payment reconciliation is intentionally page-scoped and read-only.
- Zone Admin request time-of-day filter remains client/page scoped.
- Zone Admin branch fallback matching for requests remains heuristic and client/page scoped where request rows do not contain a confirmed branch.
- Zone booking history filters remain on the existing bounded path.
- Discover, Inbox, Reports history, Chat, Chatrooms, Friends, and My Teams are deferred.

## Backend queries/indexes added

Queries added in this continuation:

- `admin.listPaymentsPageV2`
- `admin.listZoneWithdrawalRequestsPage`
- `admin.listReportsPage`

Queries already present at resume:

- `matchrooms.listForUserSchedule`
- `matchrooms.listUserMatchroomsPage`
- `wallet.listHistoryPage`
- `zoneAdminBooking.listBookingQueuePageForZone`
- `zoneAdminBooking.listMatchroomsPageForZone`

No schema indexes were added in this continuation.

## Codegen

- Convex API exports changed in `convex/admin.ts`.
- Current `CONVEX_DEPLOYMENT` from `.env.local`: `dev:ardent-lynx-28`.
- Codegen decision: not run in this phase because the new page functions are currently consumed through temporary dynamic references:
  - `(api as any).admin.listPaymentsPageV2`
  - `(api as any).admin.listZoneWithdrawalRequestsPage`
  - `(api as any).admin.listReportsPage`
- Generated files changed: no.
- Generated API types still require refresh before deploy/check-in if the team wants typed `api.admin.*` references for the new page functions.

## Validation

- `npx tsc -p tsconfig.json --noEmit`: passed after Schedule verification, after Zone Admin integration, and after Super Admin critical pagination changes.
- Initial final `git diff --check`: passed with CRLF line-ending warnings only.
- Final `npx tsc -p tsconfig.json --noEmit`: passed.
- Final `git diff --check`: passed with CRLF line-ending warnings only.

## Known risks

- New page APIs use offset cursors over indexed/filtered backend windows rather than native Convex `.paginate()`.
- Some backend searches are scan-window based and may still be capped for very large datasets.
- Super Admin payment page API currently returns reconciliation as page-scoped/null unless the legacy detail path is used; payment money movement is unchanged.
- Zone Admin history remains bounded and not cursor-paginated.
- Generated Convex API files are stale for newly added page functions until codegen is run.

## Manual QA checklist

- Schedule Upcoming/Waiting/History still classify matchrooms correctly.
- Schedule does not show generic notifications or reports.
- My Matchrooms hosted/joined load more works and shows no duplicates.
- Wallet balance is unchanged and transaction load-more has no duplicates.
- Zone Admin requests load first page and load more.
- Zone Admin pending list still opens actions correctly.
- Zone Admin accept/reject/counter-offer still work.
- Zone Admin matchrooms load first page and load more.
- Zone Admin walk-ins load from walk-in source and load more.
- Zone Admin only sees own zone data.
- Super Admin payments first page loads, filters apply, load more works, detail route opens.
- Super Admin withdrawals first page loads, approve/reject still work, load more works.
- Super Admin reports first page loads, report detail route opens, load more works.
- No payment/wallet money movement changed.
- No report/moderation action behavior changed.

## Deferred items

- Zone booking history cursor pagination.
- Super Admin users/zones/matchrooms/support/audit/identity/notifications pagination.
- Discover players/matchrooms/teams/zones pagination.
- Inbox, player reports history, chat messages, chatrooms, friends, and My Teams pagination.

Recommended commit message:

`fix(performance): paginate schedule and high-traffic lists`
