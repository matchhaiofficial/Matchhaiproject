# TEMP — Super Admin UI Consistency Checklist

## Context

We are standardizing the Super Admin UI to match the existing User/Player module design language.

Current issues:
- Super Admin pages are functional but visually inconsistent.
- Some inner pages are missing consistent back arrow + title.
- Some list pages have poor spacing between header/search/tabs/list.
- Filter sheets/drawers have title clipping, poor safe-area handling, and inconsistent footer spacing.
- Dashboard has too many quick action cards.
- Matchroom/Lobby Details page needs a proper admin-focused operational purpose.
- Bottom tab overlap/list bottom padding needs review.

Important constraints:
- Do not change business logic.
- Do not touch backend.
- Do not modify Broadcast Marketplace phases.
- Do not redesign Player/User module.
- Use Player/User module only as the reference design system.
- Keep Super Admin admin-focused.

## Reference patterns to reuse

- Screen wrapper: `src/components/Screen.tsx`
- Headers: `src/components/AppHeader.tsx`
- Cards: `AppCard` / `AppPrimitives`
- Status badges: `StatusPill`
- Segmented tabs: `SegmentedTabs`
- Filter/drawer primitives: `AppModalPrimitives`
- Sidebar/drawer: `SidebarMenu`
- Bottom tab clearance: `useTabBarClearance`
- Empty states: `AdminEmptyStateCard` or one chosen admin empty-state standard

---

## Phase 1 - Shared Super Admin UI Standards / Components

Goal:
Create or standardize lightweight shared admin UI patterns before rewriting screens.

Sub-tasks:
- [x] Audit existing shared primitives used by Super Admin.
- [x] Decide whether to create thin admin wrappers or reuse existing components directly.
- [x] Create/standardize `AdminPageHeader` if needed.
- [x] Create/standardize `AdminSearchFilterBar` if needed.
- [x] Create/standardize `AdminEmptyState` if needed.
- [x] Create/standardize `AdminStatusBadge` if needed.
- [x] Create/standardize `AdminFilterDrawer` if needed.
- [x] Document standard page spacing rules.
- [x] Document standard list/card rules.
- [x] Document standard bottom tab clearance rules.
- [x] Run `npx tsc --noEmit`.
- [ ] Manual UI check on at least one small Android screen.

Expected files:
- `src/components/AdminSurface.tsx`
- `src/components/AdminSurface.styles.ts`
- `src/components/AppHeader.tsx`
- `src/components/AppModalPrimitives.tsx`
- `src/hooks/useTabBarClearance.ts`
- Or new small admin components if required.

Files actually changed:
- `src/components/AdminSurface.tsx`
- `src/components/AdminSurface.styles.ts`
- `TEMP_SUPER_ADMIN_UI_CONSISTENCY_CHECKLIST.md` (tracking only; do not include in a production commit unless approved)

Decisions:
- Use existing shared primitives as the base instead of creating a new design system.
- Prefer thin admin wrappers only where they enforce consistency and reduce repeated screen code.
- Keep Phase 1 small: shared component standards only, no screen rewrites except tiny compile-proof usage if needed.
- `AdminPageHeader` is a thin `AppHeader` wrapper for Super Admin inner pages.
- `AdminSearchFilterBar` uses 48px dark card controls, `AppIcon` search/filter icons, and renders search-only when no filter handler is provided.
- `AdminEmptyState` reuses `AdminEmptyStateCard`; no new empty-state design.
- `AdminStatusBadge` wraps `StatusPill` with `caps=true` by default.
- `AdminFilterDrawer` composes `AppDrawer`, `AppModalHeader`, `AppModalBody`, `AppModalFooter`, and `AppButton`.
- Filter drawer top padding uses safe-area insets so titles do not clip under Android status bars.
- Filter drawer footer relies on `AppModalFooter` for bottom safe-area padding; footer rows should not add extra bottom padding.
- List/card standard remains existing `AppCard`, `AdminListCard`, and `AdminEmptyStateCard` patterns; no competing card system.
- Bottom tab clearance standard: list/scroll content should use `useTabBarClearance(extra?)` for bottom padding in later screen migrations.

Handoff summary:
- Status: Phase 1 shared wrapper implementation complete; screen migration deferred.
- Files changed: `src/components/AdminSurface.tsx`, `src/components/AdminSurface.styles.ts`, `TEMP_SUPER_ADMIN_UI_CONSISTENCY_CHECKLIST.md`.
- New components: `AdminPageHeader`, `AdminSearchFilterBar`, `AdminEmptyState`, `AdminStatusBadge`, `AdminFilterDrawer`.
- Screens touched: none yet.
- Tests run: `npx tsc --noEmit` passed.
- Known issues: existing Super Admin screens still use local search/filter/drawer implementations until later phases; manual Android UI check not run in this pass.
- Next phase starting point: update the dashboard to consume `AdminPageHeader`, shared card/list standards, and relevant wrappers without changing business logic.

