# MatchHai — Dashboard Header / Tabs / Key Warning Fix

Branch: `product-ready`

## Scope
Focused UI/navigation cleanup batch:
- Clean Player Dashboard header (remove friends + logout icons; move Logout to sidebar).
- Clean Zone Admin Dashboard header (remove logout icon; Logout already in sidebar).
- Rename Player Dashboard Quick Action "Inbox" → "Chat with friends" (navigates to friends).
- Tabs + filter button on one row (Inbox).
- Fix React unique "key" warning in `MatchroomPendingRequestsPanel`.

Out of scope (untouched):
- Wallet / payments / Easypaisa / IPN / finalize.
- Payout formula, ELO, KYC provider logic.
- Auth/security hardening, reports/moderation behavior.
- Backend Convex schema/codegen.

## Files inspected
- `app/(player)/(tabs)/index.tsx`
- `src/components/SidebarMenu.tsx`
- `src/theme/icons.ts`
- `app/zone/(tabs)/index.tsx`
- `app/(player)/inbox.tsx`
- `app/(player)/inbox.styles.ts`
- `app/(player)/schedule.tsx`
- `app/(player)/reports.tsx`
- `app/zone/modules/bookings.tsx`
- `app/matchrooms/my.tsx`
- `app/matchrooms/[id].tsx`
- `app/matchrooms/hooks/useMatchroomDetailState.ts`
- `app/matchrooms/components/MatchroomPendingRequestsPanel.tsx`

## Files changed
- `app/(player)/(tabs)/index.tsx`
- `app/zone/(tabs)/index.tsx`
- `app/(player)/inbox.tsx`
- `app/(player)/inbox.styles.ts`
- `app/matchrooms/components/MatchroomPendingRequestsPanel.tsx`

## Task 1 — Player Dashboard header
Removed from the right-action row:
- Friends (`players`) icon + friend badge.
- Logout icon.
Kept:
- Hamburger / menu (left).
- Notification bell with unread badge (right).
The sidebar (kyc-allowed branch) now contains a `Logout` item that calls `handleLogout`. The locked (non-kyc) sidebar branch already had Logout — unchanged. SidebarMenu styles the last item as a danger action automatically when its label includes "logout".

## Task 2 — Zone Admin Dashboard header
Removed the logout `Pressable` from `rightAction`. Notification bell + unread badge preserved.
Sidebar already exposed `Logout` in both kyc-verified and non-verified branches — no sidebar change required.

## Task 3 — Quick Action "Chat with friends"
`app/(player)/(tabs)/index.tsx` Quick Actions grid: replaced the `Inbox` tile with:
- label: `Chat with friends`
- icon: `chat` (already mapped to lucide `MessageCircle` in `src/theme/icons.ts`)
- target: `router.push("/(player)/friends")`
The `/(player)/inbox` route is still reachable from the notification bell, the existing route, and `DashboardAtGlancePanel.requestsOnPress`.

## Task 4 — Tabs + filter on one row
`app/(player)/inbox.tsx`:
- Wrapped `SegmentedTabs` + filter button in a new `tabsFilterRow` (flexDirection: row, alignItems: center).
- SegmentedTabs given `tabsInRow` style (`flex: 1, minWidth: 0`) so tabs occupy remaining space and never wrap the filter button to a second line.
- Filter button kept at fixed `48x48`.
- The previous "X of Y notifications" summary text moved to a small `filterSummaryRow` below — it was the element that pushed the filter button to its own row before.

Other audit results:
- `app/(player)/schedule.tsx`: filter button is on the search-bar row (separate from tabs). No wrapping issue. No change.
- `app/(player)/reports.tsx`: tabs only, no filter button. No change.
- `app/matchrooms/my.tsx`: filter button on the search-bar row, tabs on a separate row. No wrapping issue. No change.
- `app/zone/modules/bookings.tsx`: SegmentedTabs alone — no adjacent filter button. No change.

## Task 5 — MatchroomPendingRequestsPanel key warning
Root cause: data items come from `useMatchroomDetailState.incomingRequests`, which preserves Convex docs and tracks them by `_id ?? id`. The panel mapped with `key={req.id}`. When `id` was undefined (Convex records expose `_id`), every key became `undefined`, producing the React warning when more than one request was present.

Fix in `app/matchrooms/components/MatchroomPendingRequestsPanel.tsx`:
- Widened the `PendingRequest` type to include optional `_id`, `fromUid`, `matchroomId`, `notificationId`.
- Added `getRequestKey(req, index)` which prefers `_id`, then `id`, then `notificationId`, then `${matchroomId}:${fromUid}`, then `uid:${fromUid}`, and finally a deterministic positional fallback so React always sees a defined unique key.
- Used `getRequestKey(req, index)` as the `AppCard` key. Approve/Reject actions, processingRequestId comparison (`processingRequestId === req.id`), styles, and props all unchanged.

## Validation
- `npx tsc -p tsconfig.json --noEmit` → exit 0 (clean).
- `git diff --check` → exit 0 (only a Windows CRLF/LF warning, no whitespace errors).
- Codegen NOT run — frontend-only change, no Convex schema/API touched.
- No EAS build, no deploy, no push.

## Known risks
- Removing the header friends icon means the friend-request unread count no longer shows on the player home header. It is still reachable via the "Chat with friends" quick action and the "My Friends" sidebar item; the badge surface is unchanged.
- The locked (non-KYC) sidebar branch still ends with `Logout` (existing behavior); the new KYC-allowed branch now also ends with `Logout`. `SidebarMenu` styles the last item as a danger row only when the label includes "logout" — matched in both branches.
- Inbox: the secondary "X of Y notifications" line now renders below the tabs/filter row instead of inline beside the filter button. Filter drawer + Reset/Done logic unchanged.

## Manual QA checklist
- [ ] Player Dashboard header: no friends icon, no logout icon, bell badge visible when unread > 0.
- [ ] Open sidebar from hamburger; "Logout" appears at bottom (danger-styled); tapping it signs out.
- [ ] Bell still routes to `/(player)/inbox`.
- [ ] Quick Actions: "Chat with friends" tile shows the chat (MessageCircle) icon; tap routes to `/(player)/friends`.
- [ ] Inbox screen: SegmentedTabs (Pending/History) and the filter button render on a single row; filter button stays right-aligned; the row does not wrap on a small Android.
- [ ] Inbox filter drawer still opens; Reset/Done still work; badge count shows when active.
- [ ] Open a matchroom as host with ≥ 2 pending join requests — no "Each child in a list should have a unique key prop" warning. Approve and Reject still work; loading spinner still appears on the row being processed.
- [ ] Zone Admin Dashboard header: no logout icon; bell + badge still work.
- [ ] Zone Admin sidebar still contains Logout; tapping signs out.

## Recommended commit message
```
fix(ui): clean dashboard headers and pending request keys
```
