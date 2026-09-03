# Modal UI Audit and Fix Checklist

Temporary tracking file for the phased modal UI audit and fixes. Do not delete without approval. Do not include in a production commit unless explicitly approved.

## Audit Summary

- The app has shared modal primitives (`AppDialog`, `AppBottomSheet`, `AppDrawer`, `AppModalFooter`), but usage is not fully unified.
- Some flows still use raw `Modal`, custom overlays, `Alert.alert`, third-party overlays, or one-off drawer layouts.
- Highest-risk areas are payment modals, result verification, keyboard/input modals, and filter/action drawers.
- Reported issues include modal content cut off on some screen sizes, footer buttons hidden or unclickable, and close paths blocked during long or pending states.
- Samsung A32 may look fine, but smaller, larger, and home-indicator or gesture-nav devices can still fail.

## Phase Checklist

- [x] Phase 1 - Shared modal foundation
- [x] Phase 2 - Payment/checkout modals
- [x] Phase 3 - Filter drawers
- [x] Phase 4 - Confirmation/action modals
- [x] Phase 5 - Admin/zone action sheets and nested sheets
- [x] Phase 6 - Global Confirm API for Hook/Util Confirmation Prompts
- [ ] Final Device QA - physical/simulator safe-area and keyboard pass

## Modal Inventory Summary

- Shared primitives live in `src/components/AppModalPrimitives.tsx` and styles in `src/components/AppModalPrimitives.styles.ts`.
- `AppDialog` is used by matchroom create, wallet top-up, team challenge flows, in-app alerts, and profile/game activation flows.
- `AppBottomSheet` is used by report issue, registration, invite/suggest/join sheets, result gate, and zone booking sheets.
- `AppDrawer` is used by player filters, admin surfaces, zone module filters, sidebar menu, and withdrawal drawers.
- Non-unified modal surfaces remain for later phases and are intentionally out of scope for Phase 1.

## Decisions

- `AppModalFooter` owns bottom safe-area padding on both iOS and Android.
- `AppDialog` and `AppBottomSheet` wrappers keep only visual spacing and do not duplicate bottom safe-area padding.
- Keyboard-aware modal behavior is opt-in through shared primitive props and is not enabled globally in Phase 1.
- Drawer safe-area handling is future-proofed with an opt-in prop and remains off by default.
- Phase 1 does not change `dismissDisabled`, payment polling, loading states, or any backend code.

## Files Expected

- `TEMP_MODAL_UI_AUDIT_AND_FIX_CHECKLIST.md`
- `src/components/AppModalPrimitives.tsx`
- `src/components/AppModalPrimitives.styles.ts`

## Files Changed

- [x] `TEMP_MODAL_UI_AUDIT_AND_FIX_CHECKLIST.md`
- [x] `src/components/AppModalPrimitives.tsx`
- [x] `src/components/AppModalPrimitives.styles.ts`

## Tests Run

- [x] `npx tsc -p tsconfig.json --noEmit` - passed

## Known Risks

- Shared footer padding can subtly change vertical spacing in many modal callsites.
- Existing callsites with manual bottom padding may still show extra space until later phases remove duplicated caller padding.
- Keyboard-aware mode is only infrastructure in Phase 1; affected input modals need opt-in during Phase 2+.
- Drawer top/bottom safe-area remains caller-managed until Phase 3 to avoid double-padding regressions.

## Phase 1 Handoff Summary

- Shared primitives now support safer footer padding, opt-in keyboard avoidance, shrinkable modal surfaces, and opt-in drawer safe-area wrapping.
- No payment, result verification, drawer callsite, native alert, or backend behavior changed.

## Phase 2 Starting Point

- Start with matchroom create Easypaisa modal.
- Add safe close/recovery behavior for pending/payment_sent/confirmed/completing states without interrupting valid payment completion.
- Apply `keyboardAware` to phone/input payment modals where the keyboard can cover the footer.
- Then fix wallet top-up and team challenge payment modals using the same shared primitive behavior.

## Phase 2 - Payment/Checkout Modals

### Files Changed

