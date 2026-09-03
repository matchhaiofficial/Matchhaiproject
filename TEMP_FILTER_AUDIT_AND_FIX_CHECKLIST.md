# TEMP — Filter Audit and Fix Checklist

## Context
We audited all filter-like UI across Player, Zone Admin, and Super Admin modules.

Main findings:
- Filters exist across many screens but are inconsistent.
- Some screens use shared components, some use one-off filters.
- Some drawers have Reset + Done; some have Done only.
- Status names differ across modules.
- Player Discover has the strongest filter setup.
- Zone Admin Bookings and some Super Admin screens need cleanup.
- Super Admin needs stronger operational filters in later phases.

## Global Rules
- Do not add backend filters unless approved.
- Do not change query semantics unless approved.
- Do not remove filters without approval.
- Prefer clear labels and consistent reset behavior.
- Every filter drawer should have Reset + Done unless there is a clear reason not to.
- Keep filters simple for players.
- Give Super Admin stronger operational filters in later phases.
- Avoid adding too many filters to player screens.

## Phase 1 — Standardize Labels + Reset/Done Semantics
- [x] Add Reset to Zone Admin Bookings Requests filter drawer.
- [x] Add Reset to Zone Admin Bookings Matchrooms filter drawer.
- [x] Standardize notification tab wording where safe.
- [x] Standardize reports/support status wording where safe.
- [x] Standardize matchroom status labels where possible without changing logic.
- [x] Do not change backend filters.
- [x] Do not add new filters.
- [x] Run TypeScript.
- [x] Manual check Reset/Done behavior.

## Phase 2 — Player Filter Cleanup
- [x] Wallet transaction filters.
- [x] My Matchrooms filters.
- [x] Inbox type filter.
- [x] Schedule status simplification.
- [ ] Discover basic vs advanced grouping. **(Planning completed — implementation deferred; see Phase 2E handoff below.)**

### Phase 2 Plan — Player Filter Cleanup
Status: Planned only. Do not implement until approved.

#### 1. Wallet Transactions
- Files to change:
  - `app/(player)/wallet.tsx`
  - `app/(player)/wallet.styles.ts`
- Filters to add/update:
  - Type: derived from existing transaction fields such as `source` and `kind` (for example wallet top-up, booking payment, hold, release/capture, refund, withdrawal where present).
  - Status: derived from existing `status`, using current visible status label helpers.
  - Date Range: frontend ranges such as Any, Today, Last 7 Days, Last 30 Days.
  - Amount Range: frontend buckets based on `amount`.
- Filtering support:
  - Frontend-only over the already loaded `walletHistory`.
  - No backend/query support planned for Phase 2 unless existing loaded data proves insufficient.
- What will not change:
  - Wallet balance math.
  - Transaction creation, sync, checkout, refund, reservation, or settlement data.
  - Overview tab content.
- Risk areas:
  - Transaction rows use mixed shapes (`source`, `kind`, `status`, `support`), so type labels must be derived conservatively.
  - Amount buckets must treat refunds/credits/debits without changing displayed amounts.

#### 2. My Matchrooms
- Files to change:
  - `app/matchrooms/my.tsx`
  - `app/matchrooms/my.styles.ts`
- Filters to add/update:
  - Search: title, game, status, date/location where available.
  - Status: derived from `getRoomDisplayStatus(item)` or existing room status labels.
  - Game: derived from hosted/joined room data.
  - Date Range: Any, Today, This Week, Upcoming/Past-style ranges if safe.
  - Hosted / Joined tabs remain.
- Filtering support:
  - Frontend-only over already loaded `hostedRooms` and `joinedRooms` from `getUserMatchrooms`.
  - Backend already returns hosted/joined collections; no query args planned.
- What will not change:
  - Hosted/joined grouping.
  - Matchroom lifecycle logic.
  - Matchroom card navigation.
- Risk areas:
  - `getRoomDisplayStatus` may not match Schedule labels exactly; keep mapping display-only.
  - Existing screen uses custom tabs; switching to `SegmentedTabs` is acceptable only if styling and counts remain equivalent.

#### 3. Inbox
- Files to change:
  - `app/(player)/inbox.tsx`
  - `app/(player)/inbox.styles.ts`
  - `app/(player)/hooks/useInboxViewModel.ts`
- Filters to add/update:
  - Review tab wording: Pending / History should not become Unread / All unless semantics are changed and approved.
  - Type filter: Matchrooms, Teams, Payments, Support, Reports, System.
- Filtering support:
  - Frontend-only over `visibleNotifications`.
  - Type buckets derived from current notification `type`, `entityKey`, and known notification categories.
- What will not change:
  - Backend `tab` args (`pending` / `resolved`).
  - Notification counts.
  - Auto mark-read behavior.
  - Clear history and mark all read behavior.
- Risk areas:
  - Current tabs are status-based, not read-state-based; renaming to Unread / All would be misleading without a larger behavior change.
  - Type bucketing must avoid hiding actionable pending notifications unexpectedly.

#### 4. Schedule
- Files to change:
  - `app/(player)/schedule.tsx`
  - `app/(player)/schedule.styles.ts`
- Filters to add/update:
  - Verify existing Date, Game, Payment, and venue/booking-type coverage.
  - Consider renaming `Venue` to `Booking Type` if it still maps only to Zone / Broadcast.
  - Simplify status labels if display-only mapping is safe: Upcoming, Needs Action, Completed, Cancelled, Expired.
- Filtering support:
  - Frontend-only over existing `rooms`, `intents`, `actionItems`, and `historyItems`.
  - Existing Convex queries remain unchanged.
- What will not change:
  - Internal schedule categorization.
  - Matchroom lifecycle state calculation.
  - Booking intent fetching.
  - Timeline action grouping.
- Risk areas:
  - Existing `Status` filter uses exact display statuses (`Confirmed`, `Pending Payment`, `Waiting Lobby`, etc.); simplified labels may require grouping multiple statuses under one label.
  - Actions/history items are filtered differently from room items today; adding status/date filters to action items needs careful handling.

#### 5. Discover
- Files to review before implementation:
  - `app/(player)/(tabs)/discover.tsx`
  - `src/features/discover/components/DiscoverFilterDrawer.tsx`
  - `src/features/discover/filterConfig.ts`
  - Related list components under `src/features/discover/components/`
- Filters to add/update:
  - Plan grouping only:
    - Basic: Game, Area, Availability/Open Slots.
    - Advanced: Skill, Format, Price, Platform, Role.
- Filtering support:
  - Existing mixed support: player/team/zone/matchroom lists already use current filter state and service calls.
  - Do not change backend queries or service args in Phase 2 without separate approval.
- What will not change:
  - No new Discover filter dimensions in initial Phase 2 pass.
  - No restructuring until the grouping plan is explicitly approved.
- Risk areas:
  - Discover has the broadest filter surface and game-specific options; grouping can affect discoverability even without changing logic.
  - Reset counts and drawer subtitles must continue to reflect current active filters.

#### Phase 2 TypeScript / Manual Test Plan
- Run `npx tsc -p tsconfig.json --noEmit`.
- Manual Wallet checks:
  - Overview remains unchanged.
  - Transactions filter drawer/search shows correct Reset + Done behavior.
  - Type, Status, Date Range, and Amount Range combine correctly.
  - Empty state changes from no transactions vs no matching transactions are clear.
- Manual My Matchrooms checks:
  - Hosted / Joined tabs remain and counts are correct.
  - Search, Status, Game, and Date Range filter only the active tab.
  - Reset restores all filters.
  - Opening a lobby still works.
- Manual Inbox checks:
  - Pending / History counts remain correct.
  - Type filter does not change backend tab args.
  - Mark all read, clear history, and actionable cards still work.
- Manual Schedule checks:
  - Upcoming, Pending/Actions, and History lists remain correctly grouped.
  - Date, Game, Payment, Booking Type/Venue, and Status filters combine correctly.
  - Status label simplification is display-only if applied.
- Manual Discover checks:
  - No functional Discover changes unless separately approved.
  - Existing filter Reset, Done, active count, and search still work if touched.

## Phase 3 — Zone Admin Filter Cleanup
- [x] Bookings Branch filter. (Phase 3A)
- [x] Bookings Date Range filter. (Phase 3A)
- [x] Bookings Payment Status filter. (Phase 3A — Matchrooms tab)
- [x] Bookings Booking Source filter. (Phase 3A — Matchrooms tab; Requests tab gets Request Type instead)
- [x] Resources status consistency. (Phase 3B — display-only)
- [x] Pricing Date Range and Status naming. (Phase 3C — frontend-only)

## Phase 4 — Super Admin Filter Cleanup
Phase 4 plan prepared. Approved sub-phase order: 4A Support Tickets + Matchrooms,
4B Users + Zones, 4C Reports + Identity + Notifications, 4D Audit Logs.
Approved decisions: Audit Logs Date Range is in-scope (uses existing from/to args);
Payments + Withdrawals deferred to Phase 5 (page-capped / pending-only data).
- [ ] Payments Date Range. **(Deferred to Phase 5 — list loads ~20 records only.)**
- [ ] Payments Amount Range. **(Deferred to Phase 5.)**
- [ ] Payments Reconciliation Flag. **(Deferred to Phase 5 — flags exist only on payment detail record.)**
- [ ] Withdrawals Status/Date/Amount/Zone. **(Deferred to Phase 5 — only pending withdrawals are loaded.)**
- [x] Users Account Status and KYC Status. **(Phase 4B — Account Status + Role + Created Date added; KYC deferred to Phase 5 — not on user record.)**
- [x] Zones Search and Pilot Status. **(Phase 4B — Search + City + Area + Created Date added; Pilot Status deferred to Phase 5 — only on active zones, not loaded.)**
- [x] Support Priority and Category. **(Phase 4A — also User Role, Date Range, Assigned Admin.)**
- [x] Matchrooms Game/Date/Payment/Result filters. **(Phase 4A — also Booking Type, Zone.)**

