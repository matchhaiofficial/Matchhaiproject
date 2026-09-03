# MatchHai — Share Functionality Security & Privacy Audit

**Branch:** `product-ready`
**Date:** 2026-06-03
**Status:** AUDIT-ONLY. No fixes implemented. Awaiting review/approval before any code change.
**Method:** 6 parallel Claude Code sub-agents + direct verification of top-severity backend claims.

> Scope guardrails honored: did NOT touch payment money movement, Easypaisa/IPN/finalize, payout formula, ELO/rating, KYC provider logic, super-admin onboarding, or withdrawal-review redesign. No codegen, build, deploy, or push.

---

## 0. Executive Summary

The **share *text/clipboard* surface is clean** across the whole app — no share message, copied string, QR payload, or notification deep link embeds secrets (no QR/check-in/match codes, payment refs, CNIC, tokens, phone, email, or authId). The real exposure is **not in the share copy but in the backend read queries that shared/deep links resolve to**: several public Convex queries spread raw documents to any caller, so anyone with (or guessing) an ID receives far more than the UI renders.

**Top issues (corroborated by ≥2 agents and verified directly):**

| # | Severity | Issue | Location |
|---|---|---|---|
| C1 | **Critical** | `matchrooms.getById` spreads the entire raw matchroom doc to any caller — payment/payout/settlement references, GPS coordinates, all player UIDs, result votes, cancel notes | `convex/matchrooms.ts:2234` |
| C2 | **Critical** | `matchrooms.getByMatchCode` spreads the full doc AND does **not** null `matchCode` — worse than getById | `convex/matchrooms.ts:2256` |
| H1 | **High** | `/matchrooms` route group has **no auth guard**; matchroom data served to unauthenticated callers via custom scheme link | `app/matchrooms/_layout.tsx` |
| H2 | **High** | `zones.getById` returns the raw zone doc to anyone — owner identity, internal `notes`, `pilotPayoutRate`/`normalPayoutRate` over the wire | `convex/zones.ts:84` |
| H3 | **High** | Client re-derives a "match code" from the room ID (`id.slice(-6)`) when server nulls it — undermines the server gate | `app/matchrooms/utils/matchroomLobbyState.ts:251` |
| M1 | **Medium** | `teams.getWithMembers`/`getById` return full roster to any authed user; private teams not protected at data layer | `convex/teams.ts:151-173` |
| M2 | **Medium** | No `isPrivate` enforcement on matchroom read; private rooms fully readable by ID/code | `convex/matchrooms.ts:2224-2245` |
| M3 | **Medium** | Matchroom & team Share buttons not gated by lifecycle/role; share text is link-less and low-quality | `app/matchrooms/[id].tsx:533`, `app/teams/[id].tsx:517` |
| L1 | **Low** | OAuth deep-link echoes externally-supplied provider IDs into a toast | `app/_layout.tsx:142-159` |

**Admin/super-admin surface: PASS.** All super-admin queries/mutations are server-side role-gated via `getAuthenticatedAdmin`. The only clipboard surface copies opaque internal IDs. The one sensitive on-screen value (full payout bank account in the withdrawals reviewer) is intentional, super-admin-gated, and not on any copy/share/export path.

**Venue/team-chat/challenge-chat/profile: backend correctly enforced** (profile redaction + hidden/deleted gating; chat membership checks; challenge captain-only). No share leaks there.

---

## 1. Share Surface Inventory

