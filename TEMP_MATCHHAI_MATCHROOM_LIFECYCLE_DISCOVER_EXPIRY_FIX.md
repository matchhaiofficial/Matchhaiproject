# Matchroom Lifecycle + Discover Expiry Hotfix

Branch: product-ready

## Root cause

### Issue 1 — `syncLifecycleIfDue` Not authorized
`src/services/convex/matchService.ts#getMatchroom` opens every matchroom by
first calling the `matchrooms.syncLifecycleIfDue` mutation. After security
hardening this mutation calls `requireRoomActor(room, ["host", "captain", "zoneOwner"])`
which `throw new Error("Not authorized")` for any non-privileged viewer
(public discover open, friend opening shared link, etc.). The client
try/catch swallows the rejection but the Convex client still logs
`[CONVEX M(...)] Server Error Uncaught Error: Not authorized` to the
console, which the dev RN LogBox surfaces full-screen.

### Issue 2 — Expired matchrooms in Discover
`convex/discover.ts#isRoomExpired` only checked the `status` string. Rooms
whose `scheduledStartAt` had passed but whose lifecycle sweep had not yet
stamped `status = "expired"` were still returned. Several non-joinable
statuses (`in-progress`, `closed`, `admin_review`, `payment_failed`) were
not filtered. Broadcast rooms whose zone-response window expired were also
still returned.

## Files inspected
- convex/matchrooms.ts (lifecycle + actor guard)
- src/services/convex/matchService.ts (client open path)
- convex/discover.ts (Discover matchroom query)
- convex/authz.ts, convex/kycGate.ts (auth helpers)

## Files changed
- convex/matchrooms.ts — `syncLifecycleIfDue` no longer throws for
  non-privileged viewers. Inline actor check returns
  `{ changed: false, skipped: "unauthorized" }` instead of throwing.
  Lifecycle transitions still only run for host/captain/zoneOwner; KYC
  gate still enforced when actor is privileged.
- convex/discover.ts — `isRoomExpired` extended:
  - Status blocklist: completed, cancelled, expired, closed, in-progress,
    admin_review, payment_failed.
  - Time-based: `scheduledStartAt <= now && !rosterFull` → expired.
  - Explicit `expiresAt` honored.
  - Broadcast rooms past `broadcastRequestExpiresAt` excluded.
- TEMP_MATCHHAI_MATCHROOM_LIFECYCLE_DISCOVER_EXPIRY_FIX.md (this tracker).

## `syncLifecycleIfDue` fix summary
- Removed throw on unauthorized viewer.
- Backend still safe: only host/captain/zoneOwner trigger mutations
  (expire / start / complete / broadcast finalize).
- Idempotency unchanged — same helpers (`shouldExpireForNotFull`,
  `canStartMatchroom`, `canCompleteMatchroom`, `captureHeldBookingIntentsForMatchroom`)
  used.
- Server lifecycle sweep (`runLifecycleSweep`) still progresses lifecycle
  for rooms that nobody privileged opens.
- No change to payment/refund/ELO/KYC logic.

## Discover expired filtering summary
- Server-side filter (not just UI).
- Joinable rooms = status in {open, locked-but-roster-not-full and start
  not passed} AND time not past expiry AND not blocked status.
- Existing search/format/skill/area/timeline/price filters preserved.
- Pagination/load-more preserved (filter happens before slice).

## UI stale/expired handling
- No new UI code. The existing flow is:
  - `getMatchroom` mutation-call wrapped in try/catch (silently fell back
    already). With the server no-throw fix, the dev console error
    disappears entirely.
  - `convex.query(api.matchrooms.getById)` returns null for missing →
    `getMatchroom` returns `{ ok: false, message: "Matchroom not found" }`,
    which the detail screen already renders as a safe empty state.
- No raw Convex strings reach the user (server change eliminated the
  source of the `Not authorized` toast/log).

## Tests run
- `npx tsc -p tsconfig.json --noEmit` — clean.
- `git diff --check` — clean (CRLF warnings only).

## Codegen
Not run — no API signature changes (return shape extended with optional
`skipped` field; existing callers ignore it).

## Known risks
- Non-privileged viewers no longer trigger lifecycle progress. Lifecycle
  progress now relies on (a) privileged opens by host/captain/zoneOwner
  and (b) the scheduled `runLifecycleSweep`. If the sweep cadence is
  large, expired rooms could linger briefly in raw DB state — but
  Discover now filters them at query time so they will not surface.
- Time-based Discover filter uses `Date.now()` server-side; clocks
  between client and server may differ by seconds. Acceptable for join
  visibility.

## Manual QA checklist
- Open a matchroom as host → no error, lifecycle still ticks.
- Open a matchroom as participant → no error overlay.
- Open a public matchroom as non-participant → no error overlay; detail
  loads (subject to view permissions in `getById`).
- Open a matchroom whose `scheduledStartAt` is past with empty roster →
  no crash; appears as not-joinable state.
- Discover: create a room with `scheduledStartAt = now - 1h`, empty
  roster → does NOT appear in Discover.
- Discover: room with status `in-progress` → does NOT appear.
- Discover: future room with open slots → appears, joinable.
- Discover load-more pagination → still works.
