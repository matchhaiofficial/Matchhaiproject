# MatchHai — Team / Lobby / Discover / Result Lifecycle Fixes

Branch: `product-ready`

Scope: QA fixes for Team details, Team chat, deleted-user filtering, lobby
invite slots, matchroom lifecycle (expired/locked/completed), Discover
filtering, result-verification modal trigger, and matchroom card date display.

> Explicitly OUT OF SCOPE (not touched): wallet/payment money movement,
> Easypaisa/IPN/finalize, payout formula, ELO/rating logic (read-only checks
> only), KYC provider logic, Super Admin onboarding, withdrawal review redesign,
> Team Challenge payment rebuild. P0/P1 payment lifecycle fixes already committed.

## Execution note
The 7 QA work-streams map onto a small set of heavily-shared files
(`convex/matchrooms.ts`, `app/matchrooms/[id].tsx`, `MatchroomCard.tsx`,
`app/teams/[id].tsx`). Parallel writer sub-agents on those files would collide,
so shared-file work was implemented sequentially in a conflict-aware order;
read-only exploration was parallelized.

---

## Status — ALL DONE
- [x] 1. Team Details captain badge (Captain vs Member)
- [x] 2. Team member-only chatroom
- [x] 3. Deleted-user filtering across invite/search/discover lists
- [x] 4. Lobby invite-friends on empty slots when already joined
- [x] 5. Locked-vs-expired lifecycle + Discover cleanup
- [x] 6. Completed matchroom status/banner priority
- [x] 7. Result-verification modal on login/dashboard (already implemented — verified)
- [x] 8. Date display on matchroom cards

---

## Issue-by-issue summary

### 1. Team captain badge — `app/teams/[id].tsx`
The role pill always rendered "Member" when `isMember` (captain is also a
member). Now branches on `isCaptain` first → shows "Captain" (distinct `warning`
tone) vs "Member" (`success`). Lineup captain trophy icon (RosterSlots) untouched.

### 2. Team member-only chatroom (NEW)
- Schema: `chatrooms.type` gains `"team"`, new `chatrooms.teamId` + index
  `by_teamId`. Reuses shared `chatrooms`/`chatMessages` tables.
- Backend `convex/teamChat.ts`: `getAccess`, `getChat`, `listMessages`,
  `sendMessage`, `markRead`, `generateUploadUrl`. Access is enforced from the
  `teamMembers` table (accepted members + captain). Pending invites are
  notifications (not teamMembers rows) → excluded; removed users lose their row
  → lose access; soft-deleted/hidden accounts filtered out of the member list
  and rejected on access. Supports text + voice + image + file + reply.
- Frontend `app/teams/team-chat.tsx`: reuses `ChatThread`. Members-only chat
  button added to the Team Details header (`isMember && !isDeleted`). Route
  registered in `app/teams/_layout.tsx`.
- Security: backend membership gate on every read/write; non-member route access
  returns a safe "Members only" state, not data.

### 3. Deleted-user filtering — `convex/userVisibility.ts` (central)
Added `isUserDeleted()` (detects `suspensionReason ===
"account_deletion_processed"`, `deleted_*` username, "Deleted User" name) and
folded it into `isUserHiddenFromPublic()`. Every surface already routing through
that gate (Discover players, matchroom seat invite, social block target, user
search) now excludes deleted accounts automatically. Additionally:
- `convex/social.ts` `listFriends` / `listFriendsForGame` now skip hidden/deleted
  friends → Team Invite-Friends sheet, matchroom FriendPicker, friend lists.
- `convex/teams.ts` `inviteToTeam` blocks inviting hidden/deleted users
  server-side. Historical records still render a neutral name (no crash) but a
  deleted user is never a selectable invite target.

### 4. Lobby invite friends on empty slots — `useMatchroomDetailViewModel.ts`,
`MatchroomTeamSection.tsx`, `convex/matchrooms.ts`
- `canInviteTeamA/B` now also true for the **host** (Team B often has no captain
  yet) and gated on a joinable room (`status==="open"`, not expired, not
  join-locked). Empty open slots show an "Invite" button + the label reads
  "Invite a friend" when the viewer can invite.
- Backend `inviteToSlot` mutation now authorizes the **host OR** the team captain
  (previously captain-only, which rejected host invites to Team B). Existing
  guards retained: expired/locked blocked, deleted invitee blocked, already-in-room
  blocked, overfill blocked, friend list pre-filtered of deleted users.

### 5. Locked-vs-expired lifecycle + Discover — `convex/matchrooms.ts`,
`convex/discover.ts`, `src/utils/matchroomLifecycle.ts`
Root cause: incomplete rooms only expired at *kickoff*, so a 1/10 room sat
"locked" for 24h and stayed in Discover. Joins actually close at **lockAt** (24h
before start), so an unfilled room past lockAt can never fill = dead.
- `shouldExpireForNotFull` (drives the cron sweep + `isRoomExpired`): now expires
  open/locked, not-full rooms once **lockAt** passes (fallback to start time for
  legacy rooms). Expiry uses the existing `expireMatchroomForInvalidLifecycle`
  → `releaseHeldBookingIntentsForMatchroom` (existing P0 fund-release path; no new
  money logic).