## Phase 5 — Backend / Index Improvements
Status: **Plan approved. Phases 5A–5E implemented (May 23, 2026). 5D DEFERRED after data-quality review (kept unchecked). 5F remains a plan only.** Phase 4A–4D implemented (frontend-only except the approved Audit `from` value). See "Phase 5 Plan" subsection and the Phase 5A–5E handoff entries below.
- [x] Phase 5A — Users KYC Status filter (frontend-only). **(Implemented May 23, 2026.)**
- [x] Phase 5B — Zones Active tab + Pilot Status filter. **(Implemented May 23, 2026 — frontend + additive `Zone` type field; no backend change.)**
- [x] Phase 5C — Withdrawals all-status via existing arg + FE date/amount/branch. **(Implemented May 23, 2026 — reuses existing backend `status` arg; "Rejected" derived from `adminDecision`.)**
- [ ] Phase 5D — Users Last Active (conditional on data-quality check of `lastActiveAt`). **(DATA-REVIEWED May 23, 2026 — DEFERRED; `lastActiveAt` is not reliably populated. See 5D handoff.)**
- [x] Phase 5E — Payments `listPaymentsV2` + indexes + page-scoped reconciliation. **(Implemented May 23, 2026 — additive read-only query + 2 indexes; codegen run.)**
- [ ] Phase 5F — Pagination follow-ups (Payments/Withdrawals/Users/Zones/Matchrooms/Support). **(Planned — see 5F section.)**
- [x] Review heavy frontend filtering. *(Reviewed in plan — see Performance/index table and 5F.)*
- [x] Identify where backend filters are needed. *(Identified — only Payments needed a new index/query; Withdrawals/Users-KYC/Zones-Pilot are frontend-only or use existing args.)*
- [x] Add indexes only after approval. *(Approved Payments indexes `by_createdAt` + `by_status_and_createdAt` added in 5E.)*

### Phase 5 Plan (prepared May 23, 2026 — planning only, awaiting approval)
Key verified findings that change earlier deferral assumptions:
- **Users KYC + Last Active are NOT missing.** `users.kycVerificationStatus`, `kycVerifiedAt`, `kycProvider` (schema ~183-194) and `lastActiveAt` (~305) exist; `admin.listUsers` returns the full doc (`...user`), so both already reach the client. KYC Status filter = frontend-only (no denormalization). The Phase 4B note "KYC not on user record" was incorrect.
- **Withdrawals backend already accepts all statuses.** `admin.listZoneWithdrawalRequests` takes `status: any|pending|completed|failed`; only the frontend pins `pending`. No backend signature change needed. NOTE: there is no "rejected" status — rejection = `failed` + `metadata.adminDecision="rejected"`.
- **Zones `pilotStatus` already returned** by `admin.listZones` (`...zone`) and `status="active"` is already a supported arg. Pilot Status needs only an Active zones tab/list on the frontend.
- **Payments is the only genuine backend item.** `admin.listEasypaisaTransactions` returns ~20 recent rows (per-status take + dedupe, no `createdAt` ordering/pagination). Needs a new `listPaymentsV2` (pagination + server date/amount/status), adds `expiresAt`+`bookingIntentId` to the row, and indexes `paymentTransactions.by_createdAt` and `by_status_and_createdAt`. Reconciliation flags are join-heavy (wallet/bookingIntent/matchroom) and must be page-scoped/opt-in, not full-table; no denormalization for now.
Recommended sub-phase order (front-loads safe frontend-only wins, isolates the index-adding work last):
- Phase 5A — Users KYC Status (frontend-only).
- Phase 5B — Zones Active tab + Pilot Status (frontend-only).
- Phase 5C — Withdrawals all-status via existing arg + FE date/amount/branch; "Rejected" derived from adminDecision.
- Phase 5D — Users Last Active (conditional on `lastActiveAt` being well-populated; else defer).
- Phase 5E — Payments `listPaymentsV2` + indexes + page-scoped reconciliation (only schema/index/query change).
- Phase 5F — Pagination follow-ups (Matchrooms/Users/Zones) as a later track.
Must not change: money movement, payment status mutation, wallet math, withdrawal approve/reject, zone approval/pilot payout, user auth/suspension. All new queries read-only.

## Phase 6 — QA
Status: **Code-review + TypeScript regression pass COMPLETE (May 23, 2026). Passed with 2 minor fixes.** See the Phase 6 handoff entry at the end of this file. Device/simulator items below remain for manual QA.
- [x] Reset / Done buttons. *(Code review — all 10 Super Admin + Zone Admin + Player drawers verified.)*
- [x] Active filter count. *(Code review — search excluded everywhere; per-tab counts verified.)*
- [x] Empty states. *(Code review — raw vs filtered-empty verified; fixed Withdrawals "No all withdrawals" + Pricing missing filtered-empty.)*
- [ ] Small phone. *(Manual device QA — not run.)*
- [ ] Samsung A32. *(Manual device QA — not run.)*
- [ ] Large Android. *(Manual device QA — not run.)*
- [ ] iPhone with home indicator. *(Manual device QA — not run.)*
- [ ] Filter drawer scrolling. *(Manual device QA — not run.)*
- [ ] Chip wrapping. *(Manual device QA — not run.)*

## Phase Handoff Summary
For every phase, record:
- Status:
- Files changed:
- Filters changed:
- Labels changed:
- Reset behavior changed:
- Backend unchanged confirmation:
- Tests run:
- Known risks:
- Next phase starting point:

### Phase 1 (May 21, 2026)
- Status: Implemented (UI-only)
- Files changed:
  - `app/zone/modules/components/ZoneBookingsRequestsSection.tsx`
  - `app/zone/modules/components/ZoneBookingsMatchroomsSection.tsx`
- Filters changed: None (no new filters, no removals)
- Labels changed: None (deferred; see notes below)
- Reset behavior changed:
  - Zone Admin Bookings Requests drawer now has `Reset` (disabled when no active filters) + `Done`
  - Zone Admin Bookings Matchrooms drawer now has `Reset` (disabled when no active filters) + `Done`
- Backend unchanged confirmation: Yes (no Convex/backend files touched; no query args changed)
- Tests run: `npx tsc -p tsconfig.json --noEmit` (pass)
- Known risks:
  - Reset disabling relies on `activeFilterCount` being accurate for the drawer state.
- Next phase starting point:
  - Phase 2 — Player Filter Cleanup, starting with Wallet Transactions or My Matchrooms because both can be handled as frontend-only filtering over already loaded data.
- Deferred decisions / follow-ups:
  - Notifications tabs: `pending/resolved` are backend-driven and do not map cleanly to `Unread/All` labels without changing semantics; revisit in Phase 2/3.
  - Reports/support “Reviewed” label: appears to mean “triaged” (distinct state), not “In Review”; do not rename without product decision.
  - Matchroom status label unification: defer to Phase 4 to avoid broad label/mapping changes.

### Phase 2A (May 21, 2026)
- Status: Implemented (Wallet Transactions only, frontend-only)
- Files changed:
  - `app/(player)/wallet.tsx`
  - `app/(player)/wallet.styles.ts`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
- Filters added:
  - Type: All, Wallet Top-up, Booking Payment, Reserved / Hold, Refund, Release / Capture, Withdrawal, Other
  - Status: All, Successful, Pending, Failed, Expired, Cancelled, Refunded
  - Date Range: All, Today, Last 7 Days, Last 30 Days
  - Amount Range: All, Under Rs 500, Rs 500 - Rs 2,000, Rs 2,000 - Rs 5,000, Above Rs 5,000
- Frontend-only confirmation:
  - Filters apply only to the already loaded `walletHistory` array.
  - Type is derived conservatively from existing transaction fields (`source`, `kind`, `type`, `reference`, `title`).
  - Status is derived from existing `status`/`kind` values without changing current status display helpers.
- Backend unchanged confirmation:
  - No Convex/backend files changed.
  - No wallet query args changed.
  - No wallet math, transaction creation/update, payment, reconciliation, or sync logic changed.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass)
- Known risks:
  - Wallet history rows have mixed shapes, so some unusual transaction kinds may fall into `Other`.
  - Unknown statuses are excluded by non-All status filters until a product mapping is defined.
- Next starting point:
  - Phase 2B — My Matchrooms filters.

### Phase 2B (May 22, 2026)
- Status: Implemented frontend-only (My Matchrooms only)
- Files changed:
  - `app/matchrooms/my.tsx`
  - `app/matchrooms/my.styles.ts`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
- Filters added:
  - Search: title, game, display status, and existing start label.
  - Status: dynamic unique `getRoomDisplayStatus(item)` values from hosted + joined rooms.
  - Game: dynamic unique `item.game` values from hosted + joined rooms.
  - Date Range: All, Today, This Week, Past.
- Per-tab filter behavior:
  - Hosted and Joined have independent filter state.
  - Switching tabs preserves each tab's filters.
  - Reset clears search, status, game, and date range for the active tab only.
- Date Range definition:
  - `This Week` means rooms starting from now through the next 7 days.
  - Timestamp is derived only from `startTime`, `scheduledStartAt`, or `scheduledStartAt.seconds`.
  - `scheduledDate` is not parsed; rooms without a timestamp are excluded from non-All date ranges.
- Active count behavior:
  - Counts active tab filters only.
  - Non-empty search, non-All status, non-All game, and non-All date range each count as 1.
- Empty state rules:
  - No rooms in the active tab keeps the existing Hosted/Joined empty copy.
  - Existing rooms filtered to zero show `No matchrooms match these filters.`
- Backend unchanged confirmation:
  - No Convex/backend files changed.
  - No query args changed.
  - No matchroom lifecycle/status logic, grouping logic, card layout behavior, or navigation behavior changed.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass)
- Known risks:
  - Dynamic status/game options only appear after rooms are loaded.
  - Rooms with only `scheduledDate` and no numeric start timestamp do not match Today/This Week/Past.
- Next starting point:
  - Phase 2C — Inbox type filter.

### Phase 2C (May 22, 2026)
- Status: Implemented frontend-only (Inbox Type filter only)
- Files changed:
  - `app/(player)/inbox.tsx`
  - `app/(player)/inbox.styles.ts`
  - `app/(player)/hooks/useInboxViewModel.ts`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
- Filter added:
  - Type: All, Matchrooms, Teams, Payments, Support, Reports, System
- Type categories and mapping:
  - Support: `type` or `entityKey` starts with `support.` or `support_`.
  - Reports: `type` starts with `moderation.` or contains `report`.
  - Payments: `type` starts with `wallet.` / `wallet_`, contains `payment_required` / `payment_result`, or starts with `payment.`.
  - Teams: `type` or `entityKey` starts with `team.` or `team_`, or a team ID is present.
  - Matchrooms: `type` starts with `match.` / `match_` or `booking.` / `booking_`, or a matchroom/booking intent ID is present.
  - System: fallback for unknown or uncategorized notifications.
- Frontend-only confirmation:
  - Filtering applies in memory over notifications already loaded for the active backend tab.
  - `tabNotifications` keeps the existing visibility/tab logic before Type filtering.
  - `filteredNotifications` applies the Type filter for rendering only.