| Surface | Role | File / function:line | Shared content | Link target | Public/Private | Risk |
|---|---|---|---|---|---|---|
| Matchroom share button | Player | `useMatchroomDetailActions.ts:576-584` (`handleShare`); button `app/matchrooms/[id].tsx:533-545` | `Join my ${room.game} lobby on MatchHai! ${room.title}` | **none (no link)** | always visible | Med (copy + always-on; backend leak via route) |
| Matchroom QR card | Player/host/ZA | `matchroomLobbyState.ts:253`; render `MatchroomSummarySection.tsx:134-156` | `matchhai://matchrooms/${room.id}` (path ID) + Match Code shown beside | `/matchrooms/[id]` | gated `canViewCheckIn && isLocked` | Low (code gating sound; see H3) |
| Matchroom teammate invite | Captain | `useMatchroomDetailActions.ts:837-910`; sheet `MatchroomInviteSheet.tsx` | in-app push invite (no text/link) | in-app notif | captain-only (UI+backend) | Low |
| Team share button | Player | `app/teams/[id].tsx:517-526` (`handleShare`) | `Check out my team ${team.name} on MatchHai!` | **none (no link)** | members | Low (copy) |
| Team friend invite | Captain | `app/teams/components/InviteFriendsSheet.tsx:59-86` → `inviteToTeamAction` | in-app invite (no token) | `route:/teams/${id}` notif | backend-enforced | None |
| Friend invite/add | Player | `app/(player)/friends.tsx`; `app/(player)/profile/[uid].tsx:19` | in-app friend request (no link/token) | in-app | backend-enforced | None |
| Player profile | Player | `app/(player)/profile/[uid].tsx` | **no Share button**; render from `publicUser()` projection | `/(player)/profile/[uid]` | `getPublicById` gated | None |
| Venue: Copy Address | Player | `app/(player)/zones/[id].tsx:140-147` → `venueDetails.helpers.ts:34-49` | `selectedBranch.formattedAddress` | clipboard | public venue data | Low |
| Venue: Open Maps / Call | Player | `venueDetails.helpers.ts:8-32 / 51-73` | maps URL / `tel:` published phone | Maps / Dialer | public | Low |
| Friend / matchroom / team / challenge chat — Copy message | Player | `friend-chat/[friendId].tsx:398`, `matchrooms/chat/[id].tsx:535`, `teams/team-chat.tsx:278`, `teams/challenge-chat.tsx:462` | own `message.text` | clipboard | own conversation | None |
| Super-admin `CopyableId` | Super Admin | `app/super-admin/payment/[orderRefNum].tsx:62-86,269-276` | opaque internal IDs (orderRefNum, `_id`s) | clipboard | super-admin only | Low |
| Super-admin order ref / withdrawal refs | Super Admin | `payment/[orderRefNum].tsx:155`, `withdrawals.tsx:255,664` | order ref / `accountNumberFull` (display only) / truncated refs | none | super-admin only | Low–Med (account full, by design) |
| Zone wallet reference | Zone Admin | `app/zone/wallet.tsx:131-134` | `reference.slice(-12)` (display only) | none | owner only | Low |
| Notification deep links | All | `convex/pushNotifications.ts:22-49`, `convex/notifications.ts:404` | resource IDs only → `/matchrooms/<id>`, `/teams/<id>`, `/teams/challenge?id=<id>` | internal routes | per-recipient | None (IDs only) |

**Surfaces that DO NOT exist (product gaps, not leaks):** venue/zone/branch share (no `Share.share` anywhere in `app/zone/**` or player venue page), challenge share, QR/check-in for bookings, any export/CSV. The only two native `Share.share` calls in the codebase are the matchroom and team buttons above.

---

## 2. Matchroom / Lobby Share Audit (Phase 2)

Share path: `handleShare` — `useMatchroomDetailActions.ts:576-584`:
```ts
await Share.share({ message: `Join my ${room?.game} lobby on MatchHai! ${room?.title}` });
```