---

## Phase 2 - Super Admin Dashboard Cleanup

Goal:
Clean dashboard hierarchy and reduce Quick Actions to only 4 cards.

Approved Quick Actions:
1. Payments
2. Withdrawals
3. Reports
4. Zones

Sub-tasks:
- [x] Update dashboard Quick Actions to only 4 cards.
- [x] Move remaining tools to drawer/sidebar or "More admin tools".
- [x] Keep badges consistent in size and placement.
- [x] Ensure dashboard cards use consistent spacing.
- [x] Ensure dashboard top card hierarchy is clean.
- [x] Check drawer/sidebar access for removed quick actions.
- [x] Check bottom tab spacing.
- [x] Run `npx tsc --noEmit`.
- [ ] Manual check dashboard on small Android screen.

Expected files:
- `app/super-admin/(tabs)/index.tsx`
- `app/super-admin/(tabs)/index.styles.ts`
- Drawer/sidebar component if needed.

Files actually changed:
- `app/super-admin/(tabs)/index.tsx`
- `app/super-admin/(tabs)/index.styles.ts`
- `TEMP_SUPER_ADMIN_UI_CONSISTENCY_CHECKLIST.md` (tracking only; do not include in a production commit unless approved)

Handoff summary:
- Status: Phase 2 dashboard cleanup implemented.
- Files changed: `app/super-admin/(tabs)/index.tsx`, `app/super-admin/(tabs)/index.styles.ts`, `TEMP_SUPER_ADMIN_UI_CONSISTENCY_CHECKLIST.md`.
- Quick Actions final list: Payments, Withdrawals, Reports, Zones.
- More tools location: Matchrooms, Notifications, Support Tickets, Users, Identity Verifications, and Audit Logs remain accessible from `SidebarMenu`; the dashboard header hamburger and Quick Actions `More` action both open the existing sidebar.
- Standards applied: `AdminPageHeader`, `AdminQuickActionCard`, `AdminMetricCard`, `AdminStatusBadge`; dashboard scroll bottom padding continues to use `useTabBarClearance(SPACING.lg)`.
- Tests run: `npx tsc --noEmit` passed.
- Known issues: manual small Android dashboard check not run in this pass.
- Next phase starting point: Phase 3 list pages, starting with Payments/Withdrawals/Reports spacing, search/filter wrappers, and bottom tab clearance.

---

## Phase 3 - Super Admin List Page Consistency

Goal:
Standardize layout, spacing, cards, empty states, and bottom padding across list pages.

Screens:
- Payments
- Withdrawals
- Reports
- Users
- Identity Verifications
- Audit Logs
- Zones
- Notifications
- Support Tickets
- Matchrooms

Sub-tasks:
- [x] Payments: fix bottom tab clearance and list spacing.
- [x] Withdrawals: add consistent inner-page header/back button if needed.
- [ ] Reports: remove/relocate "View Support Tickets" card.
- [x] Reports: standardize search/filter/tabs/list spacing.
- [x] Users: standardize card density and spacing.
- [x] Identity Verifications: tone down reason styling and standardize IDs/statuses.
- [x] Audit Logs: standardize list card layout.
- [x] Zones: verify spacing and empty states.
- [x] Notifications: use `SegmentedTabs` instead of custom tab buttons if safe.
- [x] Support Tickets: standardize empty state and spacing.
- [x] Matchrooms: make cards more compact and align with admin list pattern.
- [x] Add bottom padding using `useTabBarClearance` where needed.
- [x] Run `npx tsc --noEmit`.
- [ ] Manual check all list pages on small Android screen.

Expected files:
- `app/super-admin/(tabs)/payments.tsx`
- `app/super-admin/(tabs)/reports.tsx`
- `app/super-admin/withdrawals.tsx`
- `app/super-admin/users.tsx`
- `app/super-admin/identity-verifications.tsx`
- `app/super-admin/audit-logs.tsx`
- `app/super-admin/zones.tsx`
- `app/super-admin/notifications.tsx`
- `app/super-admin/support-tickets.tsx`
- `app/super-admin/matchrooms.tsx`
- Shared admin styles/components if needed.