- Backend/query unchanged confirmation:
  - No Convex/backend files changed.
  - Inbox still calls `useNotifications(activeTab)` with the existing `pending` / `resolved` tab values.
  - No notification lifecycle logic changed.
- Count behavior unchanged confirmation:
  - `pendingCount` and `resolvedCount` remain derived from visible notifications before Type filtering.
- Empty state behavior:
  - Active tab with zero notifications keeps the existing `InboxEmptyState` copy.
  - Active tab with notifications filtered to zero shows `No notifications match these filters.` and `Reset filters to view all notifications.`
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass)
- Manual test notes:
  - Not run on device in this pass.
  - Code review confirms Pending / History labels and `useNotifications(activeTab)` query args are unchanged.
  - Code review confirms Type filtering happens after existing tab filtering and does not affect `pendingCount` / `resolvedCount`.
  - Code review confirms Reset returns Type to All, Done closes the drawer, and the badge count is 0 or 1.
  - Code review confirms mark-read, clear-history, and action handlers are still wired to the same notification cards/actions.
- Known risks:
  - Unknown notification shapes map to `System`.
- Next starting point:
  - Phase 2D - Schedule status simplification.

### Phase 2D (May 22, 2026)
- Status: Implemented frontend-only (Player Schedule filters only). Booking Type rename applied; Status grouping applied; `Expired` group deferred (no schedule status maps to it).
- Files changed:
  - `app/(player)/schedule.tsx`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
  - (`app/(player)/schedule.styles.ts` not changed — existing empty-state styles reused.)
- Labels changed (visible only):
  - `Venue` -> `Booking Type`
  - `Venue` option `Zone` -> displayed as `Zone Booking` (stored value stays `Zone`)
  - `Date` -> `Date Range`
  - `Payment` -> `Payment Status`
- Filters changed:
  - Status options simplified from 7 exact statuses to display buckets: `Any`, `Upcoming`, `Needs Action`, `Completed`, `Cancelled`.
  - All other filters (Game, Date Range, Booking Type, Payment Status) keep existing behavior and stored values.
- Status grouping applied (display-only mapping over statuses from `getRoomScheduleState`):
  - `Upcoming` <- `Confirmed`
  - `Needs Action` <- `Pending Payment`, `Pending Approval`, `Waiting Lobby`, `Waiting Venue`
  - `Completed` <- `Completed`
  - `Cancelled` <- `Cancelled`
  - Implemented via `STATUS_FILTER_GROUPS` + `getStatusFilterGroup(item.status)`; unknown statuses fall through unchanged so they never silently match a bucket.
  - `Expired` group deferred: `getRoomScheduleState` never returns expired/no-show/timeout; past-but-unconfirmed rooms keep their pending status and live in History, so an `Expired` chip would always return zero results. Omitted to avoid a dead filter.
- Booking Type rename applied (not deferred):
  - Confirmed safe because the "Venue" filter only ever derived `Zone` vs `Broadcast` from `isZoneRoom(room)` (`zoneId` / `confirmedZoneId` / `locationMode === "zone"`), never a physical venue/location.
  - Stored values `Zone` / `Broadcast` unchanged; `DiscoverFilterRow` `{ key, label }` option keeps the value `Zone` while showing `Zone Booking`, so line ~390 filter logic is untouched.
  - Internal state field stays `filters.venue` (only the label changed) to keep the diff minimal.
- Empty state behavior:
  - Added raw-empty vs filtered-empty distinction using `rawTabCount` (categorized tab items + tab action items, pre-search) vs `visibleTabCount` (rendered rooms + filtered actions).
  - Raw-empty keeps existing per-tab copy: `No upcoming confirmed matches`, `Nothing is pending`, `No history yet`.
  - Filtered-empty (tab has items but filters/search hide them all) shows `No schedule items match these filters.` with helper `Reset filters to view all schedule items.`
  - Item rendering (which rooms/actions render per tab) is unchanged; only the empty-state branch was consolidated.
- Drawer behavior:
  - Unchanged and already conforms to the standard pattern: Reset (left, disabled when `activeFilterCount === 0`) + Done (right, closes drawer). `getActiveFilterCount` and `DEFAULT_FILTERS` reset are unchanged.
- Tab / categorization behavior:
  - Unchanged. Upcoming/Pending/History decisioning (`categorizedRooms`, `getRoomScheduleState`, `visibleActions`) is byte-for-byte the same; only filter labels, status bucketing, and empty states changed.
- Backend / query unchanged confirmation:
  - No Convex/backend files changed.
  - No query args changed (`getUserMatchrooms`, `listIntentsByUser`, `listActiveIntentsByUser`, `listInboxPage`, `getMyReports` all called identically).
  - No lifecycle/status calculation, booking/payment, or matchroom logic changed.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass, exit 0).
- Manual test notes:
  - Not run on device in this pass; verified by code review.
  - Code review confirms tabs still categorize Upcoming/Pending/History identically.
  - Code review confirms Status grouping is a display-only comparison layer; internal statuses and tab placement unchanged.
  - Code review confirms Reset returns all filters to default and is disabled at 0 active filters; Done closes the drawer.
- Known risks:
  - Status grouping is exact-match against the strings from `getRoomScheduleState`; if those copy strings change, `STATUS_FILTER_GROUPS` must be updated in lockstep.
  - On the Upcoming tab the existing (pre-2D) behavior of also rendering resolved-report history items via `visibleActions` is preserved; the consolidated empty state now suppresses the empty card when those items are present (previously both could show together). No item visibility was added or removed.
- Next starting point:
  - Phase 2E — Discover basic vs advanced grouping plan.

### Phase 2E (May 22, 2026)
- Status: **Planning completed — implementation deferred. No code changed.**
- Scope of this pass: planning/grouping decision only. No edits to any Discover source files; only this checklist was updated.
- Files reviewed (not changed):
  - `app/(player)/(tabs)/discover.tsx`
  - `src/features/discover/components/DiscoverFilterDrawer.tsx`
  - `src/features/discover/filterConfig.ts`
  - `src/features/discover/components/DiscoverShared.tsx`
  - `src/features/discover/components/DiscoverMatchroomList.tsx`, `DiscoverPlayerList.tsx`, `DiscoverTeamList.tsx`, `DiscoverZoneList.tsx`
- Key finding: every Discover filter is **backend-driven** (each is a `selected*` arg to `api.discover.listDiscover*`). There are no frontend-only Discover filters. Because of this, a Basic/Advanced split is a **pure UI/JSX presentation change** — it does not move query args, change filter state shape, or affect active-count / Reset / subtitle logic (all of which read the filter state, not the JSX layout).
- Approved grouping (existing filters only — nothing added/removed/renamed):

  | Segment | Basic | Advanced |
  |---|---|---|
  | Rooms | Game, Area, Timeline, Availability / Open Slots | Price Range, Skill Level, FACEIT Level / Game Skill, Format, Role / Position, Series, Overs |
  | Players | Game, Area, Availability | Competitive Intent, Skill, Role / Position, Platform |
  | Teams | Game, Area, Availability / Recruiting | Team Size, Competitive Intent |
  | Venues | Venue Type, Area, Location | Game / Sport, Platform, Price Range |

- Approved decisions:
  - **Timeline = Basic** for Rooms (users commonly need to see when a matchroom is available).
  - **Game** (Rooms/Players/Teams) and **Venue Type** (Venues) are primary selectors: they must stay at the top of Basic and must **not** be collapsed, because they reset dependent filters and drive the drawer subtitle.
  - Advanced section must **hide/disable gracefully when empty** (e.g. Game = All, games without extra dimensions, Teams "my" mode).
  - **Do not rename "Availability"** yet — it means slightly different things per segment (open slots / online now / recruiting now). Defer any label cleanup to a separate approved phase.
  - Do not change which filters exist; this is grouping only.
- Approved future implementation direction (when scheduled): one drawer per segment with Basic filters always visible + a single collapsible "Advanced filters" section. **UI-only inside `DiscoverFilterDrawer.tsx`** (the four `*FiltersView` blocks).
- Backend / query / state confirmation: **no backend, Convex, query-arg, filter-state-shape, active-count, Reset, or subtitle changes required.**
- Tests run: none (planning-only; no code changed).
- Known risks (for the future implementation pass):
  - Empty Advanced section must degrade gracefully (toggle hidden or shows a "no advanced filters" note).
  - Venues `Game / Sport` is conditional on `Venue Type !== "all"`; changing Venue Type (Basic) changes Advanced contents — verify re-render on implementation.
- Next starting point:
  - Phase 3 — Zone Admin Filter Cleanup (planning first).

### Phase 3A (May 22, 2026)
- Status: Implemented frontend-only (Zone Admin **Bookings** module — Requests + Matchrooms tabs only). Resources/Pricing remain deferred (Phase 3B / 3C).
- Files changed:
  - `app/zone/modules/bookings.tsx`
  - `app/zone/modules/hooks/useZoneBookingsViewModel.ts`
  - `app/zone/modules/components/ZoneBookingsRequestsSection.tsx`
  - `app/zone/modules/components/ZoneBookingsMatchroomsSection.tsx`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
  - (`app/zone/modules/bookings.styles.ts` not changed — reused existing `filterChip` / `filterChipActive` / `filterSectionLabel` / `filtersWrap` styles.)
- Filters added — Requests tab (existing Game + Time of day retained):
  - Date Range: Any date / Today / Next 7 Days (over `preferredDate`).
  - Branch: Any branch + per-branch (heuristic — see risk).
  - Request Type: Any type / Direct / Broadcast (from `requestKind` / `locationMode`).
  - Request Status: Any status / Open / Pending Payment (from `status`; bounded to what the Requests tab can show).
- Filters added — Matchrooms tab (existing Status retained):
  - Date Range: Any date / Today / Next 7 Days (over `scheduledDate`).
  - Branch: Any branch + per-branch (prefers `branchId`, falls back to `location` substring).
  - Payment Status: Any / Paid / Unpaid (conservative — only exact `paid` counts as Paid; everything else Unpaid).
  - Booking Source: Any / Online / Walk-in / Admin (normalizes `walkin`/`walk_in` → Walk-in; Admin = source contains "admin"; Online = neither).
- Relabels (display-only):
  - Time of day: `Day` → `Day (6am-6pm)`, `Night` → `Night (6pm-6am)`. Bucket logic unchanged (`hour >= 6 && hour < 18`).
- Per-tab isolation:
  - Requests filters and Matchrooms filters are fully separate state; neither affects the other.
  - Pending tab still bypasses `filteredQueue` (uses `combinedQueue.filter(pendingRequestIds)`) and shows no filter button (`showFilters={false}`) — unaffected by the new filters.
  - Walk-ins and History tabs unchanged.
