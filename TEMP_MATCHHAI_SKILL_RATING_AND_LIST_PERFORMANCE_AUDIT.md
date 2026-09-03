# MatchHai — Skill Rating / ELO & List Rendering / Pagination Audit

> **STATUS:**
> - **Part A (Skill Rating audit)** — complete + **IMPLEMENTED** (see PART D below).
> - **Part B (List/pagination audit)** — audit complete, **NOT yet implemented** (awaiting approval).
>
> Created: 2026-05-25 · Branch: `product-ready`
> Latest run (ELO implementation): `tsc --noEmit` **PASS (exit 0)**, `git diff --check` **clean**, `convex codegen` **run against dev `ardent-lynx-28`** (additive backward-compatible schema pushed to dev). No EAS build. No prod deploy. No wallet/payment/KYC changes.
> Do **not** delete this file.

---

## 0. How this audit was run

- Phase: audit-only — read + safe commands (`rg`, `read`, `tsc --noEmit`, `git status`, `git diff --stat`).
- 4 read-only sub-agents dispatched + orchestrator deep-reads:
  1. Skill rating / ELO backend (data model, mutations, init, external stats, formula)
  2. Matchroom / team / solo rating result flow (triggers, dedup, edge cases)
  3. Discover / player list pagination
  4. Admin / zone / super-admin list performance + backend query/index
- Findings cross-checked; the two rating agents **independently converged** on the headline finding (ELO match path is dead code).

---

# PART A — SKILL RATING / ELO / MATCHMAKING RATING AUDIT

## A0. Headline findings (TL;DR)

