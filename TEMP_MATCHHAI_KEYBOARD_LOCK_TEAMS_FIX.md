# TEMP — Keyboard Phase 2 + Matchroom Lock + Replacement Notifications + My Teams Glitch

Do not delete this file. Previous related trackers:
`TEMP_MATCHHAI_SEARCH_FILTER_KEYBOARD_AUDIT_FIX.md` (Phase 1 keyboard + search/filter),
`TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`.

Previous keyboard batch fixed 7 high-risk screens by toggling existing props
(`Screen.keyboardAvoiding`, `AppDialog.keyboardAware`, `ScrollView.keyboardShouldPersistTaps`).
No shared primitive code was changed.

## Global constraints
- UI-only for Task 1. No backend/schema change for keyboard.
- Do NOT change wallet/payment money movement or payout logic.
- Do NOT change unrelated filters/search.
- Do NOT run EAS build or deploy production.
- Run Convex codegen ONLY if API/schema/generated types change; confirm target first.
- Separate `isFull` from `isLocked`. Lock = within 24h of scheduledStartAt OR backend lock status.
- Backend must reject leave after lock (not frontend-only).
- No notification spam: dedupe per matchroom + leaving player + recipient + event.

---

## TASK 1 — Keyboard full-app enforcement
### TextInput screens inspected
**47 TextInput-bearing files** audited via a strict full-app sub-agent pass (every `TextInput`
across `app/` and `src/`; no `FormField`/`Input` wrapper exists — all raw RN `TextInput`).
Grouped: auth/onboarding (login, register×4, zone-register×4, forgot/reset), player (profile edit,
wallet, matchroom create + child fields, chat, teams create/challenge, all sheets/pickers/report),
zone admin (profile, branch new/[id] + pricing form, modules, report), super admin (support-ticket,
report, request, withdrawals, identity-verifications, list searches).
### Result: 44 SAFE / 3 NEEDS-FIX (all fixed)
- Modals/sheets were already disciplined (`keyboardAware` + `AppModalBody scroll`). Detail screens
  fixed in the prior batch confirmed still safe. Android safety also backed by app.json
  `softwareKeyboardLayoutMode:"resize"`.
### Changed this pass (Task 1)
- `app/teams/[id].tsx` — Rename Team `AppDialog` was missing `keyboardAware` → added.
- `app/zone/branch/new.tsx` — main `ScrollView` missing `keyboardShouldPersistTaps` → added `"handled"`.
- `app/super-admin/identity-verifications.tsx` — `Screen` missing `keyboardAvoiding` + inner
  `ScrollView` missing `keyboardShouldPersistTaps` → both added (manual-verify reason input was hideable).
### Intentionally left unchanged (why)
- **Top-search screens** (schedule, friends, my-teams, chatrooms, discover, matchrooms/my, zone
  resources/audit, both ZoneBookings sections, every admin list via `AdminSearchFilterBar`): the only
  input is a search field pinned above a scrollable list; the keyboard opens below it and cannot hide
  it or trap the user. No `keyboardAvoiding` needed.
- **forgot/reset-password on Android**: plain View container by design but ScrollView + persistTaps +
  app.json resize ≈ Rule A.
- **Child form components** (BasicFields, WalkInRosterEditor, ZonePicker, BranchInventoryPricingForm):
  inherit a parent Screen's KAV+scroll+persistTaps (BranchInventoryPricingForm now fully safe once
  zone/branch/new.tsx fix landed above).

## TASK 2 — Matchroom full vs locked findings
**Root cause:** "full" and "locked" were conflated in the display layer. `isJoinLocked()` returns true
when a room is **full** OR past lock time; the detail view-model exposed that as `isLocked`, and the
backend additionally stamps `status:"locked", isLocked:true` when a room fills (matchrooms.ts ~2142).
So a full-but-far-away room showed "Matchroom is full and locked".
**Leave gating was already correct:** `isLeaveLocked()` (both `src/utils/matchroomLifecycle.ts` and
backend `convex/matchrooms.ts:460`) is purely time-based (lockAt = start − 24h, or zone-confirmed) and
ignores fullness. Backend `leave` already throws `MATCHROOM_LOCKED_MESSAGE` when `isLeaveLocked` (line 2165).
**Fixes (display only):**
- `app/matchrooms/[id].tsx` — banner now uses time-lock (`isLeaveLocked`, destructured as `isTimeLocked`)
  + `isFull`: shows "Matchroom is full" (blue, no lock language, Leave stays enabled) / "Matchroom is
  locked" / "Matchroom is full and locked", with sub-text "Players can no longer leave because the match
  starts within 24 hours." for locked states. Join gating + QR still use the join-lock (`isLocked`).
- `app/matchrooms/components/MatchroomCard.tsx` — badge `isLocked` switched to time-based `isLeaveLocked`;
  the previously-dead "LOCKS IN Xd" countdown path for full rooms is now reachable; a distinct `FULL`
  badge (people icon) shows for full rooms.
- `app/matchrooms/detail.styles.ts` — added `fullBanner` (accent), `bannerTextWrap`, `bannerTitle`,
  `bannerSubText`.
**Backend unchanged:** left `status:"locked"`/`isLocked` on full as-is (drives join-side gating &
`getRoomDisplayStatus` badge); leave guard is time-based and already correct. See risks.