- Active count + Reset:
  - Each drawer's badge counts every active filter for that tab; Reset clears all filters for the current drawer only (search is outside the drawer and is not cleared, matching prior behavior). Done closes the drawer.
  - Removed the vestigial `requestFilter` state (was always `"all"`); its role is now served by the explicit Request Status filter.
- Branch heuristic risk (documented):
  - Open/broadcast requests usually have no confirmed branch, only an area. Requests match by `allocatedBranchId` first, then by area (`targetAreaLabel`/`preferredAreas`/raw area fields vs branch `areaLabel`). Requests with **no determinable branch/area are NOT hidden** (they pass) so admins never lose sight of them. Consequence: the Requests Branch filter is intentionally lenient for broadcast/unknown requests.
- Backend / query unchanged confirmation:
  - No Convex/backend/service files changed. No query args changed. Data still loads via `subscribeZoneBookingQueue` / `subscribeZoneMatchrooms` / `listBookingHistoryForZone`. All new filtering is in-memory over already-loaded items.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass, exit 0).
- Manual test notes:
  - Not run on device in this pass; verified by code review + TypeScript.
- Known risks:
  - Branch heuristic leniency (above) means broadcast requests can appear under multiple branches.
  - Payment/source normalization buckets unknown values into Unpaid / Online respectively.
  - Date Range excludes items with no parseable date from non-Any ranges (consistent with Phase 2B).
- Next starting point:
  - Phase 3B — Resources status consistency, or Phase 3C — Pricing Date Range / Status naming.

### Phase 3B (May 22, 2026)
- Status: Implemented frontend-only / display-only (Zone Admin **Resources** module — labels + Reset behavior only).
- Files changed:
  - `app/zone/modules/resources.tsx`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
  - (`app/zone/modules/resources.styles.ts` not changed — no style change needed.)
- Labels changed (visible text only):
  - Drawer section `Resource category` → `Resource Type`. Chips unchanged (`All`, `PCs`, `PS5s`, `Xbox`); `assetFilter` state, option values, `assetFilterForResource`, and `availableAssetFilters` logic untouched.
  - Allocation drawer section `Date` → `Date Range`. Options unchanged (`Any date`, `Today`, `Tomorrow`, `Next 7 days`, `No date`); `allocationDateFilter` logic untouched.
- Reset behavior changed:
  - Added `disabled={activeFilterCount === 0}` to the drawer Reset button (now matches the Phase 3A/Phase 1 standard).
  - Reset still clears `assetFilter`, `statusFilter`, `allocationGameFilter`, `allocationDateFilter` only; does not clear Branch; does not clear Search. Done still closes the drawer.
- Status labels kept unchanged:
  - Resource Status taxonomy untouched: `Available`, `Held`, `Booked`, `Maintenance` (closed enum `ResourceLifecycleStatus`). No `Inactive` / `Reserved` / `Allocated` / `Unavailable` / `Active` added.
- Branch behavior kept unchanged:
  - Branch remains a backend scope selector (loads one branch's resources via `subscribeBranchResources`). No `All Branches` added; Branch is not counted in `activeFilterCount`; Branch is not cleared by Reset.
- Allocation behavior kept unchanged:
  - Allocation cards still force-display `Booked`; allocation view logic untouched.
- Backend / query unchanged confirmation:
  - No Convex/backend/service files changed. No query args changed. No resource availability logic, booking/allocation logic, or data mutation changed. All changes are visible text + one button `disabled` prop.
- Deferred (documented):
  - `All Branches` (would need backend multi-branch load).
  - New resource types (Court/Table/Room/Other — no active data; physical sports disabled in code).
  - Surfacing `isActive` as a filter.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (see result in implementation report).
- Manual / code-review notes:
  - Not run on device this pass; verified by code review + TypeScript.
  - Confirmed Resource Grid drawer shows `Resource Type`; Allocation drawer shows `Date Range`; Reset disabled at 0 active filters and enabled with ≥1; Branch/Search not cleared by Reset; bulk + per-card status actions unaffected.
- Next starting point:
  - Phase 3C — Pricing Date Range / Status naming.

### Phase 3C (May 22, 2026)
- Status: Implemented frontend-only (Zone Admin **Pricing & Promotions** module — Rules tab filters only).
- Files changed:
  - `app/zone/modules/pricing.tsx`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
  - (`app/zone/modules/pricing.styles.ts` not changed — reused existing `chip` / `chipActive` / `filterSectionLabel` / `filterChipWrap` / `filterDrawerFooter` styles.)
- Labels changed (visible text only):
  - Drawer section `State` → `Status`.
  - Status option `All states` → `All statuses` (`ENABLED_FILTERS[0].label`).
  - Drawer section `Asset type` → `Resource Type`.
  - Drawer section `Rule type` → `Rule Type`.
  - Create-Rule form field `Resource` → `Resource Type` (pure display text; no form logic change).
  - Raw filter values unchanged: `all` / `enabled` / `disabled` / `pc` / `console` / `percentage_discount` / `fixed_override`. Resource Type chips still render `PCs` / `Console`; Rule Type chips still render `Percentage Discount` / `Fixed Override` via the shared `formatLabel`.
- Date Range filter added (`ruleDateFilter`, new drawer section `Date Range`):
  - Options: `Any` / `Active Today` / `Starts Today` / `Next 7 Days` / `Expired`.
  - Derived from the rule validity fields `validFrom` / `validTo` only (NOT `createdAt` / `updatedAt`).
  - Implemented via a local pure helper `matchesRuleDateFilter(rule, filter, todayKey, weekAheadKey)`; `todayKey` / `weekAheadKey` produced by the existing `toDateValue` (ISO `YYYY-MM-DD`) so string comparison matches the stored date-only format.
- Date Range definitions:
  - `Any`: no date filtering.
  - `Active Today`: `(validFrom empty OR validFrom <= today) AND (validTo empty OR validTo >= today)`. Open-ended rules (null dates) ARE included.
  - `Starts Today`: `validFrom` exists AND `validFrom === today`.
  - `Next 7 Days`: `validFrom` exists AND `today <= validFrom <= today + 7 days` (start lands within the coming week).
  - `Expired`: `validTo` exists AND `validTo < today`.
  - Open-ended rules are excluded from `Starts Today` / `Next 7 Days` / `Expired` when the required date field is missing.
- Branch global-rule behavior fix:
  - When a specific branch is selected, the Branch filter now shows that branch's rules **plus** global/all-branches rules (`branchId === null`), since global rules apply to every branch.
  - `All branches` still shows everything. Previously a specific branch hid global rules (exact-match only).
- Reset behavior changed:
  - Added `disabled={activeRuleFilterCount === 0}` to the drawer Reset button (now matches the Phase 3A/3B/Phase 1 standard).
  - Reset clears Status, Resource Type, Rule Type, Branch, and Date Range. Reset does NOT clear Search. Done still closes the drawer.
- Active filter count:
  - Counts Status, Resource Type, Rule Type, Branch, and Date Range (each non-default = 1). Search remains excluded.
- Status taxonomy kept unchanged:
  - Status filter remains `All statuses` / `Enabled` / `Disabled` over the raw `isEnabled` boolean. No `Active` / `Scheduled` / `Expired` / `Draft` / `Paused` / `Inactive` status invented — date-derived concepts live only in the Date Range filter.
- Resource types kept unchanged:
  - Only `PCs` / `Console` surfaced (raw `pc` / `console`). No `Court` / `Table` / `Room` / `Other` / `Futsal` / `Padel` / `Pickleball` added (no active data in this module).
- Backend / query unchanged confirmation:
  - No Convex/backend/service files changed. No query args changed (`subscribeZonePricingRules`, `subscribeZoneBranches`, `getEnabledPricingRulesForZone` called identically). All new filtering is in-memory over the already-loaded `rules` array.
- Pricing logic unchanged confirmation:
  - No changes to `applyPricingRulesToRate`, `resolveEffectiveRateForGame`, `doesRuleMatchContext`, `isRuleDateMatch`, or `sortRules`. The Date Range filter is a separate display predicate and does not call or alter the resolver.
  - No changes to `createRule` / `createZonePricingRule` (rule creation/validation), `toggleRule` / `setZonePricingRuleEnabled` (activation), `removeRule` / `deleteZonePricingRule`, or any mutation payload.
- Deferred (documented):
  - Exposing additional resource types (futsal/padel/etc. — no data in this module).
  - Combined date-derived Status taxonomy (kept separate as Date Range).
  - Created/Updated-date filtering (validity Date Range is the meaningful one).
  - Empty-state copy: the Rules list shows `No pricing rules yet.` even when existing rules are hidden by filters. Left as-is this pass; flagged as a small follow-up if a distinct "no rules match filters" message is wanted.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass, exit 0).
- Manual / code-review notes:
  - Not run on device this pass; verified by code review + TypeScript.
  - Confirmed Rules drawer shows Status / Resource Type / Rule Type / Branch / Date Range; Status shows All statuses / Enabled / Disabled; Resource Type shows All / PCs / Console; Rule Type shows All / Percentage Discount / Fixed Override.
  - Confirmed Branch filter surfaces global rules under a specific branch; Reset disabled at 0 active filters and enabled with ≥1; Reset clears all drawer filters but not search; Done closes drawer; active count includes Date Range.
  - Confirmed Create Rule tab, enable/disable toggle, and delete actions are unaffected.
- Known risks:
  - Date Range relies on `validFrom` / `validTo` being ISO date-only strings (matches `normalizeRule` / `isRuleDateMatch`); the same-format `todayKey` keeps string comparison valid.
  - `Next 7 Days` means "start lands in the next 7 days," not "active at some point in the next 7 days" — revisit if product wants the broader meaning.
  - Branch global-rule inclusion is a display behavior change from the prior exact-match.
- Next starting point:
  - Phase 4 — Super Admin Filter Cleanup.

### Phase 4A (May 23, 2026)
- Status: Implemented frontend-only (Super Admin **Support Tickets** + **Matchrooms** filters only). Payments + Withdrawals remain deferred to Phase 5.
- Files changed:
  - `app/super-admin/support-tickets.tsx`
  - `app/super-admin/matchrooms.tsx`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
  - (No styles changed — reused shared `AdminFilterDrawer` + `DiscoverFilterRow` patterns.)
