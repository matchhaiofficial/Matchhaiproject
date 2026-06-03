# MatchHai — Share UX Completion & Standardization (Implementation Tracker)

**Branch:** `product-ready`
**Date:** 2026-06-03
**Builds on:** `TEMP_MATCHHAI_SHARE_FUNCTIONALITY_AUDIT.md`, `TEMP_MATCHHAI_SHARE_SECURITY_PRIVACY_FIXES.md`
**Status:** Implemented. tsc clean. No Convex changes (no codegen needed). NOT committed, NOT pushed, no production deploy, no EAS build.

> Guardrails honored: did NOT touch payment money movement, Easypaisa/IPN/finalize, payout formula, ELO/rating, KYC provider, super-admin onboarding, withdrawal review, or unrelated pagination/UI. Pre-existing-dirty files (`convex/admin.ts`, `wallet.ts`, `zoneWithdrawals.ts`, `super-admin/*`, `superAdminService.ts`) untouched.

> Orchestration note: every surface consumes one shared helper (`src/utils/shareContent.ts`); parallel sub-agents would collide creating/consuming it (and background agents hit the account session limit last run), so this was implemented directly and organized below by the 7 requested sub-agent sections.

---

## 1. Share surface inventory (Task 1)

| Surface | Exists before? | Now | File | Current copy source | Action taken | Privacy risk |
|---|---|---|---|---|---|---|
| Matchroom (detail) | Yes (raw) | ✅ standardized | `app/matchrooms/hooks/useMatchroomDetailActions.ts` + button `app/matchrooms/[id].tsx` | `formatMatchroomShare` | Reformatted (Task 3) | None — no code/payment/ID except link path |
| Team (detail) | Yes (basic) | ✅ standardized | `app/teams/[id].tsx` (captain-gated button) | `formatTeamShare` | Standardized (Task 6) | None |
| Venue/Zone (detail) | **No** | ✅ added | `app/(player)/zones/[id].tsx` (header share) | `formatVenueShare` | Added (Task 4) | None — public projection only |
| Player profile (own) | **No** | ✅ added | `app/(player)/(tabs)/profile.tsx` (header share) | `formatPlayerProfileShare` | Added (Task 5) | None |
| Player profile (other) | **No** | ✅ added | `app/(player)/profile/[uid].tsx` (header share) | `formatPlayerProfileShare` | Added (Task 5) | None — backend redacts; null for hidden/deleted |
| Team Challenge (detail) | **No** | ✅ added (captain-only) | `app/teams/challenge.tsx` (header share) | `formatTeamChallengeShare` | Added captain-gated (Task 7) | None — no payment/chat; route captain-only |
| Discover card quick-share | No | ⏸️ deferred | `app/(player)/(tabs)/index.tsx` cards | — | Documented (Task 8) | n/a |
| Zone admin venue/branch share | No | n/a | `app/zone/**` | — | No public share exists; not added | n/a |
| Super admin share/copy | Copy of opaque IDs only | unchanged | `app/super-admin/payment/[orderRefNum].tsx` | — | No change (Task 9) | Low (opaque IDs) |

Clipboard surfaces (chat message copy, venue address copy, super-admin `CopyableId`) are unchanged and safe.

## 2. Files changed

| File | Change |
|---|---|
| `src/utils/shareContent.ts` | **New** — standardized formatters + date/time helpers |
| `app/matchrooms/hooks/useMatchroomDetailActions.ts` | `handleShare` → `formatMatchroomShare` |
| `app/teams/[id].tsx` | `handleShare` → `formatTeamShare` (members/captain count) |
| `app/(player)/zones/[id].tsx` | Header share button + `onShareVenue` → `formatVenueShare` |
| `app/(player)/profile/[uid].tsx` | Header share button + `handleShareProfile` → `formatPlayerProfileShare` |
| `app/(player)/(tabs)/profile.tsx` | Header share button + `handleShareProfile` → `formatPlayerProfileShare` |
| `app/teams/challenge.tsx` | Captain-gated header share + `handleShareChallenge` → `formatTeamChallengeShare` |

