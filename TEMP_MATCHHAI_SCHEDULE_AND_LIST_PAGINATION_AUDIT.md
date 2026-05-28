# MatchHai Schedule + List Pagination Audit

Audit date: 2026-05-26

Scope: audit only. No implementation fixes, schema changes, query changes, pagination changes, UI refactors, Convex codegen/dev/deploy, EAS build, or source-code edits were performed. The only intended file change from this audit is this tracker.

## Files inspected

- `convex/_generated/ai/guidelines.md`
- `app/(player)/schedule.tsx`
- `app/(player)/schedule.styles.ts`
- `src/services/convex/matchService.ts`
- `src/services/convex/reportService.ts`
- `src/hooks/useNotifications.ts`
- `src/features/discover/components/DiscoverPlayerList.tsx`
- `src/features/discover/components/DiscoverMatchroomList.tsx`
- `src/features/discover/components/DiscoverTeamList.tsx`
- `src/features/discover/components/DiscoverZoneList.tsx`
- `app/(player)/(tabs)/discover.tsx`
- `app/(player)/(tabs)/profile.tsx`
- `app/(player)/inbox.tsx`
- `app/(player)/wallet.tsx`
- `app/(player)/friends.tsx`
- `app/(player)/chatrooms.tsx`
- `app/(player)/my-teams.tsx`
- `app/(player)/reports.tsx`
- `app/(player)/zones/[id].tsx`
- `app/matchrooms/my.tsx`
- `app/matchrooms/chat/[id].tsx`
- `app/(player)/friend-chat/[friendId].tsx`
- `app/teams/[id].tsx`
- `app/teams/challenges.tsx`
- `src/features/chat/ChatThread.tsx`
- `src/features/support/SupportChatScreen.tsx`
- `app/zone/modules/bookings.tsx`
- `app/zone/modules/hooks/useZoneBookingsViewModel.ts`
- `app/zone/modules/components/ZoneBookingsRequestsSection.tsx`
- `app/zone/modules/components/ZoneBookingsMatchroomsSection.tsx`
- `app/zone/modules/components/ZoneBookingsWalkinsSection.tsx`
- `app/zone/modules/components/ZoneBookingsHistorySection.tsx`
- `app/zone/modules/resources.tsx`
- `app/zone/modules/pricing.tsx`
- `app/zone/modules/notifications.tsx`
- `app/zone/modules/support.tsx`
- `app/zone/modules/audit.tsx`
- `app/zone/modules/insights.tsx`
- `app/zone/(tabs)/index.tsx`
- `app/zone/(tabs)/branches.tsx`
- `app/zone/(tabs)/profile.tsx`
- `src/services/convex/zoneAdminBookingService.ts`
- `src/services/convex/zoneAdminResourceService.ts`
- `src/services/convex/pricingRuleService.ts`
- `src/services/convex/reportService.ts`
- `src/services/convex/zoneAuditService.ts`
- `src/services/convex/superAdminService.ts`
- `app/super-admin/(tabs)/index.tsx`
- `app/super-admin/(tabs)/payments.tsx`
- `app/super-admin/(tabs)/reports.tsx`
- `app/super-admin/users.tsx`
- `app/super-admin/zones.tsx`
- `app/super-admin/withdrawals.tsx`
- `app/super-admin/identity-verifications.tsx`
- `app/super-admin/audit-logs.tsx`
- `app/super-admin/notifications.tsx`
- `app/super-admin/matchrooms.tsx`
- `app/super-admin/support-tickets.tsx`
- `app/super-admin/payment/[orderRefNum].tsx`
- `app/super-admin/report/[id].tsx`
- `app/super-admin/matchroom/[id].tsx`
- `app/super-admin/support-ticket/[id].tsx`
- `convex/discover.ts`
- `convex/matchrooms.ts`
- `convex/bookings.ts`
- `convex/notifications.ts`
- `convex/reports.ts`
- `convex/wallet.ts`
- `convex/social.ts`
- `convex/chat.ts`
- `convex/friendChat.ts`
- `convex/teamChallengeChat.ts`
- `convex/teamChallenges.ts`
- `convex/teams.ts`
- `convex/zones.ts`
- `convex/zoneAdminBooking.ts`
- `convex/zoneAdminResources.ts`
- `convex/zoneAudit.ts`
- `convex/admin.ts`
- `convex/support.ts`
- `convex/users.ts`
- `convex/schema.ts`
- `package.json`

## Baseline repo state

Repo was already dirty at audit start.

### `git status --porcelain` before tracker creation

```text
 M TEMP_MATCHHAI_SKILL_RATING_AND_LIST_PERFORMANCE_AUDIT.md
 M app/(player)/reports.tsx
 M app/(player)/schedule.tsx
 M app/(player)/wallet.tsx
 M app/super-admin/(tabs)/payments.tsx
 M app/super-admin/(tabs)/reports.tsx
 M app/super-admin/audit-logs.tsx
 M app/super-admin/identity-verifications.tsx
 M app/super-admin/matchrooms.tsx
 M app/super-admin/notifications.tsx
 M app/super-admin/report/[id].tsx
 M app/super-admin/support-tickets.tsx
 M app/super-admin/users.tsx
 M app/super-admin/withdrawals.tsx
 M app/super-admin/zones.tsx
 M app/zone/modules/audit.tsx
 M app/zone/modules/components/ZoneBookingsHistorySection.tsx
 M app/zone/modules/components/ZoneBookingsMatchroomsSection.tsx
 M app/zone/modules/components/ZoneBookingsRequestsSection.tsx
 M app/zone/modules/components/ZoneBookingsWalkinsSection.tsx
 M app/zone/modules/notifications.tsx
 M app/zone/modules/support.tsx
 M convex/_generated/api.d.ts
 M convex/admin.ts
 M convex/matchrooms.ts
 M convex/schema.ts
 M convex/users.ts
 M convex/zoneAdminBooking.ts
 M src/services/convex/superAdminService.ts
 M src/services/skillRatingService.ts
?? TEMP_MATCHHAI_SUPER_ADMIN_REPORT_ACTIONS_FIX.md
?? convex/ratingEngine.ts
```