| # | Question | Finding |
|---|---|---|
| 1 | Share message content | `room.game` (raw key, e.g. `cs2`) + `room.title` only |
| 2 | Matchroom ID? | No (no ID, no URL in the text) |
| 3 | QR / check-in code? | No |
| 4 | Private match code? | No |
| 5 | Payment/order refs? | No (in share text) |
| 6 | Zone/branch location? | No (only free-text title) |
| 7 | Participant names? | No |
| 8 | Outsiders open shared link? | No link in text; **but** the QR mints `matchhai://matchrooms/<id>` and the `/matchrooms` route has no auth guard (H1) |
| 9 | What does an outsider see if they open it? | **Critical (C1):** `getById` returns the full raw doc — all player UIDs, host/zoneOwner UIDs, GPS coordinates, `paymentStatus/Amount`, `sourcePaymentOrderRefNum`, `merchantSettlement*`, `venuePayout*`, `resultVerification`, `cancelReason/Note`, `clientCreateRequestId`. Only `matchCode` is nulled. |
| 10 | Expired/completed/cancelled shareable? | Yes — share button has no lifecycle gate; `getById` returns regardless of status |
| 11 | Locked/private/full shareable? | Yes — `isPrivate` is **not** enforced on read (M2) |
| 12 | Bypass discover filters? | Yes — direct by-ID/by-code lookups skip the expiry/discoverability filtering that `list`/`listOpen` apply |
| 13 | Show QR/match code to outsiders? | Share text: no. Screen: real `matchCode` nulled server-side + QR gated by `canViewCheckIn`. **But** client re-derives a code from the ID (H3). |
| 14 | Route respects role/access? | **No** for document read — only `canViewCheckIn`/`matchCode` are gated; no auth requirement, no `isPrivate`, no participant check on the rest of the payload. Mutations (`requireRoomActor`) and chat (`getMatchroomAccess`) ARE properly gated. |

**Verified directly:** `convex/matchrooms.ts:2234` `const result: any = { ...room, id: room._id, canViewCheckIn };` (full spread), and `:2256` `return { ...room, id: room._id };` (no matchCode null).

---

## 3. Venue / Zone / Branch Share Audit (Phase 3)

**No venue/zone/branch share feature exists** (player or zone-admin side). Only Copy-Address / Open-Maps / Call-Venue, all public venue data.

The real finding is the backing query. **Verified:** `convex/zones.ts:81-86`:
```ts
export const getById = query({
  args: { zoneId: v.id("zones") },
  handler: async (ctx, args) => { return await ctx.db.get(args.zoneId); },
});
```
- No auth check, **no field projection** — returns the whole zone document.
- Per schema (`convex/schema.ts:1301-1427`) that includes fields the public venue page never renders: `ownerUid`, `ownerUsername`, `ownerFullName`, internal `notes`, `rejectionReason`, full `migration`, and **`pilotPayoutRate` / `normalPayoutRate`** (payout economics).
- The client `transformZone` (`zoneService.ts:311-351`) only maps a UI subset, so the screen looks safe — but the raw payload reaching the device contains owner PII + payout rates (inspectable via devtools/direct API call).
- Routing is otherwise correct: a hand-crafted `/(player)/zones/<id>` lands on the public player page, never the `/zone` dashboard (route-guarded at `app/zone/_layout.tsx:38-44`).
- `contactEmail`/`contactPhone` are intended **public** venue contact (section copy: "what this branch exposes publicly") — acceptable.

Severity: **High (H2)** for payout-rate + owner-PII over the wire.

---

## 4. Player Profile Share Audit (Phase 4)

- **No Share button** on the profile screen.
- Data loads via `getPublicUserProfile` → `convex/users.getPublicById` (`users.ts:159-177`) → `canViewerAccessPublicUser` (`userVisibility.ts:46-52`): returns `null` for hidden/super-admin/soft-deleted to outsiders; full record only to self; otherwise the curated `publicUser()` projection (`convex/authz.ts:120-184`).
- `publicUser()` exposes: username, fullName, photoURL, bio, city, areas (honors `hideAreasPublicly`), games, skillScores, ELO/faceit display, Steam/PSN public IDs+URLs. It **excludes** phone, email, CNIC/KYC, authId, provider tokens, raw payloads (explicit code comments confirm).
- Deleted/suspended/hidden → `null` → "Profile not found".

**Verdict: compliant.** Backend-enforced, not UI-only. (Cross-check `TEMP_MATCHHAI_PROFILE_EXTERNALS_AND_QR_PRIVACY_FIX.md` to confirm shipped projection matches.)

---

## 5. Team & Team-Challenge Share Audit (Phase 5)

