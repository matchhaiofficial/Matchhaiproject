# MatchHai Fix Batch — Profile External-Platform Data + Matchroom QR Privacy

Branch: `product-ready`
Date: 2026-05-31

Scope guardrails (untouched): wallet/payment money movement, Easypaisa/IPN/finalize,
payout formula, unrelated pagination, dashboard UI polish, Super Admin onboarding,
report/moderation behavior. No EAS build, no deploy, no push.

---

## 1. Files inspected

Profile (frontend)
- `app/(player)/profile/[uid].tsx` — public player profile screen
- `app/(player)/(tabs)/profile.tsx` — own profile screen
- `app/(player)/profile/game-details.tsx` (referenced)
- `src/services/userService.ts`, `src/services/convex/userService.ts`

Profile (backend)
- `convex/users.ts` — `getById`, `getPublicById`, `getByUsername`, `refreshExternalStats`
- `convex/authz.ts` — `publicUser()` projection (root cause)
- `convex/userVisibility.ts` — `canViewerAccessPublicUser`
- `convex/schema.ts` — user external-platform + stat fields
- `convex/externalApis.ts` — Steam/FACEIT/PSN verify shapes

Matchroom QR
- `app/matchrooms/[id].tsx` — detail screen
- `app/matchrooms/components/MatchroomSummarySection.tsx` — QR/match-code card
- `app/matchrooms/hooks/useMatchroomDetailViewModel.ts`
- `app/matchrooms/hooks/useMatchroomDetailState.ts` — `isZoneAdmin`
- `app/matchrooms/utils/matchroomLobbyState.ts` — `matchCode`/`qrValue` derivation
- `convex/matchrooms.ts` — `getById`, `requireRoomActor` (host/captain/participant/zoneOwner)

---

## 2. ROOT CAUSE — Connected Platforms mismatch

`app/(player)/profile/[uid].tsx` loads other players via
`getPublicUserProfile` → `api.users.getPublicById` → returns `publicUser(target)`.

`publicUser()` in `convex/authz.ts` returned a **narrow** projection that INCLUDED
`skillScores`, `faceitElo`, `faceitSkillLevel` but **OMITTED** the platform-connection
identifiers/URLs the Connected Platforms section reads:
`steamId` / `steamProfileUrl`, `faceitId` / `faceitProfileUrl`,
`psnAccountId` / `psnOnlineId`, plus `trustScore`, privacy flags
(`hidePlatformsPublicly`/`hideAreasPublicly`) and per-game detail fields
(`cs2Role`, `fcFormation`, steam hours, `psnStats`, `valorantRole/Agent`, etc.).

Result on another player's profile:
- Performance / FACEIT card renders (it only needs `skillScores` + `faceitElo`,
  both present) → shows FACEIT level/ELO.
- Connected Platforms reads `steamProfileUrl`/`steamId`, `faceitProfileUrl`/`faceitId`,
  `psnOnlineId`/`psnAccountId` → all `undefined` → "Not connected" for all three.
- Trust always rendered 50% (default `0.5`) because `trustScore` was stripped.
- Per-game extra rows (role, playtime, PSN trophies) were blank on public profiles.

Own profile worked because `getById` returns the FULL document for self.

This is a **backend projection gap**, not a frontend bug and not intentional stripping
of the platform connection state (only the truly private fields were meant to be hidden).

## ROOT CAUSE — rank/ELO/details not updating

- Internal MatchHai rating/tier come from `skillScores[game]` (already public). Correct.
- External FACEIT level/ELO come from `faceitElo`/`faceitSkillLevel` (already public).
- The "not updating" symptom on public profiles was the same projection gap: supporting
  detail fields (`psnStats`, steam hours, roles) were never returned, so they looked stale/empty.
- `refreshExternalStats` writes platform + calibration fields via `updatePlatformLinks`;
  public profiles now read the same saved fields, so the latest synced values display.
- Game keys: screen uses `cs2`/`tekken8`/`fc26`; schema `skillScores` keys match
  (`tekken8`, `fc26` both present). No key mismatch for the active games.

---

## 3. Fixes applied

### A. Connected Platforms display (Task 2) + rank/ELO/details (Task 3)
- `convex/authz.ts` → `publicUser()` now also returns the safe public fields the
  profile screen needs: `trustScore`, privacy flags (`hideAreasPublicly`,
  `hidePlatformsPublicly`), per-game detail (`cs2Role`, `valorantRole/Agent`,
  `fcFormation`, sport positions/roles), Steam playtimes, and the verified
  platform connections: `steamId`/`steamProfileUrl`/`steamPersonaName`,
  `faceitId`/`faceitProfileUrl`/`faceitNickname`/`faceitGame` (+ existing
  `faceitElo`/`faceitSkillLevel`), `psnAccountId`/`psnOnlineId`.
- A new `publicPsnStats()` helper returns ONLY `psnOnlineId` + per-game trophy
  `progress` — the raw PSN payload (avatar/profile URLs, trophy tier blobs, sync
  timestamps) is never exposed.