### `git diff --stat` before tracker creation

```text
 ...HHAI_SKILL_RATING_AND_LIST_PERFORMANCE_AUDIT.md | 432 ++++++++++--
 app/(player)/reports.tsx                           |  87 ++-
 app/(player)/schedule.tsx                          | 168 +++--
 app/(player)/wallet.tsx                            | 280 ++++----
 app/super-admin/(tabs)/payments.tsx                | 186 +++---
 app/super-admin/(tabs)/reports.tsx                 | 104 +--
 app/super-admin/audit-logs.tsx                     |  42 +-
 app/super-admin/identity-verifications.tsx         |  78 ++-
 app/super-admin/matchrooms.tsx                     |  94 ++-
 app/super-admin/notifications.tsx                  |  73 ++-
 app/super-admin/report/[id].tsx                    | 554 +++++++++++++---
 app/super-admin/support-tickets.tsx                |  18 +-
 app/super-admin/users.tsx                          | 122 ++--
 app/super-admin/withdrawals.tsx                    | 104 +--
 app/super-admin/zones.tsx                          |  26 +-
 app/zone/modules/audit.tsx                         |  88 +--
 .../components/ZoneBookingsHistorySection.tsx      | 133 ++--
 .../components/ZoneBookingsMatchroomsSection.tsx   |  88 ++-
 .../components/ZoneBookingsRequestsSection.tsx     | 257 +++++---
 .../components/ZoneBookingsWalkinsSection.tsx      |  70 +-
 app/zone/modules/notifications.tsx                 |  52 +-
 app/zone/modules/support.tsx                       | 148 +++--
 convex/_generated/api.d.ts                         |   2 +
 convex/admin.ts                                    | 723 +++++++++++++++++++--
 convex/matchrooms.ts                               | 649 ++++++++++++++++--
 convex/schema.ts                                   |  95 ++-
 convex/users.ts                                    | 209 ++++--
 convex/zoneAdminBooking.ts                         |  75 +--
 src/services/convex/superAdminService.ts           | 179 +++++
 src/services/skillRatingService.ts                 | 169 +----
 30 files changed, 3899 insertions(+), 1406 deletions(-)
```

## 1. Executive Summary

- Biggest Schedule issue: `app/(player)/schedule.tsx` is currently a mixed timeline. It combines matchrooms, booking intents, pending notifications, and reports, so the Schedule page is not a matchroom lifecycle schedule.
- Biggest list rendering issue: many screens use `FlatList`, but the underlying data is loaded as unbounded `.collect()` or fixed `.take(100/150/200/500)` batches, then filtered locally. This creates false-empty and partial-result behavior.
- Biggest backend query issue: no Convex `.paginate()` usage was found under `convex/`. Several hot paths still use unbounded `.collect()`, `.collect().length` count patterns, global scans, or bounded candidate windows with JS filtering.
- Highest priority phase: Phase S1 should come first because Schedule is a user-facing correctness problem. Phase L1 should follow immediately for critical backend list correctness and hot-path scans.

## 2. Player Schedule Audit

### Current state

- Current file: `app/(player)/schedule.tsx`.
- Current tabs: `Upcoming`, `Pending`, `History`.
- Current data source function: `fetchTimeline()`.
- Current render strategy: `FlatList` with `initialNumToRender={10}`, `windowSize={11}`, `removeClippedSubviews`.
- Current pagination: none. No `usePaginatedQuery`, cursor, `onEndReached`, or load-more flow.

### Current data sources

- Matchrooms: `getUserMatchrooms(user._id)` in `src/services/convex/matchService.ts`, backed by `api.matchrooms.getUserMatchrooms` in `convex/matchrooms.ts`.
- Booking intents: `api.bookings.listIntentsByUser` and `api.bookings.listActiveIntentsByUser`.
- Notifications: `api.notifications.listInboxPage({ tab: "pending", limit: 40 })`.
- Reports: `getMyReports()`, backed by `api.reports.listByReporter`.

### Why notifications are wrong as Schedule source

- Notifications are inbox/action messages, not schedule state.
- A pending notification may represent a friend/team/report/system action and may not map to a real matchroom lifecycle item.
- Notifications can deep-link to a matchroom, booking status, or Schedule, but they should not define Schedule membership or tab counts.
- The current `Pending` tab includes generic inbox items and reports, making it behave like a notification inbox rather than a matchroom waiting state.

### Current behavior problems

- Misses intended source-of-truth model: matchroom lifecycle data should drive Schedule.
- Mixes matchrooms, booking intents, notifications, and reports in one visual list.
- Uses booking intents for some pending states, but not as part of one coherent matchroom lifecycle query.
- Mixes completed/cancelled/past matchrooms with resolved reports in `History`.
- Excludes expired rooms from `getUserMatchrooms`, so expired matchrooms may be missing from Schedule history.
- Loads hosted rooms with `by_hostUid.collect()` and joined rooms via membership rows `.collect()`.
- Loads all user booking intents with `.collect()`.
- Loads all reporter reports with `.collect()`.
- Client-side search/status/date/venue/payment filters operate over already-loaded data.

### Recommended tab names

Recommended final tab model: `Upcoming / Waiting / History`.

Rationale:

- `Upcoming` is already understood and maps to confirmed future matchrooms.
- `Waiting` is clearer than `Pending` because `Pending` currently reads like inbox pending notifications.
- `History` is better than `Completed` because it can include completed, cancelled, expired, and already-played matchrooms with clear status labels.
- Option B is therefore the best fit: `Upcoming / Waiting / History`.

### Exact tab definitions

- `Upcoming`: confirmed/active future matchrooms where the user is host, captain, or participant; not cancelled, expired, or completed.
- `Waiting`: matchrooms involving the user that are not fully ready, including waiting lobby fill, waiting zone approval, payment pending, booking intent pending, or broadcast pending when those represent a real matchroom lifecycle state.
- `History`: completed matchrooms, already-played matchrooms, cancelled/expired matchrooms with clear status, and finalized result/history records.