- Filters added — Support Tickets (new filter drawer; Status stays on the existing Open/In Review/Resolved tabs and is NOT duplicated in the drawer):
  - Priority: dynamic from loaded tickets' `priority`, ordered urgent/high/medium/low; `All` default.
  - Category: dynamic from `category` (sorted); `All` default.
  - User Role: dynamic from `userRole` (sorted); `All` default.
  - Assigned Admin: dynamic from `assignedAdminName` (sorted) + an `Unassigned` bucket (shown only when some ticket has no assigned admin); `All` default.
  - Date Range: Any / Today / Last 7 Days / Last 30 Days over `createdAt`.
- Filters added — Matchrooms (expanded the existing single-status drawer; status section relabeled `Matchroom status` → `Status`, values unchanged):
  - Status: existing `lifecycleStatus` filter and values kept; label-only cleanup to `Status`.
  - Game: dynamic from `game` (sorted, uppercased label); `All` default.
  - Date Range: Any / Today / Last 7 Days / Last 30 Days over `scheduledStartAt`, falling back to parsed `scheduledDate`.
  - Booking Type: dynamic subset of Direct / Zone, Broadcast, Walk-in, Other; `All` default.
  - Payment Status: dynamic from `paymentStatus`; `All` default.
  - Zone: dynamic from `zoneName`; `All` default.
  - Result Status: dynamic from `resultVerificationStatus`; `All` default.
- Filter derivation logic:
  - All option lists are derived from the currently loaded records (the active tab's tickets / the loaded matchrooms), always with an `All`/`Any` default and only present values shown (no dead chips).
  - Booking Type is heuristic (SuperAdminMatchroom has no `locationMode`/`bookingSource` field): `broadcastRequestStatus` present → Broadcast; else `location` contains walk-in → Walk-in; else `zoneName` present → Direct / Zone; otherwise → Other. Unknown/unclassifiable rooms go to Other and are never hidden.
  - Date Range: `Today` = within the current calendar day (local midnight → next midnight); `Last 7/30 Days` = `[now − N days, now]`. Records with no parseable date are excluded from non-Any ranges and remain visible under Any. Note: future-scheduled matchrooms only appear under Any/Today for Date Range (Last 7/30 Days are past-window by label).
- Empty state behavior:
  - Raw-empty (active tab / loaded set has no records) keeps existing copy (`emptyLabel(tab)` for tickets; `No matchrooms found` for matchrooms).
  - Filtered-empty (records exist but filters/search hide them all):
    - Support: `No support tickets match these filters.` / `Reset filters to view all tickets.`
    - Matchrooms: `No matchrooms match these filters.` / `Reset filters to view all matchrooms.`
- Active count / Reset behavior:
  - Active filter count counts each non-default drawer filter; search is excluded.
  - Reset clears drawer filters only; search is NOT cleared; Reset disabled when `activeFilterCount === 0`; Done closes the drawer.
- Frontend-only confirmation:
  - All new filtering is in-memory over already-loaded records. No new fetches; existing search behavior unchanged.
- Backend unchanged confirmation:
  - No Convex/backend/service files changed. No query args changed (`getSupportTickets(tab, …)` and `getSuperAdminMatchrooms()` called identically). No support-ticket or matchroom mutation/action/lifecycle logic changed; card navigation handlers unchanged.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass, exit 0).
- Manual / code-review notes:
  - Not run on device this pass; verified by code review + TypeScript.
  - Confirmed tabs (Support) and existing Status filter (Matchrooms) still work; Reset clears drawer filters but not search and is disabled at 0; Done closes the drawer; ticket/matchroom open navigation unaffected.
- Known risks:
  - Booking Type derivation is heuristic and may misclassify rooms lacking clear signals (bucketed to Other, never hidden).
  - Dynamic options only appear after data loads; filters persist across Support tabs, so a filter set in one tab may yield filtered-empty in another until Reset.
  - Matchroom Date Range is past-window for Last 7/30 Days; upcoming rooms surface only under Any/Today.
- Next starting point:
  - Phase 4B — Super Admin Users + Zones filters.

### Phase 4B (May 23, 2026)
- Status: Implemented frontend-only (Super Admin **Users** + **Zones** filters only). KYC / Last Active / Pilot Status / extra Zone statuses remain deferred to Phase 5.
- Files changed:
  - `app/super-admin/users.tsx`
  - `app/super-admin/zones.tsx`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
  - (Zones styles: added one `searchBar` style entry for the new search bar. Users styles unchanged.)
- Filters added — Users (new filter drawer; Account Type stays on the existing All / Players / Zone Admins tabs and is NOT duplicated in the drawer):
  - Account Status: dynamic from `accountStatus` (null treated as `active`); `All` default.
  - Role: dynamic from `role` (sorted); `All` default. (Optional/secondary per plan; only present role values shown — for player-heavy tabs this row may only show `All`.)
  - Created Date: Any / Today / Last 7 Days / Last 30 Days over `createdAt`.
- Filters added — Zones (added a search bar where none existed + a new filter drawer; Zone Status stays on the existing Pending / Migration tabs):
  - Search (new): over `venueBrandName`, `ownerFullName`, `contactEmail`, city, area, and legacy `name` / `ownerUsername`.
  - City: dynamic from `primaryBranch.city` (legacy `city` fallback); `All` default.
  - Area: dynamic from `primaryBranch.areaLabel`; `All` default.
  - Created Date: Any / Today / Last 7 Days / Last 30 Days over `createdAt`.
- Filter derivation logic:
  - All option lists derived from currently loaded records (the active tab's users / zones), always with an `All`/`Any` default and only present values shown (no dead chips).
  - Users Account Status maps missing `accountStatus` to `active` for both options and matching (matches the existing card behavior of treating missing status as Active).
  - Zone City/Area derived via shared `getZoneCity` / `getZoneArea` helpers so option lists and filtering use identical values (primary branch first, legacy `city` fallback for city).
  - Date Range: `Today` = current calendar day (local midnight → next midnight); `Last 7/30 Days` = `[now − N days, now]`. Records with no parseable date excluded from non-Any ranges, visible under Any. Zone `createdAt` is typed `any`, so `getZoneTimestamp` coerces number or parseable string and ignores anything else.
- Label decision (documented): the plan taxonomy listed "Area / City" as one label; implemented as two precise rows (`City`, `Area`) for clarity, since they are distinct fields and mixing them in one chip list would be confusing.
- Empty state behavior:
  - Raw-empty (loaded set has no records) keeps existing copy (`No users found` for users; `No {status} zones` for zones).
  - Filtered-empty (records exist but filters/search hide them all):
    - Users: `No users match these filters.` / `Reset filters to view all users.`
    - Zones: `No zones match these filters.` / `Reset filters to view all zones.`
  - Zones summary row count now reflects the visible (filtered) count.
- Active count / Reset behavior:
  - Active filter count counts each non-default drawer filter; search is excluded.
  - Reset clears drawer filters only; search is NOT cleared; Reset disabled when `activeFilterCount === 0`; Done closes the drawer.
- Frontend-only confirmation:
  - All new filtering is in-memory over already-loaded records. No new fetches; existing Users search behavior unchanged; Zones search is newly added (frontend-only).
- Backend unchanged confirmation:
  - No Convex/backend/service files changed. No query args changed (`getUsers(tab === "all" ? undefined : tab)` and `getZones(tab, …)` called identically). No suspension/approval/mutation logic changed; suspend/reactivate buttons (Users) and zone request navigation (Zones) untouched.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass, exit 0).
- Manual / code-review notes:
  - Not run on device this pass; verified by code review + TypeScript.
  - Confirmed tabs still work, suspend/reactivate actions intact, Reset clears drawer filters but not search and is disabled at 0, Done closes the drawer, zone card navigation unaffected.
- Known risks:
  - Users Role filter row may show only `All` on player-heavy tabs (most players have no `role`); harmless but visually sparse.
  - Filters persist across tabs (a filter set in one tab may yield filtered-empty in another until Reset).
  - City/Area options only reflect zones loaded in the current tab; switching tabs/refreshing rebuilds them.
- Next starting point:
  - Phase 4C — Super Admin Reports + Identity Verifications + Notifications cleanup.

### Phase 4C (May 23, 2026)
- Status: Implemented frontend-only (Super Admin **Reports** + **Identity Verifications** + **Notifications** filters only).
- Files changed:
  - `app/super-admin/(tabs)/reports.tsx`
  - `app/super-admin/identity-verifications.tsx`
  - `app/super-admin/notifications.tsx`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
  - (Notifications styles: added one `searchBar` style entry. Reports/Identity styles unchanged.)
- Filters added — Reports (existing status tabs + Target Type stay; search unchanged):
  - Relabeled drawer section `Report type` → `Target Type` (value mapping/logic unchanged: Player / Matchroom / Zone-venue report).
  - Game: dynamic from loaded reports' `game` (sorted, uppercased label); `All` default.
  - Date Range: Any / Today / Last 7 Days / Last 30 Days over `createdAt`.
- Filters added — Identity Verifications (existing backend Status + Role filters unchanged):
  - Date Range: Any / Today / Last 7 Days / Last 30 Days — frontend-only over `submittedAt` (falls back to `verifiedAt`, then `rejectedAt`).
  - IMPORTANT: Status and Role remain backend query args (trigger reload); Date Range is applied in-memory in `visibleRows` and does NOT trigger a reload.
- Filters added — Notifications (previously had no search and no drawer; read-state stays on the Unread/Read tabs):
  - Search (new): over `title`, `body`, type label, and `route`.
  - Type: dynamic buckets (Matchrooms / Teams / Payments / Support / Reports / System), only present categories shown; `All` default.
  - Date Range: Any / Today / Last 7 Days / Last 30 Days over `createdAt`.
- Filter derivation logic:
  - Reports Game and Notifications Type options are derived from currently loaded records, with `All` default and only present values shown (no dead chips).
  - Notification Type bucketing is conservative and mirrors the Player Inbox (Phase 2C): support./moderation.|report/wallet.|payment/team./match.|booking. prefixes; anything unmatched → System.
  - Date Range: `Today` = current calendar day (local midnight → next midnight); `Last 7/30 Days` = `[now − N days, now]`. Records with no parseable date excluded from non-Any ranges, visible under Any.
- Note on Notifications search: a search bar was added because the shared filter button lives in `AdminSearchFilterBar`; this also brings Notifications in line with the standard Super Admin header (search + filter + tabs). Search is frontend-only and excluded from the active filter count.
- Deferred (documented, per plan):
  - Reports Priority — no priority field on the report record.
  - Identity Provider (single value `didit`) and Failure Reason (free-text) — low value / search-only.
  - Notifications Priority — no priority field on the notification record.