## 3. Standardized helper summary (Task 2) — `src/utils/shareContent.ts`

Single source of truth for share copy. Exports: `formatMatchroomShare`, `formatVenueShare`, `formatPlayerProfileShare`, `formatTeamShare`, `formatTeamChallengeShare`, plus `formatShareDate` ("Sat, Jun 6, 2026"), `formatShareTime` ("3:00 PM"), `buildDeepLink`, `APP_SCHEME`. Dates parsed via the existing `parseScheduledDateTime` (device-local, matching stored schedule strings); game labels via `getCanonicalGameLabel`. Output is headline → blank line → details (one per line) → blank line → deep link. The helpers structurally exclude matchCode/QR/payment/payout/PII/provider data — only the deep-link path segment carries an id.

## 4. Matchroom share format (Task 3)

```
Join my Valorant matchroom on MatchHai 🎮

5v5 Competitive
📍 Pashas Squad
🗓️ Sat, Jun 6, 2026
⏰ 3:00 PM
🎟️ 8 seats left

Open in MatchHai:
matchhai://matchrooms/<id>
```
Rules applied: friendly game label; clean date + 12-hour time; `📍 Venue TBC` when venue missing; `🎟️ Lobby full` when full; seats line omitted when no capacity data. Share button already hidden for terminal/private rooms (prior phase). No matchCode/QR/payment.

## 5. Venue share (Task 4) — implemented

Header share button on the public venue page. Format:
```
Book a slot at Pashas Squad on MatchHai 🎮

📍 Gulshan, Karachi
🎮 Games: CS2, Valorant, FC26
💸 From Rs 1,500/hr

Open in MatchHai:
matchhai://zones/<id>
```
Data from the **public** `PlayerVenueViewModel` (`venueBrandName`, `selectedBranch.areaCityLabel`, `supportedGameLabels`, `selectedBranch.startingPriceLabel`) — which is backed by the public `getPublicVenueById` projection from the prior phase, so no owner/payout/notes/bank data is present. Deep link opens the public venue page, never the zone dashboard.

## 6. Player profile share (Task 5) — implemented

Header share on both own profile (`(tabs)/profile.tsx`) and public profile (`profile/[uid].tsx`). Format:
```
Check out Ovais on MatchHai 🎮

Valorant / CS2 player
⭐ MatchHai Rating: 1200
🏆 FACEIT Level 5

Open profile:
matchhai://profile/<uid>
```
Public fields only: display name (`fullName || username`), enabled-game labels, a skill rating, FACEIT level. No email/phone/CNIC/KYC/authId/raw provider IDs. Public profile share relies on `getPublicUserProfile` (returns null for hidden/deleted/suspended → screen shows "not found", so no share surface for those).

## 7. Team share (Task 6) — standardized

Captain-gated button (unchanged gating). Format:
```
Check out Team PashaSquad on MatchHai 🎮

Game: Valorant
Members: 5
Captain: Ovais

Open team:
matchhai://teams/<id>
```
Member count from `memberUids`/`members`; captain name from the captain member row. No chat link, no invite tokens, no member PII. Private-team roster remains protected at the backend (`getWithMembers` projection from prior phase).

## 8. Team Challenge share (Task 7) — implemented (captain-only)

Captain-gated header share. Format:
```
Team Challenge on MatchHai ⚔️

PashaSquad vs Team Saad
🎮 Valorant
🗓️ Sat, Jun 6, 2026
⏰ 3:00 PM
📍 Venue TBC

Open challenge:
matchhai://teams/challenge?id=<id>
```
No payment status, no captain wallet/payment refs, no chat. The challenge route is captain-only (`teamChallenges.getById` returns null to non-captains), so a forwarded link only resolves for the two captains; everyone else sees a safe "unavailable" state. Button only renders when `isCaptain`.

## 9. Discover share (Task 8) — deferred (documented)