### Recommended backend query

Create a future `matchrooms.listForUserSchedule` query. This audit does not implement it.

Recommended shape:

```ts
{
  tab: "upcoming" | "waiting" | "history",
  paginationOpts,
  filters?: {
    game?: string,
    dateRange?: "today" | "tomorrow" | "week" | "all",
    venue?: "zone" | "broadcast" | "all",
    paymentStatus?: "paid" | "unpaid" | "all",
    searchText?: string
  }
}
```

Recommended return:

```ts
{
  page: Array<{ matchroom: MatchroomListRow, derivedState: string, reason: string }>,
  isDone: boolean,
  continueCursor: string
}
```

Recommended source model:

- Matchrooms are the source of truth.
- Booking intents may enrich a matchroom's derived state if they represent real lifecycle state.
- Notifications and reports are excluded from Schedule list data.
- Optional tab counts should come from a separate bounded/counter query, not by loading every item.

### Recommended frontend structure

- Keep `FlatList`.
- Replace `fetchTimeline()` aggregation with `usePaginatedQuery` or equivalent cursor-driven schedule data.
- Replace `actions` tab key with `waiting`.
- Remove generic notification/report `TimelineActionItem`s from Schedule.
- Keep status pills and empty states, but update copy to reflect matchroom lifecycle only.
- Use server-side filters where possible; avoid filtering a partial loaded page as if it were complete.

### Recommended empty states

- Upcoming: "No upcoming matches" and "Confirmed future matchrooms will appear here."
- Waiting: "No matchrooms waiting" and "Lobby fill, venue approval, and payment-pending matchrooms will appear here."
- History: "No matchroom history yet" and "Completed, cancelled, and expired matchrooms will appear here."
- Filtered empty state: "No matchrooms match these filters" and "Reset filters to view this schedule tab."

### Schedule test cases

- Confirmed full paid venue-approved future room appears only in `Upcoming`.
- Future room with user confirmed but lobby not full appears only in `Waiting`.
- Future zone room full but `zoneAdminApproved !== true` appears only in `Waiting`.
- Pending approval or payment pending appears only in `Waiting`.
- `completed`, `cancelled`, and `expired` rooms appear only in `History`.
- Past active room appears in `History` with clear state.
- Same room in hosted and joined results renders once.
- Notifications and reports do not create Schedule rows.
- Search/filter empty state differs from true empty tab.

## 3. Full List Inventory

### Player

| Screen/list | Role/module | Data source/query | Backend limit/pagination | Render strategy | Search/filter behavior | Partial-data risk | Scale | Severity | Recommended fix |
|---|---|---|---|---|---|---|---|---|---|
| Discover Players | Player discover | `api.discover.listDiscoverPlayers` | client asks `limit: 200`; backend fetches 120-300 candidates; no cursor | `FlatList` | backend JS search/filter after bounded fetch | Yes, matching users after candidate window are invisible | all players | High | Paginated/search-indexed discover query or digest table; push game/search/area/platform filters to indexes |
| Discover Matchrooms | Player discover | `api.discover.listDiscoverMatchrooms` | client asks `limit: 200`; backend fetches 120-250 rooms; no cursor | `FlatList` | backend JS filters search/timeline/open slots/price | Yes | public matchrooms | High | Paginated indexed query by active status, game, scheduled time; persist filterable active/open-slot fields |
| Discover Teams | Player discover | `api.discover.listDiscoverTeams` | client asks `limit: 200`; backend fetches 100-200 teams; no cursor | `FlatList` | backend JS filters; my mode collects memberships | Yes | teams | High | Use `teamMembers.by_userId` for My Teams; paginated team discover digest/index |
| Discover Zones/Venues | Player discover | `api.discover.listDiscoverZones` | client asks `limit: 200`; backend max 100 active zones | `FlatList` | backend JS search/area/price/platform | Yes once active zones exceed 100 | active zones | Medium | Paginate active zones; add searchable brand/city/area/game fields |
| Schedule | Player schedule | `getUserMatchrooms`, booking intents, inbox page, reports | matchrooms/intents/reports collect all; inbox limit 40 | `FlatList` | frontend tab classification and filters | Yes; also wrong source model | user lifecycle history | High | Matchroom-only paginated schedule query |
| My Matchrooms | Player matchrooms | `getUserMatchrooms` | hosted `.collect()`; joined member rows `.collect()` | `FlatList` | frontend search/status/game/date | Yes for heavy users | per-user rooms | Medium | User-scoped paginated query with status/date filters |
| Inbox | Player notifications | `api.notifications.listInboxPage` | limit 100; backend reads `limit * 4`; no cursor | `FlatList` | frontend tab/type filter | Yes for type/history beyond latest window | user notifications | Medium | Cursor pagination; index by `toUid/status/type/createdAt` |
| Wallet transactions | Player wallet | `api.wallet.listHistory` | collects all wallet and payment rows | `FlatList` for transactions; overview `ScrollView` | frontend type/status/date/amount filters | Yes once bounded; currently unbounded | per-user financial history | High | Paginated normalized ledger or cursor-merged wallet/payment rows |
| Friends | Player social | `api.social.listFriends`; `api.friendChat.getUnreadCounts` | collects all friendships and DM unread rows | `FlatList` | frontend online/search filters | No partial cap today, but unbounded/N+1 | friends/DMs | Medium | Paginated friend digest; separate lightweight presence |
| My Teams | Player teams | `api.teams.getUserTeams` | reads latest 200 teams then filters `memberUids` | `FlatList` | frontend search | Yes and correctness bug after 200 teams | teams | High | Membership index query via `teamMembers.by_userId`; paginate |
| Profile My Teams | Player profile | `api.teams.getUserTeams` | same latest-200 cap | `ScrollView.map` top 3 | top-3 over partial data | Yes | teams | High | Backend `limit: 3` using membership index |
| Team members / join requests | Team detail | `api.teams.getWithMembers`; `api.notifications.listTeamJoinRequests` | team members collect; join requests collect captain pending | `ScrollView.map` | per-team UI lists | Join requests can be unbounded across captain | bounded team roster; unbounded requests | Medium | Index team join requests by `teamId/status/type`; bound/paginate |
| Team challenges | Team challenges | `api.teamChallenges.listForCaptain` | global scan with Convex `.filter()` then collect | `ScrollView.map` | client render over full result | Full-table scan | team challenges | High | Add `by_captainAUid_createdAt` and `by_captainBUid_createdAt`; use `FlatList` |
| Matchroom chat messages | Matchroom chat | `api.chat.listMessagesForMatchroom` | `limit: 200`; no cursor | `ChatThread` `FlatList` | recent 200 only | Older history unavailable | messages | Medium | Cursor pagination/infinite scroll; initial 50 |
| Friend chat messages | DM chat | `api.friendChat.listMessages` | `limit: 200`; no cursor | `ChatThread` `FlatList` | recent 200 only | Older history unavailable | messages | Medium | Cursor pagination/infinite scroll; attachment URL caching |
| Chatrooms list | Player chats | `api.chat.listForUser`, `api.teamChallengeChat.listForMe`, `api.friendChat.listForUser` | all memberships collect; no cursor | `FlatList` | frontend search | No cap but unbounded + N+1 | conversations | High | Unified conversation digest table or paginated per-user conversation indexes |
| Support chat | Player support | `api.support.listConversationMessages` | capped 50; no cursor | chat list | recent messages only | Older support history unavailable | support messages | Low-Medium | Paginate messages if history UX matters |
| Reports | Player reports | `api.reports.listByReporter` | collects all reporter reports | `FlatList` | service/frontend status filtering | Unbounded; future cap would mislead | reports | Medium | `by_reporterUid_status_updatedAt` with pagination |
| Zone details lists | Player venue detail | `api.zones.getById` | single zone doc embeds branches/resources/pricing | `ScrollView.map` | local display | Large embedded arrays can bloat doc/UI | venue resources | Medium | Lazy-load branch/resources or split child tables if large |