- `app/(player)/profile/[uid].tsx` → `renderPlatformCard` refactored to take an
  explicit `connected` boolean + safe `displayValue` + optional `linkUrl`.
  Connection is now derived from ANY verified identifier/URL for the platform
  (`steamId || steamProfileUrl`, `faceitId || faceitNickname || faceitProfileUrl`,
  `psnAccountId || psnOnlineId || psnStats.psnOnlineId`). FACEIT shows
  nickname/Level/ELO. Owner privacy (`hidePlatformsPublicly`) still collapses the
  value to "Verified Account" for other viewers; external links open only for
  non-private real URLs.
- Internal MatchHai rating/tier and external FACEIT level/ELO already flowed from
  `skillScores`/`faceitElo`; with the projection fixed they now display
  consistently alongside Connected Platforms (no more "FACEIT data shown but
  platform says Not connected"). Trust no longer defaults to 50%.

### B. External refresh authorization (Task 3 hardening)
- `convex/users.ts` → `refreshExternalStats` previously compared the *target*
  doc id to itself and never checked the caller, so any authenticated user could
  drive external provider calls for another user. Added `assertCanRefreshStats`
  (`internalQuery` → `requireSelfOrSuperAdmin`) and call it first. Cooldown
  (`EXTERNAL_SYNC_COOLDOWN_MS`) still rate-limits. Internal ELO is never written
  by this path.

### C. Matchroom QR / match-code privacy (Tasks 5–7)
- `convex/matchrooms.ts` → new non-throwing `resolveCheckInAccess()` (host,
  captainA/B, joined participants via `playerUids` or slots, owning zone admin
  `zone.ownerUid`, super admin). `getById` now returns a zone-scoped
  `canViewCheckIn` boolean and **sets `matchCode` to null for outsiders** so the
  secret never reaches an unauthorized client.
- `src/services/convex/matchService.ts` → `Matchroom.matchCode` widened to
  `string | null`; added `canViewCheckIn?: boolean`.
- `app/matchrooms/[id].tsx` → derives `canViewCheckIn` from the authoritative
  backend flag (host/joined added only as a safe client fallback) and passes it
  down.
- `app/matchrooms/components/MatchroomSummarySection.tsx` → QR card (QR image +
  "Match Code" + "Admin can use this code if QR fails") now requires
  `canViewCheckIn` in addition to `isLocked`. Outsiders never render it, even when
  the room is full/locked.
- Share (`handleShare`) only shares game + title — no QR/match code. The QR deep
  link payload is just `matchhai://matchrooms/{id}` (a route, not the code), and
  opening it lands on the gated detail screen.

## 4. Public profile privacy checks (Task 4)
`publicUser()` still excludes all private/sensitive fields: email, phone, CNIC/KYC,
`authId`, wallet balances, provider tokens, and raw `steamStats`/`faceitStats`/
`psnStats` payloads. Only public display values are returned. Hidden/system-admin
accounts remain gated by `canViewerAccessPublicUser`.

## 5. Safe error handling (Task 7)
- Profile load failures surface "Could not load user profile."/"Profile not found"
  (existing copy retained); no raw Convex/provider errors shown.
- Outsiders simply don't see the QR section (no raw authorization error).

## 6. Validation
- `npx convex codegen` → target `dev:ardent-lynx-28` (project matchhai-staging,
  DEV — not production). Completed; new `internal.users.assertCanRefreshStats`
  resolves (api uses whole-module `typeof users`).
- `npx tsc -p tsconfig.json --noEmit` → PASS (no errors).
- `git diff --check` → exit 0 (only pre-existing LF→CRLF advisory warnings).
- No EAS build, no production deploy, no push.

## 7. Files changed (this batch)
- `convex/authz.ts`
- `convex/users.ts`
- `convex/matchrooms.ts`
- `src/services/convex/matchService.ts`
- `app/(player)/profile/[uid].tsx`
- `app/matchrooms/[id].tsx`
- `app/matchrooms/components/MatchroomSummarySection.tsx`
- `TEMP_MATCHHAI_PROFILE_EXTERNALS_AND_QR_PRIVACY_FIX.md` (this tracker)

(Other already-modified files in `git status` — `convex/admin.ts`, `schema.ts`,
`social.ts`, `userVisibility.ts`, `superAdminService.ts`, `accountRouting.ts`,
`app/super-admin/(tabs)/profile.tsx` — are from prior Super Admin onboarding work
and were NOT touched by this batch.)

## 8. Known risks
- `publicUser()` is shared by `getById` (non-self), `getPublicById`,
  `getByUsername`, `getBySteamId`, `getByPsnAccountId`. The added fields are all
  public-safe and additive; no existing consumer is broken, but more data now
  travels in those responses.
- `getById` strips `matchCode` for outsiders. Any future feature relying on
  `matchCode` for a non-member would need a dedicated authorized path
  (`getByMatchCode` remains available for code-holders).
- Client `canViewCheckIn` fallback (`isHost || isJoined`) is intentionally narrow;
  zone-admin/super-admin visibility relies on the backend flag only (so unrelated
  zone admins stay blocked).

## 9. Manual QA checklist
Player profile:
1. View a player with FACEIT linked → FACEIT shows Connected/Verified + Level/ELO.
2. Steam-linked player → Steam Connected.
3. PSN-linked player → PlayStation Connected.
4. Player with no linked accounts → all three "Not connected".
5. Own vs public profile show consistent connection state + trust %.
6. Owner with `hidePlatformsPublicly` → others see "Verified Account", not the ID.
7. No private fields (email/phone/CNIC/tokens/raw payloads) in the response.

Matchroom QR:
1. Outsider opens a discoverable/locked room → no QR, no match code.
2. Joined player opens room → QR + code visible.
3. Host/captain opens room → QR + code visible.
4. Owning-zone admin opens room → QR + code visible.
5. Unrelated user / unrelated zone admin → no QR/code.
6. Super admin → QR/code visible.
7. Shared link contains no QR/code; outsider opening it still can't see the code.
8. No raw authorization errors shown.

---

## 10. Super Admin Users self-row exclusion (additional task, 2026-06-02)

Requirement: in Super Admin → Users, the currently authenticated Super Admin's own
row must not appear in the normal Users management list (only their own row; other
admins/users still appear). Access-overview/admin-management screens are unaffected.

Root behavior before: `app/super-admin/users.tsx` → `getUsersPage` →
`api.admin.listUsersPage` (and `getUsers` → `api.admin.listUsers`) returned every
user, including the logged-in Super Admin.

Fix (backend, server-derived identity — never client-passed):
- `convex/admin.ts` `listUsersPage` and `listUsers` now read the actor via
  `getAuthenticatedAdmin(...)` → `admin.profile._id` and filter out that single row.
- `listUsersPage` keeps offset math identical to the unfiltered query: offsets index
  the raw ordered window and the cursor advances by the raw window size
  (`windowDocs.length`), so the actor's row is just dropped from whichever page it
  lands in. Search, filters, and load-more all operate on the actor-free server
  result, so none can bring the row back.
- `listSuperAdminAccess` (Access overview) intentionally left UNCHANGED — the current
  Super Admin still appears there.
- `getUsers`/`listUsers` is exported but currently unused by the app; filtered too for
  consistency, no consumer affected.

Validation: tsc PASS. Page/cursor/isDone semantics unchanged except the actor row is
absent. Auth gate (`getAuthenticatedAdmin`) still rejects non-Super-Admins.

QA: login as Ovais → Users list excludes Ovais; other users present; search/filters/
load-more never surface Ovais; Access overview still shows Ovais; non-Super-Admin
still blocked from the page.

---

## 11. Zone-admin withdrawal: full payout account number for Super Admin (2026-06-02)

Issue: the Super Admin withdrawal review surface showed only the masked account
number, so the reviewer could not execute the bank transfer. Root cause: the raw
account number was never persisted — `wallet.createZoneWithdrawalTransaction` stored
only `accountNumberMasked` / `accountNumberLast4`, so every review query/screen could
only show the masked value. (The request-time email already included the full number.)

Fix:
- `convex/wallet.ts` `createZoneWithdrawalTransaction` — new optional arg
  `accountNumberFull`, persisted to transaction `metadata.accountNumberFull`
  (`metadata` is `v.any()`, no schema change).
- `convex/zoneWithdrawals.ts` — passes `accountNumberFull: accountNumberRaw`.
- `convex/admin.ts` — both Super-Admin-only serializers
  (`serializeAdminZoneWithdrawal`, `serializeAdminZoneWithdrawalEnriched`) now return
  `accountNumberFull`. These run only inside `getAuthenticatedAdmin`-gated queries;
  zone/player paths never receive it.
- `src/services/convex/superAdminService.ts` — `SuperAdminWithdrawalRequest` gains
  `accountNumberFull?: string | null`.
- `app/super-admin/withdrawals.tsx` — Bank Payout "Account" shows
  `accountNumberFull || accountNumberMasked || "N/A"`.

Note: requests created before this change have no stored full number → fall back to
masked; their original request email still carries the full number. Exposure is
Super-Admin-only (necessary to send the payout); list-row view stays masked.

## 12. Restrict suspend/delete of a Super Admin to the primary (2026-06-02)

Requirement: only `ovais@matchhai.com` may suspend or delete another Super Admin
account; other Super Admins cannot.

Fix (backend, server-derived identity):
- `convex/admin.ts` — new `assertCanActOnSuperAdminTarget(admin, target)`: if the
  target is a Super Admin (`isAuthorizedSuperAdmin`), the actor's email must equal
  `ovais@matchhai.com` (normalized) or it throws. Non-super-admin targets are
  unaffected. Called in `deleteUserAccount` and `setUserSuspension` (covers
  suspend AND reactivate).
- Frontend `app/super-admin/users.tsx` — `canManageSuperAdmins` (viewer email ===
  ovais) gates the Suspend/Reactivate/Delete buttons on Super-Admin rows; backend
  remains the hard gate. Delete on a Super-Admin row is now shown to the primary
  (previously hidden for all Super-Admin rows).

Validation: tsc PASS; codegen run (target `dev:ardent-lynx-28`) for the new
`accountNumberFull` mutation arg; `git diff --check` exit 0.