Detail-page share now exists for matchroom, venue, player, team, and (captain) challenge. Quick-share icons on Discover cards were **not** added: it is a broad cross-card UI change (matchroom/player/team/zone card layouts + per-card data wiring) better done with design review, and the same privacy rules would apply (public/active content only). **Recommendation:** add card-level share in a dedicated UI pass reusing the `shareContent` helpers, gating out private/expired/deleted/hidden content. No privacy regression today (no card share exists).

## 10. Admin / Zone Admin / Super Admin (Task 9) — no change

No public share added on admin pages. Super-admin copy remains opaque internal IDs only. No bank/CNIC/provider payloads copied. Zone admin has no venue-share surface (players share venues via the public page). Booking/withdrawal/payment/support links remain admin-only and backend-gated (prior audit confirmed). `convex/admin.ts` intentionally untouched (carries unrelated pre-existing changes).

## 11. Deep-link route support (Task 10)

All target routes exist and map to real screens (no broken links):
- `matchhai://matchrooms/<id>` → `app/matchrooms/[id].tsx`
- `matchhai://zones/<id>` → `app/(player)/zones/[id].tsx` (`/zones/[id]`)
- `matchhai://profile/<uid>` → `app/(player)/profile/[uid].tsx` (`/profile/[uid]`)
- `matchhai://teams/<id>` → `app/teams/[id].tsx`
- `matchhai://teams/challenge?id=<id>` → `app/teams/challenge.tsx`

Access enforced by prior-phase backend projections + route guards: unauthorized/logged-out → login or safe "unavailable"; deleted/expired/private content does not leak.

## 12. Tests run

- `npx tsc -p tsconfig.json --noEmit` → **exit 0** (clean).
- `git diff --check` → **exit 0** (LF/CRLF warnings only).
- **Codegen:** not run — no `convex/` schema/function/index changes this batch (client utils + UI only).

## 13. Known risks

- Share `rating` for player profiles uses the selected/first enabled game's skill rating; if a player has no skill score yet, the rating line is omitted (graceful).
- Team-challenge `venue` falls back to "Venue TBC" unless the challenge object carries a venue name field; confirmed-venue display may vary by status.
- Date/time uses device-local interpretation of stored schedule strings (consistent with the rest of the app); no explicit Asia/Karachi tz pin was added.
- Discover card quick-share deferred (see §9).

## 14. Manual QA checklist (remaining — device/sim)

1. Matchroom share → multi-line, friendly date/time, no ISO, no matchCode/payment.
2. Full matchroom → "Lobby full"; missing venue → "Venue TBC".
3. Terminal/private matchroom → no share button.
4. Venue share → name/area/games/price + `matchhai://zones/<id>`; no owner/payout/bank data.
5. Own profile share works; public profile share works; hidden/deleted profile → no share (not-found).
6. Profile share has no email/phone/CNIC/provider IDs.
7. Team share → name/game/members/captain + `matchhai://teams/<id>`; private roster not leaked.
8. Challenge share visible only to captains; copy has no payment; non-captain opening link → safe unavailable.
9. Every shared deep link opens the right screen when app installed.
10. Logged-out open of any shared link → login.

## 15. Deferred items

- Discover card quick-share icons (UI pass with design review).
- Optional: explicit Asia/Karachi timezone pin for share date/time if cross-tz consistency is required.
- Optional: venue branch-level deep link (`?branchId=`) in venue share if branch selection should persist.

---

## Recommended commit (after review/approval)

Stage only this batch (avoid the unrelated pre-existing dirty files):
```
git add src/utils/shareContent.ts \
        app/matchrooms/hooks/useMatchroomDetailActions.ts \
        app/teams/[id].tsx app/teams/challenge.tsx \
        app/(player)/zones/[id].tsx \
        app/(player)/profile/[uid].tsx \
        app/(player)/(tabs)/profile.tsx \
        TEMP_MATCHHAI_SHARE_UX_COMPLETION_FIX.md
```
Commit message:
```
fix(sharing): standardize share actions across app
```