Leaderboards were searched for but not found.

### Zone Admin

| Screen/list | Role/module | Data source/query | Backend limit/pagination | Render strategy | Search/filter behavior | Partial-data risk | Scale | Severity | Recommended fix |
|---|---|---|---|---|---|---|---|---|---|
| Booking queue/requests | Zone admin bookings | `api.zoneAdminBooking.listBookingQueueForZone` via `subscribeZoneBookingQueue` | 5s polling; `.collect()` per active status | `FlatList` | client filters date/type/status/branch/search | No cap, but unbounded poll load | active zone requests | Medium | Paginated queue query; server-side status/date filters |
| Pending counter-offers | Zone admin bookings | `api.bookings.listOffersByZone` | `.collect()` on zone offers | list derived in requests UI | client filters pending/unexpired | Unbounded | offers | High | Index `zoneOffers` by `zoneId/status/updatedAt` or `expiresAt`; paginate |
| Matchrooms | Zone admin bookings | `api.zoneAdminBooking.listMatchroomsForZone` via polling | 5s polling; `matchrooms.by_zoneId.collect()` | `FlatList` | client filters status/date/payment/source/search | No cap, but unbounded poll load | zone matchrooms | High | Paginated `by_zoneId_createdAt`, `by_zoneId_status_createdAt`, `by_zoneId_bookingSource_createdAt` |
| Walk-ins | Zone admin bookings | same matchroom list | inherited unbounded zone matchroom collect | `FlatList` | client filters `bookingSource === walkin` | Yes if later capped; current unbounded | walk-in rooms | High | Server query for walk-ins by zone/source with pagination |
| Booking history | Zone admin bookings | `api.zoneAdminBooking.listBookingHistoryForZone` | takes up to 300 requests/offers then JS filters | `FlatList` | backend JS history classification | Yes | booking history | Medium | History indexes by zone/requestKind/lifecycle/status/updatedAt; paginate |
| Resources | Zone admin resources | `api.zoneAdminResources.listResourcesByZoneAndBranch` via polling | 5s polling; `.collect()` by zone/branch | `ScrollView.map` nested accordions | client filters asset/status/search/allocation | No cap, but full render risk | branch resources | Medium-High | Paginated resources; `by_zoneId_branchId_lifecycleStatus`; consider `FlatList`/SectionList |
| Pricing rules | Zone admin pricing | `api.zones.listPricingRules` | 60s polling fallback; `.collect()` by zone | `ScrollView.map` | client filters type/asset/branch/enabled/search | Unbounded but likely smaller | pricing rules | Low-Medium | Bounded/paginated rules; indexes by zone/enabled/type/asset |
| Branches/profile lists | Zone admin branches/profile | embedded zone branches; branch service polling | embedded arrays and 5s branch polling in modules | `ScrollView.map` | local display | Whole-zone doc invalidation | branches | Medium | Centralize branch query/provider; avoid repeated polling |
| Notifications | Zone admin notifications | `api.notifications.listForUser({ limit: 100 })` | take 100; no cursor | `FlatList` | client zone-admin visibility + pending/history | Yes | notifications | Medium | Zone-admin inbox query/index by recipient/status/type/createdAt |
| Support/reports | Zone admin support | `api.reports.listForMyZone` | `reports.by_zoneId.collect()`; status JS filtering | `FlatList` | status tab via service/backend filtering | Unbounded | zone reports | Medium-High | `by_zoneId_status_updatedAt`, pagination |
| Audit | Zone admin audit | `api.zoneAudit.listZoneAuditEvents` | `take(200)`; no cursor | `FlatList` | client date/action/actor filters | Yes beyond 200 | audit logs | Medium | Paginate; push action/date filters to indexed queries |
| Insights/dashboard lists | Zone admin dashboard/insights | queue, matchrooms, branches/resources polling | multiple 5s polls, branch fan-out | `ScrollView.map` summaries | client aggregates | Hot-path polling/fan-out | dashboard usage | High | Zone summary/aggregate query/table; reduce polling |
| Withdrawals | Zone admin profile actions | no zone withdrawal list found | action/mutation/email flow only | N/A | N/A | N/A | withdrawals | Low | If list is added, use withdrawal-specific indexed/paginated query |