- Empty state behavior:
  - Raw-empty keeps existing copy (Reports `No reports here` with updated tab-focused description; Identity `No verifications found`; Notifications per-tab copy).
  - Filtered-empty (records exist but filters/search hide them all):
    - Reports: `No reports match these filters.` / `Reset filters to view all reports.`
    - Identity: `No verifications match these filters.` / `Reset filters to view all verifications.`
    - Notifications: `No notifications match these filters.` / `Reset filters to view all notifications.`
- Active count / Reset behavior:
  - Active filter count counts each non-default drawer filter; search excluded.
  - Reset clears drawer filters only (Reports: Target Type + Game + Date; Identity: Status + Role + Date; Notifications: Type + Date); search is NOT cleared; Reset disabled when count is 0; Done closes the drawer.
- Frontend-only confirmation:
  - Reports Game/Date, Identity Date, and all Notifications filters/search are in-memory over already-loaded records. Reports tab and Identity Status/Role remain the existing backend args.
- Backend unchanged confirmation:
  - No Convex/backend/service files changed. No query args changed (`getReports(tab)`, `getIdentityVerifications({ status, role })`, `getSuperAdminNotifications(tab, …)` called identically). No report/identity/notification mutation, manual-verify, mark-read, archive, or navigation logic changed.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass, exit 0).
- Manual / code-review notes:
  - Not run on device this pass; verified by code review + TypeScript.
  - Confirmed tabs still work, manual-verify (Identity) and mark-read/archive/open (Notifications) actions intact, Reset clears drawer filters but not search and is disabled at 0, Done closes the drawer, Notifications unread badge still reflects loaded unread count (pre-filter).
- Known risks:
  - Notification Type bucketing is heuristic; unusual `type` strings fall into System (never hidden).
  - Identity Date Range uses submitted/verified/rejected fallback; rows with none of those timestamps appear only under Any.
  - Reports Game / Notifications Type options reflect only the current tab's loaded records.
- Next starting point:
  - Phase 4D — Super Admin Audit Logs (Date Range via existing from/to args + search-label clarification).

### Phase 4D (May 23, 2026)
- Status: Implemented (Super Admin **Audit Logs** only). This sub-phase intentionally sends values to the pre-existing backend `from` arg (approved decision); no new arg, no new index, no new query.
- Files changed:
  - `app/super-admin/audit-logs.tsx`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
  - (No styles changed.)
- Filter added — Date Range (Any / Today / Last 7 Days / Last 30 Days):
  - Wired to the existing `getSuperAdminAuditLogs({ ..., from })` arg via `dateRangeToFrom(dateFilter)`.
  - Only a lower bound (`from`) is used: `Today` = local start-of-day; `Last 7/30 Days` = `now − N days`. `to` is left unused because audit logs are never future-dated.
  - This is a BACKEND filter (unlike Reports/Identity/Notifications Date Range): changing it re-runs `load` (added to its dependency list, same mechanism as the existing Status/Module/Action/Admin backend filters). `Any` sends `from: undefined`, restoring the unfiltered result set exactly.
- Search clarified (behavior unchanged):
  - Placeholder relabeled `Search target/action/reference` → `Search target ID / action / admin`.
  - Search is still sent to the backend as `targetId` AND re-filtered on the frontend across targetId/targetType/action/module/superAdminName/superAdminEmail/reason. Logic untouched; only the placeholder text changed.
- Active count / Reset behavior:
  - Active filter count now includes Date Range (Super Admin + Status + Action + Module + Date Range); search still excluded.
  - Reset clears all five drawer filters (including Date Range → `Any`); search is NOT cleared; Reset disabled when count is 0; Done closes the drawer.
- Backend unchanged confirmation:
  - No Convex/backend/service files changed. The `from`/`to` args already existed on `getSuperAdminAuditLogs` and `api.admin.listSuperAdminAuditLogs`; this only passes a value to `from`. No mutation/action/index changes.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass, exit 0).
- Manual / code-review notes:
  - Not run on device this pass; verified by code review + TypeScript.
  - Confirmed Date Range presets change the fetched set via `from`; `Any` restores the unfiltered set; existing four backend filters and frontend search still work; Reset clears all drawer filters but not search and is disabled at 0; Done closes the drawer.
- Known risks:
  - Date Range is bounded only below; combined with the `limit: 150` fetch, very old logs outside the window are excluded server-side as intended.
- Phase 4 status: 4A–4D implemented (frontend-only except the approved Audit `from` value). Remaining Phase 4 checklist items (Payments, Withdrawals, Users KYC, Zones Pilot Status) are intentionally deferred to Phase 5 — see notes under the Phase 4 section.
- Next starting point:
  - Phase 5 — Backend / Index improvements (Payments fetch depth + reconciliation flags on list records; Withdrawals multi-status load; Users KYC + Last Active; Zones Pilot Status + extra statuses).

### Phase 5A (May 23, 2026)
- Status: Implemented frontend-only (Super Admin **Users** — KYC Status filter only). No backend/Convex/query/schema changes. Last Active intentionally NOT touched (Phase 5D, pending a `lastActiveAt` data-quality check).
- Files changed:
  - `app/super-admin/users.tsx`
  - `src/services/convex/superAdminService.ts` (TYPE ONLY — added `kycVerificationStatus` + `kycVerifiedAt` to the `SuperAdminUser` type; no query/arg/service-logic change)
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
  - (Users styles not changed — reused existing `AdminFilterDrawer` + `DiscoverFilterRow` pattern.)
- Filter added — KYC Status (new drawer row alongside the existing Account Status + Role + Created Date from Phase 4B):
  - Dynamic options derived from the loaded users, ordered by the canonical KYC lifecycle (`KYC_STATUS_ORDER`): Not Started, Pending, In Progress, In Review, Verified, Rejected, Expired. `All` default. Only present values are shown (no dead chips), matching the Phase 4B Account Status / Role pattern.
  - Labels rendered via the existing `formatLabel` helper (`not_started` → `Not Started`, `in_review` → `In Review`, etc.).
- KYC status mapping / source:
  - Reads `user.kycVerificationStatus` (already returned by `admin.listUsers` via `...user`; the field exists on the `users` schema). `kycVerifiedAt` added to the type for future display use but not yet surfaced in the UI.
  - Provider filter intentionally NOT added (per approved scope).
- Missing KYC handling:
  - Missing/undefined `kycVerificationStatus` is treated as `not_started` for BOTH option derivation and matching (`(user.kycVerificationStatus || "not_started")`). Consequence: on player-heavy tabs the `Not Started` chip will usually appear because most players have no KYC record yet — expected, not a dead chip.
- Behavior:
  - Frontend-only over the already-loaded users list; combines with Account Status + Role + Created Date + Search.
  - Does NOT affect the backend accountType tabs (All / Players / Zone Admins) — `getUsers(tab === "all" ? undefined : tab)` is called identically.
  - Active filter count now includes KYC Status when not `All`; search remains excluded.
  - Reset clears KYC Status back to `All` along with the other drawer filters; search is NOT cleared; Reset disabled when `activeFilterCount === 0`; Done closes the drawer.
- Empty state behavior:
  - Unchanged from Phase 4B (the page already supports raw-empty vs filtered-empty): raw-empty keeps `No users found`; filtered-empty shows `No users match these filters.` / `Reset filters to view all users.` KYC Status participates via the same `visible` predicate, so a KYC-only filtered-empty triggers the filtered-empty copy.
- Frontend-only confirmation:
  - All KYC filtering is in-memory over already-loaded records. No new fetches; no change to existing search behavior.
- Backend unchanged confirmation:
  - No Convex/backend/service-logic files changed. No query args changed (`api.admin.listUsers` call is byte-for-byte the same). No schema change. No user auth, suspension/reactivation, or role-mutation behavior changed; suspend/reactivate buttons untouched. The only `superAdminService.ts` edit is an additive TypeScript type field.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass, exit 0, no output).
- Manual / code-review notes:
  - Not run on device this pass; verified by code review + TypeScript.
  - Confirmed tabs still work; search still works; Account Status / Role / Created Date filters still work; KYC Status filters correctly; missing KYC maps to Not Started; filters combine; Reset clears KYC Status; active count includes KYC; suspend/reactivate intact.
- Known risks:
  - KYC/all frontend filters act only on the loaded ~150 most-recent-by-`updatedAt` users (existing Phase 4B limitation); flagged for the Phase 5F pagination track.
  - `Not Started` chip is near-omnipresent on player tabs because missing → not_started; intended.
- Next starting point:
  - Phase 5B — Zones Active tab + Pilot Status filter (frontend-only; `getZones("active")` already supported, `pilotStatus` already returned).
- Phase 5D pre-check reminder: before implementing Last Active, inspect whether `users.lastActiveAt` is reliably populated (it is presence/chat-driven). If sparse, defer; if broadly populated, ship frontend-only.

### Phase 5B (May 23, 2026)
- Status: Implemented (Super Admin **Zones** — Active tab + Pilot Status filter). Frontend + one additive TypeScript type field; no backend/Convex/query/schema change.
- Files changed:
  - `app/super-admin/zones.tsx`
  - `src/services/convex/zoneService.ts` (TYPE ONLY — added `pilotStatus` + `pilotStartedAt` / `pilotEndsAt` / `pilotEndedAt` to the `Zone` interface; no logic/query change)
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
  - (Zones styles not changed — reused existing tab/drawer/empty-state structure from Phase 4B.)
- Active tab added:
  - New `Active` tab alongside the existing `Pending` / `Migration` tabs (`ZoneReviewStatus` union extended with `"active"`). The tab value is passed straight to the existing `getZones(tab, …)` call — `status="active"` was already supported end-to-end (`superAdminService.getZones` type union, `api.admin.listZones` validator, and the `zones.by_status_updatedAt` index). No new fetch/arg.
- Pilot Status filter added (Active tab only):
  - Options: `All` / `Active Pilot` (`active`) / `Pilot Ended` (`ended`) / `No Pilot` (`none` or missing).
  - Rendered as a `DiscoverFilterRow` inside the existing filter drawer, shown **only when `tab === "active"`**; not shown on Pending/Migration (not meaningful there).
  - Mapping: `zone.pilotStatus || "none"`. The field is returned by `admin.listZones` via `...zone` and exists on the `zones` schema (`v.union("none","active","ended")`).