Files actually changed:
- `app/super-admin/(tabs)/payments.tsx`
- `app/super-admin/withdrawals.tsx`
- `app/super-admin/(tabs)/reports.tsx`
- `app/super-admin/users.tsx`
- `app/super-admin/identity-verifications.tsx`
- `app/super-admin/audit-logs.tsx`
- `app/super-admin/zones.tsx`
- `app/super-admin/notifications.tsx`
- `app/super-admin/support-tickets.tsx`
- `app/super-admin/matchrooms.tsx`
- `TEMP_SUPER_ADMIN_UI_CONSISTENCY_CHECKLIST.md` (tracking only; do not include in a production commit unless approved)

Per-screen wrapper adoption:
- Payments: `AdminPageHeader`, `AdminSearchFilterBar`, `AdminFilterDrawer`, `AdminListCard`, `AdminEmptyStateCard`, and `useTabBarClearance(SPACING.lg)`. Expand/collapse details remain on the same row press handler.
- Withdrawals: `AdminPageHeader` with back button, existing `AdminListCard` rows, existing approve/reject drawer unchanged, and `useTabBarClearance(SPACING.lg)`.
- Reports: `AdminPageHeader`, `AdminSearchFilterBar`, `AdminFilterDrawer`, `AdminListCard`, `AdminEmptyStateCard`, `SegmentedTabs`, and `useTabBarClearance(SPACING.lg)`. The support tickets link card was preserved to avoid removing an existing action.
- Users: `AdminPageHeader`, `AdminSearchFilterBar`, existing `AdminListCard` rows, `SegmentedTabs`, `AdminEmptyStateCard`, and `useTabBarClearance(SPACING.lg)`.
- Identity Verifications: `AdminPageHeader`, `AdminSearchFilterBar`, `AdminFilterDrawer`, `AdminStatusBadge`, `AdminEmptyStateCard`, and `useTabBarClearance(SPACING.lg)`. The complex verification card stayed on `AppCard` to preserve manual review layout/actions.
- Audit Logs: `AdminPageHeader`, `AdminSearchFilterBar`, `AdminFilterDrawer`, `AdminListCard`, `AdminEmptyStateCard`, and `useTabBarClearance(SPACING.lg)`.
- Zones: `AdminPageHeader`, `AdminListCard`, `SegmentedTabs`, `AdminEmptyStateCard`, and `useTabBarClearance(SPACING.lg)`.
- Notifications: `AdminPageHeader`, `SegmentedTabs`, `AdminListCard`, `AdminEmptyStateCard`, and `useTabBarClearance(SPACING.lg)`.
- Support Tickets: `AdminPageHeader`, `AdminSearchFilterBar`, `AdminListCard`, `AdminStatusBadge`, `SegmentedTabs`, `AdminEmptyStateCard`, and `useTabBarClearance(SPACING.lg)`.
- Matchrooms: `AdminPageHeader`, `AdminSearchFilterBar`, `AdminFilterDrawer`, `AdminListCard`, `AdminInfoLine`, `AdminEmptyStateCard`, and `useTabBarClearance(SPACING.lg)`.

Layout tradeoffs:
- Reports keeps the "View Support Tickets" card in place because it is an existing navigation action, not a filter/list row.
- Identity Verification keeps its existing complex `AppCard` body because manual review inputs and status check grids do not fit cleanly into a compact list-card conversion.
- Withdrawals keeps the existing approve/reject detail drawer because it is an action drawer, not a filter drawer.
- Dense metadata was moved into `AdminInfoLine` where it reduced custom text rows without changing data shown.

Handoff summary:
- Status: Phase 3 implementation complete.
- Files changed: listed above.
- Screens fixed: Payments, Withdrawals, Reports, Users, Identity Verifications, Audit Logs, Zones, Notifications, Support Tickets, Matchrooms.
- Screens partially deferred: Reports support ticket link card kept; Identity Verification card body kept on `AppCard`; Withdrawals action drawer kept as-is.
- Tests run: `npx tsc --noEmit` passed.
- Known issues: manual small Android screen check not run in this pass.
- Next phase starting point: Phase 4 filter sheet consistency should audit any remaining non-filter action drawers separately from `AdminFilterDrawer` filter sheets, especially action-heavy drawers like Withdrawals.

---

## Phase 4 - Filter Sheet / Drawer Consistency

Goal:
Make all Super Admin filters use one consistent safe-area-aware filter sheet/drawer standard.

Sub-tasks:
- [x] Identify all Super Admin filter sheets/drawers.
- [x] Standardize header title and close button placement.
- [x] Add safe-area top padding to avoid title clipping.
- [x] Use scrollable body for filter content.
- [x] Use fixed footer with Reset + Done.
- [x] Remove excessive footer/bottom empty space.
- [x] Ensure chips/pills styling is consistent.
- [x] Ensure Reset disabled state is consistent.
- [x] Ensure Done button is primary and aligned.
- [x] Test filters on:
  - Payments
  - Reports
  - Matchrooms
  - Identity Verifications
  - Audit Logs
  - Users if applicable