| # | Question | Finding |
|---|---|---|
| 1 | Team share exposes member PII? | No. Share text is static team name. `teamMembers` rows carry only username/role/roster — **no phone/email** in schema. |
| 2 | Team share exposes private chat? | No (no chat content / link in share). |
| 3 | Non-members open team chat from link? | No. `teamChat.getAccess/getChat/listMessages` require auth + live membership (`teamChat.ts:67-90`); outsiders get `forbidden`/`null`/`[]` and a "Members only" screen. |
| 4 | Challenge share exposes payment state? | No challenge share exists; payment state is captain-only (`teamChallenges.getById` returns `null` to non-captains, `:263-265`). |
| 5 | Challenge share exposes captain wallet/payment? | No. `getChallengePaymentSummary` returns captain UIDs only to the two captains; no balances/refs/order numbers. |
| 6 | Expired/cancelled/completed challenges joinable via share? | No share; chat backend locks non-active statuses (`teamChallengeChat.ts:140-142`); UI shows "Challenge Closed". |
| 7 | Team / challenge share templates | Team: `Check out my team ${team.name} on MatchHai!` (no link). Challenge: none. |
| 8 | Private invite tokens leaked? | No tokens exist — invites are notification rows keyed `team.invite:${teamId}:${toUid}`, consumed only by the named invitee. |

