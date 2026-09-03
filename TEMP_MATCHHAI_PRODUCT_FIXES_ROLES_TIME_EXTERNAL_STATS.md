# MatchHai Product Fixes — Roles / Time / External Stats

Tracker for: Valorant roles+agents, registration KYC helper, matchroom date/time
helper, counter-offer midnight rollover, accepted-counter-offer lobby time,
external stats refresh (Steam/FACEIT/PSN).

Branch: `product-ready`. No wallet/payment/payout logic touched. No EAS build, no
production deploy. Convex codegen run against the **dev** deployment (approved).

---

## Files inspected

- `constants/profileOptions.ts` (game/role/agent config)
- `src/constants/gameRules.ts` (GAME_RULES → roles per game)
- `app/(player)/profile/game-details.tsx` (per-game profile editor + external stats)
- `app/(player)/(tabs)/profile.tsx` (own profile, auto-refresh wiring)
- `app/(player)/profile/[uid].tsx` (public profile)
- `app/matchrooms/create/index.tsx`, `RoleAutoFill.tsx`, `GameDynamicFields.tsx`
- `app/matchrooms/create/utils/matchroomCreateValidation.ts`
- `src/constants/timing.ts`, `convex/timing.ts`
- `src/features/discover/filterConfig.ts`
- `app/auth/register.tsx`, `app/auth/zone-register.tsx`, `components/RegistrationFieldLabel.tsx`
- `app/auth/register.styles.ts`
- `app/matchrooms/components/MatchroomSuggestSheet.tsx`, `MatchroomSummarySection.tsx`, `MatchroomCard.tsx`
- `app/matchrooms/hooks/useMatchroomDetailActions.ts`, `useMatchroomDetailUiState.ts`
- `app/zone/modules/bookings.tsx`, `hooks/useZoneBookingsActions.ts`, `hooks/useZoneBookingsViewModel.ts`
- `app/zone/modules/components/ZoneBookingsCounterOfferSheets.tsx`, `ZoneBookingsRequestsSection.tsx`
- `convex/zoneAdminBooking.ts` (sendCounterOffer / respondToCounterOffer / ensureMatchroomForAcceptedOffer)
- `convex/matchroomBroadcast.ts` (confirmBroadcastVenue)
- `convex/users.ts` (refreshExternalStats / updatePlatformLinks / updateGamePreferences / saveOnboarding)
- `convex/externalApis.ts` (fetchSteamProfile / fetchFaceitProfile / verifyPsnProfile)
- `convex/schema.ts` (users, zoneOffers, matchrooms)
- `src/services/convex/userService.ts`, `zoneAdminBookingService.ts`
- `app/(player)/components/InboxNotificationCard.tsx`

## Files changed

- `constants/profileOptions.ts` — centralized Valorant roles + agents config + helpers
- `convex/schema.ts` — `users.valorantAgent`; `zoneOffers.proposedStartAt` + `scheduleOptions.startAt`
- `convex/users.ts` — `valorantAgent` in saveOnboarding; PSN added to `refreshExternalStats`
- `app/(player)/profile/game-details.tsx` — Valorant role→agent picker; external-stats refresh for tekken8/fc26
- `app/(player)/(tabs)/profile.tsx` — Valorant role+agent display; PSN added to auto-refresh trigger
- `app/(player)/profile/[uid].tsx` — Valorant block; PSN trophy/playtime on tekken8/fc26
- `app/matchrooms/create/index.tsx` — normalize legacy Valorant role on prefill; date/time helper copy
- `app/auth/register.tsx`, `app/auth/zone-register.tsx` — CNIC/KYC helper under Full Name
- `app/matchrooms/hooks/useMatchroomDetailActions.ts` — send `startAt` with suggested option
- `app/zone/modules/bookings.tsx` — local (non-UTC) date in `formatDateTime`
- `app/zone/modules/hooks/useZoneBookingsViewModel.ts` — local date in `toDateString`
- `app/zone/modules/hooks/useZoneBookingsActions.ts` — timestamp-based counter-offer build (+startAt, +originalStartAt)
- `convex/zoneAdminBooking.ts` — persist proposedStartAt/startAt; set `scheduledStartAt` on accept (direct + broadcast)
- `src/services/convex/userService.ts` — `valorantAgent` on UserProfile; `scheduleOptions.startAt` type
- `src/services/convex/zoneAdminBookingService.ts` — `startAt` on scheduleOptions type
- `app/(player)/components/InboxNotificationCard.tsx` — 12h display for 24h-stored option time
- `src/utils/scheduleTime.ts` — NEW shared, locale/UTC-safe schedule time helpers