### Super Admin

| Screen/list | Role/module | Data source/query | Backend limit/pagination | Render strategy | Search/filter behavior | Partial-data risk | Scale | Severity | Recommended fix |
|---|---|---|---|---|---|---|---|---|---|
| Dashboard counters/lists | Super admin dashboard | `api.admin.getDashboardSummary`; `getSuperAdminMatchrooms` | many unbounded `.collect()` counts; matchroom preview latest 150 | `ScrollView`; preview client slice | dashboard aggregates server-side, preview client-side | Counters can hit read limits; preview partial | platform-wide | Critical | Counter/summary docs; bounded upcoming list query |
| Users | Super admin users | `api.admin.listUsers` | service asks 150; indexed take | `FlatList` | account type server-side; status/role/KYC/date/search client-side | Yes | users | High | Cursor pagination; server filters/search fields |
| Zones | Super admin zones | `api.admin.listZones` | take 100 | `FlatList` | status server-side; city/area/date/search client-side | Yes | zones | High | Paginate; server city/area/status filters; facets separate |
| Payments | Super admin payments | `api.admin.listPaymentsV2` | scans up to 500, returns 50-100 | `FlatList` | mixed server and client filtering; search not passed | Yes | payments | High | Paginate by createdAt; provider/kind/status indexes; exact order/ref lookup |
| Withdrawals | Super admin withdrawals | `api.admin.listZoneWithdrawalRequests` | `walletTransactions.by_type.take(min(limit*10,200))` then JS filters | `FlatList` | status/source server JS; branch/date/search client | Yes | withdrawals | High | Dedicated withdrawal table or `type/status/source/createdAt` indexes |
| Reports | Super admin reports | `api.admin.listReports` | take 100 | `FlatList` | status server-side; type/game/date/search client-side | Yes | reports | High | Paginate; indexes by status/type/game/updatedAt; denormalized list fields |
| Identity verifications | Super admin identity | `api.admin.listIdentityVerifications` | exact status indexed; pending scans 500; role JS filtering | `FlatList` | status/role/date/search mixed | Yes | KYC | High | Pending group field/index; role/status/submittedAt indexes; paginate |
| Audit logs | Super admin audit | `api.admin.listSuperAdminAuditLogs` | reads `limit * 3` from createdAt then JS filters | `FlatList` | backend JS + UI search filters | Yes | audit logs | High | Pagination; indexes by module/action/status/admin/date |
| Notifications | Super admin notifications | `api.admin.listMyNotifications` | reads `limit * 4`; no cursor | `FlatList` | read/category/search page-scoped | Yes | notifications | Medium-High | Paginate; recipientRole/isRead/isArchived/type indexes; counters |
| Matchrooms | Super admin matchrooms | `api.admin.listSuperAdminMatchrooms` | latest 150 | `FlatList` | all filters client-side | Yes | matchrooms | High | Server filters + pagination; matchroom admin digest |
| Support tickets | Super admin support | `api.admin.listSupportTickets` | status indexed or all take 100 | `FlatList` | priority/category/role/assignee/date/search client-side | Yes | support tickets | High | Pagination; indexes by status, assigned admin, priority; denormalized display names |
| Payment detail linked records | Super admin detail | `api.admin.getPaymentDetailByOrderRefNum` | point lookup plus bounded child reads | `ScrollView` | mostly server-side | Limited | detail records | Medium | Keep point lookups; use take/first for unique refs |
| Report detail related records | Super admin detail | `api.admin.getReportById` | point lookup | `ScrollView` | N/A | Low | detail | Low-Medium | Keep point lookup; paginate any future linked lists |
| Matchroom detail linked reports | Super admin detail | screen loads reports and client-filters | first page/loaded reports only | `ScrollView` | client filter by matchroom | Yes | linked reports | High | Add `listReportsByMatchroomId(matchroomId, paginationOpts)` |
| Support ticket detail | Super admin detail | `api.admin.getSupportTicketById` | notes 50, messages 80 | `ScrollView` | bounded history | Older history unavailable | messages/notes | Medium | Paginate support messages/notes |

### Backend Convex queries