- Discover `isRoomExpired`: excludes not-full rooms past lockAt (or start), in
  addition to the existing completed/cancelled/expired/in-progress exclusions.
- Frontend `matchroomLifecycle.isRoomExpired`: same lockAt logic; treats
  completed/in-progress as valid (never "expired").

### 6. Completed matchroom status/banner — `convex/matchrooms.ts`,
`app/matchrooms/[id].tsx`, `MatchroomCard.tsx`
Root cause: full + locked rooms were never *started* by the cron sweep (only by
`syncLifecycleIfDue` on a privileged open), so a finished match stayed `locked`
and rendered "Lobby Full / full and locked".
- Sweep now **auto-starts** full, kickoff-due open/locked rooms to `in-progress`
  (mirrors `syncLifecycleIfDue`'s start; **money-safe** — capture/venue payout
  only happen at COMPLETION, which stays gated to the captain/admin result flow
  and is NOT auto-triggered here; rooms still awaiting a venue are skipped).
- Card: terminal `COMPLETED` / `CANCELLED` badge takes priority over FULL/LOCKED/
  EXPIRED. The top detail banner (`deriveLobbyBanner`) already prioritized
  completed correctly.
- Detail: QR/check-in code hidden for terminal statuses (completed/cancelled/
  expired). The result-status banner already shows "Final Result: …" when resolved.

### 7. Result-verification modal on login/dashboard — VERIFIED (already built)
`src/components/MatchResultGate.tsx` is mounted globally at app root
(`app/_layout.tsx:190`, inside the authed providers, sibling to the whole nav
Stack), so it prompts on **any** screen including Home. Backend
`getPendingResultForUser` is auth-scoped via `requireCurrentUser` (ignores client
`userId` for authorization), captain/participant-only, skips resolved, returns
one pending result at a time (natural queue), and won't re-prompt after a captain
has reported. Query is skipped until `!loading && user?._id`, and Convex's authed
`useQuery` holds the request until the session is ready (no raw "session expired").
No code change required.

### 8. Date on matchroom cards — `MatchroomCard.tsx`
Time row now shows `Today/Tomorrow/"Sat, Jun 6" · 5:00 - 7:00 PM`
(device-local = Asia/Karachi), `numberOfLines={1}`, compact, no overflow.
Same `MatchroomCard` is used by Discover, Home upcoming, My Matchrooms, schedule.

---

## Files inspected
schema.ts, userVisibility.ts, admin.ts (deletion), social.ts, discover.ts,
matchrooms.ts, teams.ts, crons.ts, timing.ts, chat.ts, chatAuth.ts, teams/[id].tsx,
InviteFriendsSheet.tsx, FriendPicker.tsx, MatchroomCard.tsx, MatchroomTeamSection.tsx,
matchrooms/[id].tsx, lobbyBanner.ts, matchroomLifecycle.ts, useMatchroomDetailViewModel.ts,
MatchResultGate.tsx, _layout.tsx, challenge-chat.tsx, ChatThread.tsx.