---

## Fixes implemented

### Task 1 — Valorant roles + agents
- Config location: **`constants/profileOptions.ts`** → `VALORANT_ROLE_GROUPS`
  (single source of truth). Roles: Duelist / Controller / Initiator / Sentinel
  (keys `duelist`/`controller`/`initiator`/`sentinel`). Agents per role with exact
  display labels (KAY/O label, key `kayo`).
- `VALORANT_ROLES` is now derived from the groups (the 4 tactical labels), so every
  existing consumer (discover filters, matchroom create RoleAutoFill, game rules)
  picks up the new roles automatically without breaking other games.
- Helpers added: `normalizeValorantRole` (maps legacy generic roles → tactical,
  preserves data), `getValorantAgentsForRole`, `formatValorantRoleAgent`.
- Agent selection persisted in new `users.valorantAgent` field. Editor in
  `game-details.tsx`: role chips → agents under the selected role (agent cleared
  when it doesn't belong to a newly chosen role).
- Display: own profile (`Role · Agent`) and public profile (Role + Agent rows).
- Legacy values: old `valorantRole` strings (e.g. "Entry Fragger") are mapped to a
  tactical role on load (not dropped); display falls back gracefully.

### Task 2 — Registration KYC/CNIC helper
- Copy used (consistent across both): **"Use your full name as per CNIC so KYC can
  be verified."**
- Player registration: under Full Name (`app/auth/register.tsx`).
- Zone admin registration: under Owner / primary contact (`app/auth/zone-register.tsx`).
- Muted small text (`styles.helperText` + `COLORS.muted`), required asterisk kept,
  validation unchanged.

### Task 3 — Matchroom create date/time helper
- Removed the misleading "Earliest allowed time is <today> at 9:00 PM" line.
- Solo/player matchroom helper: **"Matchrooms must be scheduled at least 3 days in
  advance."**
- Walk-in helper: **"Walk-in matchrooms must be scheduled at least 1 day in
  advance."**
- Validation logic unchanged (still `validateMatchroomScheduleWindow` / picker
  `minimumDate`); only helper copy changed.

### Task 4 — Counter-offer midnight rollover
- Root causes: (a) date derived via `toISOString()` (UTC) rolled the day back for
  after-midnight local times in UTC+5; (b) client computed proposed start with
  `new Date('YYYY-MM-DDThh:mm AM/PM')` → invalid.
- New shared helpers in `src/utils/scheduleTime.ts` (`toLocalDateString`,
  `toLocalTime24`, `clockMinutesFromString`, `minutesToTime24`,
  `combineLocalDateTime`) — all local-time, no UTC/locale dependence.
- Zone queue counter-offer now builds each option from a real local instant
  (`combineLocalDateTime`), derives date + 24h time + `startAt` from it, and sends
  `startAt` per option plus a clean `originalStartAt`.
- Backend `sendCounterOffer` persists `proposedStartAt` + per-option `startAt`;
  ±2h-of-original and not-in-past checks still enforced via timestamps.
- `formatDateTime`/`toDateString` fixed to use the local calendar day.

### Task 5 — Accepted counter-offer updates lobby/matchroom time
- `ensureMatchroomForAcceptedOffer` now sets `scheduledStartAt` (the canonical
  field the lobby/lifecycle read) from the accepted option's `startAt`, plus
  `scheduledDate`/`scheduledTime`. Applies to both existing and newly created
  matchrooms.
- Broadcast accept path (`respondToCounterOffer`) now also patches the matchroom's
  `scheduledStartAt`/date/time from the chosen option (previously only the request
  was updated).
- `MatchroomSummarySection` already prioritizes `scheduledStartAt`, so lobby/detail,
  zone history (same components) and `MatchroomCard` now show the accepted time.
- Audit history preserved: original request `preferredDate/preferredTime` retained;
  offer keeps `scheduleOptions` + `proposedStartAt`.

### Task 6 — Steam/FACEIT/PSN refresh
- Existing infra reused: `refreshExternalStats` action with 5-min cooldown
  (`EXTERNAL_SYNC_COOLDOWN_MS`), `lastExternalSyncAt`, `force` flag, writes via
  `updatePlatformLinks`; own profile auto-refreshes on focus + interval (respecting
  cooldown) and on pull-to-refresh (force).
- **PSN added** to `refreshExternalStats` (was Steam+FACEIT only) using
  `verifyPsnProfile` with the user's `psnOnlineId` and `wantsTekken/wantsFc` from
  their play flags; stores `psnStats`, `psnAccountId`, `psnOnlineId`,
  `psnLastSyncedAt`.
- `hasExternalPlatform` (own profile) now includes PSN so PSN-only users trigger
  auto-refresh.
- `game-details.tsx`: refresh affordance extended to tekken8/fc26 (PSN/Steam) with
  fallback "Linked Stats" cards and a refresh button.
- Public profile shows PSN trophy progress + playtime for tekken8/fc26 where
  available; failures never break the screen (data is read from stored fields).

---

## Tests run

- `npx convex codegen` — succeeded (dev deployment).
- `npx tsc -p tsconfig.json --noEmit` — **passed, no errors**.
- `git diff --check` — clean (only a benign LF→CRLF notice).

## Known risks

- Timezone model: helpers use device-local time. The app is Karachi-only
  (single timezone), so admin and player share the frame; cross-timezone use is out
  of scope.
- Stored counter-offer `scheduleOptions.time` is now canonical 24h ("HH:mm").
  Display surfaces format to 12h (inbox card updated). Zone "Suggested:" row shows
  24h — intentional, unambiguous.
- Legacy offers without `startAt` fall back to server-side `parseLocalDateTimeMillis`
  (UTC parse) on accept — only affects offers created before this change.
- Public profile does NOT trigger viewer-initiated external refresh (deliberate:
  avoids viewers spamming third-party APIs / refreshing other users' data). Public
  profile shows the most recent stored stats; owners refresh their own data.
- Matchroom-detail "Suggest Alternative" sheet has no time editor in the current UI
  (`counterDateValue` is fixed at now+2h); the primary admin counter-offer flow is
  the zone bookings queue, which is fully fixed. Flagged for product follow-up.
- Schema additions (`valorantAgent`, `proposedStartAt`, `scheduleOptions.startAt`)
  are optional, so existing docs remain valid.

## Manual QA remaining

- Valorant: onboarding/profile → pick each tactical role, confirm correct agent list,
  save, reopen, verify persisted; check discover player card + public profile.
- Registration: helper visible under Full Name (player + zone admin), small screens,
  keyboard open.
- Create Matchroom: helper copy correct for solo and walk-in; invalid date still
  blocked with clear message.
- Counter-offer: 24 May 11 PM → propose 12 AM (next day) → verify zone UI, player
  inbox, accepted lobby/detail all show **25 May 12 AM**; ±2h still enforced; out of
  range blocked; not-in-past blocked.
- Accept flow updates lobby/detail/booking history/notification time (no stale
  original time).
- External stats: link Steam/FACEIT/PSN, open profile (auto-refresh if stale),
  reopen within 5 min (no new call), force via pull-to-refresh, confirm public
  profile shows updated values, simulate API failure (UI stays up).

## Recommended commit message

```
fix(matchrooms): correct counter-offer timing and Valorant role data
```