| Function/query | Table(s) | Current strategy | Risk | Recommended backend model |
|---|---|---|---|---|
| `discover.listDiscoverPlayers` | `users`, `friendships`, `notifications` | `users.by_accountType.take(120-300)` then JS filters; friendships/notifications collect | High | Discover digest/search index; cursor pagination; indexed filters |
| `discover.listDiscoverMatchrooms` | `matchrooms` | `by_game` or `by_createdAt.take(120-250)` then JS filters | High | Active matchroom index/digest by status/game/startAt |
| `discover.listDiscoverTeams` | `teams`, `teamMembers`, `notifications`, `teamChallenges` | bounded candidates + several collects | High | Team digest, membership query, challenge captain indexes |
| `discover.listDiscoverZones` | `zones` | active zones take max 100 then JS filters | Medium | Active zone digest/pagination |
| `matchrooms.getUserMatchrooms` | `matchrooms`, `matchroomMembers` | hosted `.collect()`, member rows `.collect()`, N `db.get` | High for Schedule | User schedule/member pagination; history-inclusive status handling |
| `bookings.listIntentsByUser` | `bookingIntents` | user `.collect()` | High for Schedule/Wallet | `by_userId_status_updatedAt`, pagination |
| `wallet.listHistory` | `walletTransactions`, `paymentTransactions` | both user tables `.collect()`, merge in JS | High | Normalized ledger or cursor-merged paginated history |
| `notifications.listInboxPage` | `notifications` | `by_toUid.take(limit*4)` then JS filters/slices | Medium | `toUid/status/type/createdAt` pagination |
| `notifications.countPendingFast/countUnreadFast` | `notifications` | indexed `.collect()` for counts | High | Denormalized counters or bounded count semantics |
| `reports.listByReporter/listMine/listForMyZone` | `reports` | indexed `.collect()`, JS status filters | Medium-High | compound reporter/zone/status/updatedAt indexes and pagination |
| `social.listFriends` | `friendships`, `users` | friendships `.collect()` plus N user reads | Medium | friend digest or paginated friendship rows |
| `teams.getUserTeams` | `teams` | latest 200 teams then member array filter | High | `teamMembers.by_userId` query |
| `teamChallenges.listForCaptain` | `teamChallenges` | global `.filter()` then `.collect()` | High | captain A/B indexes and paginated merge |
| `chat.listMessages*`, `friendChat.listMessages`, `support.listConversationMessages` | messages | bounded `take()` only | Medium | cursor pagination for older messages |
| `chat.listForUser`, `friendChat.listForUser`, `teamChallengeChat.listForMe` | chat memberships/chatrooms | membership `.collect()` and N joins | High for chatrooms page | conversation digest/index per participant |
| `zoneAdminBooking.listBookingQueueForZone` | `bookingRequests`, `users` | per-status `.collect()`, N user reads | Medium | paginated status/date query; denormalized user display |
| `zoneAdminBooking.listMatchroomsForZone` | `matchrooms` | `by_zoneId.collect()` | High | paginated by zone/status/source/createdAt |
| `zoneAdminBooking.listBookingHistoryForZone` | `bookingRequests`, `zoneOffers`, `matchrooms` | `take(fetchLimit)` then JS history classification and joins | Medium | history/status indexes; pagination |
| `zoneAdminResources.listResourcesByZoneAndBranch` | `zoneResources` | by zone/branch `.collect()` | Medium-High | paginate resources; status/index filters |
| `zones.listPricingRules/listResources/listPendingReview` | pricing/resources/zones | `.collect()` in several paths | Low-Medium | bounded/paginated zone admin lists |
| `zoneAudit.listZoneAuditEvents` | `zoneAuditEvents` | indexed take limit; no cursor | Medium | `paginationOpts`; action/module/date indexes |
| `admin.getDashboardSummary` | many platform tables | multiple unbounded `.collect()` counts | Critical | summary/counter documents |
| `admin.listUsers/listZones/listReports/listSupportTickets/listSuperAdminMatchrooms` | admin list tables | mostly fixed `take(100/150)` | High | cursor pagination and server filters |
| `admin.listPaymentsV2` | payment/wallet tables | scan window up to 500 then JS filters | High | payment indexes + pagination/search by order/ref |
| `admin.listZoneWithdrawalRequests` | walletTransactions | type scan then JS filters | High | dedicated withdrawal table or type/status/source index |
| `admin.listIdentityVerifications` | identity verifications | exact status index; pending pseudo-status scan | High | status group/role/status/submittedAt indexes |
| `admin.listSuperAdminAuditLogs` | audit logs | `limit*3` scan then JS filters | High | filter-specific indexes + pagination |

## 4. Critical / High Risk Lists

| Issue ID | Severity | Screen/query | Current problem | Impact | Recommended fix | Files likely |
|---|---|---|---|---|---|---|
| SCHED-01 | High | Player Schedule | Mixed matchrooms + booking intents + notifications + reports | Schedule is semantically wrong | Matchroom-only paginated schedule query and tabs `Upcoming/Waiting/History` | `app/(player)/schedule.tsx`, `convex/matchrooms.ts`, `convex/bookings.ts` |
| SCHED-02 | High | `matchrooms.getUserMatchrooms` | hosted/member data collected all; expired filtered out | Schedule/My Matchrooms history incomplete and unbounded | User schedule query with pagination and explicit history status handling | `convex/matchrooms.ts` |
| DISC-01 | High | Discover Players | candidate cap before search/filter | Player search misses records beyond first 300 | Search/indexed paginated discover players | `src/features/discover/components/DiscoverPlayerList.tsx`, `convex/discover.ts` |
| DISC-02 | High | Discover Matchrooms | bounded recent/game candidates then JS filters | Timeline/slot/search filters misleading | active matchroom digest or indexed server filters | `DiscoverMatchroomList.tsx`, `convex/discover.ts` |
| DISC-03 | High | Discover Teams/My Teams | teams capped and membership checked in arrays | My Teams can be incorrect after latest 200 | membership-indexed query and paginated discover teams | `convex/teams.ts`, `convex/discover.ts` |
| WALLET-01 | High | Wallet history | full wallet + payment transaction collects | user financial history grows unbounded | normalized ledger or paginated history | `app/(player)/wallet.tsx`, `convex/wallet.ts` |
| ZA-01 | High | Zone Admin matchrooms/walk-ins | 5s polling + zone matchrooms `.collect()` | hot polling path and full zone reads | paginated zone matchrooms by status/source/date | `app/zone/modules/bookings.tsx`, `convex/zoneAdminBooking.ts` |
| ZA-02 | High | Zone dashboard/insights | multiple 5s polling fan-outs | expensive dashboard reads and invalidations | zone summary/aggregate query/table | `app/zone/(tabs)/index.tsx`, `app/zone/modules/insights.tsx` |
| SA-01 | Critical | Super Admin dashboard | multiple platform-wide `.collect()` counts | dashboard can hit Convex read/function limits | maintained summary/counter documents | `convex/admin.ts` |
| SA-02 | High | Super Admin users/zones/reports/matchrooms/support | fixed first 100/150 then client filters | filters/search incomplete | cursor pagination and server filters | `app/super-admin/*`, `convex/admin.ts` |
| SA-03 | High | Super Admin payments/withdrawals | scan windows then JS/client filters | false-empty financial/admin search | payment/withdrawal indexes and pagination | `app/super-admin/(tabs)/payments.tsx`, `app/super-admin/withdrawals.tsx`, `convex/admin.ts` |
| CHAT-01 | High | Chatrooms list | three full conversation subscriptions and joins | chat list grows expensive | unified conversation digest/pagination | `app/(player)/chatrooms.tsx`, `convex/chat.ts`, `convex/friendChat.ts` |
| TEAM-01 | High | Team challenges | full-table scan with Convex filter | captain challenge list scales poorly | captain A/B indexes and pagination | `app/teams/challenges.tsx`, `convex/teamChallenges.ts` |

## 5. Discover Pagination Audit

