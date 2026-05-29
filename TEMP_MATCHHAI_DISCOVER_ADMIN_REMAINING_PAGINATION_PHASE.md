# MatchHai Discover + Remaining Admin/List Pagination Phase

Implementation date: 2026-05-29

## 1. Pre-flight

- Branch: `product-ready`
- Latest commit at phase start: `9845e53 fix(performance): paginate schedule and high-traffic lists`
- Previous pagination commit hash: `9845e53643aadcfa4763c37021832315a8ac8045`
- `git status --porcelain` at phase start: clean
- `git diff --stat` at phase start: empty
- Previous TEMP audit/implementation files were left in place.

## 2. Files changed

- `convex/discover.ts`
- `src/features/discover/components/DiscoverPlayerList.tsx`
- `src/features/discover/components/DiscoverMatchroomList.tsx`
- `src/features/discover/components/DiscoverTeamList.tsx`
- `src/features/discover/components/DiscoverZoneList.tsx`
- `convex/admin.ts`
- `src/services/convex/superAdminService.ts`
- `app/super-admin/users.tsx`
- `app/super-admin/zones.tsx`
- `app/super-admin/matchrooms.tsx`
- `app/super-admin/support-tickets.tsx`
- `app/zone/modules/bookings.tsx`
- `app/zone/modules/components/ZoneBookingsHistorySection.tsx`
- `TEMP_MATCHHAI_DISCOVER_ADMIN_REMAINING_PAGINATION_PHASE.md`

## 3. Discover pagination summary

- Added load-more/onEndReached handling to Discover Players, Matchrooms, Teams, and Zones.
- Added loading-more footers to all four Discover list components.
- Preserved existing segment tabs, filters, search props, card UI, pull-to-refresh, and action flows.
- Raised server-side Discover candidate caps in `convex/discover.ts` so the UI no longer treats the old first 200/300 candidate windows as complete.
- Discover currently uses progressive server-limit pagination over the existing query shape instead of new typed cursor exports. This avoids codegen churn in this slice but is less scalable than true cursor pagination.

## 4. Super Admin remaining pagination summary

Implemented page APIs and UI load-more for the stop-rule priority Super Admin lists:

- Users
  - Added `admin.listUsersPage`.
  - Added `getUsersPage`.
  - Migrated `app/super-admin/users.tsx` to `FlatList.onEndReached`.
- Zones
  - Added `admin.listZonesPage`.
  - Added `getZonesPage`.
  - Migrated `app/super-admin/zones.tsx` to `FlatList.onEndReached`.
- Matchrooms
  - Added `admin.listSuperAdminMatchroomsPage`.
  - Added `getSuperAdminMatchroomsPage`.
  - Migrated `app/super-admin/matchrooms.tsx` to `FlatList.onEndReached`.
- Support tickets
  - Added `admin.listSupportTicketsPage`.
  - Added `getSupportTicketsPage`.
  - Migrated `app/super-admin/support-tickets.tsx` to `FlatList.onEndReached`.

Existing actions and detail routes were preserved. The new service calls use `(api as any)` so generated API types are not required for this pass.

## 5. Zone history pagination summary

- Zone Booking History now has load-more behavior.
- `ZoneBookingsHistorySection` accepts `loadingMore` and `onLoadMore`.
- `app/zone/modules/bookings.tsx` increases the existing owner-scoped history query limit from 20 up to a capped 100 rows.
- Accept/reject/counter-offer paths were not changed.
- Ownership remains enforced by the existing `zoneAdminBooking.listBookingHistoryForZone` query.

## 6. Player remaining lists summary

Deferred in this slice:

- Inbox
- Player report history
- Friends
- My Teams/Profile My Teams
- Chatrooms
- Chat messages

Reason: the stop-rule minimum set was completed first. Chatrooms/messages and social lists need more careful query design to avoid global merge pagination bugs.

## 7. Backend queries/indexes added

Added Convex query exports:

- `admin.listUsersPage`
- `admin.listZonesPage`
- `admin.listSuperAdminMatchroomsPage`
- `admin.listSupportTicketsPage`

Indexes added: none.

## 8. Filters moved server-side

- Super Admin Users: account type remains server-scoped through the page query.
- Super Admin Zones: lifecycle/status tab remains server-scoped through the page query.
- Super Admin Support Tickets: status tab remains server-scoped through the page query.
- Super Admin Matchrooms: base ordering remains server-side by created time.
- Discover filters continue to execute in the existing Convex Discover queries.

## 9. Filters still page-scoped and why

- Super Admin Users: status, role, KYC, date, and search remain client-side over loaded pages. Full server correctness would need more compound indexes/search strategy.
- Super Admin Zones: city, area, pilot status, date, and search remain client-side over loaded pages because city/area are nested or derived.
- Super Admin Matchrooms: lifecycle, booking type, zone name, result status, payment status, date, and search remain client-side over loaded pages because several are derived or nested.
- Super Admin Support Tickets: priority, category, role, assignment, date, and search remain client-side over loaded pages.
- Discover uses existing Convex filters but still relies on bounded candidate windows. Raised caps reduce false completeness, but true cursor pagination/search correctness remains a follow-up.
- Zone Booking History uses progressive limit over the existing query. True cursor pagination is deferred because the current history rows are derived from requests, offers, and matchrooms.

## 10. Codegen

- Codegen run: no.
- Target: not applicable.
- Reason: no schema/index changes were made, and new API exports are consumed through `(api as any)` service wrappers.
- Note: generated API types should be refreshed before replacing dynamic references with typed `api.admin.*` references.

## 11. Known risks

- Discover load-more is not true cursor pagination yet; it progressively raises the server limit over existing filtered queries.
- New Super Admin page APIs use offset cursors. Inserts/deletes between page loads can shift page boundaries, though UI merge logic deduplicates loaded rows by id.
- Several filters remain loaded-page-scoped and are documented above.
- Zone History is capped at 100 rows in this slice and still uses the existing derived multi-table query.

## 12. Deferred items

- Super Admin audit logs, identity verifications, and notifications pagination.
- Player Inbox, player Reports, Friends, My Teams/Profile My Teams.
- Chatrooms and chat message older-page pagination.
- True cursor-based Discover page APIs or digest-backed Discover search.

## 13. Validation

- `npx tsc -p tsconfig.json --noEmit`: passed after implementation.
- Final `npx tsc -p tsconfig.json --noEmit`: passed.
- Final `git diff --check`: passed with CRLF line-ending warnings only.

## 14. Manual QA checklist

- Discover Players load first page and load more without duplicate cards.
- Discover Matchrooms load first page and load more without duplicate cards.
- Discover Teams Browse/My Teams load more without breaking mode state.
- Discover Zones load more and preserve effective rate labels.
- Super Admin Users load more; suspend/reactivate still works.
- Super Admin Zones load more; zone detail routes still open.
- Super Admin Matchrooms load more; matchroom detail routes still open.
- Super Admin Support Tickets load more; ticket detail routes still open.
- Zone Booking History load more; only owned zone history appears.
- Filters reset and loaded rows do not duplicate at page boundaries.
- No payment/wallet money movement behavior changed.
- No report/moderation behavior changed.

Recommended commit message:

`fix(performance): paginate discover and remaining admin lists`