- `app/matchrooms/create/index.tsx`
- `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts`
- `app/(player)/wallet.tsx`
- `app/teams/challenge.tsx`
- `app/teams/challenge-create.tsx`
- `TEMP_MODAL_UI_AUDIT_AND_FIX_CHECKLIST.md`

### Modal Flows Fixed

- Matchroom create Easypaisa modal now has `keyboardAware={true}`, a non-destructive `Do this later` action for active long-running states, and an `I've paid / Continue` CTA that uses the existing manual refresh path.
- Matchroom create now shows an active payment banner when an Easypaisa order exists and the modal is hidden. The banner shows current status, `Open payment status`, and `I've paid / Continue`.
- Matchroom create bottom submit CTA opens the active payment status instead of starting a duplicate payment prompt when an order is already active.
- Wallet top-up phone modal now opts into keyboard-aware modal behavior and keeps existing top-up logic unchanged.
- Team challenge accept/create Easypaisa modals now use `keyboardAware={true}` and switch active-order footers to `Do this later` plus `I've paid / Continue`.

### Decisions

- Hiding active payment modals only changes visibility; it does not reset order refs, payment phase, checkout status, polling, reconciliation, wallet math, or navigation.
- Existing dismiss-disabled behavior remains for business-locked modal dismissal; explicit in-UI recovery actions stay available.
- No raw modal, alert, drawer, backend, Convex, payment status, reconciliation, or route behavior was changed.

### Tests Run

- `npx tsc -p tsconfig.json --noEmit` - passed

### Known Risks

- Manual device QA is still needed for exact keyboard behavior on small Android gesture-nav devices and iPhone home-indicator devices.
- If a user leaves the route entirely during an active payment, this phase does not add cross-route recovery; it only adds in-screen recovery while the create/challenge screen remains mounted.
- Matchroom terminal states (`failed`, `expired`) still keep their existing close/reset and retry behavior.

### Phase 3 Starting Point

- Continue with filter drawers and leave payment/result verification surfaces out of Phase 3 unless explicitly approved.
- Watch for duplicated caller padding now that shared footers own bottom safe-area padding.

## Phase 3 - Filter Drawers

### Drawers Checked

- Player Discover filter drawer: `DiscoverFilterDrawer` in `app/(player)/(tabs)/discover.tsx`.
- Super Admin Payments filter drawer: `AdminFilterDrawer` in `app/super-admin/(tabs)/payments.tsx`.
- Super Admin Reports filter drawer: `AdminFilterDrawer` in `app/super-admin/(tabs)/reports.tsx`.
- Super Admin Matchrooms filter drawer: `AdminFilterDrawer` in `app/super-admin/matchrooms.tsx`.
- Super Admin Identity Verifications filter drawer: `AdminFilterDrawer` in `app/super-admin/identity-verifications.tsx`.
- Super Admin Audit Logs filter drawer: `AdminFilterDrawer` in `app/super-admin/audit-logs.tsx`.

### Changes

- Removed the extra `paddingBottom: SPACING.md` from the Discover filter footer row so `AppModalFooter` remains the single owner of bottom safe-area padding.
- Left Super Admin filter drawers unchanged because `AdminFilterDrawer` already uses `AppModalFooter` for Reset/Done and its footer row does not add manual bottom padding or `insets.bottom`.
- Left Withdrawals unchanged because it is an action/detail drawer, not a filter drawer.

### Decisions

- Bottom safe-area handling for filter drawer CTAs is centralized in `AppModalFooter`.
- `AppDrawer` bottom `contentSafeAreaEdges` was not enabled for these filter drawers to avoid duplicating `AppModalFooter` bottom safe-area padding.
- Keyboard-aware drawer mode was not enabled because the approved filter drawer contents are chip-based and do not contain drawer-local text or numeric inputs.
- Filter defaults, selected states, reset behavior, done/apply behavior, query semantics, backend code, and Convex code were not changed.

### Tests Run

- `npx tsc -p tsconfig.json --noEmit` - passed

### Manual Regression Notes

- Player Discover filter drawer: footer now relies on `AppModalFooter` only; Reset/Done behavior unchanged; long segment filter bodies remain in the scroll region.
- Super Admin Payments filter drawer: checked shared `AdminFilterDrawer` footer structure; no extra footer bottom padding found.
- Super Admin Reports/Matchrooms filter drawers: checked shared `AdminFilterDrawer` footer structure; no extra footer bottom padding found.