- Fields used: `pilotStatus` (filter); existing `venueBrandName` / `ownerFullName` / `contactEmail` / city / area / `createdAt` (search + City/Area/Created Date from Phase 4B, unchanged).
- Active count / Reset behavior:
  - `activeFilterCount` now also counts Pilot Status, but **only on the Active tab** (`Number(tab === "active" && pilotFilter !== "all")`), so switching away from Active never shows a phantom count or hides rows.
  - Reset clears Pilot Status along with City / Area / Created Date; search is NOT cleared; Reset disabled at 0; Done closes the drawer.
- Empty state:
  - Reused the existing raw-empty vs filtered-empty branch. Active tab raw-empty shows `No active zones` (via `statusTitle("active")`); filtered-empty shows `No zones match these filters.` / `Reset filters to view all zones.`
- Frontend-only / backend-unchanged confirmation:
  - Pilot Status filtering is in-memory over the already-loaded active-tab zones. No Convex/backend/service-logic change. `getZones` call is byte-for-byte the same (only a new `tab` value flows through the pre-existing union). No zone approval, pilot start/end automation, or pilot payout logic touched (those fields are read-only here).
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass, exit 0).
- Known risks:
  - Active zones list is page-capped by `admin.listZones` `limit` (default 100); Pilot Status filters only the loaded window — flagged for Phase 5F.
  - `pilotStatus` is optional in the schema; legacy active zones without the field bucket into `No Pilot` (intended).
- Next starting point:
  - Phase 5C — Withdrawals all-status filters.

### Phase 5C (May 23, 2026)
- Status: Implemented (Super Admin **Withdrawals** — all-status view + Date/Amount/Branch filters). Frontend-only; reuses the existing backend `status` arg. No backend/Convex/mutation change.
- Files changed:
  - `app/super-admin/withdrawals.tsx`
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
  - (No styles file — added `searchBar` / `tabs` / `tabText` entries to the in-file `StyleSheet`.)
- Status mapping (the screen previously hardcoded `status: "pending"` at the call site — now a status view):
  - UI tabs: `All` / `Pending` / `Completed` / `Rejected` / `Failed` (`SegmentedTabs`).
  - Backend `status` arg mapping (`tabToBackendStatus`): `all → any`, `pending → pending`, `completed → completed`, `rejected → failed`, `failed → failed`. Switching tabs re-runs `load` (added to its deps), using the **existing** `api.admin.listZoneWithdrawalRequests` arg (`any|pending|completed|failed`). No new backend arg.
  - **Rejected derivation:** backend has no `rejected` status. Rejected = `status === "failed" && adminDecision === "rejected"`; Failed = `status === "failed" && adminDecision !== "rejected"`. Both tabs fetch backend `"failed"` and split client-side via `matchesStatusTab`. `adminDecision` is serialized top-level by `serializeAdminZoneWithdrawal` (from `metadata.adminDecision`) and reliably reaches the client, so the split is safe.
- Filters added (drawer):
  - Branch / Venue: dynamic from loaded `branchName` (falls back to `venueName`); `All` default.
  - Amount Range: `Any` / Under Rs 500 / Rs 500–2,000 / Rs 2,000–5,000 / Above Rs 5,000 (over `amount`).
  - Date Range: `Any` / Today / Last 7 Days / Last 30 Days (over `createdAt`).
  - Search (new): owner / branch / venue / bank / reference / masked account / amount.
- Payout Method: **DEFERRED** — only `bankName` exists (no distinct payout-method/provider field). `bankName` is shown in the card/detail; not surfaced as a filter (would be mislabeled). Documented per scope.
- Detail drawer guard (UI-only, no logic change): now that non-pending withdrawals are viewable, the Reject/Approve footer + reject-reason input render **only when `selected.status === "pending"`**. For non-pending items the detail shows read-only `Decision` + `Decided` lines. The approve/reject mutations and their handlers are unchanged; this only prevents showing re-decision controls on already-decided requests.
- Active count / Reset behavior:
  - Active count = Branch + Amount + Date (status is on tabs, not counted — matches zones/users); search excluded.
  - Reset clears Branch / Amount / Date; search and status tab are NOT cleared; Reset disabled at 0; Done closes the drawer.
- Empty state:
  - Raw-empty (tab-scoped set empty) shows `No {status} withdrawals`; filtered-empty (tab has items but drawer/search hide them all) shows `No withdrawals match these filters.` / `Reset filters to view all withdrawals.`
- Backend / mutation unchanged confirmation:
  - No Convex/backend/service-logic files changed. `getZoneWithdrawalRequests` is called with the existing `{ status, limit }` shape (limit raised to 100, the backend cap). No wallet math, payout processing, or approve/reject logic changed.
- Tests run:
  - `npx tsc -p tsconfig.json --noEmit` (pass, exit 0).
- Known risks:
  - Backend scans `min(limit*10, 200)` withdrawal rows then slices; on the `All` tab a busy period could exceed the window — flagged for Phase 5F (scan-cap).
  - Amount/Date exclude rows with no parseable value from non-Any ranges (consistent with prior phases).
- Next starting point:
  - Phase 5D — Users Last Active data check.

### Phase 5D (May 23, 2026)
- Status: **DATA-REVIEWED — DEFERRED. No code changed.** Last Active filter NOT added.
- Scope of this pass: data-quality investigation of `users.lastActiveAt` only (no edits to any source file; only this checklist updated).
- Files reviewed (not changed):
  - `convex/schema.ts` (users `lastActiveAt`), `convex/users.ts` (`touchPresence`), `convex/admin.ts` (`listUsers`, `getDashboardSummary`), `src/services/convex/superAdminService.ts` (`SuperAdminUser` type), `src/hooks/usePresenceHeartbeat.ts`, `src/features/chat/utils.ts`.
- Data-check result (why DEFERRED):
  - `lastActiveAt` (`v.optional(v.number())`) has **exactly one writer**: `users.touchPresence` (`convex/users.ts`), which patches `lastActiveAt` + `isOnline`.
  - Its only intended driver, `usePresenceHeartbeat` (foreground + 60s heartbeat), is **defined but not imported/used anywhere** in the app — so there is no broad, always-on activity path populating the field in production.
  - `getDashboardSummary` already encodes distrust: it computes `active30d` from `lastActiveAt` but falls back to `totalUsersFallback` and exposes an `activeSource` flag.
  - `lastActiveAt` is consumed only by chat "last seen" labels (`src/features/chat/utils.ts`); the `SuperAdminUser` type doesn't even include it.
  - Conclusion: field is **sparse / unreliable**; a Last Active filter would silently hide most users under any non-Any bucket. Deferred per the "if data not good enough" path.
- Backend unchanged confirmation: yes — no files changed.
- Future requirement before implementing: (1) wire `usePresenceHeartbeat` into the app shell so `lastActiveAt` updates on every foreground/heartbeat; (2) confirm in dev/prod that a meaningful share of users have a recent `lastActiveAt`; (3) then add the filter frontend-only (`Any` / Today / Last 7 / Last 30 / Never-Unknown) over `lastActiveAt`, combining with search + account-type tab + Account Status + Created Date + KYC Status, and add `lastActiveAt` to the `SuperAdminUser` type.
- Next starting point:
  - Phase 5E — Payments backend-supported filters.

### Phase 5E (May 23, 2026)
- Status: Implemented (Super Admin **Payments** — backend-supported listing + filters + page-scoped reconciliation). Additive, read-only. The old `listEasypaisaTransactions` query + `getEasypaisaTransactions` wrapper are kept intact.
- Files changed:
  - `convex/schema.ts` (added 2 additive indexes to `paymentTransactions`)
  - `convex/admin.ts` (added new read-only query `listPaymentsV2`)
  - `src/services/convex/superAdminService.ts` (added types `AdminPaymentListItem` / `AdminPaymentReconciliation` / `AdminPaymentStatus` / `AdminPaymentsQueryInput` + wrapper `getAdminPayments`)
  - `app/super-admin/(tabs)/payments.tsx` (migrated to `getAdminPayments`; added Date/Amount/Provider Status/Reconciliation Issue filters)
  - generated Convex files (`convex/_generated/*` via codegen)
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
- New query — `admin.listPaymentsV2` (read-only):
  - Args: `sessionToken`, `status?`, `kind?`, `dateFrom?`, `dateTo?`, `amountMin?`, `amountMax?`, `search?`, `includeReconciliation?`, `limit?`. Auth via the existing `getAuthenticatedAdmin`.
  - Replaces the old per-status take + dedupe of ~20 rows with **createdAt-ordered** fetching: status + date bounds pushed into the index (`by_status_and_createdAt` when a status is given, else `by_createdAt`), `.order("desc").take(scanLimit)` where `scanLimit = min(max(limit*5, limit), 500)`; then in-memory `provider==="easypaisa"` + kind + amount + search; then `.slice(0, limit)` (limit default 50, cap 100).
  - Returns list-safe fields only: `paymentTransactionId`/`_id`/`id`, `orderRefNum`, `kind`, `status`, `amount`, `currency`, `createdAt`, `updatedAt`, `processedAt`, `expiresAt`, `providerStatus`, `providerReference`, `providerDescription` (truncated via `truncateAdminProviderText`), `accountOwnerName` (joined), `bookingIntentId`, `lastError`, `callbackCount`, and a safe `providerPayload` subset (`flow`/`lastSyncAt`/`lastProviderStatus`). **Excluded:** raw `providerPayload` (ipn/hosted raw bodies), phone/CNIC/account, secrets/tokens.
- Indexes added (additive, do not conflict with existing):
  - `paymentTransactions.by_createdAt` = `["createdAt"]`
  - `paymentTransactions.by_status_and_createdAt` = `["status", "createdAt"]`
- Reconciliation strategy (page-scoped + opt-in):
  - Flags computed **only** when `includeReconciliation === true`, and **only over the returned page** (≤ limit rows) — never the full table, no writes, no denormalization.
  - Flags returned per row: `paidNoWalletTx`, `walletTxWithoutPaid`, `bookingIntentUnpaidButPaymentPaid`, `pendingPastExpiry`, `failedButWalletTxExists`. Derivations mirror `getPaymentDetailByOrderRefNum` exactly (wallet lookup via `walletTransactions.by_reference` = `easypaisa:{orderRefNum}`; bookingIntent `get`). `pendingPastExpiry` is the cheap, join-free flag (status + `expiresAt`).
  - UI requests reconciliation only when the user picks a Reconciliation Issue other than `All` (so the default load and 45s auto-refresh do not run the joins).
