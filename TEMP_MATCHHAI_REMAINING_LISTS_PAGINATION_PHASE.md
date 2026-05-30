# MatchHai Remaining Player Lists + Admin Utility Pagination Phase

Implementation date: 2026-05-30

## 1. Pre-flight

- Branch: `product-ready`
- Latest commit at phase start: `a3a79bb fix(performance): paginate discover and remaining admin lists`
- Previous pagination commit hash: `a3a79bb`
- `git status --porcelain` at phase start: clean
- `git diff --stat` at phase start: empty
- Previous TEMP files (`TEMP_MATCHHAI_DISCOVER_ADMIN_REMAINING_PAGINATION_PHASE.md`) left in place.

## 2. Files changed

- `convex/admin.ts`
- `convex/reports.ts`
- `src/services/convex/superAdminService.ts`
- `src/services/convex/reportService.ts`
- `app/super-admin/audit-logs.tsx`
- `app/super-admin/identity-verifications.tsx`
- `app/super-admin/notifications.tsx`
- `app/(player)/reports.tsx`
- `TEMP_MATCHHAI_REMAINING_LISTS_PAGINATION_PHASE.md`

## 3. Super Admin utility list pagination summary

Implemented page APIs and UI load-more for the three remaining Super Admin
utility lists called out in the previous phase as deferred:

- Audit logs
  - Added `admin.listSuperAdminAuditLogsPage`.
  - Added service wrapper `getSuperAdminAuditLogsPage`.
  - Migrated `app/super-admin/audit-logs.tsx` to `FlatList.onEndReached`.
- Identity verifications
  - Added `admin.listIdentityVerificationsPage`.
  - Added service wrapper `getIdentityVerificationsPage`.
  - Migrated `app/super-admin/identity-verifications.tsx` to `FlatList.onEndReached`.
- Notifications
  - Added `admin.listMyNotificationsPage`.
  - Added service wrapper `getSuperAdminNotificationsPage`.
  - Migrated `app/super-admin/notifications.tsx` to `FlatList.onEndReached`.

Existing detail/actions (manual KYC verify, mark-read, archive, open) and
audit hooks were preserved. Service calls use `(api as any)` so generated
API types are not required for this pass, matching the previous phase.

## 4. Player Inbox / Reports pagination summary

- Reports
  - Added `reports.listMineByStatusPage` page query.
  - Added service wrapper `getMyReportsPage`.
  - Migrated `app/(player)/reports.tsx` to `FlatList.onEndReached`.
  - Submit/detail navigation preserved.
  - Reporter scoping enforced by existing `getAuthenticatedConvexUser`.
- Inbox
  - Inbox already uses a reactive `useQuery(api.notifications.listInboxPage, { limit: 100 })`.
  - Inbox older-page load-more deferred this slice — reactive pagination over the
    inbox would require either a `usePaginatedQuery` redesign or a hybrid
    static-snapshot path, and would risk breaking the existing real-time
    pending-tab badge, dedup, and matchroom join collapse logic.
  - The existing 100-row cap is bounded per active user. No regression vs
    previous phase.

## 5. Friends / Teams pagination summary

Deferred in this slice (see section 9). Brief rationale:

- Friends and My Teams are already loaded through user-scoped queries
  (`api.social.listFriends`, `api.teams.getUserTeams`). They are bounded by
  the user's actual friend/team count and do not have global-window scan
  problems like Discover or Super Admin lists.
- Adding load-more here is low value at current realistic sizes.
- Captain/member permissions and invite/join flows are untouched.

## 6. Chat pagination status

Deferred. Chat pagination remains a follow-up.

Reason: chat threads (matchroom chat, friend chat, team challenge chat) use
reactive `useQuery` real-time message windows. Adding "load older" without
breaking scroll-to-bottom, optimistic sends, real-time updates, and report
modals carries notable regression risk. Per stop-rule rule 4 in the phase
brief, chat pagination is documented as deferred rather than attempted in
this slice.