**M1 (Medium):** `teams.getWithMembers`/`getById`/`getByIdString` are unauthenticated public reads returning the full roster (UIDs, usernames, roles) with no membership check. Acceptable for *public* teams, but **private** teams (`visibility==='private'`) are not protected at the data layer — `teams/[id].tsx:234` only disables the join button. Risk is read disclosure of a private roster, not write (write actions are backend-authz'd).

---

## 6. Admin / Super-Admin Share & Copy Audit (Phase 6) — PASS

| # | Question | Finding |
|---|---|---|
| 1 | Admin can copy/share sensitive refs? | Only clipboard surface is `CopyableId` (`payment/[orderRefNum].tsx:62-86`) copying opaque internal IDs. No bank account/CNIC/token/payload on any copy path. |
| 2 | Admin links admin-only? | Yes. `super-admin/_layout.tsx:42-55` redirects non-admins + logs `recordSuperAdminAccessDenied`. Internal navs stay in `/super-admin/*`. |
| 3 | Copy/share include secrets? | No. |
| 4 | Copied text safe/truncated? | Copied = opaque IDs; displayed refs truncated in cards. |
| 5 | Export/share protected? | No export/share features exist; all backing queries server-gated. |
| 6 | Non-admin opening admin link blocked safely? | Yes. `getAuthenticatedAdmin` throws `"Super admin access required"` (`admin.ts:251`) — clean Error; service wrappers return generic messages. |
| 7 | Backend role-gated server-side? | Yes — every exported admin query/mutation calls `getAuthenticatedAdmin(ctx, args.sessionToken)` (70+ sites). `requestZoneWithdrawal` gated by `requireKycVerified` + self-check (`zoneWithdrawals.ts:73-80`). |

**Residual (Medium, by-design):** full payout bank account `accountNumberFull` is *displayed* in the super-admin withdrawals drawer (`withdrawals.tsx:664`) so the reviewer can execute the transfer — backend-gated, plain non-selectable text, not copyable/shareable/exportable. Also emailed in full to the fixed internal `WITHDRAWAL_REQUEST_EMAIL` (`zoneWithdrawals.ts:116`). Residual risk = shoulder-surfing by an authorized admin, not an access gap.

**Latent (Low):** `listEasypaisaTransactions` (`admin.ts:1236`) returns raw `providerPayload.ipn/hosted` blobs over the wire (super-admin-gated, not currently rendered/copied by any UI). Consider deprecating the legacy query so a future screen can't surface it.

Support ticket detail, identity verifications (statuses only, no CNIC/doc payload), and audit logs (`metadataSafe` only) are all server-redacted.

---

## 7. Deep-Link / Routing Access-Control Audit (Phase 7)

**Architecture:** scheme `matchhai` (`app.json:8`); no `expo.linking`/intentFilters/associatedDomains → default expo-router auto-linking over the custom scheme (no Universal/App Links). `matchrooms`, `teams`, `zone`, `super-admin` are **siblings** of `(player)`, so they do NOT inherit `(player)/_layout.tsx`'s `!user` redirect — each group must guard itself.

| Group | Layout guard | Status |
|---|---|---|
| `(player)` | `_layout.tsx:44-50` `!user`→login | OK |
| `teams` | `_layout.tsx:28-34` `!user`→login, role redirect | OK |
| `zone` | `_layout.tsx:38-44` `!user`→login, non-zone/non-SA→player tabs | OK |
| `super-admin` | `_layout.tsx:42-55` `!user`/`!SA`→login + telemetry | OK |
| **`matchrooms`** | **none** — plain `<Stack>` | **GAP (H1)** |

| Route | Backing query & access | Outsider result | Fallback UI |
|---|---|---|---|
| `/matchrooms/[id]` | `matchrooms.getById` — public read, only strips matchCode | **Full room doc** (C1) | "Matchroom not found" toast + back on null |
| `/matchrooms/chat/[id]` | `chat.getMatchroomAccess` — auth + participant | none | dedicated forbidden/unauth screens |
| `/teams/[id]` | `teams.getWithMembers` — public, no membership check | full roster (M1) | "Team not found"; deleted banner |
| `/teams/team-chat`, `/teams/challenge-chat` | membership / captain checks | none | "Members only" / safe states |
| `/(player)/profile/[uid]` | `users.getPublicById` — redacted + null for hidden/deleted | redacted / null | "Profile not found" |
| `/(player)/zones/[id]` | `getPlayerVenueDetails`→`zones.getById` | public venue data (+ H2 over-return) | error state + report UI |
| `/zone/**` | layout redirect + backend authz on mutations | redirected | redirect to player tabs |
| `/super-admin/**` | layout redirect + `getAuthenticatedAdmin` on every query | redirected + clean Error | safe `{ok:false}` messages |

**Scenario results:**
1. Unauth opens `matchhai://matchrooms/<id>` → renders (no guard) and receives full room doc. **Leak.**
2. Outsider opens `/teams/<id>` → must log in, then any player gets full roster (private teams unprotected). **Read disclosure.**
3. Outsider opens team/challenge chat → blocked, safe screen. **OK.**
4. Outsider opens `/(player)/profile/<uid>` → redacted/null + "not found". **OK.**
5. Non-zone-admin opens `/zone/...` → redirected. **OK.**
6. Non-super-admin opens `/super-admin/...` → redirected + backend throws. **OK (defense in depth).**
7. Expired/cancelled matchroom → data still served (C1); UI shows expired banner, hides join/QR.
8. Deleted/suspended profile → null → "not found". **OK.**
9. QR link from outsider → same as #1; real `matchCode` stripped server-side, but roster/venue/schedule served.

**Notification deep-link param safety:** hrefs carry resource IDs only — no tokens, secrets, PII, OTPs, or payment refs. Push-tap routing gated client-side (`NotificationRuntimeBridge.tsx:102-110`) to authed users; a *manually* opened raw scheme link bypasses this (mitigated by per-group layout guard — which is why H1 matters).

---

## 8. QR / Check-In Privacy Audit (Phase 9)

- QR rendered client-side (`MatchroomSummarySection.tsx:141-146`); value is `matchhai://matchrooms/<id>` — a **route, not a secret**.
- QR card + match code render only when `canViewCheckIn && isLocked && qrValue` (`:134`). `canViewCheckIn` is **backend-authoritative** via `resolveCheckInAccess` (host, captainA/B, joined players, slot occupants, owning zone owner, super admin — `matchrooms.ts:2186-2222`); the real `matchCode` is nulled server-side for outsiders.
- QR/match code never appear in share text or in the shared link. **Good.**
- Terminal-state suppression: detail screen forces `canViewCheckIn=false` for terminal status (`[id].tsx:267-274`), so completed/expired/cancelled rooms don't show an active QR on screen. (Server still returns `matchCode` to a *member* on a finished room — UI hides it; minor, see Low below.)
- No tokens in the QR/link, so nothing to expire. `matchCode` itself is static/never-rotating (`schema.ts:614`) with a permanent `by_matchCode` index — valid forever once known, and `getByMatchCode` leaks it (C2).

**H3 (High):** `matchroomLobbyState.ts:251` — `const matchCode = room?.matchCode || (room?.id ? room.id.slice(-6).toUpperCase() : "")`. When the server nulls `matchCode`, the client synthesizes a code from the public room ID, so the "code" is a trivially guessable function of the ID and the server null-out is undermined for the displayed value (currently still gated by `canViewCheckIn`, but one render-condition away from exposure).

---

## 9. Copy / Content Quality Recommendations (Phase 8 — document only)

| Surface | Current | Recommended (do not implement yet) |
|---|---|---|
| Matchroom share | `Join my ${room.game} lobby on MatchHai! ${room.title}` (no link, raw game key) | `Join my {GameLabel} matchroom on MatchHai 🎮\n{title}\n📍 {area/venue or "Venue TBC"} · 🗓 {date} {time} · {N} seats left\nOpen: matchhai://matchrooms/{id}` — friendly game label (`cs2`→CS2, `fc26`→FC26), include deep link, omit seats/venue when not public/joinable, never include match code/payment |
| Team share | `Check out my team ${team.name} on MatchHai!` (no link) | `Check out ${team.name} (${gameLabel}) on MatchHai! Join us in the app.` + deep link to public `/teams/{id}` (roster-PII-free) |
| Venue share (if built) | n/a | `{venueBrandName} — {branch}, {area}, {city} · Games: {labels} · From {startingPriceLabel} · Book on MatchHai: <public /(player)/zones/[id] link>` — exclude owner UID/name, notes, payout rates, `/zone` routes |
| Profile share (if built) | n/a | Display name + `matchhai://profile/<uid>` only; rely on `getPublicById` gating |

Guidance: include game/venue/date/time/seats where relevant; friendly labels for Pakistan audience; never internal IDs as visible copy (path-only); gate share buttons off for terminal/private entities.

---

## 10. Issues by Severity

### Critical
- **C1 — `matchrooms.getById` leaks the full raw matchroom doc.** `convex/matchrooms.ts:2234`. Current: spreads entire doc to any caller (no auth, no `isPrivate`), leaking payment/payout/settlement refs, GPS, all UIDs, result votes, cancel notes. Expected: public-safe allow-listed projection for non-members; full only to authorized actors; honor `isPrivate`. Fix: build projection (mirror `publicUser()` in `authz.ts`), gate on `resolveCheckInAccess`/membership, never spread raw doc. Test: unauth `getById` returns no `*payout*`/`*Settlement*`/`sourcePaymentOrderRefNum`/`coordinates`/`resultVerification`; member still gets full data.
- **C2 — `matchrooms.getByMatchCode` spreads full doc AND does not null matchCode.** `convex/matchrooms.ts:2256`. Fix: same projection + member gate; never echo `matchCode`. Test: outsider with a known code gets public-safe shape, `matchCode` absent.

### High
- **H1 — `/matchrooms` route group has no auth guard.** `app/matchrooms/_layout.tsx`. Fix: add `useAuth`+`Redirect` matching `teams/_layout.tsx`; pair with C1 backend fix. Test: open `matchhai://matchrooms/<id>` logged out → redirect to login.
- **H2 — `zones.getById` over-returns (owner PII + payout rates + notes).** `convex/zones.ts:84`. Fix: add `getPublicVenueById` with whitelisted projection; keep raw `getById` behind owner/admin auth; route player path to the public query. Test: unauth call asserts no `pilotPayoutRate`/`normalPayoutRate`/`notes`/`ownerUid`.
- **H3 — Client re-derives match code from room ID.** `app/matchrooms/utils/matchroomLobbyState.ts:251`. Fix: `const matchCode = room?.matchCode ?? null;` render only when truthy and `canViewCheckIn`. Test: outsider/locked room → no ID-derived 6-char code anywhere.

### Medium
- **M1 — `teams.getWithMembers`/`getById` expose private-team roster to any authed user.** `convex/teams.ts:151-173,263-278`. Fix: when team is `private` and viewer not member/captain/SA, omit `members` (counts only). Test: non-member opens private `/teams/<id>` → member identities absent.
- **M2 — No `isPrivate` enforcement on matchroom read.** `convex/matchrooms.ts:2224-2245`. Fix: in projection gate, private + non-member → `null`/unavailable. (Folds into C1.)
- **M3 — Matchroom & team Share buttons not lifecycle/role-gated + link-less.** `app/matchrooms/[id].tsx:533`, `app/teams/[id].tsx:517`. Fix: hide/disable share for terminal/`isPrivate` entities; add deep link + marketable copy (§9). Test: cancelled/private room → share hidden.

### Low
- **L1 — OAuth deep-link echoes provider IDs into a toast.** `app/_layout.tsx:142-159`. Fix: gate behind `__DEV__` or remove value-bearing toast. Test: `matchhai://oauth?steamId=<x>` → no `<x>` toast in production.
- **L2 — Member gets `matchCode` on terminal-status rooms** from `getById` (UI hides it). `matchrooms.ts:2233-2237`. Fix: null `matchCode` server-side for terminal statuses too.
- **L3 — Legacy `listEasypaisaTransactions` returns raw ipn/hosted blobs** (SA-gated, unused by UI). `admin.ts:1236`. Fix: deprecate/remove.

---

## 11. Recommended Implementation Phases (for approval — NOT yet implemented)

- **Phase A (Critical, backend projections):** Replace raw spreads in `matchrooms.getById` + `getByMatchCode` with an allow-listed public projection gated on membership; honor `isPrivate` (C1, C2, M2). Add `zones.getPublicVenueById` and point the player venue path at it (H2).
- **Phase B (High, routing + client codes):** Add auth guard to `app/matchrooms/_layout.tsx` (H1). Remove the client match-code fallback in `matchroomLobbyState.ts` (H3).
- **Phase C (Medium, teams + share gating):** Private-team roster projection (M1). Gate Share buttons by lifecycle/`isPrivate`; add deep links + improved copy (M3, §9).
- **Phase D (Low, polish):** OAuth toast (L1), terminal-status matchCode null (L2), deprecate legacy easypaisa query (L3).

> Recommended sequence: A → B before any share copy adds a deep link, because adding a link without the backend projection + route guard would *increase* exposure.

---

## 12. Test Cases (consolidated)

1. Unauthenticated `convex.query(api.matchrooms.getById,{matchroomId})` → response excludes all `*payout*`, `*Settlement*`, `sourcePaymentOrderRefNum`, `coordinates`, `clientCreateRequestId`, `resultVerification`, `cancelNote`; member call still full.
2. Outsider `getByMatchCode` with known code → public-safe shape, `matchCode` absent.
3. Open `matchhai://matchrooms/<id>` logged out → redirected to login.
4. Private matchroom opened by outsider → unavailable; member → normal.
5. Cancelled/private matchroom → Share button hidden/disabled.
6. Share a confirmed public matchroom → message has deep link + friendly game + venue/date/seats, no match code.
7. Unauthenticated `zones.getById` → no `pilotPayoutRate`/`normalPayoutRate`/`notes`/`ownerUid`.
8. Non-member opens private `/teams/<id>` → member identities not returned.
9. Non-member opens team/challenge chat → "Members only", no messages, no raw Convex error.
10. Deleted/hidden profile link → "Profile not found".
11. Non-super-admin opens `/super-admin/payment/<ref>` → redirect + clean denial, no data.
12. `matchhai://oauth?steamId=<x>` → no `<x>` toast in production build.

---

## Validation

- `npx tsc -p tsconfig.json --noEmit`: _see final report section_
- `git status --porcelain`: _see final report section_
- Audit-only. No code modified by this audit other than creating this tracker. No codegen, build, deploy, or push.