- Payments UI filters:
  - Payment Type (server `kind`): All / Wallet Top-up / Booking Payment. (No Team Challenge — `kind` only has `booking_intent` / `wallet_topup`.)
  - Payment Status (server `status`): All / Created / Redirected / Token Received / Pending / Paid / Failed / Expired / Cancelled.
  - Date Range (server `dateFrom`): Any / Today / Last 7 Days / Last 30 Days (lower bound only; payments aren't future-dated).
  - Amount Range (server `amountMin`/`amountMax`): Any / Under Rs 500 / Rs 500–2,000 / Rs 2,000–5,000 / Above Rs 5,000 (whole-rupee inclusive bounds).
  - Provider Status (client, dynamic from loaded page): All + present values.
  - Reconciliation Issue (client over the page, triggers `includeReconciliation`): All / the 5 flags above. Active flags also render as red `StatusPill`s on each card.
  - Search remains client-side over the loaded page (owner/orderRef/providerRef/status/kind/amount). (`listPaymentsV2` also accepts a server `search` arg for orderRef/providerRef, currently unused by the UI.)
- Active count / Reset / Empty state:
  - Active count = Type + Status + Date + Amount + Provider Status + Reconciliation; search excluded. Reset clears all six; search not cleared; Reset disabled at 0; Done closes the drawer.
  - Empty: `anyFilterActive` (any non-default filter or search) → `No payments match these filters.` / `Reset filters to view all payments.`; otherwise `No payments found`.
- Sensitive fields excluded: confirmed (see returned-fields list above).
- Codegen result: `npx convex codegen` ran successfully (server code + TypeScript bindings regenerated). NOTE: the two new indexes become active on the next `convex dev`/`deploy` (codegen/deploy backfills them); `listPaymentsV2` requires them at runtime.
- TypeScript result: `npx tsc -p tsconfig.json --noEmit` (pass, exit 0).
- No-change confirmations: no payment status mutation, no reconciliation/wallet WRITES, no Easypaisa callback/IPN/finalize changes, no refund/capture/settlement changes. `listPaymentsV2` is a pure read.
- Known risks:
  - The list is a most-recent window (`scanLimit` ≤ 500; page `limit` ≤ 100). Date/Amount are honest within that window but full-history pagination is **not** implemented — see Phase 5F. This is intentional and avoids faking full-history filtering.
  - Page-scoped reconciliation does up to `limit` × (1 wallet query + 1 bookingIntent get); kept opt-in to bound cost.
  - Provider Status options reflect only the loaded page.
- Manual/code-review notes:
  - Not run on device this pass; verified by code review + TypeScript + codegen.
  - Confirmed the detail screen (`/super-admin/payment/[orderRefNum]`) still uses the unchanged `getPaymentDetailByOrderRefNum` (full reconciliation there is untouched).
- Next starting point:
  - Phase 5F — pagination follow-ups.

### Phase 5F — Performance / Pagination Follow-ups (May 23, 2026 — PLAN ONLY, not implemented)
No implementation this pass. Recorded risks and the recommended approach for a later track:
- **Payments:** `listPaymentsV2` loads a most-recent window (`scanLimit` ≤ 500, page `limit` ≤ 50/cap 100). Date/Amount filtering is honest within the window but not across full history. Follow-up: add cursor pagination (the codebase currently uses no Convex `.paginate()` anywhere — adopting it here would be the first instance; alternatively a `createdAt`-cursor "load more" using `by_createdAt`/`by_status_and_createdAt`).
- **Withdrawals:** backend scans `min(limit*10, 200)` `walletTransactions` rows (by type) then filters/slices; the `All` tab in a busy period can exceed the window. Follow-up: dedicated index/pagination for withdrawal requests, or a cursor.
- **Users:** Super Admin Users loads ~150 most-recent-by-`updatedAt`; all frontend filters (Account Status / Role / Created Date / KYC) act only on that window. Follow-up: server-side filtering or pagination if user volume grows.
- **Zones:** `admin.listZones` is `limit`-capped (default 100) per status; the new Active tab + Pilot Status filter act on the loaded window. Follow-up: pagination for large active-zone counts.
- **Matchrooms / Support:** server lists are `take(N)`-capped; future pagination risk if volume grows (no change needed now).
General: no Convex pagination pattern exists in the codebase today; introducing one (`paginationOptsValidator` + `usePaginatedQuery`, or explicit cursors) should be a single, reviewed track applied consistently.

### Phase 6 — Filter QA + Regression Pass (May 23, 2026)
- Status: **PASSED WITH MINOR FIXES.** Full code-review + TypeScript regression across Player, Zone Admin, and Super Admin filter work (Phases 1–5). No new filters, no UI redesign, no backend logic change. 2 small in-scope bugs fixed.
- Files changed this phase:
  - `app/super-admin/withdrawals.tsx` (label fix only — see Bug 1)
  - `app/zone/modules/pricing.tsx` (filtered-empty state — see Bug 2)
  - `TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`
- Bugs fixed:
  1. **Withdrawals raw-empty grammar.** On the new `All` status tab, the raw-empty title rendered `statusTabTitle("all")` → `"all"`, producing "No all withdrawals". Fixed to show "No withdrawals" on the `All` tab while keeping per-status titles ("No pending withdrawals", etc.). Display-only; no logic touched.
  2. **Pricing missing filtered-empty state.** The Rules list showed "No pricing rules yet." even when existing rules were hidden by filters/search (flagged as a Phase 3C follow-up). Added the raw-vs-filtered distinction: raw-empty keeps "No pricing rules yet."; filtered-empty now shows "No pricing rules match these filters." Uses existing `rules` (raw) vs `filteredRules` (post-filter); no pricing/query/mutation logic changed.
- Screens verified by code review (no change needed — confirmed correct):
  - Player: Wallet Transactions, My Matchrooms, Inbox, Schedule. (Discover confirmed planning-only/deferred per Phase 2E — no implementation changes.)
  - Zone Admin: Bookings (Requests + Matchrooms tabs), Resources, Pricing.
  - Super Admin: Users (+KYC), Zones (+Pilot/Active tab), Withdrawals, Payments, Reports, Identity Verifications, Audit Logs, Notifications, Matchrooms, Support Tickets.
- Cross-cutting checks confirmed by code review:
  - All 10 Super Admin filter drawers use the `resetDisabled={!activeFilterCount}` (or `=== 0`) standard; Reset clears drawer filters only and never clears search; Done closes the drawer. Same standard verified on Zone Admin Bookings (Requests + Matchrooms) and Resources drawers.
  - Active filter count excludes search on every screen; tab-scoped/conditional counts verified (e.g. Zones Pilot Status only counts on the Active tab via `Number(tab === "active" && pilotFilter !== "all")`).
  - Filtered-empty vs raw-empty state present on all 13 Player + Super Admin filter screens, plus Zone Admin Bookings Requests and Resources, and now Pricing.
- Screens verified on device/simulator: **NONE** this pass — code review + TypeScript only. Device matrix (small phone / Samsung A32 / large Android / iPhone home-indicator / drawer scrolling / chip wrapping) remains open.
- Backend / Convex safety confirmation (from `git diff` review of the uncommitted Phase 5 changes):
  - `convex/admin.ts`: only ADDED `listPaymentsV2` (read-only `query`). No existing mutation/action changed.
  - `convex/schema.ts`: only ADDED two additive indexes to `paymentTransactions` (`by_createdAt`, `by_status_and_createdAt`). No field/validator changes.
  - No mutation behavior changed for payments / wallet / withdrawals / zones / users / support / reports / matchrooms. Withdrawals approve/reject handlers and mutations are byte-for-byte unchanged (the only withdrawals change gates the re-decision UI to `status === "pending"` and splits the backend `failed` set into Rejected/Failed for display).
  - `listPaymentsV2` sensitive-data safety verified: returns only a safe `providerPayload` subset (`flow` / `lastSyncAt` / `lastProviderStatus`) and `providerDescription` is truncated. It does NOT return raw `providerPayload` (IPN/hosted bodies), phone, CNIC, account details, or tokens/secrets.
  - Service layer (`superAdminService.ts`, `zoneService.ts`) changes are additive TypeScript types + one read-only `getAdminPayments` wrapper; no query-arg or logic changes to existing functions.
- Convex deployment / configuration note:
  - Configured deployment (`.env.local`): `CONVEX_DEPLOYMENT=dev:ardent-lynx-28` — a **dev** deployment in the **matchhai-staging** project (team shakir-yasin). `EXPO_PUBLIC_CONVEX_URL=https://ardent-lynx-28.convex.cloud`. There is no `convex.json`. This is a dev/staging deployment, **not production**.
  - Phase 5E ran `npx convex codegen`, which regenerates the local `convex/_generated/*` bindings; codegen alone does not push functions or backfill indexes. The new indexes (`by_createdAt`, `by_status_and_createdAt`) become active only on the next `convex dev`/`convex deploy`, which `listPaymentsV2` requires at runtime. Any deployed backend change is limited to the additive read-only query + 2 indexes.
  - Phase 6 did **not** change any `convex/` or generated files, so no codegen was re-run and no deploy was performed.
- Commands run:
  - `npx tsc -p tsconfig.json --noEmit` → exit 0 (clean), re-run after both fixes → exit 0 (clean).
  - `git diff --check` → no whitespace/conflict errors (only benign LF→CRLF advisory warnings).
  - `npx convex codegen` → NOT run (no backend/generated change in Phase 6).
- Known risks / remaining items:
  - All Super Admin filtering acts on a most-recent loaded window (Payments ≤ 500 scan / ≤ 100 page; Withdrawals scan-capped; Users ~150; Zones ~100). Date/Amount/etc. are honest within that window only — full-history pagination is the Phase 5F track.
  - Reconciliation flags (Payments) render only when a Reconciliation Issue filter is selected (opt-in/page-scoped by design) — there is no "any issue" aggregate option.
  - Heuristic buckets remain (Bookings Branch leniency, Booking Type/Source classification, Notification Type → System fallback): unknowns are bucketed, never hidden. Documented in their phase entries.
  - Zone Admin Bookings **Matchrooms** tab still shows a single "No matchrooms found for this zone." (no raw-vs-filtered split) because the child section receives the already-filtered list; adding the distinction needs prop plumbing — left as a low-priority follow-up, not a regression.
  - Indexes must be live on the target deployment before `listPaymentsV2` is exercised in any environment (see deployment note).
- Recommended next step after Phase 6:
  - Run the manual device QA matrix (drawer scrolling, chip wrapping, Reset/Done, active counts, empty states) on the listed devices.
  - Deploy the additive Phase 5E backend (read-only query + 2 indexes) to the intended environment via `convex deploy` (currently only present locally / on the dev deployment) so the indexes are backfilled before Payments V2 is used.
  - Then schedule the Phase 5F pagination track as a single reviewed change.