- [x] Run `npx tsc --noEmit`.
- [ ] Manual small-screen check.

Expected files:
- `app/super-admin/(tabs)/payments.tsx`
- `app/super-admin/(tabs)/reports.tsx`
- `app/super-admin/matchrooms.tsx`
- `app/super-admin/identity-verifications.tsx`
- `app/super-admin/audit-logs.tsx`
- Shared filter/drawer components.

Files actually changed:
- `app/super-admin/matchrooms.tsx`
- `TEMP_SUPER_ADMIN_UI_CONSISTENCY_CHECKLIST.md`

Handoff summary:
- Status: Phase 4 implementation complete.
- Files changed: `app/super-admin/matchrooms.tsx`, `TEMP_SUPER_ADMIN_UI_CONSISTENCY_CHECKLIST.md`.
- Filter sheets standardized:
  - Payments: `AdminSearchFilterBar` opens `AdminFilterDrawer`; badge count remains `kind/status`; subtitle uses `activeFilterCount`; Reset restores `Any` filters and stays open; Done/X close only; safe-area handled by shared drawer/header/footer primitives.
  - Reports: `AdminSearchFilterBar` opens `AdminFilterDrawer`; badge count remains `typeFilter`; subtitle uses `activeFilterCount`; Reset restores `Any` and stays open; Done/X close only; safe-area handled by shared drawer/header/footer primitives.
  - Matchrooms: `AdminSearchFilterBar` opens `AdminFilterDrawer`; badge count remains lifecycle filter active state; subtitle now uses `activeFilterCount`; Reset restores `Any` and stays open; Done/X close only; safe-area handled by shared drawer/header/footer primitives.
  - Identity Verifications: `AdminSearchFilterBar` opens `AdminFilterDrawer`; badge count remains `statusFilter/roleFilter`; subtitle uses `activeFilterCount`; Reset restores `all` filters and stays open; Done/X close only; safe-area handled by shared drawer/header/footer primitives.
  - Audit Logs: `AdminSearchFilterBar` opens `AdminFilterDrawer`; badge count remains `admin/status/action/module`; subtitle uses `activeFilterCount`; Reset restores all filters to `all` and stays open; Done/X close only; safe-area handled by shared drawer/header/footer primitives.
- Explicit exclusion: `app/super-admin/withdrawals.tsx` keeps its existing `AppDrawer` because it is an approve/reject action detail drawer, not a filter drawer.
- Tests run: `npx tsc --noEmit` passed.
- Known issues: Manual Android and iOS device smoke checks were not run in this pass.
- Next phase starting point: Phase 5 should begin with the Super Admin matchroom detail route and compare it against the player matchroom detail flow before adding admin-only operational sections.

---

## Phase 5 - Super Admin Matchroom / Lobby Details

Goal:
Rebuild or refine the Super Admin Matchroom/Lobby Details page into a useful operational review page.

Purpose:
Super Admin should be able to review a matchroom/lobby operationally:
- who is in the lobby
- teams/slots
- payment status
- zone/booking state
- broadcast/direct state
- chat preview
- reports/disputes
- result/completion state
- admin-safe linked actions

Sub-tasks:
- [x] Audit existing Super Admin matchroom/lobby details route.
- [x] Compare with user/player matchroom details page.
- [x] Define admin-focused sections.
- [x] Add consistent header/back/title/status badge.
- [x] Add summary section:
  - game
  - schedule
  - format
  - zone/location
  - host
  - player count
  - payment status
- [x] Add teams/players section:
  - Team A / Team B
  - slots
  - host/captain labels
  - payment/verification flags if available
- [x] Add booking/zone section:
  - direct/broadcast mode
  - zone approval state
  - confirmed zone/branch
  - offer/counter-offer history if available
- [x] Add payments section:
  - paid/held/refunded/captured
  - references if safe
- [x] Add chat review section:
  - read-only recent messages preview
  - link to full chat review only if supported
- [x] Add reports/disputes section:
  - linked reports
  - result verification/dispute state
- [x] Add safe admin actions only:
  - view audit log
  - open linked report/ticket
  - no risky cancel/force action unless backend already supports it
- [x] Run `npx tsc --noEmit`.
- [ ] Manual check with:
  - full matchroom
  - incomplete matchroom
  - broadcast matchroom
  - direct zone matchroom
  - completed/disputed matchroom if available.

