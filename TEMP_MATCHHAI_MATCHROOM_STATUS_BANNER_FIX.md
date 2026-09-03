# Matchroom Lobby Status Banner — Lifecycle Fix

Branch: product-ready

## Files inspected
- app/matchrooms/[id].tsx (banner render)
- app/matchrooms/hooks/useMatchroomDetailViewModel.ts
- app/matchrooms/utils/matchroomLobbyState.ts
- app/matchrooms/components/BroadcastStatusPanel.tsx (separate, kept)
- app/matchrooms/detail.styles.ts
- src/utils/matchroomLifecycle.ts (`isRoomExpired`, `isJoinLocked`, `isLeaveLocked`)
- convex/matchrooms.ts (room fields: status, broadcastRequestStatus,
  venueConfirmedAt, confirmedZoneId, zoneAdminApproved, bookingApprovalStatus)

## Root cause
The top banner rendered only two states: `isExpired` and
`(isTimeLocked || isFull)`. The title fell back to "Matchroom is full and
locked" whenever both flags were true, but no priority was given to
zone-approval / counter-offer / completed / waiting states. Result:
matchrooms with pending zone responses or freshly-full but not-yet-locked
rooms were misrepresented.

## Fields used for banner derivation
Read-only fields, all already present on the room payload:
- `room.status` — open, locked, in-progress, completed, cancelled, expired
- `isExpired` — from `useMatchroomDetailViewModel` (`isRoomExpired`)
- `isFull` — from `deriveMatchroomLobbyState`
- `isTimeLocked` — from `useMatchroomDetailViewModel` (`isLeaveLocked`)
- `room.broadcastRequestStatus` — "waiting_for_zones" | "offers_received"
- `room.venueConfirmedAt`, `room.confirmedZoneId`, `room.zoneAdminApproved`
- `room.bookingApprovalStatus` — "pending" (direct booking awaiting zone)

No backend schema changes. No new fields added.

## Banner states implemented
| Key | Tone | Title |
|---|---|---|
| `unavailable` | danger (red) | Matchroom unavailable |
| `completed` | success (green) | Match completed |
| `awaiting_captain` | action (orange) | Awaiting captain approval |
| `awaiting_zone` | warning (yellow) | Awaiting zone response |
| `full_locked` | warning | Matchroom is full and locked |
| `locked` | warning | Matchroom is locked |
| `full` | accent (blue) | Matchroom is full |
| `confirmed` | success | Booking confirmed |
| `waiting` | info | Waiting for players |

## Priority order implemented
1. cancelled / expired / unavailable
2. completed
3. awaiting captain approval (counter-offer pending)
4. awaiting zone admin response
5. full and locked
6. locked but not full
7. full but not locked
8. confirmed (zone accepted, still open)
9. waiting for players (default)

This is implemented in `deriveLobbyBanner()` as sequential early returns.

## Files changed
- app/matchrooms/utils/lobbyBanner.ts (new) — `deriveLobbyBanner` helper
  returning `{ key, title, body, tone, icon } | null`.
- app/matchrooms/[id].tsx — replaced the two ad-hoc banner blocks with a
  single render driven by `deriveLobbyBanner`. Tone → existing style
  mapping.
- app/matchrooms/detail.styles.ts — added `successBanner`, `infoBanner`,
  `actionBanner` variants reusing existing token colors.
- TEMP_MATCHHAI_MATCHROOM_STATUS_BANNER_FIX.md — this tracker.

## Join/leave behavior
Unchanged. Banner is purely presentational. Leave button still gated by
`isLeaveLocked` from `matchroomLifecycle.ts`. Full ≠ locked; lock still
keyed off 24-hour lock window / venue confirmation as before.

## Tests run
- `npx tsc -p tsconfig.json --noEmit` — clean.
- `git diff --check` — clean (CRLF warnings only).

## Codegen
Not run — no Convex API or schema change.

## Known risks
- "awaiting_zone" for direct (non-broadcast) bookings relies on
  `bookingApprovalStatus === "pending"`. If that field is unset on legacy
  rooms, the banner falls through to `waiting` rather than incorrectly
  asserting "awaiting zone" — safe default.
- "Booking confirmed" surfaces when `venueConfirmedAt` or
  `confirmedZoneId` is set; this overrides the bare "waiting" state but
  is still subordinate to full/locked priority levels.
- BroadcastStatusPanel still renders its own zone-offer details further
  down the screen — no duplication, banner is summary-only.

## Manual QA checklist
1. New room with open slots → "Waiting for players" (info / blue).
2. Broadcast room before zone responds → "Awaiting zone response".
3. Zone counter-offer arrives → "Awaiting captain approval" (orange).
4. Zone accepts booking → "Booking confirmed" (green).
5. Roster fills > 24h before start → "Matchroom is full" (accent), leave
   still allowed.
6. Roster fills inside 24h window → "Matchroom is full and locked"
   (warning), leave disabled.
7. Past lock time, roster not full → "Matchroom is locked" (warning).
8. Cancelled / expired room → "Matchroom unavailable" (danger).
9. Completed room → "Match completed" (success).