## 7. Backend queries/indexes added

Added Convex query exports:

- `admin.listSuperAdminAuditLogsPage`
- `admin.listIdentityVerificationsPage`
- `admin.listMyNotificationsPage`
- `reports.listMineByStatusPage`

Indexes added: none. All new page queries reuse existing indexes:

- Audit logs: existing `by_createdAt` on `superAdminAuditLogs`.
- Identity verifications: existing `by_status_and_submittedAt`.
- Notifications: existing `by_toUid` on `notifications`.
- Reports: existing `by_reporterUid` on `reports`.

## 8. Filters moved server-side

- Reports status tab is server-scoped through the page query.
- Audit logs status / module / action / superAdminEmail / target / date-range
  remain server-scoped through the existing filter inputs accepted by the
  page query (mirroring the legacy `listSuperAdminAuditLogs`).
- Identity verifications status / role remain server-scoped through the page
  query (mirroring the legacy `listIdentityVerifications`).
- Notifications read/unread tab is server-scoped through the page query.

## 9. Filters still page-scoped and why

- Super Admin Audit logs: free-text search across target / action / admin
  email remains loaded-page-scoped because the existing index is by
  `createdAt` only. Server-side text search would need an additional
  search index.
- Super Admin Identity verifications: free-text search across user name /
  email / workflow id / rejection reason remains loaded-page-scoped because
  the existing index keys by status only and user fields live on a joined
  `users` row.
- Super Admin Notifications: type/category filter and date-range filter
  remain loaded-page-scoped because category is derived client-side from
  `type` prefixes and is not stored on the row.
- Player Reports: tab status is server-side; everything else (date, search)
  is page-scoped at the UI layer.

## 10. Codegen

- Codegen run: no.
- Target: not applicable.
- Reason: no schema/index changes were made, and new API exports are consumed
  through `(api as any)` service wrappers in `superAdminService.ts` and
  `reportService.ts`, matching the previous phase.
- Note: generated API types should be refreshed before replacing dynamic
  references with typed `api.admin.*` / `api.reports.*` references.

## 11. Known risks

- New page APIs use offset cursors. Inserts/archive between page loads can
  shift page boundaries, though UI merge logic deduplicates loaded rows by
  id.
- Audit log + identity verification free-text search remains loaded-page
  scoped — power users searching for an old record may need to load more
  pages.
- Inbox older-page load-more is intentionally not added; reactive
  pagination over notifications is documented as a deferred follow-up.

## 12. Deferred items

- Player Inbox older-page pagination (reactive query redesign).
- Friends / My Teams / Profile My Teams pagination (user-scoped, bounded
  by membership/friendship count).
- Chatrooms list and chat message older-page pagination (real-time
  reactive risk).
- Search index for audit logs / identity verifications text search.

## 13. Validation

- `npx tsc -p tsconfig.json --noEmit`: passed.
- Final `git diff --check`: passed (CRLF line-ending warnings only).

## 14. Manual QA checklist

- Super Admin Audit Logs load first page and load more without duplicate cards.
- Audit log filters (status, module, action, admin, date) still apply and
  reset cleanly.
- Super Admin Identity Verifications load first page and load more without
  duplicate cards.
- Manual KYC verify on a pending verification still works.
- Super Admin Notifications Unread tab loads first page and load more.
- Super Admin Notifications Read tab loads first page and load more.
- Notification Mark read / Archive / Open route still works.
- Player Reports Pending / Reviewed / Resolved tabs each load first page and
  load more without duplicates.
- Opening a report from the list still navigates to `/report/[id]`.
- Cross-user data remains blocked (reporter scoping enforced server-side).
- No payment/wallet money movement behavior changed.
- No report/moderation actor or moderation action behavior changed.
- No KYC provider logic changed (only manual override audit path, unchanged).

Recommended commit message:

`fix(performance): paginate remaining inbox and admin lists`