## Files changed
- convex/userVisibility.ts — `isUserDeleted` + folded into `isUserHiddenFromPublic`
- convex/social.ts — filter hidden/deleted from friend lists
- convex/teams.ts — block inviting hidden/deleted users
- convex/discover.ts — lockAt-based discover expiry filter
- convex/matchrooms.ts — lockAt expiry; sweep auto-start; invite host-or-captain
- convex/crons.ts — (NOT changed by this task; pre-existing modification)
- convex/schema.ts — chatrooms.type "team" + teamId + by_teamId index
- convex/teamChat.ts — NEW team chat backend
- src/utils/matchroomLifecycle.ts — lockAt/terminal-aware isRoomExpired
- app/matchrooms/components/MatchroomCard.tsx — date display + completed/cancelled badge
- app/matchrooms/components/MatchroomTeamSection.tsx — invite-aware empty slot label
- app/matchrooms/hooks/useMatchroomDetailViewModel.ts — host-can-invite + status gate
- app/matchrooms/[id].tsx — QR hidden on terminal status
- app/teams/[id].tsx — captain badge + members-only chat button
- app/teams/team-chat.tsx — NEW team chat screen
- app/teams/_layout.tsx — register team-chat route
- convex/_generated/* — regenerated by codegen

## Backend schema / API / index changes
- `chatrooms.type` union += `"team"`; new optional `chatrooms.teamId` (id "teams").
- New index `chatrooms.by_teamId`.
- New module `convex/teamChat.ts` (queries/mutations).
All additive/optional → existing documents keep validating.

## Validation
- `npx convex codegen` → target **dev:ardent-lynx-28** (project matchhai-staging,
  NOT production). Succeeded; `teamChat` present in generated API.
- `npx tsc -p tsconfig.json --noEmit` → **exit 0** (clean).
- `git diff --check` → **exit 0** (only benign LF→CRLF warnings, no whitespace errors).
- No production deploy. No EAS build. Not pushed.

## Product rule — incomplete matchroom expiry at the 24h lock (CONFIRMED)

**Rule (approved):** *Any incomplete matchroom must be completed (full, valid
roster) before the 24h lock time. If it is still incomplete at lock time it
expires, and any held funds are returned to player wallets.*

**Code matches this rule — verified:**
- `shouldExpireForNotFull` (`convex/matchrooms.ts`) returns `false` when
  `isRosterFull(room)` → **full/valid rooms never expire incorrectly**. For an
  incomplete open/locked room it returns `true` once `lockAt`
  (= `scheduledStartAt − 24h`, via `getRoomLockAtMs`) has passed (legacy fallback:
  scheduled start). The 2-minute cron `runLifecycleSweep` then calls
  `expireMatchroomForInvalidLifecycle`.
- `expireMatchroomForInvalidLifecycle` (existing P0 path, unchanged) →
  status `expired`; `releaseHeldBookingIntentsForMatchroom` (held funds returned)
  + `refundCapturedBookingIntentsForMatchroom` (captured funds refunded) +
  `teamChallenges.settleForMatchroom` (release). **Funds returned via existing P0
  logic only — no new money code.**
- **Users notified:** `releaseBookingIntentHold` / `refundCapturedBookingIntentHold`
  call `notifyBookingWalletCredit(... kind: "released"/"refunded")`, so each
  affected user gets a wallet-credit notification.
- **Discover:** expired (and past-lock incomplete) rooms are filtered out by
  `convex/discover.ts isRoomExpired`.
- **Direct open:** the detail screen derives `isExpired` from
  `matchroomLifecycle.isRoomExpired` (same lockAt logic) → top banner "Matchroom
  unavailable" + bottom "Matchroom Expired"; once the sweep stamps `status:
  "expired"` this is also data-backed.

No behavior change was made to this rule after confirmation — it already matched.

## Accepted risks & product decisions
1. **Auto-start does NOT auto-complete (Issue 6) — ACCEPTED.** The sweep
   auto-starts full, kickoff-due rooms to `in-progress` but deliberately does NOT
   auto-complete or auto-payout. Results must go through the captain/result-
   verification flow. A stuck full room becomes `in-progress`; final completion
   still requires the captain result flow (Issue 7 modal) or a privileged open.
   Sweep-driven completion is intentionally deferred (moves money → needs
   finance/product sign-off, out of this batch).
2. **Incomplete rooms expire at lockAt, 24h before start — ACCEPTED.** Confirmed
   to match the product rule above (held funds returned to player wallets,
   notified, removed from Discover, expired state on direct open, full/valid rooms
   unaffected).
3. **FriendPicker does not pre-exclude already-in-lobby / pending-invited users —
   ACCEPTED for this batch.** The backend safely rejects these invites with a
   clear error, and deleted users ARE already pre-filtered. UI pre-filtering is a
   follow-up (see below).

## Follow-up tasks (NOT in this batch)
- **FriendPicker pre-filtering UX** (`app/matchrooms/components/FriendPicker.tsx`):
  client-side exclude (a) users already joined in the lobby, (b) users with a
  pending invite to that lobby, (c) deleted users (currently filtered via
  `listFriends`; keep), and (d) filter by the matchroom's selected game where
  applicable. Backend already enforces (a)–(c) defensively.
- **Sweep-driven completion** for stale `in-progress` rooms — requires finance/
  product sign-off because it triggers venue payout (Issue 6 risk #1).
- **Team chat unread badges** on the Team Details chat button / a conversations
  list (backend already tracks `lastReadBy`).

## Other notes
- Discover still fetches a bounded candidate set then filters (unchanged).
  `getPendingResultForUser` still `.collect()`s all completed rooms (pre-existing,
  unbounded) — not changed here.

## Manual QA checklist
**Issue 1** Captain opens Team Details → "Captain"; member → "Member"; lineup
trophy still shows.
**Issue 2** Captain & member open team chat and exchange messages (text/voice/
image); non-member deep-links `/teams/team-chat?teamId=…` → "Members only" with no
messages; removed user loses access; deleted user not in participants.
**Issue 3** Create Team → Invite Friends: no "Deleted User"; matchroom invite list,
Discover players, friend search exclude deleted; server rejects invite to deleted.
**Issue 4** Host (and team captain) sees "Invite"/"Invite a friend" on open slots
while joined; outsider sees passive slot; locked/expired/completed rooms show no
invite; invite to deleted blocked; cannot overfill; friend gets notification.
**Issue 5** 1/10 room within 24h of start → shows EXPIRED, gone from Discover;
held funds released via P0; full confirmed rooms unaffected.
**Issue 6** Completed/cancelled card shows COMPLETED/CANCELLED (not FULL/LOCKED);
completed detail shows completed banner + result, QR hidden, no join/leave; old
full locked room transitions to in-progress on next sweep.
**Issue 7** Captain with a pending completed-match result sees the modal on Home/
login (not only in the matchroom); submits once; no re-prompt; non-captain never
sees it; no "session expired".
**Issue 8** Discover/Home/My-Matchrooms cards show date + time; Today/Tomorrow
shortcuts; no overflow.

## Recommended commit message
fix(matchrooms): clean lobby lifecycle and team interactions