- Players: currently `FlatList`, client asks for `limit: 200`, backend scans up to 300 `users.by_accountType` candidates and filters search/game/role/skill/availability/area/platform/intent in JS. Friendships and pending requests are also collected. Needs server-side search/pagination and likely a discover digest/search index.
- Matchrooms: currently `FlatList`, client asks for `limit: 200`, backend takes 120-250 candidates by game or createdAt, then filters status, expiration, search, skill, format, role, area, price, timeline, open slots in JS. Needs active-public matchroom index/digest and cursor pagination.
- Teams: currently `FlatList`, client asks for `limit: 200`, backend uses latest/game team candidates and collects related notifications/challenges. My Teams mode should not scan latest teams; it should query membership rows. Needs server filters and pagination.
- Zones/Venues: currently `FlatList`, backend takes at most 100 active zones and filters search/game/area/price/platform in JS. Needs active zone pagination and searchable denormalized fields if venue count grows.
- Filters/search: multiple discover filters are misleading because they filter only the fetched candidate window. This is most visible for player search beyond first 300 users.

## 6. Zone Admin List Audit

- Bookings queue: improved from global scan to zone/status indexes, but still polled every 5 seconds and `.collect()`s all active requests for the zone. Add pagination and server filters.
- Matchrooms: current query collects all zone matchrooms every 5 seconds. Status/date/payment/source/search filters are client-side. Add zone/status/source/date indexes and pagination.
- Walk-ins: derived from same full matchroom list. Add dedicated server filter by `bookingSource`.
- History: uses bounded request/offer windows and JS classification. Add lifecycle/history indexes and pagination.
- Resources: branch resources are collected and rendered through nested `ScrollView.map` accordions. Add pagination/status filters and consider `SectionList` if branches/resources grow.
- Pricing rules: likely lower scale, but currently collected and rendered via `ScrollView.map`. Add pagination if rules grow.
- Notifications: load 100 generic user notifications and filter for zone admin visibility client-side. Add role/status/type-aware query.
- Support/reports: zone reports collect by zone and filter status. Add `by_zoneId_status_updatedAt` and pagination.
- Audit: bounded to 200, but date/action/actor filters are client-side. Add pagination and indexed filters.
- Insights/dashboard: highest Zone Admin performance risk due repeated polling/fan-out across branches/resources/queue/matchrooms. Replace with summary/counters.

## 7. Super Admin List Audit

- Users: first 150 only; status/role/KYC/date/search client-side. Needs server filters and pagination.
- Zones: first 100 only; city/area/date/search client-side. Needs server filters/pagination and separate facets.
- Payments: backend scans up to 500 and UI filters loaded rows. Needs pagination and provider/kind/status/order-ref indexes.
- Withdrawals: backend takes a type window and JS-filters source/status; UI filters branch/date/search. Needs dedicated withdrawal table or indexes.
- Reports: first 100; type/game/date/search client-side and some display fields missing. Needs indexes and denormalized list fields.
- Identity: pending pseudo-status scans a broad window; role/date/search partly JS/client. Needs status group/index and pagination.
- Audit logs: `limit * 3` scan then filters. Needs filter-specific indexes and cursor pagination.
- Notifications: read/category/search page-scoped over a broad window. Needs recipient/status/type indexes and pagination.
- Matchrooms: first 150; all lifecycle/game/payment/zone/result/date/search filters client-side. Needs server filters and pagination.
- Support tickets: first 100; priority/category/role/assignee/date/search client-side. Needs pagination and denormalized display fields.
- Dashboard counters: platform-wide `.collect()` counts are the most critical backend risk. Needs summary/counter docs.

## 8. Backend Query + Index Audit

### Likely required indexes or model changes

- `matchrooms`: `by_hostUid_scheduledStartAt`, `by_zoneId_createdAt`, `by_zoneId_status_createdAt`, `by_zoneId_bookingSource_createdAt`, `by_status_game_scheduledStartAt`, `by_game_status_scheduledStartAt`, and possibly a schedule digest keyed by participant.
- `matchroomMembers`: keep `by_uid`, but add/consider schedule-optimized membership rows carrying `scheduledStartAt`, `statusBucket`, or use a separate `matchroomParticipantSchedule` digest if Convex indexing across joined matchroom fields becomes awkward.
- `bookingIntents`: `by_userId_status_updatedAt`, `by_userId_matchroomId`, `by_matchroomId_userId`, and paginated active-intents query.
- `notifications`: `by_toUid_status_createdAt`, `by_toUid_type_status_createdAt`, `by_toUid_isRead_createdAt`, `by_fromUid_type_status`, optional `recipientRole/status/createdAt`, and counters for unread/pending badges.
- `reports`: `by_reporterUid_status_updatedAt`, `by_zoneId_status_updatedAt`, `by_status_type_updatedAt`, `by_matchroomId_updatedAt`.
- `walletTransactions`: `by_userId_createdAt`, `by_userId_type_createdAt`, `by_userId_status_createdAt`, `by_type_status_createdAt`, and withdrawal-specific source fields if zone withdrawals stay in wallet transactions.
- `paymentTransactions`: `by_userId_createdAt`, `by_status_createdAt`, `by_provider_status_createdAt`, `by_provider_kind_createdAt`, exact lookup indexes for `orderRefNum` and provider refs.
- `teams`: membership queries should use `teamMembers.by_userId`; discover may need `by_game_status_createdAt`, `by_visibility_game_createdAt`, and search index/prefix field.
- `teamChallenges`: `by_captainAUid_createdAt`, `by_captainBUid_createdAt`, `by_opponentTeamId_status`, `by_challengerTeamId_status`.
- `chat/conversations`: introduce conversation digest rows or indexes by participant/update time; message queries need `paginationOpts`.
- `zoneOffers`: `by_zoneId_status_updatedAt`, `by_zoneId_status_expiresAt`, `by_requestId`.
- `bookingRequests`: `by_zoneId_status_updatedAt`, `by_zoneId_requestKind_status_updatedAt`, `by_zoneId_requestKind_lifecycleStatus_updatedAt`.
- `zoneResources`: `by_zoneId_branchId_lifecycleStatus`, `by_zoneId_assetType_lifecycleStatus`.
- `zoneAuditEvents`: indexes by zone/module/createdAt, zone/action/createdAt, zone/actor/createdAt.
- `admin audit`: indexes by module/action/status/admin/date as needed.
- Super admin dashboard: prefer maintained summary/counter documents over more indexes for total counts.

