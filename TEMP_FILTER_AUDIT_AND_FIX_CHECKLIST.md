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
- [ ] Add Reset to Zone Admin Bookings Requests filter drawer.
- [ ] Add Reset to Zone Admin Bookings Matchrooms filter drawer.
- [ ] Standardize notification tab wording where safe.
- [ ] Standardize reports/support status wording where safe.
- [ ] Standardize matchroom status labels where possible without changing logic.
- [ ] Do not change backend filters.
- [ ] Do not add new filters.
- [ ] Run TypeScript.
- [ ] Manual check Reset/Done behavior.

## Phase 2 — Player Filter Cleanup
- [ ] Wallet transaction filters.
- [ ] My Matchrooms filters.
- [ ] Inbox type filter.
- [ ] Schedule status simplification.
- [ ] Discover basic vs advanced grouping.

## Phase 3 — Zone Admin Filter Cleanup
- [ ] Bookings Branch filter.
- [ ] Bookings Date Range filter.
- [ ] Bookings Payment Status filter.
- [ ] Bookings Booking Source filter.
- [ ] Resources status consistency.
- [ ] Pricing Date Range and Status naming.

## Phase 4 — Super Admin Filter Cleanup
- [ ] Payments Date Range.
- [ ] Payments Amount Range.
- [ ] Payments Reconciliation Flag.
- [ ] Withdrawals Status/Date/Amount/Zone.
- [ ] Users Account Status and KYC Status.
- [ ] Zones Search and Pilot Status.
- [ ] Support Priority and Category.
- [ ] Matchrooms Game/Date/Payment/Result filters.

## Phase 5 — Backend / Index Improvements
- [ ] Review heavy frontend filtering.
- [ ] Identify where backend filters are needed.
- [ ] Add indexes only after approval.

## Phase 6 — QA
- [ ] Small phone.
- [ ] Samsung A32.
- [ ] Large Android.
- [ ] iPhone with home indicator.
- [ ] Filter drawer scrolling.
- [ ] Chip wrapping.
- [ ] Reset / Done buttons.
- [ ] Active filter count.
- [ ] Empty states.

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
- Deferred decisions / follow-ups:
  - Notifications tabs: `pending/resolved` are backend-driven and do not map cleanly to `Unread/All` labels without changing semantics; revisit in Phase 2/3.
  - Reports/support “Reviewed” label: appears to mean “triaged” (distinct state), not “In Review”; do not rename without product decision.
  - Matchroom status label unification: defer to Phase 4 to avoid broad label/mapping changes.