### Known Risks

- Manual device QA is still needed on physical iOS home-indicator and Android gesture-nav devices to confirm exact tappable area behavior.
- Search bars on the parent screens are outside the filter drawers, so keyboard behavior for parent search remains outside Phase 3.

### Phase 4 Starting Point

- Continue with confirmation/action modals and non-filter action drawers separately.
- Treat Withdrawals and other action-heavy drawers as Phase 4/5 candidates, not filter drawer regressions.

## Phase 4 - Confirmation/Action Modals

### Files Changed

- `app/teams/[id].tsx`
- `app/teams/[id].styles.ts`
- `src/components/ReportIssueModal.tsx`
- `app/matchrooms/components/MatchroomSuggestSheet.tsx`
- `app/matchrooms/components/MatchroomAdminCancelSheet.tsx`
- `app/matchrooms/components/MatchroomJoinTeamSheet.tsx`
- `src/components/GameActivationPromptModal.tsx`
- `src/components/SkillAssessmentModal.tsx`
- `src/components/SkillAssessmentModal.styles.ts`
- `src/features/chat/ChatAttachmentMenu.tsx`
- `TEMP_MODAL_UI_AUDIT_AND_FIX_CHECKLIST.md`

### Modals Touched

- Team role-required sheet, member action dialog, destructive confirmation sheet, and rename action dialog.
- Report issue sheet.
- Matchroom suggest alternative sheet.
- Matchroom admin force-cancel sheet.
- Matchroom join-team action sheet.
- Game activation confirmation dialog.
- Skill assessment setup sheet.
- Chat attachment action sheet.

### Changes

- Kept `AppModalFooter` as the single owner of bottom safe-area padding for CTA/action regions.
- Removed duplicated role-required footer `paddingBottom` and the extra sheet bottom offset in `app/teams/[id].tsx`.
- Converted chat attachment actions from raw `Modal` to `AppBottomSheet` with `AppModalHeader` and `AppModalFooter`.
- Refactored `SkillAssessmentModal` from fixed-height `ScrollView` shell to `AppModalBody scroll` with sticky `AppModalFooter`.
- Kept explicit close/cancel exits enabled during loading/submitting states while primary/destructive actions remain disabled/loading where they already were.

### Decisions

- `dismissDisabled` remains in place for backdrop/back dismissal where already used, but visible Close/Cancel actions remain usable.
- `keyboardAware` was added only to input sheets: `ReportIssueModal`, `MatchroomSuggestSheet`, and `MatchroomAdminCancelSheet`.
- No `keyboardVerticalOffset` or custom keyboard avoid behavior was added.
- No handlers, labels, routes, server calls, state transitions, query semantics, backend code, Convex code, payment modals, or filter drawers were changed.

### Tests Run

- `npx tsc -p tsconfig.json --noEmit` - passed

### Manual Regression Notes

- Team destructive confirmation: footer remains sticky through `AppModalFooter`; Cancel/header close stay available while submit is in progress.
- Report issue sheet: input sheet now opts into keyboard-aware modal behavior; body stays scrollable and footer remains sticky.
- Matchroom suggest/admin cancel sheets: input sheets now opt into keyboard-aware modal behavior; Cancel/header close remain available during processing.
- Chat attachment sheet: Photo/File still call `onClose()` before `onPickImage`/`onPickFile`; actions now sit in the shared footer safe-area region.
- Skill assessment sheet: content scrolls through `AppModalBody scroll`; Save & Continue remains in the sticky footer.

### Known Risks

- Manual device QA is still needed on physical iOS home-indicator and Android gesture-nav devices to verify exact tappable spacing.
- Closing a loading sheet hides the UI but does not cancel the existing background action; this is intentional for Phase 4 and preserves business behavior.
- Team rename was adjusted only for non-trapping close/cancel behavior; it did not receive keyboard-aware mode because it was outside the approved keyboard list.

### Phase 5 Starting Point

