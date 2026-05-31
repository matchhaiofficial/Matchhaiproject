# MatchHai Zone Profile / Withdrawals / Super Admin Fix Tracker

Date: 2026-05-27

## Scope

- Fix Zone Admin Profile KYC/profile layout issues.
- Add an in-modal success state after Zone Admin withdrawal request submission.
- Make Super Admin withdrawal rows visibly actionable while preserving the existing detail drawer and approve/reject flow.
- Add a Super Admin dashboard notification bell and badge using existing summary badge data.
- Do not change payout math, wallet movement, Easypaisa/IPN/finalize logic, Convex schema/API, finance analytics, or withdrawal backend approve/reject behavior.

## Files Inspected

- `convex/_generated/ai/guidelines.md`
- `app/zone/(tabs)/profile.tsx`
- `app/zone/(tabs)/profile.styles.ts`
- `app/super-admin/withdrawals.tsx`
- `app/super-admin/(tabs)/index.tsx`
- `app/super-admin/(tabs)/index.styles.ts`
- `app/super-admin/notifications.tsx`
- `app/super-admin/_layout.tsx`
- `src/components/AdminSurface.tsx`
- `src/components/AppPrimitives.tsx`
- `src/components/AppModalPrimitives.tsx`
- `src/hooks/useToast.ts`
- `src/services/convex/superAdminService.ts`

## Root Cause

- Zone Profile reused the centered profile card layout for the KYC verification card.
- The KYC title/subtitle column had no shrinking constraints and the status pill sat in a non-wrapping row, so small Android widths could push content outside the card.
- Withdrawal success feedback depended on a bottom toast and immediately closed the modal, which could look like a silent close when the toast was hidden behind bottom chrome.
- Super Admin withdrawal rows already had a detail drawer tap handler, but the row did not visually advertise the tap action.

## UI Fixes Made

- Added a full-width KYC card mode with dedicated KYC row/text styles.
- KYC title/subtitle now live in a shrinkable text column, and the status pill stays inside a wrapping header row.
- Added small top spacing so the KYC card separates from the main profile card while keeping screen margins consistent.
- Kept Zone Profile business logic and KYC logic unchanged.

## Withdrawal Success Behavior

- Added an in-modal success state after successful withdrawal submission.
- The modal stays open and shows:
  - `Request submitted`
  - submitted amount
  - `Pending` status
  - branch, bank, and masked account
  - Super Admin review message
  - `Done` button
- Submit is blocked while submitting and after the success state is shown.
- Error handling still shows a safe toast and leaves the modal open.

## Super Admin Withdrawal Card / Action Fix

- Preserved the existing withdrawal detail drawer and existing approve/reject service calls.
- Added a visible `View details` affordance with a chevron inside each withdrawal row.
- Pending requests still show approve/reject actions with confirmation and loading state.
- Non-pending requests remain read-only in the detail drawer.
- No full bank account, CNIC, phone, or private data was exposed.

## Super Admin Notification Bell

- Added a bell icon to the Super Admin dashboard header next to logout.
- The bell navigates to `/super-admin/notifications`.
- Badge uses existing `summary.badges.unreadNotifications` and `summary.badges.unreadNotificationsCapped`.
- No duplicate notification system or new query was added.

## Files Changed

- `app/zone/(tabs)/profile.tsx`
- `app/zone/(tabs)/profile.styles.ts`
- `app/super-admin/withdrawals.tsx`
- `app/super-admin/(tabs)/index.tsx`
- `app/super-admin/(tabs)/index.styles.ts`
- `TEMP_MATCHHAI_ZONE_PROFILE_WITHDRAWALS_SUPERADMIN_FIX.md`

## Tests Run

- Passed: `npx tsc -p tsconfig.json --noEmit`
- Passed: `git diff --check`
  - Note: command emitted existing line-ending warnings for several dirty working-tree files, but no whitespace errors.

## Known Risks

- Visual QA still needs device/emulator confirmation for Samsung A32-like dimensions.
- Super Admin withdrawal drawer behavior was already implemented; this batch only adds a visible affordance and should be manually verified on device.

## Manual QA Remaining

- Zone Profile KYC card no longer overlaps/clips on small Android width.
- Zone Profile cards, My Branches, withdraw button, and branch cards align consistently.
- Withdrawal request success state appears in-modal and does not silently redirect.
- Double tapping submit does not create duplicate requests.
- Pending withdrawal appears in Super Admin.
- Super Admin withdrawal row opens detail drawer.
- Pending withdrawal approve/reject still works through existing logic.
- Completed/rejected/failed withdrawal opens read-only.
- Super Admin bell opens notifications.
- Badge appears when existing unread count is available.

## Codegen

- Convex codegen was not run. No Convex schema/API changes were made.