### Query changes recommended

- Convert user/admin/zone list APIs to `paginationOptsValidator` and `.paginate()`.
- Move search/filter args to backend queries and clearly indicate when a filter is page-scoped versus complete.
- Avoid `.collect().length` counts on growing tables.
- Avoid global `.take(n)` then JS/client filtering for admin lists.
- Avoid polling where Convex reactive `useQuery` or explicit refresh is sufficient.
- Avoid repeated N+1 `ctx.db.get` joins on hot list rows; denormalize small display fields or use digest tables.
- Cache/reuse attachment/storage URLs in chat-like lists where URL resolution happens per row.

## 9. Recommended Implementation Phases

### Phase S1 - Schedule page correction

- Stop using notifications and reports as Schedule data.
- Define tabs from matchroom lifecycle/status: `Upcoming / Waiting / History`.
- Implement a proper matchroom schedule query for user schedule.
- Include booking-intent-derived states only when tied to real matchroom lifecycle.
- Keep `FlatList`/virtualization and add empty states.
- Include cancelled/expired in History with clear status labels.

### Phase L1 - Critical backend list correctness

- Zone Admin matchroom list: zone-scoped paginated query and server filters.
- Zone Admin booking queue: paginated/reactive query and remove high-frequency full-queue polling where possible.
- My Matchrooms/Schedule: user-scoped paginated matchroom query.
- Wallet history: paginated transaction history.
- Dashboard aggregate counters: replace full-table count scans with summary/counter documents.

### Phase L2 - Super Admin pagination

- Add pagination/server filters for users, zones, matchrooms, reports, support tickets, audit logs, identity verifications, payments, and withdrawals.
- Add exact lookup/search paths for payments by order/reference.
- Stop deriving filter options only from first page unless explicitly labelled page-scoped.

### Phase L3 - Player/Discover pagination

- Discover players/matchrooms/teams/zones with cursor pagination and server-side search/filter semantics.
- Inbox notifications with cursor pagination and type filters.
- Reports with reporter/status pagination.
- Chat messages with load older/infinite scroll.
- Chatrooms list with conversation digests or paginated per-user conversations.

### Phase L4 - Polish/performance

- Memoized row/card components where lists remain heavy.
- Image/attachment optimization and storage URL caching.
- Segment caching for discover tabs.
- Remove polling where reactive queries or explicit refresh are better.
- Add counters/summaries for badges instead of loading lists.

## 10. Test Cases

| Area | Priority | Test case | Expected result |
|---|---|---|---|
| Schedule classification | P0 | confirmed full paid venue-approved future room | Appears only in `Upcoming` |
| Schedule classification | P0 | future room, user confirmed, not full | Appears only in `Waiting` with lobby-fill state |
| Schedule classification | P0 | future zone room full but not zone-approved | Appears only in `Waiting` with venue approval state |
| Schedule classification | P0 | booking/payment pending tied to room | Appears only in `Waiting` |
| Schedule classification | P0 | completed room | Appears only in `History` |
| Schedule classification | P0 | cancelled/expired room | Appears only in `History` with clear status |
| Schedule classification | P0 | past active room | Appears in `History`, not `Upcoming` |
| Schedule source | P0 | pending inbox notification without matchroom lifecycle row | Does not create Schedule row |
| Schedule source | P0 | resolved report | Does not create History row |
| Dedupe | P0 | same room hosted and joined | Single card rendered |
| Pagination load-more | P0 | Schedule > initial page | All pages load without omissions |
| Pagination load-more | P0 | page boundary with equal timestamps | No duplicate IDs |
| Server search/filter | P0 | matching user/room/payment exists beyond first old cap | Search/filter finds it after pagination work |
| Empty states | P1 | no rows in tab | Tab-specific empty state shown |
| Empty states | P1 | filters hide non-empty tab | Filtered empty state shown |
| Large dataset performance | P0 | 1k rooms/intents or 1k admin rows | Query stays bounded; UI remains responsive |
| Zone admin scoping | P0 | zone admin owns Zone A, Zone B has similar data | Zone A admin never sees Zone B rows |
| Super admin filters | P0 | users/zones/reports beyond first page | Filters are complete across dataset |
| Super admin payments | P0 | payment order/ref beyond scan window | Exact search finds it |
| Discover search | P0 | player beyond first 300 | Search finds it |
| Chat pagination | P1 | older messages beyond initial page | Load older retrieves stable ordered messages |
| Access/auth | P0 | unauthenticated or wrong role | Query rejects and returns no partial data |

Existing test tooling gap:

- `package.json` has no `test` script.
- No Jest/Vitest/Detox/Playwright test config was found in the audited app context.
- Dev dependencies include `react-test-renderer` and `typescript`, but not `vitest`, `convex-test`, or `@edge-runtime/vm`.

Recommended future test tooling:

- Convex query tests with `convex-test` for schedule classification, zone scoping, discover search caps, and admin server filters.
- UI/component tests for Schedule tabs, empty states, duplicate suppression, and load-more behavior.
- Pagination contract tests for cursor continuity, stable sort, no duplicate IDs, and beyond-first-page search results.

## 11. Final Recommendation

Implement Phase S1 first: Schedule correction. It is the clearest user-facing correctness issue because the page currently presents generic notifications and reports as schedule content.

After Schedule is corrected, implement Phase L1 immediately, starting with:

- Zone Admin matchrooms/booking queue pagination and polling reduction.
- User Schedule/My Matchrooms user-scoped pagination.
- Wallet transaction pagination.
- Super Admin dashboard counters.

Reasoning: Schedule fixes the product semantics; L1 fixes the highest-risk backend/list correctness paths that can create missing records, false filters, and high read load as data grows.