- Review Withdrawals and other action-heavy non-filter drawers separately.
- Audit remaining raw `Alert.alert` and native `Modal` usages that are informational or outside the Phase 4 targeted surfaces.
- Consider a broader policy for edit/input modals such as team rename if keyboard behavior should be standardized beyond confirmation/action surfaces.

## Phase 5 - Action-heavy Admin/Zone Drawers and Confirmation Surfaces

### Files Changed

- `app/super-admin/withdrawals.tsx`
- `app/zone/modules/pricing.tsx`
- `app/zone/modules/notifications.tsx`
- `app/zone/modules/migration-tools.tsx`
- `app/super-admin/request/[id].tsx`
- `app/zone/(tabs)/profile.tsx`
- `app/super-admin/(tabs)/profile.tsx`
- `app/super-admin/(tabs)/index.tsx`
- `TEMP_MODAL_UI_AUDIT_AND_FIX_CHECKLIST.md`

### Surfaces Fixed

- Super Admin Withdrawals drawer: approve/reject prompts now use local `AppDialog`; drawer opts into `keyboardAware` because it contains the reject reason `TextInput`.
- Zone Pricing delete rule: native delete confirmation replaced with `AppDialog`; confirm still calls the same `deleteZonePricingRule` flow.
- Zone Notifications clear/mark all: native confirmation replaced with `AppDialog`; title, message, and confirm label still follow pending vs history state.
- Zone Migration Tools run migration: native confirmation replaced with `AppDialog`; Retry vs Run Migration label logic and migration service flow are preserved.
- Super Admin Request approval: native approval confirmation replaced with `AppDialog`; confirm closes the dialog and runs the same `approveZone` flow.
- Zone and Super Admin logout prompts: native logout confirmations replaced with `AppDialog`; confirm still runs the same `signOutUser` and navigation/toast behavior.

### Safe-area and Structure

- All converted confirmations use `AppDialog` with `AppModalHeader`, `AppModalBody`, and sticky `AppModalFooter`.
- Withdrawals drawer CTA row removed the manual `insets.bottom`/`paddingBottom` wrapper; `AppModalFooter` now owns bottom safe-area padding.
- Converted dialog CTA rows do not add manual bottom inset padding inside `AppModalFooter`; they only keep horizontal/top row spacing.
- Cancel/Close remains visible on every dialog; primary/destructive actions keep existing loading/disabled behavior.
- Withdrawals drawer header close is left usable during submit, matching the non-trapping Phase 5 rule.

### Keyboard Strategy

- Added `keyboardAware` only to the Super Admin Withdrawals `AppDrawer`, because the drawer contains the multiline reject reason `TextInput`.
- No keyboard-aware mode was added to simple confirmation dialogs.
- `keyboardVerticalOffset` was left at the primitive default of `0`.

### Tests Run

- `npx tsc -p tsconfig.json --noEmit` - passed

### Manual Check Notes

- Super Admin Withdrawals drawer: code review confirms footer actions stay in `AppModalFooter`, duplicate bottom inset padding was removed, and Close remains callable during submit; device safe-area/keyboard QA still needs a physical/simulator pass.
- Zone Pricing delete dialog: confirm path calls the same delete flow; cancel/close only clears pending rule state.
- Zone Notifications clear/mark dialog: pending count still controls title/message/confirm label; `clearing` state remains wrapped around the same mutations.
- Zone Migration Tools dialog: migration status still controls Retry/Run label; cancel/close only hides the dialog; confirm keeps the same migration state transitions.
- Logout dialogs: confirm still executes existing sign-out and navigation/toast flows; cancel/close only hides the dialog.

### Known Risks

- Physical iOS home-indicator and Android gesture-nav verification is still needed for exact tappable spacing.
- Closing a dialog while an async action is running hides the UI but does not cancel the already-started action; this preserves existing business behavior.
- `AppDialog` conversions are local to approved admin/zone callsites and do not introduce a global confirmation host.

### Phase 6 Starting Point

- `app/matchrooms/hooks/useMatchroomDetailActions.ts` - multiple action confirmations/action choices live inside a hook and need a dedicated UI-state plan before replacing native alerts.
- `app/(player)/utils/inboxAlerts.ts` - confirmation helper uses native alerts outside a component tree and needs a caller-owned dialog or global confirmation pattern.
- `src/utils/verificationGate.ts` - informational OK-only alert remains out of Phase 5 confirmation/action scope.