## TASK 3 — Leave button rules + replacement notification behavior
**Leave button rules (already correct, verified):** all 3 Leave entry points call `handleLeaveAction`,
which checks `isLeaveLocked(room)` and shows an explanation alert when locked; otherwise leave proceeds.
Full-but-unlocked → Leave enabled. Locked → blocked with explanation. Backend rejects leave after lock.
**Replacement notifications (new, backend `convex/matchrooms.ts` `leave` mutation):**
`notifyUrgentReplacementOnLeave(ctx, room, matchroomId, leavingUid)` fires only when a player actually
left AND the roster *was* full AND `now` is within `URGENT_REPLACEMENT_WINDOW_MS` (1h) before `lockAt`:
- Captains/host (`hostUid`, `captainUidA`, `captainUidB`, deduped, minus leaver) → player notification
  `match.replacement_needed`: "Replacement needed / A player left close to the match time. Invite a
  replacement from your friends as soon as possible." Route `/matchrooms/{id}`.
- Zone admin (`room.zoneOwnerUid`, zone-linked only) → `match.walkin_replacement_needed`
  (recipientRole zone_admin): "Walk-in replacement needed / … Please try to accommodate one walk-in
  player for this matchroom." Route `/matchrooms/{id}`.
- Dedupe: explicit `dedupeKey` per (matchroom, leaver, recipient) + `dedupePolicy:"upsert_active"` →
  one notification per leave event, retry-safe.
- New type strings only (table `type` is `v.string()`); reused existing `internal.notifications.
  createCanonicalFromServer` → **no new Convex functions, no schema change, no codegen.** Added bespoke
  inbox labels in `src/utils/notificationCategories.ts`.
- 5v4/bot note: **not implemented** (no bot gameplay exists; would be copy-only). Deferred.
### 24h-lock vs "1 hour before match" conflict
Documented & resolved safely. The product line "notify if a player leaves 1 hour before the match"
**conflicts** with the authoritative 24h lock — within 24h, leaving is already blocked, so a 1h-before
leave cannot occur. Per the approved safe rule, the urgent-replacement window is **1 hour before the
LOCK time** (i.e. ~25h–24h before start), the last moment a leave is still permitted. Lock stays
authoritative; notifications never fire for a blocked leave. If product truly wants 1h-before-START
behavior, that requires relaxing the lock — deferred for a business decision.

## TASK 4 — Profile My Teams glitch findings
**Root cause (two compounding):** (1) the section rendered a spinner whenever `loadingTeams` was true,
and `fetchTeams` toggled it true→false on every call, blanking the list on each refresh; (2)
`useFocusEffect` depended on `maybeRefreshExternalStats`, whose identity changes after each external-stats
sync (it depends on `profile`) → the effect re-ran → refetched teams + triggered another sync → loop →
repeated visible/invisible flicker.
**Fix (`app/(player)/(tabs)/profile.tsx`):**
- Replaced `loadingTeams` with `initialTeamsLoad` (spinner only until the first fetch resolves); focus/
  background refreshes now update `myTeams` in place without blanking.
- Focus effect now calls external-stats refresh via a ref (`maybeRefreshExternalStatsRef`) and depends
  only on `fetchTeams` (stable; changes solely on `user._id`) → runs once per focus, no loop.

---

## Files changed
Task 1 (keyboard): `app/teams/[id].tsx`, `app/zone/branch/new.tsx`,
`app/super-admin/identity-verifications.tsx`.
Task 2 (full vs locked): `app/matchrooms/[id].tsx`, `app/matchrooms/detail.styles.ts`,
`app/matchrooms/components/MatchroomCard.tsx`,
`app/matchrooms/hooks/useMatchroomDetailViewModel.ts` (already exposed `isLeaveLocked`; destructured in [id]).
Task 3 (notifications): `convex/matchrooms.ts` (leave mutation + helper), `convex/timing.ts`
(URGENT_REPLACEMENT_WINDOW_MS), `src/utils/notificationCategories.ts` (2 labels).
Task 4 (flicker): `app/(player)/(tabs)/profile.tsx`.
Tracker: this file.

## Tests run
- `npx tsc -p tsconfig.json --noEmit` → **pass (exit 0)**.
- `git diff --check` → **clean (exit 0)**; only LF→CRLF informational warnings.
- Convex codegen: **not run** (no new Convex functions / schema / generated-type changes).
- EAS build: **not run**.

## Manual QA remaining
- Keyboard (Android + iOS, small + large): teams Rename dialog, zone Add-Branch form, super-admin
  Identity Verifications manual-verify reason — focused field clears keyboard; submit reachable.
- Full vs locked: full room >24h away → "Matchroom is full" (blue), Leave works, card shows FULL +
  "LOCKS IN Xd"; within 24h → "locked" copy, Leave blocked with explanation, backend rejects leave.
- Replacement notifications: leave a full zone-linked room <1h before lock → captains get
  "Replacement needed", zone admin gets "Walk-in replacement needed", routes open the matchroom, no
  duplicates on retry; leaving a locked room → no notification.
- My Teams: open Profile, switch tabs/refocus, let external stats refresh → no flicker; cards open;
  stable empty state when no teams.

## Known risks
- Backend still sets `status:"locked"`/`isLocked` when a room fills; `getRoomDisplayStatus` therefore
  still returns 'locked' for full rooms in any *other* surface that reads it directly (not the detail
  banner or card, which are now corrected). Changing the backend status enum is higher-risk (used by
  join gating, queries, schedule buckets) and was intentionally deferred.
- The matchroom detail QR (`MatchroomSummarySection`) still keys off the join-lock; a full-but-unlocked
  room may show the check-in QR early. Pre-existing; out of the reported scope.
- Urgent-replacement notifications assume `hostUid`/`captainUid*` are auth ids resolvable via users
  `by_authId` and `zoneOwnerUid` via `resolveUserByAnyId` (matches existing match.cancelled pattern).
- New notification types render via the generic inbox fallback + the 2 added labels; not yet seen on a
  device.
