# MatchHai Test Data Guide

Controlled test dataset for unit, E2E, and load testing of the MatchHai
Expo/React Native app on the **Convex staging deployment**.

> **STAGING / DEV ONLY. NEVER SEED PRODUCTION.**
> The seed and cleanup `.mjs` scripts and `convex/devCleanup` *hard-refuse*
> to run unless `CONVEX_DEPLOYMENT` begins with `dev:` (and explicitly refuse
> any `prod:` deployment). Always confirm your deployment target before running
> anything in this doc. See the [Safety checklist](#safety-checklist).

Related files:
- `.env.test.example` — config template (copy to `.env.test`, never commit real values).
- `__tests__/fixtures/index.ts` — in-memory unit-test fixtures (the conceptual mirror of this dataset).
- `convex/demoSeed.ts` — main seed/remove/export Convex functions.
- `convex/devTeamSeed.ts` — team-challenge seeding (consumes `seed_args.json`).
- `convex/devReset.ts`, `convex/devCleanup.ts` — full data wipes.
- `scripts/seed-*.mjs`, `scripts/remove-*.mjs`, `scripts/export-demo-data.mjs` — runners.

---

## 1. The test cast (controlled entities)

These roles/states match the unit fixtures in `__tests__/fixtures/index.ts` so
in-memory tests and seeded staging data stay conceptually aligned. The seed
scripts generate a large *realistic* population; for deterministic E2E we
additionally pin the named cast below (see [Seeding](#3-seeding-staging)).

### Users / roles
| Role | Fixture (`__tests__/fixtures/index.ts`) | Example staging email | Notes |
|------|------------------------------------------|------------------------|-------|
| Player A | `playerA` | `test.player.a@matchhai.demo` | basic player, elo 1000 |
| Player B | `playerB` | `test.player.b@matchhai.demo` | basic player, elo 1000 |
| Captain A | `captainA` | `test.captain.a@matchhai.demo` | owns Team Alpha, hosts rooms |
| Captain B | `captainB` | `test.captain.b@matchhai.demo` | opposing captain |
| Zone Admin | `zoneAdmin` | `test.zone.admin@matchhai.demo` | owns `zone_main` |
| Other Zone Admin | `otherZoneAdmin` | `test.other.zone.admin@matchhai.demo` | owns `zone_other` (cross-tenant auth tests) |
| Super Admin | `superAdmin` | `test.superadmin@matchhai.demo` | `role: "super-admin"` |
| Deleted User | `deletedUser` | `test.deleted@matchhai.demo` | `isDeleted: true`, `deletedAt` set |

All `.demo`-domain accounts share one password (placeholder
`TEST_USER_PASSWORD` in `.env.test`). The realistic seed uses `Demo@123456`;
the legacy `demoSeed` path uses `MatchHaiDemo123!`.

### Zones, branches, slots
| Entity | Fixture | States to cover |
|--------|---------|-----------------|
| Zone | `activeZone`, `pendingZone`, `unavailableZone` | `active` / `pending-review` / unavailable |
| Branch | `makeBranch` | `isActive` true/false, per-player rate |
| Slot | `makeSlot`, `confirmedSlot` | `open` / `reserved` / `confirmed` (schema slot status union) |

### Matchrooms (one per lifecycle state)
| Fixture | `_id` | `status` | Meaning |
|---------|-------|----------|---------|
| `openRoom` | `room_open` | `open` | joinable, starts +2 days |
| `fullRoom` | `room_full` | `open` | all slots confirmed (capacity 2) |
| `lockedRoom` | `room_locked` | `open`* | within 24h lock window |
| `expiredRoom` | `room_expired` | `open`* | start passed, never filled |
| `completedRoom` | `room_completed` | `completed` | finished match |
| `privateRoom` | `room_private` | `open` | `visibility: "private"` |

\* In fixtures, locked/expired are *derived* from time (the fixture sets `status: "open"`
plus past/near timestamps). The real `matchrooms.status` union in `convex/schema.ts`
is `open | in-progress | completed | locked | expired | cancelled`. When seeding
staging, prefer scheduling timestamps (`scheduledStartAt`, `lockAt`, `expiresAt`)
so the app's own lifecycle logic transitions rooms — see the field-mismatch note in §5.

### Teams & team challenges
- Team: `makeTeam` → `team_a` "Team Alpha", captain `user_captainA`, members + `memberUids`.
- Team challenges: seeded by `convex/devTeamSeed.ts:seedChallengeTeamsForUser`
  (captain teams per game + N opponent teams with full rosters). Roster rules:
  cs2/cs16/valorant = 5 main, fc25/fc26/tekken8 = 2 main.

### Bookings, payments, verification states
| Entity | Fixture | States |
|--------|---------|--------|
| Booking intent | `makeBookingIntent` | `pending_approvals` / `approved` / `approved_pending_payment` / `confirmed` / `rejected` / `expired` / `cancelled` (schema `bookingIntents.status`) |
| Payment | `makePayment` | `pending` / `paid` / `failed` / `expired` / `refunded` (fixture) — provider `easypaisa` |
| Result verification | (covered via matchroom + `refundStatus`) | `refundStatus: none / pending / completed` |

---

## 2. How the existing seeding works

There are **three** independent seeding mechanisms. Know which one you need.

### A. Karachi-realistic demo (recommended for population)
- **Convex action:** `demoSeed:seedKarachiRealisticDemo` (paginated, cursor-driven).
- **Runner:** `scripts/seed-karachi-realistic-demo.mjs`.
- **Inputs:** a seed key (argv), and player rows read from
  `matchhai_karachi_realistic_demo_players.xlsx` (sheet `All Players`).
  Hard-coded `zoneCount: 60`, `batchSize: 10`.
- **Creates:** Better Auth users + Convex `users` (players + zone admins),
  approved `zones` with `branches` and `zoneResources`/`pricingRules`,
  friendships, teams, and matchrooms. Tags data with `seedSource =
  "karachi_realistic_demo_2026"` so it can be removed precisely.
- **Guard:** refuses unless `CONVEX_DEPLOYMENT` starts with `dev:`; also needs
  `DEMO_SEED_ENABLED=true` and a matching `DEMO_SEED_KEY` in the Convex env.

### B. Legacy demo seed
- **Convex action:** `demoSeed:seedDemoData` (cursor/batch); also a non-paginated
  `seedDemoDataLegacy` mutation. Defaults: 200 players / 200 zones / 200 teams /
  200 matchrooms.
- **Runner:** `scripts/seed-demo-data.mjs`.
- **Creates:** super admin + players + zones (with resources) + friendship ring +
  teams + matchrooms (`bookingSource: "seed"`, `paymentStatus: "unpaid"`,
  `isPrivate: false`, `zoneAdminApproved: true`).
- **Guard:** the *runner* does NOT enforce `dev:` (unlike the Karachi runner) but
  the action still requires `DEMO_SEED_ENABLED` + `DEMO_SEED_KEY`.

### C. Team-challenge seed (driven by `seed_args.json`)
- **Convex mutation:** `devTeamSeed:seedChallengeTeamsForUser`.
- **Invocation:** run via the Convex CLI with the JSON args file (see below).
  `seed_args.json` currently contains:
  ```json
  {"seedKey":"...","userEmail":"...","ensureCaptainTeams":["cs2","fc26","valorant","cs16","tekken8"],"opponentTeamCount":20}
  ```
- **Creates:** for the given `userEmail`, captain teams for each requested game
  (filled to roster capacity with demo fill players) plus `opponentTeamCount`
  fully-rostered opponent teams — exactly what team-challenge tests need.
- **Guard:** requires `DEMO_SEED_KEY` to match `seedKey`.

---

## 3. Seeding staging

> Confirm `CONVEX_DEPLOYMENT=dev:quick-panda-920` (staging) first. See checklist.

Set the staging deployment env once (Convex dashboard → staging deployment):
`DEMO_SEED_ENABLED=true` and `DEMO_SEED_KEY=<secret>`. Load local env from
`.env.test` (or `.env.local`) so `EXPO_PUBLIC_CONVEX_URL` / `CONVEX_DEPLOYMENT`
resolve.

```powershell
# Karachi realistic population (xlsx-driven)
node scripts/seed-karachi-realistic-demo.mjs "<DEMO_SEED_KEY>" matchhai_karachi_realistic_demo_players.xlsx

# OR legacy demo population
node scripts/seed-demo-data.mjs "<DEMO_SEED_KEY>"

# Team-challenge cast for a specific captain (reads seed_args.json)
npx convex run devTeamSeed:seedChallengeTeamsForUser --% --prod-disabled $(Get-Content seed_args.json -Raw)
# Or pass JSON inline:
npx convex run devTeamSeed:seedChallengeTeamsForUser '{ "seedKey": "<DEMO_SEED_KEY>", "userEmail": "test.captain.a@matchhai.demo", "ensureCaptainTeams": ["cs2","fc26","valorant"], "opponentTeamCount": 20 }'
```

> The exact `npx convex run` flag for an args file depends on your Convex CLI
> version (`npx convex run <fn> '<json>'` always works). The `seed_args.json`
> shape is the source of truth for what to pass.

### Example `seed_args.json` block for the test cast
Do **not** overwrite the committed `seed_args.json`. To request the full
test-cast captain + opponent teams, an args block like this can be used:

```json
{
  "seedKey": "<DEMO_SEED_KEY>",
  "userEmail": "test.captain.a@matchhai.demo",
  "ensureCaptainTeams": ["cs2", "fc26", "valorant", "cs16", "tekken8"],
  "opponentTeamCount": 20
}
```

---

## 4. Reset / cleanup / export

### Targeted removal (preferred — only deletes seeded demo data)
```powershell
# Remove Karachi-realistic data (matches seedSource tag). Requires dev: deployment.
node scripts/remove-karachi-realistic-demo.mjs "<DEMO_SEED_KEY>"

# Remove legacy demo data.
node scripts/remove-demo-data.mjs "<DEMO_SEED_KEY>"
```

### Full wipe (destructive — clears ALL app tables)
```powershell
# convex/devCleanup.ts — refuses prod:, requires the confirm token.
npx convex run devCleanup:wipeAllDevData '{ "confirm": "DELETE_ALL_MATCHHAI_DEV_DATA", "includeAuth": true }'

# convex/devReset.ts — internalMutation full reset (run via dashboard/internal).
# Pass confirm: "DELETE_ALL_MATCHHAI_DEV_DATA".
```
`wipeAllDevData` deletes app tables in FK-safe order and, with `includeAuth:true`,
clears Better Auth `session`/`account`/`verification`/`user`. It explicitly
refuses any deployment matching `^prod:`.

### Export the seeded dataset
```powershell
node scripts/export-demo-data.mjs
```
Calls `demoSeed:exportDemoData`, writing `demo-data/*.json` + `*.csv` and a
`DEMO_DATA.md` summary (super admin, players, zone admins, teams, matchrooms,
shared password). Use this to capture exact seeded IDs/emails for E2E tests.

---

## 5. Fixture / schema field mismatches (for QA)

These are conceptual-naming differences between `__tests__/fixtures/index.ts`
and the real Convex schema / seed code. Tests using the fixtures pass because
fixtures are loosely typed (`any`), but seeded staging data uses the schema
field names — keep this list in mind when writing E2E assertions.

1. **Matchroom status / visibility.**
   - Fixtures use `visibility: "public" | "private"`. Schema/seed use
     `isPrivate: boolean` (no `visibility` field on `matchrooms`).
   - Fixtures model `locked`/`expired` as `status:"open"` + timestamps; schema
     `matchrooms.status` is an explicit union `open | in-progress | completed |
     locked | expired | cancelled`. Seed scripts set timing fields and let the
     app transition; assert on timestamps, not a hard `"locked"` status, unless
     you seed it explicitly.
   - Fixtures use `format: "5v5"`; the schema has no `format` field (game +
     slot arrays imply size).

2. **Slot shape.**
   - Fixtures: `{ slotId, team: "A"|"B", uid, status }`.
   - Schema/seed (`demoSeed.ts buildSlots`): slots live in separate `slotsA` /
     `slotsB` arrays with `{ slotId, status, role }` — there is **no `team`
     field** (side is implied by the array) and occupancy uses `role`/reserved
     info rather than a bare `uid`. Fixture `confirmedSlot` sets `uid`; real
     slots reserve via `reservedFor`.

3. **Zone fields.**
   - Fixtures: `ownerUserId`, `status: "active"|"pending-review"`,
     `perPlayerRate`, `branchId`, `isAvailable`.
   - Schema/seed: owner is `ownerUid` (+ `ownerUsername`, `ownerFullName`);
     pricing lives under `branches[].pricing` and `zoneResources.hourlyRate`,
     not a flat `perPlayerRate`. Zone approval is a separate `zones.approve`
     mutation, not just a `status` literal.

4. **User fields.**
   - Fixtures: `role`, `isSuperAdmin`, `isDeleted`, `kycStatus: "verified"`,
     `selectedGames`, `elo`.
   - Schema/seed: super admin is `role: "super-admin"` (string), not a boolean
     `isSuperAdmin`. Games are per-game boolean flags (`playsCs2`, `playsValorant`,
     `playsFc`, `playsTekken`, `playsFutsal`, `playsIndoorCricket`, `playsPadel`,
     `playsPickleball`) plus `skillScores`, not a `selectedGames` array or a flat
     `elo`. KYC/verification uses `isVerified` + identity-verification tables, not
     `kycStatus`. `usernameLower` is required and indexed (fixtures omit it).
   - `zone_admin` (fixture role) vs `accountType: "zone"` + `role` in schema.

5. **Booking intent.**
   - Fixtures add `paymentStatus`, `perPlayerRate`, `playerCount`, `totalAmount`
     on the booking intent. Schema `bookingIntents.status` union matches the
     fixture's listed states; confirm money fields live where the schema places
     them (matchroom `pricing.perPlayer` vs intent) when asserting totals.

6. **Payments.**
   - Fixture `makePayment` status set is `pending|paid|failed|expired|refunded`
     with `provider:"easypaisa"`. The schema `walletTransactions`-style status
     union seen is narrower (`pending|completed|failed`); payment provider state
     also lives in `paymentTransactions`. Align E2E payment-state assertions to
     the actual table, not the fixture's superset.

---

## Safety checklist

Before running ANY seed or cleanup command:

- [ ] `echo $env:CONVEX_DEPLOYMENT` (PowerShell) shows the **staging** value
      (`dev:quick-panda-920`), never a `prod:` deployment.
- [ ] `EXPO_PUBLIC_CONVEX_URL` points at `https://quick-panda-920.convex.cloud`.
- [ ] `DEMO_SEED_ENABLED=true` and `DEMO_SEED_KEY` are set on the **staging**
      Convex deployment (not production).
- [ ] No real secrets are written to any committed file — only `.env.test`
      (git-ignored) holds filled values.
- [ ] For full wipes, you intend to destroy ALL data on the target deployment
      and have the confirm token `DELETE_ALL_MATCHHAI_DEV_DATA`.
- [ ] Prefer the targeted `remove-*` scripts over full wipes when only demo
      data needs clearing.