## Phase 6 - Global Confirm API for Hook/Util Confirmation Prompts

### Files Changed

- `src/ui/confirm.ts`
- `app/matchrooms/hooks/useMatchroomDetailActions.ts`
- `app/(player)/utils/inboxAlerts.ts`
- `TEMP_MODAL_UI_AUDIT_AND_FIX_CHECKLIST.md`

### Prompts Migrated

- Matchroom zone reject confirmation in `app/matchrooms/hooks/useMatchroomDetailActions.ts`.
- Matchroom leave confirmation in `app/matchrooms/hooks/useMatchroomDetailActions.ts`.
- Matchroom delete confirmation in `app/matchrooms/hooks/useMatchroomDetailActions.ts`.
- Matchroom transfer captaincy confirmation in `app/matchrooms/hooks/useMatchroomDetailActions.ts`.
- Matchroom manage player action choice in `app/matchrooms/hooks/useMatchroomDetailActions.ts`.
- Inbox clear-history confirmation in `app/(player)/utils/inboxAlerts.ts`.
- Counter-offer accepted multi-button action prompt with `matchroomId` in `app/(player)/utils/inboxAlerts.ts`.

### Global Confirm API

- Added `confirm(options): Promise<boolean>` in `src/ui/confirm.ts`; it always includes a cancel button and resolves `true` only from the confirm action.
- Added `choose<K extends string>(options): Promise<K | null>` in `src/ui/confirm.ts`; it always includes a cancel button and resolves the selected action key or `null`.
- Both helpers remain thin wrappers around `Alert.alert`, so the existing `InAppAlertProvider` continues to render prompts through `AppDialog`, `AppModalHeader`, `AppModalBody`, and `AppModalFooter`.
- Concurrent prompts follow the existing `InAppAlertProvider` FIFO queue behavior.

### Safe-area and Keyboard Strategy

- No callsite bottom padding was added.
- Prompt CTA rows continue to use the existing `InAppAlertProvider` dialog path, where `AppModalFooter` owns bottom safe-area padding.
- No duplicate inset padding was introduced or removed in Phase 6 callsites.
- No `keyboardAware` mode was added because all migrated prompts are confirmation/action surfaces with no inputs.

### Informational Alerts Left As-is

- `Missing data`, `Locked`, `Cannot Delete`, `Deletion Blocked`, and delete `Error` alerts in `app/matchrooms/hooks/useMatchroomDetailActions.ts`.
- Simple OK-only `showCounterOfferAccepted` path without `matchroomId` in `app/(player)/utils/inboxAlerts.ts`.
- `src/utils/verificationGate.ts` remains out of Phase 6 scope.

### Tests Run

- `npx tsc -p tsconfig.json --noEmit` - passed after removing stale generated `.expo/types/router.d.ts` output that contained an invalid typed-route entry for `../src/ui/confirm`.

### Manual Check Notes

- Delete Lobby confirm: code review confirms `setLoading(true)` still happens only after the confirm result; cancel returns before side effects.
- Leave Matchroom confirm: cancel returns before `leaveMatchroom`; confirm preserves the same loading, toast, and refresh flow.
- Manage Player choose: cancel resolves `null`; Make Captain is only shown under the existing `!isCurrentCaptain` condition and still calls `handleTransferCaptain`.
- Inbox clear-history confirm: public function signature remains unchanged; confirm path still runs `void onConfirm()`.
- Counter-offer accepted with `matchroomId`: OK resolves `null`; View Matchroom still calls `openMatchroom(matchroomId)`.

### Known Risks

- Device QA is still needed on physical iOS home-indicator and Android gesture-nav devices to verify exact tappable spacing.
- The global API depends on `InAppAlertProvider` staying mounted at the app root before these helpers are invoked; this matches the existing app layout.

### Phase 7 Starting Point

- Continue scanning remaining component-tree `Alert.alert` usages separately, excluding payment/checkout, filters, and informational OK-only alerts unless future scope changes.