Expected files:
- `app/super-admin/matchroom/[id].tsx`
- `TEMP_SUPER_ADMIN_UI_CONSISTENCY_CHECKLIST.md`

Files actually changed:
- `app/super-admin/matchroom/[id].tsx`
- `TEMP_SUPER_ADMIN_UI_CONSISTENCY_CHECKLIST.md`

Handoff summary:
- Status: Phase 5 implementation complete.
- Files changed: `app/super-admin/matchroom/[id].tsx`, `TEMP_SUPER_ADMIN_UI_CONSISTENCY_CHECKLIST.md`.
- Sections implemented:
  - Overview: title, lifecycle badge, description, game, schedule, scheduled start, raw status, location, zone, host.
  - Teams & players: current/max players, slot data availability, Team A slots, Team B slots, player fallback list when slots are missing.
  - Booking / venue: mode, broadcast request, zone approval, confirmed zone/branch, venue confirmation, offer/counter-offer, lock state when fields are present.
  - Payments: payment status badge, payment status, safe pricing summary, held/captured/refunded, booking intent, venue payout when fields are present.
  - Chat review: explicit read-only unavailable state because no Super Admin-safe chat preview API is exposed in the current detail payload.
  - Reports & disputes: linked reports count/statuses via existing Super Admin reports API, result verification status, admin-review flag.
  - Result / completion: lifecycle, completion status, result verification, available linked issue signal.
  - Metadata: match code, route matchroom ID, created, updated.
- Fields available:
  - `title`, `description`, `game`, `status`, `lifecycleStatus`, `paymentStatus`, `zoneAdminApproved`, `broadcastRequestStatus`, `resultVerificationStatus`, `scheduledDate`, `scheduledTime`, `scheduledStartAt`, `currentPlayers`, `maxPlayers`, `hostName`, `hostUserName`, `matchCode`, `createdAt`, `updatedAt`, `zoneName`, `players`, `slotsA`, `slotsB`, `pricing`.
  - Slot-level fields available when present: `slotId`, `status`, `uid`, `user.username`, `reservedFor.username`, `role`, `skillTier`.
- Fields missing:
  - `locationMode`, confirmed zone/branch display labels, `venueConfirmedAt`, lock timestamps/state, offer/counter-offer status, full result verification payload, chat preview messages, booking intent/payment transaction summaries, venue payout status.
- Backend follow-ups:
  - Add a Super Admin-safe matchroom chat preview API for latest read-only messages.
  - Add linked reports/disputes summary directly to the matchroom detail payload.
  - Add full result/completion verification details for admin review.
  - Add booking/venue operational fields to the Super Admin detail payload.
  - Add safe payment summaries without raw provider/payment payloads.
- Status/badge handling notes: lifecycle and payment badges use existing labels/status strings with display-only tone mapping; no state semantics changed.
- Safe-area notes: screen stays inside shared `Screen`; header uses `AdminPageHeader`; bottom scroll padding remains `SPACING.xxl`.
- Risky admin actions: none added; disabled Flag/Cancel placeholder removed.
- Tests run: `npx tsc --noEmit` passed.
- Known issues: manual Android/iOS device smoke checks not run yet.
- Next phase starting point: Phase 6 should do final Super Admin QA across detail/list surfaces, with special attention to support-ticket and report detail pages for consistent `AdminPageHeader` + section primitive usage.

---

## Phase 6 - QA Pass

Goal:
Final visual consistency QA across all Super Admin screens.

Sub-tasks:
- [ ] Dashboard quick actions show exactly 4 cards.
- [ ] Drawer/sidebar works and has all secondary tools.
- [ ] All inner pages have back arrow + title.
- [ ] All list pages have consistent header/search/tabs/list spacing.
- [ ] No list is hidden behind bottom tab bar.
- [ ] All filter sheets have safe-area-aware header/footer.
- [ ] Empty states are consistent.
- [ ] Status badges are consistent.
- [ ] Matchroom detail has a clear admin use case.
- [ ] No business logic changed.
- [ ] No backend files changed.
- [ ] Run `npx tsc --noEmit`.
- [ ] Manual small Android screen check.
- [ ] Optional screenshots/video for final review.

Handoff summary:
- Status:
- Final files changed:
- QA result:
- Known remaining issues:
- Recommended next work:

---

## Global Rules

- Do not delete this file without asking me first.
- Do not include this file in a production commit unless I approve.
- Keep it updated after every phase.
- If Codex chat context becomes full, continue from this file in the next chat.
- Do not modify backend.
- Do not change business logic.
- Do not touch Broadcast Marketplace phases.
- Do not redesign Player/User module.