1. **🔴 CRITICAL — The match-result ELO pipeline is DEAD CODE. Ratings never change from match outcomes.**
   `applyMatchResult` ([skillRatingService.ts:395](src/services/skillRatingService.ts#L395)) and the mutation it calls, `applyMatchSkillUpdates` ([users.ts:792](convex/users.ts#L792)), have **zero call sites** anywhere in the app. The result lifecycle (captain report → vote → `finalizeMatchroomResult`) resolves a winner and sends notifications but **never invokes any rating logic**. After onboarding, a player's rating is effectively frozen.

2. **🔴 CRITICAL — Rating mutations are unauthenticated & client-driven.**
   `updateSkillScores`, `applyMatchSkillUpdates`, `updateGamePreferences`, `updateFullProfile` ([users.ts](convex/users.ts)) take a `userId` arg and patch it with **no `ctx.auth` check**. Any client can set **any** user's rating to anything (100/Elite for self, 0 for a rival). All ELO math runs on the client.

3. **🔴 CRITICAL — No idempotency / replay guard.** `applyMatchSkillUpdates` only bumps `matchroom.updatedAt`; it does not mark a match as "rating applied" nor check for prior application. If wired up, replays would double-count W/L and deltas.

4. **🟠 HIGH — No server-side range validation.** Schema `rating: v.number()` ([schema.ts:6](convex/schema.ts#L6)); 0–100 clamp is client-only.

5. **🟠 HIGH — External calibration is forgeable.** Linking Steam/FACEIT/PSN checks uniqueness but **not ownership** → smurf/inflation of the *initial* rating. After first calibration, refresh never recalculates the rating.

6. **🟡 MED — Teams have no rating; team stats never update.** `teams.stats` (W/L) has a defined writer (`updateStats`) with **zero callers**; there is no team ELO field at all. `teamChallenges.result` stores only `{winnerId, score}`.

7. **🟡 MED — No draw outcome in the lifecycle.** `finalWinner` is strictly `team1|team2`; ties are resolved by coin-flip (`chooseRandomWinner`), even though the ELO helper supports `'draw'`.

8. **🟠 HIGH — `admin_review` is a dead end.** Invalid/disputed results set `status="admin_review"` and alert super-admins, but **no mutation finalizes an admin-review match** → such matches are stuck and (even once ratings exist) never resolved.

## A1. Data model audit

No dedicated `leaderboard` / `playerStats` / `ratingHistory` tables exist. All rating data is embedded.

### `users` table — rating/stat fields ([schema.ts](convex/schema.ts))

| Field | Line | Type | Meaning | Scope | Written by | Displayed |
|---|---|---|---|---|---|---|
| `skillScores` | ~263 | object keyed by game (`cs2,cs16,valorant,tekken,tekken8,futsal,cricket,indoor_cricket,fc25,fc26,padel,pickleball`) | Authoritative MatchHai rating per game | per-game, player | `updateSkillScores`, `applyMatchSkillUpdates`, `updateGamePreferences`, `updateFullProfile` | game-details, matchroom cards |
| `skillScores[game]` shape | 5–15 | `{rating, tier, matchesPlayed, wins, losses, initialSource?, initialRating?, lastMatchDate?, lastUpdated}` | 0–100 rating + tier + W/L | per-game | same | profile, matchrooms |
| `faceitElo` | 243 | number\|null | FACEIT ELO (display + cs2 calibration) | per-game(cs2) | `refreshExternalStats`, `updatePlatformLinks` | game-details |
| `faceitSkillLevel` | 244 | number\|null | FACEIT level 1–10 → cs2 initial rating | per-game(cs2) | same | game-details, register-step3 |
| `steamCs2Hours` | 241 | number\|null | CS2 hours; +5/+10 bonus to cs2 initial rating | per-game(cs2) | refresh | game-details |
| `steamStats` | 252 | `v.any()` | Raw Steam KD payload | player | refresh | game-details |
| `steamFc26Hours`, `steamTekken8Hours` | 253–254 | `v.any()` | Hours feeding fc26/tekken8 init (writer gap, see I-9) | per-game | (read in calc) | game-details |
| `psnStats` | 256 | `v.any()` | Trophy `progress` 0–100 → fc26/tekken8 calibration | per-game | refresh | game-details |
| `faceitStats` | 255 | `v.any()` | Raw FACEIT payload | player | refresh | — |
| identity (`steamId/faceitId/psn*`) | 233–249 | string\|null | External identity + uniqueness | player | step3/refresh | — |
| sync timestamps | 257–260 | number | Refresh cooldown | player | refresh | — |

> `skillScoreValidator.rating` is unconstrained `v.number()` — **no DB-level min/max**.

### `matchrooms` table — fairness/skill fields

| Field | Line | Meaning | Written by |
|---|---|---|---|
| `hostSkillScore` / `hostSkillTier` / `hostSkillContext` | 590–593 | Host rating snapshots | create ([matchrooms.ts:2029](convex/matchrooms.ts#L2029)) |
| `avgSkillScoreLive` | 596 | Live avg of rated players ("Live Fairness Stats") | `buildRoomSkillStats` ([matchrooms.ts:1143](convex/matchrooms.ts#L1143)) on create/join/leave |
| `totalSkillSum` | 597 | Sum of ratings | `buildRoomSkillStats` |
| `ratedPlayerCount` | 598 | Count rated players | `buildRoomSkillStats` |
| `skillLevel` | 589 | Free-text label e.g. "Any" | create |
| slot/player `skillTier` | 94/111 | Tier snapshot | join |

> **There is no `roomAvgSkill` field** — the live-average is `avgSkillScoreLive`, used as a soft fairness gate (~[matchrooms.ts:2984](convex/matchrooms.ts#L2984)), surfaced to client as `roomAverageRating`.

### `teams` — `stats:{wins,losses,matchesPlayed}` ([schema.ts:939](convex/schema.ts#L939)). **No `teams.rating`/`skillRating`.** Writer `updateStats` has no callers.
### `bookingRequests` — `hostSkillScore/Tier/Context` snapshots (~805). No rating writes.

## A2. Initialization audit

A new user gets a per-game (not global) rating via **three paths**; the default `45` is **never silently persisted**.

1. **Register step 3** ([register-step3.tsx](app/auth/register-step3.tsx)) — links Steam/FACEIT/PSN into onboarding store; does **not** calibrate `skillScores` here.
2. **`prepareProfileForMatchParticipation`** ([matchService.ts:251](src/services/convex/matchService.ts#L251)) — on join/create, if no skill for game → `initializeSkillIfMissing`.
3. **`initializeSkillIfMissing`** ([skillRatingService.ts:298](src/services/skillRatingService.ts#L298)) — returns existing; else `calculateInitialRating`. If source `questionnaire` (no external data) → returns `null` (no default save) → UI shows `SkillAssessmentModal`. If external data → auto-saves via `updateSkillScores`.
4. **Game-details** ([game-details.tsx](app/(player)/profile/game-details.tsx)) — calibrate from external or open questionnaire.

`calculateInitialRating` only has real branches for **cs2** (FACEIT level → 25/50/75/90 + Steam-hours bonus), **fc26** (PSN progress → 20–80 + Steam hours), **tekken8** (PSN progress). `cs16`, `valorant`, futsal, cricket, padel, pickleball → questionnaire only.

## A3. Matchroom rating flow audit

Result lifecycle ([matchrooms.ts](convex/matchrooms.ts)): completed → `submitCaptainReport` (:2393) → both agree → `finalizeMatchroomResult` (:339); disagree+≤2 players → coin-flip (`chooseRandomWinner` :175); disagree+>2 → `participant_vote` → `submitParticipantVote` (:2489) → majority/plurality/coin-flip → finalize. Invalid roster → `markInvalidResultVerificationForAdminReview` (:982).

**The single chokepoint `finalizeMatchroomResult` contains no rating call.** Every matchroom type (solo / team-captain / zone booking / broadcast / walk-in) flows through the same path → **no rating change in any case**. Result UI ([result.tsx:66](app/matchrooms/result.tsx#L66)) builds "teams" by a naïve 50/50 `players.slice` for display, not real roster.

## A4. Team rating flow audit

- No team rating field exists. `teams.stats` W/L never updates (`updateStats` [teams.ts:606](convex/teams.ts#L606) + wrapper `teamService.updateTeamStats` [:349](src/services/convex/teamService.ts#L349) have **zero callers**).
- `teamChallenges.ts` has **no result/finalize/rating logic**; challenges create a matchroom that then inherits the (rating-less) matchroom flow.
- Lineup/sub/leave handling is moot today; if wired, sides are raw client-supplied UID arrays at report time.

## A5. Rating formula audit ([skillRatingService.ts:357–503](src/services/skillRatingService.ts#L357))

`Expected = 1/(1+10^((opp−cur)/40))`, `delta = round(K·confidence·(actual−expected))`, `K = 8` if `matchesPlayed<20` else `4`. Scale 0–100, `DEFAULT_RATING=45`.

- **Max delta/match:** provisional `K=8` → up to ±8; established `K=4` → up to ±4; even teams → ±2. Reasonable magnitude but slow given coarse tiers (Intermediate = 50–70).
- **Opponent rating?** Yes — **team average** of the opposing side (each player vs opp-team-avg).
- **Margin / kills / MVP?** No. Pure W/L/draw. `confidence` always 1.0.
- **Anti-smurf?** None — and provisional K is *higher*, letting sandbaggers move faster. Initial calibration forgeable.
- **Decay?** None (`lastMatchDate` stored, unused).

## A6. External stats interaction audit

- Steam ([externalApis.ts:37](convex/externalApis.ts#L37)), FACEIT (:132), PSN (:311) are public actions (no auth).
- Stats feed rating **only at initial calibration**. `refreshExternalStats` ([users.ts:632](convex/users.ts#L632)) writes only display fields — **refresh never recalculates `skillScores`**.
- Cooldown via `EXTERNAL_SYNC_COOLDOWN_MS` unless `force:true`.
- **Ownership not proven** — only uniqueness checked → any public profile can be linked and inherit calibration. ✅ Matches the recommended "display-confidence, internal-rating-from-results" model **only partially**: external influences init, but internal results currently don't influence rating at all (because of the dead-code bug).

## A7. Security / abuse audit

| Risk | Status |
|---|---|
| Client can submit rating directly | **YES** — unauthenticated mutations (I-2). |
| Self-report wins repeatedly | Moot now (no rating from results) but no dedup if wired (I-3). |
| Captain finalize without opponent confirmation | Only via coin-flip on ≤2-player disagreement; otherwise needs both/vote. |
| Friends farm by repeating matches | No anti-farm; no cooldown between same opponents. |
| Cancelled/no-show affects rating | No (no rating at all). |
| Admin override of rating | No admin rating mutation; `admin_review` has no resolve path (I-4/H). |
| Rating history / audit trail | **None.** |
| Bot/walk-in/replacement exploits | Non-user UIDs default to rating 45 and skew averages if wired (I-7). |
| Dedup/idempotency on rating update | **None** (I-3). |

## A8. Skill Rating Audit — structured issues

| # | Issue | Sev | Files (file:line) | Current | Expected | Fix | Test |
|---|---|---|---|---|---|---|---|
| A-I1 | ELO match path is dead code | 🔴 CRIT | [skillRatingService.ts:395](src/services/skillRatingService.ts#L395); [matchrooms.ts:339](convex/matchrooms.ts#L339) | Winner finalized; ratings/stats never change | On finalize, server applies skill+team updates | Move rating math server-side; call from `finalizeMatchroomResult` | Finalize a match → assert each participant's `rating/wins/matchesPlayed` changed |
| A-I2 | Rating mutations unauthenticated | 🔴 CRIT | [users.ts:743](convex/users.ts#L743),[:792](convex/users.ts#L792),[:1061](convex/users.ts#L1061),[:1080](convex/users.ts#L1080) | Any client sets any user's rating | Auth + ownership; batch path = `internalMutation` | Add `ctx.auth` checks; convert to internal | As A, call `updateSkillScores({userId:B,rating:100})` → rejected |
| A-I3 | No idempotency/replay guard | 🔴 CRIT (latent) | [users.ts:813–839](convex/users.ts#L813) | Only bumps `updatedAt` | Per-match "applied" marker / ledger | `matchroom.skillApplied` flag or `ratingHistory` row keyed by matchroomId | Apply twice → change once |
| A-I4 | No server-side range validation | 🟠 HIGH | [schema.ts:6](convex/schema.ts#L6); clamp client-only | Accepts any number | Clamp 0–100 in handler | Clamp in mutation | Submit 999/−50 → stored 100/0 |
| A-I5 | External calibration forgeable | 🟠 HIGH | [register-step3.tsx](app/auth/register-step3.tsx); [externalApis.ts](convex/externalApis.ts); calc [:100–163](src/services/skillRatingService.ts#L100) | Uniqueness only, no ownership | Ownership proof or display-only | OAuth / profile-code; else require questionnaire+history | Link a public L10 FACEIT acct → cannot calibrate |
| A-I6 | admin_review dead end | 🟠 HIGH | [matchrooms.ts:982](convex/matchrooms.ts#L982) | Alerts admins; no finalize mutation | Admin resolve + finalize | Add super-admin resolve mutation calling finalize | Force invalid roster → admin resolves |
| A-I7 | No margin/decay/anti-smurf | 🟡 MED | [skillRatingService.ts:366–503](src/services/skillRatingService.ts#L366) | Pure W/L; confidence=1.0; no decay | Optional margin/MVP (KD available); decay; smurf caps | Add weighting/decay; reconsider provisional K | Two sets differing only by margin → different deltas |
| A-I8 | Team rating/stats never update | 🟡 MED | [teams.ts:606](convex/teams.ts#L606); [teamService.ts:349](src/services/convex/teamService.ts#L349); [schema.ts:939](convex/schema.ts#L939) | `updateStats` unused; no team rating | Update team stats (+optional rating) on team-match finalize | Call from finalize for team matches | Finalize team match → team `stats.wins`++ |
| A-I9 | No draw/no-contest outcome | 🟡 MED | [matchrooms.ts:357](convex/matchrooms.ts#L357),[:175](convex/matchrooms.ts#L175) | Ties → coin flip | Support draw/void | Add `draw`/`void` to `finalWinner` → `'draw'` (helper already supports) | Tie vote → draw, not random win |
| A-I10 | Non-user roster entries skew averages | 🟡 LOW-MED | [skillRatingService.ts:412–434](src/services/skillRatingService.ts#L412) | Missing profiles default to 45, still averaged | Exclude non-rated | Filter to real UIDs before averaging | Include bot UID → excluded |
| A-I11 | Legacy keys / hours-field writer gap | 🟢 LOW | [schema.ts:253–254,269,273](convex/schema.ts#L253); read [:143](src/services/skillRatingService.ts#L143) | `tekken/tekken8`,`fc25/fc26` ad-hoc; `steamFc26Hours` never written | Canonicalize keys; populate or remove hours | Migration + populate | Link Steam w/ FC26 hours → influences init |

### A8 — Recommended MVP rating model (for the eventual implementation phase, NOT now)
- Per-game rating, base **1000** on a classic ELO scale (or keep 0–100 but document conversion) — pick one and store consistently.
- `K = 24` normal, `K = 12` casual/unverified/walk-in; expected score from team-average; winner gains/loser loses; **no update** for cancelled/expired/no-contest; **update once** per finalized result.
- Append-only `ratingHistory` ledger keyed by `(matchroomId, userId)` for audit + dedup.
- Server-authoritative: client submits outcome only; server computes deltas inside `finalizeMatchroomResult` (internal mutation).
- External stats → initial **confidence/seed** only; ownership-verified.

### A8 — Recommended implementation phases (post-approval)
- **Phase R1 (security first):** auth+ownership on rating mutations; convert batch update to `internalMutation`; server-side clamp. _(no behavior change to users)_
- **Phase R2 (wire the engine):** move ELO math server-side; call from `finalizeMatchroomResult`; add `skillApplied` flag + `ratingHistory` ledger; handle cancelled/expired/draw/no-roster.
- **Phase R3 (teams):** team stats on team-match finalize; decide on team rating.
- **Phase R4 (fairness polish):** decay, anti-smurf caps, margin/MVP weighting, ownership-verified calibration.

---

# PART B — LIST RENDERING / PAGINATION / PERFORMANCE AUDIT

## B0. Executive summary

App-wide pattern: **every list query uses `.collect()` or a fixed `.take(N)`/slice, with filtering done server-side over a partial batch or client-side over the loaded batch. No screen uses `usePaginatedQuery`/cursor pagination, and no list has `onEndReached`/load-more.** Two classes of problem:

1. **Performance / read-cost** — unbounded `.collect()` on growing tables (wallet, dashboard, booking queue) + 5s polling that re-runs full scans.
2. **Correctness (worse than perf)** — user-scoped lists derived from a **global newest-200 take** silently drop the user's own older records ("My Matchrooms", Schedule), and filter UIs claim completeness while filtering only a partial batch (Discover, all super-admin lists).

Confirmed prior findings still present: **H-02** (booking queue full-table scan every 5s) and **H-03** (zone matchroom list global `.take(200)`).

## B1. List inventory by module + B2. Per-list detail

### Player lists
| Screen | File | Query (file:line) | Backend limit | Render | Filter | onEnd? | Scale | RISK | Recommend |
|---|---|---|---|---|---|---|---|---|---|
| Discover · Matchrooms | [DiscoverMatchroomList.tsx](src/features/discover/components/DiscoverMatchroomList.tsx) | `listDiscoverMatchrooms` ([discover.ts:464](convex/discover.ts#L464)) | `.take(≤250)` by index | FlatList(memo) | server, partial | No | grows w/ rooms | MED | cursor/usePaginatedQuery |
| Discover · Players | [DiscoverPlayerList.tsx](src/features/discover/components/DiscoverPlayerList.tsx) | `listDiscoverPlayers` ([discover.ts:354](convex/discover.ts#L354)) | `.take(≤300)` users; `.collect()` friendships+notifs | FlatList(memo) | server, partial | No | grows w/ users | **HIGH** | search index + paginate; bound collects; drop focus-refetch |
| Discover · Teams | [DiscoverTeamList.tsx](src/features/discover/components/DiscoverTeamList.tsx) | `listDiscoverTeams` ([discover.ts:551](convex/discover.ts#L551)) | `.take(≤200)`; `.collect()` notifs+pending challenges | FlatList(memo) | server, partial | No | grows w/ teams | MED | paginate; bound collects |
| Discover · Zones | [DiscoverZoneList.tsx](src/features/discover/components/DiscoverZoneList.tsx) | `listDiscoverZones` ([discover.ts:691](convex/discover.ts#L691)) | `.take(≤100)` by status | FlatList(memo) | server, partial | No | few venues | LOW→MED | paginate when >100 |
| My Matchrooms | [my.tsx](app/matchrooms/my.tsx) | `getUserMatchrooms` ([matchrooms.ts:1744](convex/matchrooms.ts#L1744)) | `.take(200)` **global** then JS user-filter | FlatList(memo) | frontend | No | breaks as global rooms grow | **HIGH/crit** | per-user index, not global take |
| Schedule | [schedule.tsx](app/(player)/schedule.tsx) | `getUserMatchrooms` + intents/notifs/reports | global-200 + per-user `.collect()` | **ScrollView.map** | frontend | No | history grows | **HIGH** | FlatList + per-user paginated history |
| Inbox | [inbox.tsx](app/(player)/inbox.tsx) | `listInboxPage` ([notifications.ts:701](convex/notifications.ts#L701)) | `.take(400)`→slice 100 | FlatList(memo) | frontend | No | hard cap 100 | MED | cursor load-more past 100 |
| Wallet txns | [wallet.tsx](app/(player)/wallet.tsx) | `wallet.listHistory` ([wallet.ts:78](convex/wallet.ts#L78)) | **`.collect()` ×2 unbounded** | **ScrollView.map** | frontend | No | grows per user forever | **HIGH** | FlatList + `.paginate()` |
| Friends | [friends.tsx](app/(player)/friends.tsx) | `getUserFriends` + `getUnreadCounts` | per-user `.collect()` | FlatList(memo) | frontend | No | small | LOW | ok |
| My Teams (profile) | [profile.tsx](app/(player)/(tabs)/profile.tsx) | `getUserTeams` ([teams.ts:236](convex/teams.ts#L236)) | `.take(200)`, `.slice(0,3)` | ScrollView | n/a | No | small | LOW | ok |
| Team detail/members | [teams/[id].tsx](app/teams/[id].tsx) | team+members | bounded by team size | ScrollView.map | n/a | No | small | LOW | ok |
| Chat rooms list | [chatrooms.tsx](app/(player)/chatrooms.tsx) | `chat/friendChat/teamChallengeChat listForUser` ([chat.ts:336](convex/chat.ts#L336)) | `.collect()` + N+1 `get` | FlatList(memo) | frontend | No | grows w/ chats joined | MED | denormalize lastMessage + paginate |
| Matchroom chat msgs | [chat/[id].tsx](app/matchrooms/chat/[id].tsx) · [ChatThread.tsx](src/features/chat/ChatThread.tsx) | `listMessagesForMatchroom` ([chat.ts:384](convex/chat.ts#L384)) | `.take(200)` + 200× `storage.getUrl` | FlatList(memo) | none | No (no older) | bounded 200 | MED | reverse cursor; cache attachment URLs |
| Friend chat msgs | [friend-chat/[friendId].tsx](app/(player)/friend-chat/[friendId].tsx) | `friendChat.listMessages` ([friendChat.ts:207](convex/friendChat.ts#L207)) | `.take(200)` | FlatList(memo) | none | No (no older) | bounded 200 | MED | reverse cursor |
| Reports | [reports.tsx](app/(player)/reports.tsx) | `reports.listMine` ([reports.ts:467](convex/reports.ts#L467)) | **`.collect()` unbounded** | **ScrollView.map** | none | No | low/user | MED | FlatList + `.paginate()` |
| Venue detail | [zones/[id].tsx](app/(player)/zones/[id].tsx) | `getPlayerVenueDetails` | single doc | ScrollView (bounded) | n/a | n/a | n/a | LOW | ok |

### Zone Admin lists
| Module | Data source | Backend limit | Render | Filter | Risk | Recommend |
|---|---|---|---|---|---|---|
| Bookings — requests | `subscribeZoneBookingQueue` (poll 5s) → `listBookingQueueForZone` ([zoneAdminBooking.ts:683](convex/zoneAdminBooking.ts#L683)) | **full scan `.collect()`** | ScrollView.map | client | **CRITICAL (H-02)** | `by_zoneId_and_status` index + reactive |
| Bookings — matchrooms | `subscribeZoneMatchrooms` (poll 5s) → `listMatchroomsForZone` ([:952](convex/zoneAdminBooking.ts#L952)) | `.take(200)` global | ScrollView.map | client | **HIGH (H-03)** | `by_zoneOwnerUid` index; reactive; FlatList |
| Bookings — walk-ins | same matchroom sub, JS filter | inherits H-03 | ScrollView.map | client | HIGH | inherits H-03 |
| Bookings — history | `listBookingHistoryForZone` ([:742](convex/zoneAdminBooking.ts#L742)) | `.take(≤300)` indexed | section.map | server+JS | MED | well-indexed (good) |
| Resources | `subscribeBranchResources/Branches` (poll 5s) | `.collect()` bounded/zone | ScrollView.map | client | LOW-MED | poll→reactive |
| Pricing | `pricingRuleService` (TTL poll) | bounded/zone | map | client | LOW | ok |
| Notifications | `by_toUid*` | `.take` windows | list | client | LOW | ok |
| Support | indexed `.take()` | bounded | list | server | LOW | best-practice file |
| Reports (zone) | `reports by_zoneId .collect()` ([reports.ts:510](convex/reports.ts#L510)) | bounded/zone | map | client | LOW | ok |
| Audit | `zoneAudit` ([zoneAudit.ts:69](convex/zoneAudit.ts#L69)) | `.take(≤300)` indexed | ScrollView.map | server | LOW | good model |
| Insights | aggregates over above | derived | charts | client | MED | verify not summing a `.take(200)` set |
| Branches | `getZoneBranches` (poll 5s) | bounded | map | client | LOW | poll→reactive |

### Super Admin lists — common: fetch once (limit 100–150), all filters client-side over loaded rows, `ScrollView`+`.map` (no virtualization, no pagination anywhere).
| List | Query (file:line) | Limit | Misleading filters? | Render | Risk | Recommend |
|---|---|---|---|---|---|---|
| Dashboard | `getDashboardSummary` ([admin.ts:591](convex/admin.ts#L591)) | **~13 full-table `.collect()`** | counts real but via full scans | ScrollView | **CRITICAL** | maintained aggregate counters |
| Users | `listUsers` ([admin.ts:1504](convex/admin.ts#L1504)) | `.take(150)` | YES (status/role/KYC over loaded) | ScrollView.map | **HIGH** | server filter + cursor; FlatList |
| Matchrooms | `listSuperAdminMatchrooms` ([admin.ts:1037](convex/admin.ts#L1037)) | `.take(100)` | YES (6 filters over 100) | ScrollView.map | **HIGH** | server filter + paginate |
| Zones | `listZones` ([admin.ts:1454](convex/admin.ts#L1454)) | `.take(100)` | YES (city/area) | ScrollView.map | MED | paginate + FlatList |
| Payments | `listPaymentsV2` ([admin.ts:1312](convex/admin.ts#L1312)) | `.take(≤500)` (date+status in index) | partial (kind/amount/search post-filter) | ScrollView.map | MED | **best backend template**; +paginate/FlatList |
| Withdrawals | `listZoneWithdrawalRequests` ([admin.ts:1629](convex/admin.ts#L1629)) | `.take(≤200)` | YES (branch; zone-detect in JS) | ScrollView.map | MED | dedicated index/flag |
| Reports | `listReports` ([admin.ts:1530](convex/admin.ts#L1530)) | `.take(100)` | YES (game) | ScrollView.map | MED | paginate + FlatList |
| Identity verif. | `listIdentityVerifications` ([admin.ts:833](convex/admin.ts#L833)) | `.take(≤500)` pending | YES (role; pending=JS multi-status) | ScrollView.map | MED | `by_role_and_status` index |
| Audit logs | `listSuperAdminAuditLogs` ([admin.ts:789](convex/admin.ts#L789)) | `.take(limit*3≤600)`→slice | YES (filters in JS after over-fetch) | ScrollView.map | MED | push filters into index; cursor |
| Notifications | `listMyNotifications` ([admin.ts:1659](convex/admin.ts#L1659)) | `.take(limit*4)` | category over loaded | ScrollView.map | LOW-MED | paginate |
| Support tickets | `listSupportTickets` ([admin.ts:1605](convex/admin.ts#L1605)) | `.take(100)` | YES (priority/category/role/assignee) | ScrollView.map | MED | paginate; per-row joins |
| Easypaisa | `listEasypaisaTransactions` ([admin.ts:1080](convex/admin.ts#L1080)) | per-status `.take`+dedupe | YES (orderRef over loaded) | ScrollView.map | MED | superseded by V2; consider removing |

## B3. Discover tab special audit
- Segment model: mount-once + keep-mounted-hidden ([discover.tsx:131](app/(player)/(tabs)/discover.tsx#L131)) → no remount on tab switch (good). But Players/Teams **refetch on every focus** (`useFocusEffect`), re-running the 300/200 candidate scan.
- All 4 queries: index-bounded `.take()` (no full-table scan) **but filter server-side over a partial batch** → "N found" is "N of first ≤cap candidates". Worst for **Players** (300-cap, relevance-blind index order, focus-refetch). `lastFetchKey` ref declared but unused.
- All cards memoized, stable keys, `removeClippedSubviews` — good. No `onEndReached` on any segment.
- `userCity` hardcoded `"Karachi"` in zones ([DiscoverZoneList.tsx:126](src/features/discover/components/DiscoverZoneList.tsx#L126)).

## B4. Super Admin list audit
See table above. Key: Dashboard `getDashboardSummary` is the single worst-scaling query (~13 unbounded `.collect()` across users/zones/reports/matchrooms/payments/wallet/teams). All list screens lack pagination and use non-virtualized `ScrollView.map`; heavy filter UIs (Matchrooms, Users) operate over only the loaded 100–150 rows → misleading. `listPaymentsV2` is the one to copy (date+status pushed into the index range).

## B5. Zone Admin list audit
- **H-02 confirmed still present:** [zoneAdminBooking.ts:683](convex/zoneAdminBooking.ts#L683) `query("bookingRequests").withIndex("by_status").collect()` — `by_status` used only for a handle, **no `.eq()` bound → scans whole table**, then JS-filters status+zone (:695). Polled every 5s ([zoneAdminBookingService.ts:379](src/services/convex/zoneAdminBookingService.ts#L379), `POLL_INTERVAL_MS=5000`).
- **H-03 confirmed still present:** [zoneAdminBooking.ts:952](convex/zoneAdminBooking.ts#L952),[:967](convex/zoneAdminBooking.ts#L967) `matchrooms by_createdAt take(200)` ×2 then JS filter `zoneOwnerUid`/location. Polled every 5s.
- 4 zone-admin pollers (bookings, matchrooms, branches, resources) all 5s `setInterval`; **service files' own comments say to use reactive `useQuery`**. Converting removes the 5s scan multiplier.

## B6. Backend query / index audit (critical/high)
| Query (file:line) | Table | Index | collect/take | Post-collect JS filter | Growth | Risk | Recommended |
|---|---|---|---|---|---|---|---|
| `listBookingQueueForZone` [:683](convex/zoneAdminBooking.ts#L683) | bookingRequests | `by_status` **no `.eq()`** = full scan | `.collect()` | status+zoneId | scales | **CRIT** | `by_zoneId_and_status` |
| `getDashboardSummary` [:591](convex/admin.ts#L591) | users/zones/reports/matchrooms/payments/wallet/teams | mostly `by_status`/none | `.collect()` ×~13 | counts/sums in JS | scales | **CRIT** | maintained aggregate counters |
| `listMatchroomsForZone` [:952](convex/zoneAdminBooking.ts#L952) | matchrooms | `by_createdAt` | `.take(200)` ×2 | zoneOwnerUid/location | scales | **HIGH** | `by_zoneOwnerUid` |
| `getCompletedMatchroomsForUser` [matchrooms.ts:2587](convex/matchrooms.ts#L2587) | matchrooms | `by_status(completed)` | `.collect()` (all completed) | uid membership | scales | **HIGH** | player-membership index |
| `getUserMatchrooms`/`listByPlayer` [matchrooms.ts:1744](convex/matchrooms.ts#L1744) | matchrooms | `by_createdAt` | `.take(200)` | `playerUids.includes` | scales | **HIGH** | player index (correctness + perf) |
| `wallet.listHistory` [wallet.ts:78](convex/wallet.ts#L78) | walletTransactions+paymentTransactions | `by_userId` | `.collect()` ×2 | none | scales/user | **HIGH** | `.paginate()` |
| `listUsers`/`listReports`/`listSuperAdminMatchrooms` | users/reports/matchrooms | indexed | `.take(100–150)` | client-side filters | scales | MED-HIGH | push filters to index + paginate |
| `searchTeams` [teams.ts:225](convex/teams.ts#L225) | teams | default | `.take(200)`+JS substring | name | scales | MED | search index |
| `discover pendingChallenges` [discover.ts:607](convex/discover.ts#L607) | teamChallenges | `by_status(pending)` | `.collect()` (all pending) | none | scales | MED | per-team filter |
| `reports.listMine` [reports.ts:467](convex/reports.ts#L467) | reports | `by_reporterUid` | `.collect()` | status | scales/user | MED | `.paginate()` |
| chat/friendChat `listForUser` [chat.ts:336](convex/chat.ts#L336) | chatroomMembers | `by_userId` | `.collect()`+N+1 get | none | scales/user | MED | denormalize + paginate |

**Good patterns to replicate:** `convex/support.ts` (all indexed+`.take()`), [zoneAudit.ts:69](convex/zoneAudit.ts#L69) (status/module index + `.take(≤300)`), [admin.ts:1312 listPaymentsV2](convex/admin.ts#L1312) (date+status in index range).

## B7. List Audit — structured + recommended phases

### Recommended pagination patterns
- Convex `.paginate()` + RN `usePaginatedQuery` with `onEndReached` for growing user lists (wallet, reports, chat history, schedule history, inbox >100).
- Server-side filtering pushed into compound indexes for all admin lists (status/date/role/zone) instead of client-side `useMemo` over a loaded page.
- Replace user-scoped "global newest-N take" with **user-scoped indexes** (host/player membership) — this is correctness, not just perf.
- Maintained aggregate counters for the super-admin dashboard.
- Convert 5s zone-admin pollers to reactive `useQuery` subscriptions.

### Recommended implementation phases (post-approval)
- **Phase L1 (correctness + worst scans):**
  - H-02 `by_zoneId_and_status` index + bounded query + reactive subscription.
  - H-03 `by_zoneOwnerUid` index; drop global `by_createdAt` 200-take.
  - My Matchrooms / Schedule: user-scoped membership index (fixes silent record loss).
  - Dashboard aggregate counters.
- **Phase L2 (admin pagination):** super-admin Users/Matchrooms/Reports/Payments/Identity/Audit/Support — server-side filters + cursor pagination + FlatList.
- **Phase L3 (player pagination):** Wallet, Reports, Inbox(>100), chat history (reverse cursor + attachment URL cache), Discover infinite scroll + server search (Players first).
- **Phase L4 (polish):** convert remaining pollers to reactive; memoize remaining `ScrollView.map` → FlatList; image/attachment caching; verify Insights aggregates.

### Test cases (representative)
- Seed 5k `bookingRequests` across many zones → open zone bookings → query reads only that zone's active rows (Convex read count flat).
- Create 250 matchrooms in other zones + 3 in target zone → all 3 appear in zone matchroom list and in the host's "My Matchrooms".
- Seed 500 wallet transactions → Transactions tab mounts one page, scroll loads more.
- >300 players, search a player created early → findable.
- 150 notifications → items 101–150 reachable.
- Super-admin Matchrooms filter by a zone with >100 rooms → returns matches beyond the first 100.
- Chat with 500 messages → scroll-up loads older; `storage.getUrl` not recomputed for unchanged messages.

---

# PART C — FINAL REPORT

1. **Files inspected** — see appendix (≈70 files across `convex/`, `src/services/`, `app/`, `src/features/`).
2. **Skill rating current logic** — per-game 0–100 score in `users.skillScores`; client-side ELO in `skillRatingService.ts`; initialized from external stats (cs2/fc26/tekken8) or questionnaire; displayed on profile/matchrooms; used for matchmaking fairness (`avgSkillScoreLive`, skill brackets, discover filters).
3. **Rating formula** — exists (`calculateRatingChange`, K 8/4, divisor 40, 0–100) **but is unreachable from match results**.
4. **Rating update triggers found** — only questionnaire (`saveSelfAssessment`) and external auto-init (`initializeSkillIfMissing`). **No match-result trigger** (dead code).
5. **Rating security/abuse risks** — unauthenticated mutations (set any user's rating), no idempotency, no range validation, forgeable external calibration, no audit ledger, coin-flip "wins". (A-I1…A-I11.)
6. **Recommended rating phases** — R1 secure mutations → R2 wire engine server-side w/ dedup+ledger → R3 team stats → R4 fairness polish.
7. **Total lists audited** — ~14 player + ~12 zone-admin + ~12 super-admin = **~38 list surfaces** + ~25 backend list queries.
8. **Critical/high list issues** — H-02 (booking full scan/5s), H-03 (zone matchroom global take), Dashboard ~13 full scans, My Matchrooms/Schedule global-200 correctness loss, Wallet unbounded `.collect()`+ScrollView, Discover Players 300-cap, super-admin Users/Matchrooms misleading filters.
9. **Pagination first** — Phase L1: H-02, H-03, user-scoped match indexes, dashboard counters.
10. **Indexes likely needed** — `bookingRequests.by_zoneId_and_status`; `matchrooms.by_zoneOwnerUid` + player-membership index (host/player); `walletTransactions` paginate; `identityVerifications.by_role_and_status`; team name search index; dedicated zone-withdrawal flag/index. *(Not created in this phase.)*
11. **Code changed?** — **No.** Only this tracker file was created.
12. **TypeScript** — `npx tsc -p tsconfig.json --noEmit` → **PASS (exit 0)**.
13. **git** — tracker is the only new file; all `M` files are from the prior approved keyboard/teams batch (unchanged by this audit).
14. **Recommended next implementation phase** — Given launch risk, **Phase R1 (secure rating mutations)** + **Phase L1 (H-02/H-03 + user-scoped match indexes + dashboard counters)** are the highest-value, lowest-blast-radius first steps. Await approval before any schema/index/query/rating change.

---

## Appendix: Files inspected
**Convex:** schema.ts, users.ts, matchrooms.ts, teams.ts, teamChallenges.ts, discover.ts, admin.ts, zoneAdminBooking.ts, bookings.ts, wallet.ts, notifications.ts, reports.ts, chat.ts, friendChat.ts, teamChallengeChat.ts, externalApis.ts, support.ts, zoneAudit.ts, zoneAdminResources.ts, kyc.ts, zones.ts, dashboard.ts.
**Services:** skillRatingService.ts, matchService.ts, teamMatchService.ts, teamService.ts, userService.ts, externalApiService.ts, zoneAdminBookingService.ts, zoneAdminResourceService.ts, pricingRuleService.ts, superAdminService.ts, sharedPollingRegistry.ts, authService.ts.
**App (player):** (tabs)/discover.tsx, (tabs)/profile.tsx, schedule.tsx, inbox.tsx, wallet.tsx, friends.tsx, chatrooms.tsx, reports.tsx, profile/game-details.tsx, zones/[id].tsx, friend-chat/[friendId].tsx, auth/register-step3.tsx.
**App (matchrooms/teams):** matchrooms/my.tsx, result.tsx, vote.tsx, [id].tsx, chat/[id].tsx; teams/[id].tsx, challenge.tsx, challenge-create.tsx.
**App (zone):** modules/bookings.tsx (+hooks), resources.tsx, pricing.tsx, notifications.tsx, support.tsx, audit.tsx, insights.tsx, (tabs)/branches.tsx, components/ZoneBookings*Section.tsx.
**App (super-admin):** (tabs)/index.tsx, users.tsx, zones.tsx, (tabs)/payments.tsx, withdrawals.tsx, (tabs)/reports.tsx, identity-verifications.tsx, audit-logs.tsx, notifications.tsx, matchrooms.tsx, support-tickets.tsx, easypaisa.tsx.
**Features/components:** discover/components/Discover{Matchroom,Player,Team,Zone}List.tsx, chat/ChatThread.tsx, SkillAssessmentModal.tsx; constants/skillQuestions.

---

# PART D — SKILL RATING / ELO IMPLEMENTATION (DONE)

> Implements approved phases R1–R8. Server-authoritative dynamic ELO + security + history/idempotency + team stats/ELO. Sequential single-writer integration (no overlapping edits). Read-only QA sub-agent verified.

## D1. Files changed
| File | Change |
|---|---|
| `convex/ratingEngine.ts` | **NEW** — pure, server-only ELO engine (conversions, expected score, K-factor, individual + matchroom adjustments, caps, team ELO). No ctx/DB/side-effects. |
| `convex/schema.ts` | `skillScoreValidator.elo?`; matchroom `skillRatingAppliedAt/By/Version`; `teams.eloByGame` (`v.record`); `teamChallenges` index `by_matchroomId`; **new `ratingHistory` ledger table** (+4 indexes). |
| `convex/users.ts` | Added `requireProfileOwner`, field denylist + skill sanitizers; hardened `updateSkillScores`/`updateGamePreferences`/`updateFullProfile`; **removed** `applyMatchSkillUpdates`. |
| `convex/matchrooms.ts` | Added `applyRatingsForFinalizedMatch` + helpers; called from `finalizeMatchroomResult` (best-effort, idempotent). Player + team ELO + ledger. |
| `src/services/skillRatingService.ts` | Removed client ELO (`applyMatchResult`, `calculateRatingChange`, K consts); added `elo?` to `GameSkillScore`. |
| `convex/_generated/*` | Regenerated by `convex codegen` (dev). |

## D2. Security fixes (R1)
- `updateSkillScores`, `updateGamePreferences`, `updateFullProfile` now require `requireProfileOwner` (auth identity + caller `_id === userId`). **User A can no longer write User B's rating.**
- Generic mutations strip `PROTECTED_USER_FIELDS` (role/authId/kyc*/ban*/suspend*/trustScore/_id) → no privilege escalation.
- **`elo` is server-only**: client skill writes inherit existing `elo`, never accept a client value; rating clamped 0–100, tier recomputed server-side; server-managed W/L preserved (a re-assessment can't wipe earned ELO/stats).
- The unauthenticated client batch mutation `applyMatchSkillUpdates` was **deleted**; client `applyMatchResult`/`calculateRatingChange` removed. **No client-calculated ELO, no client deltas/averages remain.**

## D3. Rating scale & compatibility (R2) — Option A (additive)
- Internal `elo` is 1000-based (classic divisor 400); `rating` (0–100) + `tier` remain the **UI projection** and are still written on every update → **profile/matchroom cards unchanged**.
- Seed when `elo` missing: `elo = 500 + rating*10` (rating 0→500, 50→1000, 100→1500). UI projection: `rating = (elo−500)/10`.
- Display tier still uses the existing 0–100 thresholds (Beginner≤30/Casual≤50/Intermediate≤70/Advanced≤85/Pro≤95/Elite) for parity. An elo-tier mapping (`tierFromElo`, <800/…/1600+) exists in the engine for future leaderboard use; **not** used for display (documented compatibility choice).

## D4. Dynamic player ELO formula (R3) — `convex/ratingEngine.ts`
- Expected: `1/(1+10^((oppAvg−teamAvg)/400))`, per-side team averages (real users only).
- K-factor (server-computed): competitive 32 / normal 24 / casual 16 / walk-in 12 / admin 14 / bot-short 10; **×1.25 if <10 matches**, **×0.85 if >50**.
- Individual adj (vs own-team avg), clamp **[0.85,1.15]**: weaker-than-team winner gains more; stronger-than-team winner gains less; stronger-than-team loser loses more.
- Matchroom adj (vs room avg), clamp **[0.9,1.1]**: below-room winner bonus; above-room winner reduction; strong loser in weak room penalised more.
- Caps: general/competitive/admin **±40**, casual/walk-in **±20**, bot-short **±12**; **minimum ±1** on decisive results; draws may be 0. (FACEIT-style — verified by QA: weak-beats-strong > equal > strong-beats-weak; strong-loses-weak large negative.)

## D5. Match-result wiring (R4)
- ELO applied **only** inside `finalizeMatchroomResult` (the single finalize chokepoint) — i.e. after a **verified, finalized** result (captain agreement / participant majority / all-votes / tiebreak).
- **No update** on: unverified captain report, pending vote, `admin_review`, cancelled, expired, no real roster. Skips set the marker (deterministic, no retry loops).
- Sides built from canonical `slotsA`(team1)/`slotsB`(team2), **not** the UI 50/50 slice. Bots/walk-ins excluded (`resolveRealUserIds` drops uids that don't resolve to a user). Requires ≥1 real user per side.
- `winner==="team1"` → side A. Best-effort `try/catch` so a rating error can never roll back the finalized result (Convex single-transaction semantics confirmed).

## D6. Rating history / idempotency (R5)
- **`ratingHistory` ledger** row per player and per team: matchroomId, game, subjectType, userId/teamId, teamSide, old/new/delta, team/opponent/matchroom avg, expected/actual, kFactor, adjustmentFactors, resultSource, appliedAt.
- **Idempotency**: matchroom `skillRatingAppliedAt/By/Version` set once; `applyRatingsForFinalizedMatch` early-returns if already applied. Plus finalize entry points early-return on `status==="resolved"`. **Same match cannot apply twice** (player or team).

## D7. Team stats & team ELO (R6)
- Team-vs-team detected via `teamChallenges.by_matchroomId`. On finalize: winner `stats.wins++`, loser `stats.losses++`, both `matchesPlayed++` (previously **never** updated). `teamChallenges.result.winnerId` recorded if unset.
- Team ELO: `teams.eloByGame[game]`, seeded from active-lineup member-average ELO (else 1000), K=20, cap **±30**, idempotent via the same matchroom marker. Only updates for linked team-vs-team challenges (not random solo lobbies).

## D8. External stats policy (R7)
- Unchanged behavior, **verified**: `refreshExternalStats` writes only display fields (`faceit*`, `steam*`, `psn*`, sync timestamps) and **never `skillScores`** → external refresh cannot overwrite internal ELO. External data still seeds *initial* calibration only. (Ownership-of-external-account is still uniqueness-only — pre-existing A-I5 risk, not in this batch's scope.)

## D9. Known risks / deferred
- **Admin-resolved disputes are currently unrated (deferred).** The engine supports an `admin_resolved` K-factor (14), but no admin mutation routes through `finalizeMatchroomResult`. `admin_review` matches still correctly do **not** auto-update (per R4). Wiring a super-admin "resolve & finalize" mutation (audit item A-I6) is deferred — it touches the heavier session-token admin auth surface; recommended as a small follow-up that calls `finalizeMatchroomResult(..., "admin_resolved")`.
- **No draw outcome from the matchroom flow** — lifecycle still resolves ties via coin-flip (reduced to casual K here to soften coin-flip impact). Adding a true `draw`/`void` outcome remains a separate lifecycle change (A-I9); engine already supports `draw`.
- **External account ownership** (A-I5) unchanged — calibration still forgeable at link time; out of scope for this batch.
- `elo` clamps to [100,3000]; rating projection clamps [0,100].

## D10. QA — verification status
- `npx tsc -p tsconfig.json --noEmit` → **PASS (exit 0)**.
- `git diff --check` → **clean** (only LF/CRLF warnings).
- `npx convex codegen` → **exit 0** (dev `ardent-lynx-28`; additive/backward-compatible schema).
- Read-only QA sub-agent: **PASS** on security, no-client-ELO, engine correctness (incl. numeric sanity), wiring/eligibility, idempotency/ledger, UI compatibility, scope guard, external-stats policy. One low RISK = the deferred admin-resolve wiring (D9).

### Manual QA still recommended (runtime, not code-review)
1. User A `updateSkillScores({userId:B,...})` → rejected ("only update your own profile").
2. Self-assessment + game-details save still works for the logged-in user.
3. Finalize a 5v5 → each real participant's `elo/rating/wins/matchesPlayed` changed; `ratingHistory` rows exist; matchroom `skillRatingAppliedAt` set.
4. Re-trigger finalize / replay → no second application (counts unchanged).
5. Weak-vs-strong, strong-vs-weak, equal → deltas follow FACEIT ordering.
6. New (<10) vs established (>50) → larger vs smaller movement.
7. Walk-in/casual room → smaller capped delta; bot/non-user uid → ignored.
8. Cancelled/expired/admin_review → no rating change.
9. Team challenge finalize → both teams' `stats` + `eloByGame` update once; `result.winnerId` set.
10. Profile + matchroom cards still render rating/tier correctly.
11. External refresh → display stats change, `elo`/`rating` unchanged.

### Recommended commit message
```
fix(rating): add dynamic player and team ELO

Server-authoritative FACEIT-style ELO applied on verified finalized
results; secure self-only skill mutations; ratingHistory ledger +
idempotency markers; team stats & team ELO for team-vs-team challenges.
Removes client-calculated ELO. No wallet/payment/KYC changes.
```

---

# PART E — ADMIN-RESOLVE (Part D follow-up) + LIST/PERF (Part B) IMPLEMENTATION

> Verified: `convex codegen` (dev `ardent-lynx-28`, additive) + `tsc --noEmit` **PASS (exit 0)** + `git diff --check` **clean**. Backfill `matchrooms:backfillMatchroomMembers` run on dev (15 rooms). No wallet/payment/easypaisa/KYC logic changed.

## E1. Part D follow-up — admin-resolve wiring (DONE)
- `convex/matchrooms.ts` `resolveMatchroomResultByAdmin` (super-admin only): finalizes a disputed/admin_review match through the single `finalizeMatchroomResult` chokepoint with source `admin_resolved` → ELO applied with the reduced admin K (14). Fixes audit **A-I6** dead-end. `admin_review` still never auto-rates (only an explicit super-admin call does).

## E2. Part B — L1 backend correctness/scan fixes (DONE)
- **H-02** `convex/zoneAdminBooking.ts listBookingQueueForZone`: replaced whole-table `bookingRequests.withIndex("by_status").collect()` (polled every 5s) with per-zone-per-status reads via new index **`bookingRequests.by_zoneId_and_status`**. Result set identical (the old area branch was a no-op); reads now O(this zone's active requests).
- **H-03** `listMatchroomsForZone`: removed the two global `matchrooms.by_createdAt.take(200)` scans (ownerUid + locationHints branches). They were redundant — `includeInAdminList` already requires `zoneId === args.zoneId`, fully covered by the indexed `by_zoneId` branch. No behavior change; global scans gone.
- **My Matchrooms / Schedule correctness** (was HIGH: global newest-200 silently dropped a user's older rooms): new **`matchroomMembers`** join table (indexes `by_uid`, `by_matchroomId`, `by_matchroomId_and_uid`). `getUserMatchrooms` now reads hosted via `by_hostUid` (complete) + joined via the member index; `listByPlayer` and `checkTimeConflict` use the member index. Reads are **defensive** (post-filtered against live `playerUids`) so stale rows can't surface wrong rooms. `syncMatchroomMembers` called at every add/change site (create, direct join, paid join, slot-recalc, leave, remove-player). `backfillMatchroomMembers` internalMutation provided and **run on dev**.

## E3. Part B — list virtualization (L2/L3/L4 render fix) (DONE)
Converted growable `ScrollView`+`.map` lists → virtualized `FlatList` (memoized rows, stable keys, `ListHeaderComponent`/`ListEmptyComponent`, `RefreshControl` moved onto the list, `removeClippedSubviews`/`initialNumToRender`/`windowSize`). **Only the list container/rendering changed** — data fetching, filters, tabs, money math, and styles preserved. This fixes the core "renders every row at once" problem (only visible rows mount).
- **Player:** `wallet.tsx` (transaction history), `schedule.tsx` (rooms+actions merged into one FlatList), `reports.tsx`.
- **Super Admin:** `users.tsx`, `(tabs)/payments.tsx`, `(tabs)/reports.tsx`, `audit-logs.tsx`, `identity-verifications.tsx`, `matchrooms.tsx`, `notifications.tsx`, `support-tickets.tsx`, `withdrawals.tsx`, `zones.tsx`.
- **Zone Admin:** `ZoneBookings{Requests,Matchrooms,Walkins,History}Section.tsx`, `modules/audit.tsx`, `modules/support.tsx`, `modules/notifications.tsx`.

## E4. Deferred (NOT in this batch) — with rationale
Honest scope note: this batch did **virtualization + L1 correctness**, not full cursor pagination everywhere. Remaining:
- **Dashboard maintained counters** (`admin.ts getDashboardSummary`, ~13 full `.collect()`): the correct fix (running counters) must hook into create/payment mutations, which conflicts with the standing "do not change payment/money-movement logic" rule. **Deferred**; dashboard still functions (full scans) — recommend counters as a focused follow-up that avoids payment-write paths.
- **True cursor/infinite-scroll pagination** (`usePaginatedQuery` + new `.paginate()` backend queries) for wallet/reports/admin lists and Discover: **not added** — virtualization already fixes the render cost; cursoring needs runtime QA on money-adjacent screens. Backend `.collect()` read-cost for some lists remains. **Deferred.**
- **Zone-admin 5s polling → reactive `useQuery`**: deferred (risks live-queue behavior; needs runtime QA). Note H-02/H-03 already cut the per-poll cost dramatically.
- `super-admin/easypaisa.tsx` (superseded by `listPaymentsV2`) and the dashboard `upcomingRooms` (bounded) left un-virtualized.
- Backend: `searchTeams` index, `discover` pending-challenges collect, chat reverse-pagination — deferred.

## E5. Verification
- `npx convex codegen` (dev) → exit 0; `npx convex run matchrooms:backfillMatchroomMembers` → `{processed:15}`.
- `npx tsc -p tsconfig.json --noEmit` (NODE_OPTIONS heap 8192) → **PASS (exit 0)**.
- `git diff --check` → **clean**.
- ⚠️ **Runtime QA still required** (cannot run the app here): verify scroll behavior on every converted screen (esp. zone bookings sections — confirm no nested-scroll), wallet/payments amounts unchanged, pull-to-refresh, empty states, filters. One sub-agent (super-admin) hit a session limit mid-run; the orchestrator completed `support-tickets.tsx` + `zones.tsx` by hand and tsc-verified all touched files.
