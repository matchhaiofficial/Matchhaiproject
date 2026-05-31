# MatchHai — Full App Audit (Audit-Only, Pre-Launch Product Readiness)

> **Status:** AUDIT ONLY. No source code, schema, backend, or config was modified.
> **Date:** 2026-05-24 · **Branch:** `product-ready` · **Working tree:** clean
> **Stack:** Expo SDK 54 / React Native 0.81.5 / React 19 / Expo Router 6 / Convex 1.32 / Better Auth 1.4.9
> **Auditor mode:** Fully exhaustive static audit + `tsc --noEmit` + dependency/config scan.
> **Author note:** This file is the working tracker **and** the final professional audit. Do not delete.

---

## 0. Tracker — Methodology, Coverage, Known Unknowns

### 0.1 Commands run (read-only / safe)
| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | **PASS — exit 0, zero type errors** across app + (app-side) types. Strong baseline. |
| `git status` | Clean working tree, branch `product-ready` up to date with origin. |
| `git diff --stat` | No diffs (clean). |
| Glob / Grep / Read | Used throughout for code inspection (see §0.3). |

> **Not run (per instructions):** `convex codegen`, `convex dev`, `eas build`, deploy, migrations, installs, formatting.
> **Note:** `tsc` validates the app via `tsconfig.json`. `convex/` has its own `convex/tsconfig.json` and is type-checked by the Convex toolchain at deploy time, which was **not** run — so Convex-only type regressions are not covered by the PASS above.

### 0.2 Confidence taxonomy used in this report
- **[CONFIRMED]** — verified by reading the exact code path.
- **[LIKELY]** — strong evidence from code but a runtime/edge path not fully traced.
- **[RISK]** — design/architecture risk; not a guaranteed defect.
- **[IMPROVEMENT]** — quality/UX/perf betterment, not a defect.
- **[MANUAL QA]** — cannot be verified statically; needs device/runtime testing.

### 0.3 Coverage map (depth of inspection)
| Area | Depth |
|---|---|
| Convex `schema.ts` | Deep (full, 1827 lines) |
| `zoneAdminBooking.ts` + service + `kycGate.ts` | Deep (auth bug target) |
| Auth providers (`AuthenticatedConvexProvider`, `convex.ts`) | Deep |
| `timing.ts` (date/time rules) | Deep (full) |
| `easypaisa.ts` (idempotency/lock) | Deep (key paths) |
| `admin.ts` (super-admin gate, masking, payment detail) | Deep (gate + exports map) |
| `matchrooms.ts` (start/complete lifecycle) | Targeted (lifecycle guards) |
| `notifications.ts` (dedupe), `reminderManager.ts` | Targeted/Deep |
| `AppModalPrimitives.tsx` | Deep (full) |
| `app.json` / `eas.json` / `package.json` / `tsconfig.json` | Deep (full) |
| Player/Team/Super-Admin **screens** (`*.tsx`) | Structural + reasoned (not every screen line-read) |
| External API actions (Steam/FACEIT/PSN/Didit/Expo push) | Structural + reasoned |

### 0.4 Known unknowns (require manual device/runtime QA or credentials)
1. Real-device modal scroll behavior (Samsung A32, iPhone SE, Pro Max, tablets).
2. iOS payment modal button tap behavior (WebBrowser / in-app browser return).
3. Live Easypaisa success/failure/pending callbacks (no sandbox creds exercised).
4. Didit KYC webhook round-trip; Expo push real delivery + token churn.
5. Production Convex deployment env wiring (eas.json `production` profile has no env — see CR-04).
6. Steam/FACEIT/PSN live rate limits and error fallbacks.
7. Actual App Store / Play Store metadata, screenshots, privacy forms (not in repo).

---

## 1. Executive Summary

**Overall readiness (static assessment): ~62% — NOT yet release-ready for public stores.** The product is feature-complete and unusually mature in its backend modeling (payment idempotency, broadcast lifecycle, dedupe-aware notifications, audit logging, KYC gating). TypeScript compiles cleanly. However, there are **release-blocking gaps in access control, store/build configuration, and iOS permission declarations** that must be fixed before submission, plus a set of high-severity correctness/UX risks concentrated in the recently-worked areas (payments, zone-admin actions, notifications).

### Biggest blockers (must fix before public launch)
1. **CR-01 [CONFIRMED — Security/Access Control]** Zone-admin booking mutations (`acceptBookingRequest`, `rejectBookingRequest`, `sendCounterOffer`) enforce only `requireKycVerified` (signed-in + KYC), **not zone ownership**. Any KYC-verified user can accept/reject/counter bookings for **any** zone, mint matchrooms, and set `adminUid`/`zoneOwnerUid` to arbitrary values. Classic IDOR / broken object-level authorization.
2. **CR-02 [CONFIRMED — Store/iOS]** `app.json` declares only a microphone usage string. The app uses **image & document pickers** in 5 screens (`expo-image-picker`/`expo-document-picker`) but those plugins are **not registered** and **no `NSPhotoLibraryUsageDescription`/`NSCameraUsageDescription`** strings exist → iOS App Store rejection and/or runtime crash on first picker use.
3. **CR-04 [CONFIRMED — Build/Deploy]** `eas.json` **`production` build profile has no `env` block** (no `EXPO_PUBLIC_CONVEX_URL`). `preview` and (implicitly) prod share **one** Convex deployment; there is **no staging↔production separation**. A production build risks shipping with no/incorrect backend URL.
4. **CR-03 [CONFIRMED — Security]** Super-admin gate falls back to a **hard-coded default email** (`superadmin@matchhai.com`) when `EXPO_PUBLIC_SUPER_ADMIN_EMAIL` is unset, and the email is a **public** `EXPO_PUBLIC_*` value. Whoever controls/registers that email becomes super admin.
5. **CR-05 [LIKELY — Security]** Super-admin role check compares `profile.role === "super-admin"` (hyphen) while the rest of the app uses `"super_admin"` (underscore). A user promoted via `setUserRole` to one spelling may bypass/lose admin depending on the writer — inconsistent authorization source of truth.

### Highest-risk flows
- **Payments/Easypaisa** (money movement, stuck states, reconciliation) — backend is strong, but UI state honesty + production env wiring are the risk.
- **Zone-admin booking accept/reject/counter** (access control + the historical "Unauthenticated" symptom).
- **Matchroom lifecycle** (lock/expire/start/result verification correctness across crons).
- **Notifications** (dedupe, deep-link route validity, reminder accuracy).

### What can be post-launch
- UI polish, animation refinement, deeper performance/memoization passes, tablet/landscape support, advanced ASO, broader test automation.

---

## 2. Flow Map

### 2.1 Player flows
```
Register (4 steps) → email/phone verify → onboarding (games/areas/platforms) → KYC (Didit) gate
  → Home dashboard → Discover (players/teams/zones/matchrooms, filters)
  → Create Matchroom (solo ≥3d / team) → zone-specific OR broadcast fanout
       → Booking intent → Pay & Review (Easypaisa / wallet hold) → Booking Status (poll)
       → Lobby fill → lock (24h pre-start) → start → complete → result verification (captain → vote → admin)
  → Wallet (top-up, transactions, held balance, unpaid bookings)
  → Teams (create, invite, captain transfer) → Team Challenge (≥2d) → venue propose/confirm
  → Inbox/notifications (deep-link routes) → Schedule → Friends/Chat → Reports/Support
```

### 2.2 Zone Admin flows
```
Zone register (steps) → Super-Admin approval → (approved_pending_migration → active) → KYC
  → Dashboard → Bookings: Requests (accept/reject/counter ±2h) | Matchrooms | Walk-ins (≥1d) | History
  → Resources (allocation/lifecycle) → Pricing rules → Notifications → Insights → Audit → Support → Profile/Branches
  → Withdrawals (request → super-admin approve/reject) → Pilot payout
```

### 2.3 Super Admin flows
```
Allowlist-gated entry → Dashboard (quick actions, summary)
  → Users (role, suspend) → Zones (approve/reject/suspend, retry migration)
  → Payments (list V2, Easypaisa list, payment detail by orderRefNum, attention flags)
  → Withdrawals (approve/reject) → Identity Verifications (manual verify) → Reports (status)
  → Support Tickets (assign/note/reply/resolve) → Matchrooms (monitor) → Audit Logs → Notifications
```

### 2.4 Backend / notification / payment flows
```
Easypaisa: startCheckout (idempotent lock, reuse active) → REST initiate → checkout → IPN/callback (http.ts)
  → syncTransactionStatus → wallet credit / hold capture / settlement → attention flags → super-admin notify
Wallet: deposit / hold / hold_capture / hold_release / refund (walletTransactions ledger)
Notifications: createCanonicalFromServer (dedupePolicy: upsert/replace/versioned) → push (Expo) → deep-link route
Crons (every ~2 min): lifecycle transitions (lock, expire-not-full, start, result deadlines, broadcast expiry)
```

---

## 3. Critical Bugs

| ID | Sev | Role | Flow | Category | Status | Issue / Affected files | Repro | Expected | Actual | Recommended fix | Impl risk |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **CR-01** | Critical | Zone Admin / any user | Zone booking accept/reject/counter | security/auth | CONFIRMED | Mutations only call `requireKycVerified(ctx)`, never verify caller owns `args.zoneId`; `adminUid`/`zoneOwnerUid` are client strings. `convex/zoneAdminBooking.ts` (`acceptBookingRequest` L963, `rejectBookingRequest` L1291, `sendCounterOffer` L1401), `convex/kycGate.ts`. | As any KYC-verified account, call `api.zoneAdminBooking.acceptBookingRequest` with another zone's `zoneId`/`requestId`. | Reject unless caller owns the zone (like `requireAuthenticatedZoneOwner` used in queries). | Action succeeds; resources allocated, matchroom created, audit attributed to attacker-chosen `adminUid`. | Add `requireAuthenticatedZoneOwner(ctx, args.zoneId)` to all three mutations + walk-in/respond; derive `adminUid`/`zoneOwnerUid` from the resolved actor, not args. | Low (additive guard; mirrors existing query helper). |
| **CR-02** | Critical | Player/All | Profile image, team logo, chat attachments | store/iOS | CONFIRMED | `expo-image-picker`/`expo-document-picker` used in `app/(player)/profile/edit.tsx`, `app/teams/[id].tsx`, `app/teams/challenge-chat.tsx`, `app/matchrooms/chat/[id].tsx`, `app/(player)/friend-chat/[friendId].tsx`; not in `app.json` `plugins`; no `NSPhotoLibraryUsageDescription`/`NSCameraUsageDescription`. | Build iOS, open profile edit → pick photo. | Picker shows with permission prompt. | App Store review rejection (missing purpose strings) / runtime crash. | Add `expo-image-picker` + `expo-document-picker` to `plugins` with iOS permission strings; add `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription` to `ios.infoPlist`. | Low (config only). |
| **CR-03** | Critical | Super Admin | Admin auth | security | CONFIRMED | Default fallback `superadmin@matchhai.com` + public `EXPO_PUBLIC_SUPER_ADMIN_EMAIL`. `convex/admin.ts` L12, L91-93, allowlist always appends default. | Leave env unset; register that email. | No implicit god-account; admin emails server-only. | Whoever owns the default email gets super-admin. | Remove default fallback; require explicit server-side env (non-`EXPO_PUBLIC_`); fail closed if unset. | Low-Med (must set prod env before deploy). |
| **CR-04** | Critical | All | Production build → backend | build/deploy | CONFIRMED | `eas.json` `production` profile has no `env`; only `preview` sets `EXPO_PUBLIC_CONVEX_URL`. No staging/prod split. | `eas build --profile production`. | Prod build has correct prod Convex URL + secrets. | Prod build may have undefined Convex URL (warned only) → app can't reach backend. | Add `production.env` (separate prod Convex deployment) or EAS secrets; document staging vs prod. | Med (deployment topology decision). |
| **CR-05** | Critical | Super Admin | Admin authorization | auth/validation | LIKELY | `isAuthorizedSuperAdmin` checks `profile?.role === "super-admin"` (hyphen) vs `"super_admin"` (underscore) used in notifications/recipientRole. `convex/admin.ts` L108; verify `setUserRole` written value. | Promote a user via `setUserRole`, then rely on `profile.role` path. | One canonical role string everywhere. | Hyphen/underscore mismatch can grant/deny inconsistently. | Standardize on one constant (`"super_admin"`), migrate existing values, centralize in a shared `roles.ts`. | Med (data migration of role strings). |
| **CR-06** | Critical→High | Player | Payment honesty / stuck states | payment/UI | RISK / MANUAL QA | If money debited but callback pending/failed, UI must always surface `orderRefNum` + support path. Backend has attention flags (`easypaisa.ts` L563-582) + super-admin detail, but the **player-facing** "Booking Status"/"Pay & Review" copy needs verification it never shows false success/failure and always shows orderRef on ambiguity. `app/matchrooms/book/status/[intentId].tsx`, `book/pay/[intentId].tsx`. | Pay, kill app mid-callback, reopen status. | Clear "pending — we'll confirm; ref: XXXX; contact support" state. | Unverified statically; potential misleading state. | Verify status screen renders explicit pending/unknown state with orderRef + support deep-link; add reconcile poll + manual "I've paid" → server `syncTransactionStatus`. | Med. |

> Note: CR-06 straddles Critical/High pending device QA of the two payment screens; treated as a release gate for the money path.

---

## 4. High / Medium / Low Issues

### 4.1 High
| ID | Role | Flow | Category | Status | Issue / Files | Expected vs Actual | Fix |
|---|---|---|---|---|---|---|---|
| H-01 | All | Direct service mutations at cold start | auth/session | LIKELY | `setActiveConvexClient` runs in a `useEffect` (post-render); until it fires, the module default **unauthenticated** client is active (`src/lib/convex.ts` L23, `AuthenticatedConvexProvider.tsx` L182). A direct service mutation fired during first paint → `Unauthenticated`. | Direct calls always authed. | Set active client synchronously on client creation (in `createConvexClient` caller) or gate service calls on an `authReady` flag; this is the residual root of the historical zone-admin "Unauthenticated" reports. |
| H-02 | Zone Admin | Booking queue | perf/scalability | CONFIRMED | `listBookingQueueForZone` does `query("bookingRequests").withIndex("by_status").collect()` then filters in JS (`zoneAdminBooking.ts` L659-677). Full-table scan of all booking requests across all zones, every 5s poll. | Indexed per-zone query. | Add/use `by_zoneId_and_status` (or fan via `by_zoneId`); avoid global `.collect()`; the comment even admits "No area matching possible with current schema". |
| H-03 | Zone Admin | Matchrooms list | perf/scalability | CONFIRMED | `listMatchroomsForZone` does `.take(200)` over `by_createdAt` twice for ownerUid/location hints (L924-951) — caps results (silent truncation) and scans recent 200 globally. | Per-zone indexed query. | Use `by_zoneId`/`by_zoneOwnerUid` indexes; remove 200-cap heuristic. |
| H-04 | Player | Payment polling | perf/network | CONFIRMED | Zone services poll every **5s** via `setInterval` (`zoneAdminBookingService.ts` L116) with `convex.query`; multiple subscribers share state but still a steady poll. Combined with payment status polling → battery/network + Convex read load at scale. | Prefer reactive `useQuery` subscriptions (already noted in code comments) over interval polling. | Migrate hot lists to `useQuery`; keep polling only where necessary; back off when backgrounded. |
| H-05 | Super Admin | Payment lists | perf/scalability | LIKELY | `listEasypaisaTransactions`/`listPaymentsV2`/`listUsers`/`listReports` (admin.ts) — verify all are paginated; large tables `.collect()` will not scale and can exceed Convex limits. | Cursor pagination. | Ensure `.paginate()` or bounded `.take()` with cursors on every admin list. |
| H-06 | Player | Result verification | data integrity | LIKELY | `submitCaptainReport` routes invalid verification to admin review (`matchrooms.ts` L2323-2331) — good — but confirm participant-vote & admin-review deadlines (`RESULT_CAPTAIN_VERIFICATION_MS=2h`, `RESULT_PARTICIPANT_VOTE_MS=12h`) are enforced by crons and can't strand a room in `participant_vote` forever. | Deadlines auto-resolve. | Verify cron handles result deadlines; add fallback to admin_review on expiry. |
| H-07 | Player | Broadcast booking | lifecycle/race | RISK | Broadcast offer windows (`BROADCAST_OFFER_RESPONSE_WINDOW_MS=2h`) + scheduled `expireBroadcastCounterOffer` via `ctx.scheduler.runAfter`. Concurrent zone accept vs expiry vs player selection could race; `acceptBookingRequest` guards `existingOffers.length>0` but multi-zone fanout still needs first-writer-wins verification. | Exactly one venue confirmed. | Add a transactional guard on `confirmedZoneId` set; idempotent confirm. |
| H-08 | All | Schema typing | db/maintainability | CONFIRMED | Heavy `v.any()` on critical fields: `users.steamStats/faceitStats/psnStats/teamsByGame`, `matchrooms.ruleset/walkIn/resultVerification.participantVotes/votes`, `zones.pricing/branches`, `pricingRules` time, `notifications.data`, `bookingRequests`-derived. Loses validation + index/query safety. | Typed validators. | Incrementally replace `v.any()` with explicit validators (start with money/lifecycle-affecting ones: `walkIn`, `resultVerification` votes, `zones.pricing`). |
| H-09 | Player | Matchroom create | validation | LIKELY | Time rules exist server-side (`timing.ts`) but confirm **both** create paths (player `useMatchroomCreateSubmitFlow.ts` and zone-accept) call `validateMatchroomScheduleWindow`/`validateWalkInScheduleWindow` before insert; client-only enforcement is bypassable. | Server validates every insert. | Ensure all matchroom/booking inserts validate the window server-side (grep shows `validate*` imported in `zoneAdminBooking.ts` but verify call sites). |
| H-10 | Zone Admin | Counter-offer time | time/date | CONFIRMED-design | ±2h window validated using **client-computed** `proposedStartAts`/`originalStartAt` epoch ms (`sendCounterOffer` L1421-1465). If client omits them, validation is skipped (loop over empty array). | Server derives times authoritatively. | Server should compute proposed/original ms from date+time strings + zone TZ rather than trusting client; reject when missing. |

### 4.2 Medium
| ID | Role | Category | Status | Issue / Files | Fix |
|---|---|---|---|---|---|
| M-01 | All | data model | CONFIRMED | `teamMembers.odxerId` is a typo-named field for the user id (`schema.ts` L961, indexes `by_userId`→`["odxerId"]`). Confusing, error-prone. | Rename to `userId` via migration; keep index name. |
| M-02 | All | data model | CONFIRMED | Dual ID shapes: `teamChallengeChatMessages.senderUid` is `string` "for backwards compat" with TODO to become `v.id("users")` (schema L1066-1070). Mixed string/id comparisons recur (e.g. `String(...)===String(...)`). | Plan the migration; document invariant. |
| M-03 | Player | UX | RISK | `fc25`→`fc26` normalization scattered across many files (`normalizeGameKey`). Inconsistent handling risks orphaned `fc25` rows. | Centralize game-key canonicalization in one util; migrate stored `fc25`. |
| M-04 | Zone Admin | UX/error | CONFIRMED | Many zone mutations `throw new Error("...")` strings surfaced via `getUserFacingErrorMessage`. Good, but resource-fit errors ("CS and Valorant bookings require exactly 2 complete PC rooms" vs code requires 10 ids for pc — see `getRequiredResourceProfile` L55-60 returns `requiredResourceIds: 10` but error text says "2") — **message/logic mismatch**. | Fix message or count; reconcile pc resource requirement (10 vs 2). |
| M-05 | All | notifications | LIKELY | Deep-link routes embedded as strings (`/zone/modules/bookings?...`, `/(player)/inbox`, `/matchrooms/{id}`). No central route validator → a renamed route silently dead-ends. | Centralize routes (`src/navigation/routes.ts` exists) and validate on notification create. |
| M-06 | Player | wallet | LIKELY | Active top-up reuse throws `ACTIVE_TOPUP_IN_PROGRESS_MESSAGE` on amount mismatch (`easypaisa.ts` L1164). UX must let user cancel the stuck top-up; verify a cancel path exists. | Add explicit "cancel pending top-up" affordance. |
| M-07 | All | time/date | CONFIRMED | `parseLocalDateTimeMillis` uses `new Date(`${date}T${time}`)` (server TZ) in `zoneAdminBooking.ts` L23-29 while service uses explicit local Y/M/D construction. Mixed TZ assumptions can shift bookings by hours. | One TZ-explicit datetime helper shared by client+server (use Pakistan TZ). |
| M-08 | Super Admin | masking | LIKELY | Payment detail returns `providerPayload.ipn/hosted/lastProviderStatus` (admin.ts L1130-1135). Confirm raw IPN doesn't leak card/MSISDN PII to admin UI beyond need. | Whitelist fields; mask MSISDN. |
| M-09 | All | dedupe | LIKELY | Friend-request dedupe is directional (`social.friend_request:${from}:${to}`) — reverse-direction duplicate requests not deduped. | Use sorted pair key. |
| M-10 | All | crons | RISK | Lifecycle cron every 2 min (`LIFECYCLE_CRON_INTERVAL_MS`). Verify batch sizes bounded and idempotent; a growing matchroom table could make each tick scan-heavy. | Bound per-tick work with indexed status+time queries. |
| M-11 | Player | onboarding | RISK | KYC gate allows `pending/in_progress/in_review` as "access allowed" (`kycGate.ts` L18-25). A user can transact while only `pending` — confirm that's intended for money flows (withdrawals use stricter message). | Confirm policy; possibly require `verified` for payouts/withdrawals (already a separate message exists). |
| M-12 | All | env | CONFIRMED | `SKIP_KYC_VERIFICATION`/`SKIP_PHONE_OTP` bypass exists (`kycGate.ts` L11-16). Ensure these are never set in production env. | Add deploy guard/assert; document. |

### 4.3 Low
| ID | Category | Status | Issue / Files | Fix |
|---|---|---|---|---|
| L-01 | UI | CONFIRMED | `AppModalHeader` title `numberOfLines={1}` + `adjustsFontSizeToFit` + `allowFontScaling={false}` — disables Dynamic Type for titles (a11y). | Allow font scaling or test legibility. |
| L-02 | build | CONFIRMED | `app.json` Android `permissions` lists both `RECORD_AUDIO` and `android.permission.RECORD_AUDIO` (duplicate). | De-duplicate. |
| L-03 | build | CONFIRMED | `firebase` (12.5) is a dependency but Convex/Better Auth is the backend; if unused it bloats bundle. | Confirm usage; remove if legacy. |
| L-04 | build | CONFIRMED | `@convex-dev/auth` and `better-auth`/`@convex-dev/better-auth` both present — confirm only one auth path is live; dead dep = bundle bloat + confusion. | Remove unused auth lib. |
| L-05 | UI | RISK | `edgeToEdgeEnabled:false` on Android — Android 15 (target SDK 35) force-enables edge-to-edge; setting may be ignored → content under status/nav bars. | Test on Android 15; adopt edge-to-edge + safe-area. |
| L-06 | DX | CONFIRMED | `app/debug/perf.tsx` debug screen ships in the route tree. | Gate behind `__DEV__`/remove from prod routes. |
| L-07 | UI | RISK | `expo-keep-awake` dependency — ensure not keeping screen awake app-wide (battery). | Verify scoped usage. |
| L-08 | copy | RISK | Wallet/real-money wording (PKR, "deposit", "withdrawal", "pilot payout") may trip store "real-money/gambling" review if framed as wagering. | Frame strictly as venue booking payments; add disclaimers. |

---

## 5. UI / UX Audit

### 5.1 Global consistency [Strong foundation]
- **Design system present:** `src/theme.ts` (SPACING/colors), `src/motion/*` (entrance/press tokens), shared primitives (`AppModalPrimitives`, `AppPrimitives`, `AdminSurface`, `PlayerSurface`, `DetailSurface`). This drives consistency — good.
- **Modals/sheets/drawers** are centralized and well-built (max-height caps, safe-area-aware footer, keyboard-avoiding, scroll fix). [CONFIRMED strength]
- **Dark theme** appears to be the default surface (black splash/nav `#121212`/`#000`). Confirm contrast ratios meet WCAG AA on muted text. [MANUAL QA]

### 5.2 Player UI
- Dashboard is componentized (`components/dashboard/*`) — good separation. [IMPROVEMENT] Verify empty/loading/error states on each tile.
- Discover has structured filter config (`src/features/discover/filterConfig.ts`) and per-entity styles — good. Validate active-count + reset (see §0/Filters).
- Inbox uses swipeable rows + empty state component — good UX affordances.

### 5.3 Zone Admin UI
- Module-based (`features/zoneAdmin/modules.ts`, `ZoneModuleScreen`) — consistent shell. Action errors are mapped to friendly text. [CONFIRMED]
- M-04 message/logic mismatch (resource count) is a visible UX defect.

### 5.4 Super Admin UI
- `AdminSurface` shared shell drives header/back/drawer consistency. Verify every inner page (`payment/[orderRefNum]`, `request/[id]`, `report/[id]`, `matchroom/[id]`, `support-ticket/[id]`) shows a back affordance and consistent list/header spacing. [MANUAL QA — structural pattern is present]

### 5.5 Forms / states / micro-interactions
- Motion tokens (`usePressScale`, `useEntrance`) give consistent press/entrance feel. [IMPROVEMENT] Ensure disabled/submitting states on every CTA (payment, accept/reject) to prevent double-submit (duplicate-action prevention is partly enforced server-side via idempotency/dedupe).

### 5.6 Typography / color / spacing
- Centralized `SPACING` + Google fonts (Inter/Lora/Martel/Montserrat). [RISK] Four font families is heavy for a mobile bundle; confirm all are used.

---

## 6. Responsiveness / Device Audit

### 6.1 Devices to test (matrix)
| Device | Why |
|---|---|
| Samsung A32 (6.5", Android, gesture nav) | Primary low/mid Android; modal scroll + safe-area. |
| Small Android (≤5.5", e.g. older budget) | Chip wrapping, sticky CTA overlap. |
| Large Android / foldable | Layout stretch, edge-to-edge (Android 15). |
| iPhone SE (2/3) | Smallest iOS; modal max-height (75%/82%) + keyboard. |
| iPhone 15/16 Pro Max | Home indicator inset, large canvas. |
| iPad (supportsTablet:true) | App allows tablet — verify it isn't a stretched phone UI. |

### 6.2 Likely breakpoints / issues
- **Modals:** primitives cap at 75% (dialog) / 82% (sheet) of window height and rely on consumer using `AppModalBody scroll`. **Root cause of "visible but not scrollable":** screens rendering long content in the **default `AppModalBody` (scroll=false)** or in raw `<Modal><View>` without a ScrollView. [CONFIRMED mechanism — consumer audit needed]
- **Keyboard:** `keyboardAware` is opt-in per modal; forms that don't set it will hide inputs behind keyboard. [MANUAL QA]
- **Safe area:** Footer adds bottom inset; verify all sticky CTAs (Pay, Accept) use `AppModalFooter`/`bottomChrome` and aren't clipped by the home indicator.
- **iPad:** `supportsTablet:true` with a phone layout → App Review may flag unoptimized iPad UI. Consider disabling tablet or designing for it.
- **Dynamic Type:** `allowFontScaling={false}` in modal header (L-01) — broader audit for forced font sizes.

### 6.3 Device test cases — see §7 (UI/Responsiveness block, RD-*).

---

## 7. Functional QA Test Cases

> **See section "§7-A … §7-K Test Case Tables" appended below.** 360+ cases across all modules.
> Columns: **ID | Module | Role | Preconditions | Steps | Expected | Priority (P0–P3) | Automation (Y/N)**.

*(Test case tables are appended at the end of this document under "TEST CASE LIBRARY".)*

---

## 8. Payment / Wallet / Easypaisa Audit

### 8.1 Current flow [CONFIRMED strengths]
- **Idempotent checkout:** `createCheckoutTransactionWithLock` reuses an active transaction via `activePaymentTransactionId` pointer + `by_bookingIntentId` / `by_userId_and_status` scans + `isActiveCheckoutTransaction`/`chooseLatestActiveTransaction`. Prevents duplicate charges per intent/top-up. (`easypaisa.ts` L1093-1253)
- **Ownership check on pay:** booking-intent checkout asserts `intent.createdByUid === userId` (L1121) — good (you can't pay into someone else's intent server-side).
- **TTL:** `PAYMENT_INTENT_TTL_MS` / `EASYPAY_CHECKOUT_TTL_MS` = 15 min — bounded attempts.
- **Reconciliation hooks:** attention flags + super-admin notify (`easypaisa.ts` L541-582), payment detail by orderRef (`admin.ts` L1142), `syncTransactionStatus` action (L1695).
- **Wallet ledger:** `walletTransactions` with explicit `hold/hold_capture/hold_release/refund/booking_payment/deposit/withdrawal` types + `by_reference` index (idempotency by reference).
- **Settlement:** `markMerchantCapturedForAcceptedMatchroom` only captures full, approved, zone rooms; idempotent on `merchantSettlementStatus==="captured"`.

### 8.2 Risks / edge cases
| # | Risk | Status | Action |
|---|---|---|---|
| 8.2.1 | Production has no Convex URL env (CR-04) → payments can't initialize in prod build. | CONFIRMED | Fix eas.json prod env. |
| 8.2.2 | Player-facing honesty of pending/failed states + orderRef visibility (CR-06). | MANUAL QA | Verify status screen copy + support deep-link. |
| 8.2.3 | "Pay from someone else's Easypaisa account": server binds intent to `createdByUid`, but the **payer MSISDN** can differ from the account owner. Confirm settlement/refund target is the platform, not the payer, and that refunds go to wallet (not payer phone). | LIKELY | Document refund target = wallet credit. |
| 8.2.4 | Hold capture timing: `captureScheduledAt`/`captureScheduledFnId` exist; verify scheduled capture can't double-capture or capture a released hold. | LIKELY | Idempotency on `heldStatus` transitions. |
| 8.2.5 | iOS payment modal buttons (WebBrowser return → "I've paid/Continue"/"Do this later"). | MANUAL QA | Device-test return-from-browser → status poll. |
| 8.2.6 | Refund on rejection: `rejectBookingRequest` calls `releaseHoldsForMatchroom` + `refundCapturedHoldsForMatchroom` (zoneAdminBooking.ts L1336-1345) — good; verify both are idempotent and notify the player. | LIKELY | Confirm + add player refund notification. |
| 8.2.7 | Currency hard-coded "PKR" in many spots; ensure no mixed-currency math. | CONFIRMED | Centralize currency constant. |

### 8.3 Payment test cases — see §7-F (PW-*), 50+ cases.

---

## 9. Notification Audit

### 9.1 Architecture [CONFIRMED strengths]
- **Canonical creator** `notifications.createCanonicalFromServer` with `dedupePolicy` union: `upsert_active` / `replace_active` / `versioned_new` (`notifications.ts` L35, L547-621) and `by_dedupeKey` index. Strong dedupe model.
- **Push pipeline:** `pushDevices` table (expo token, platform, permission, isActive, lastError), `pushNotificationsActions.ts`, `PushRegistrationBridge`, `NotificationRuntimeBridge`.
- **Local reminders:** `reminderManager.ts` correctly skips completed/cancelled/expired rooms, past start times, and past trigger moments (the "false 15m reminder" guard — L24-29). Default 15m, clamped [0,120].

### 9.2 Risks / gaps
| # | Risk | Status | Action |
|---|---|---|---|
| 9.2.1 | Server reminders (24h/2h/30m) — confirm they're scheduled by crons and deduped (not just the 15m local). | LIKELY | Verify cron-driven reminder notifications + dedupeKey per (room,offset). |
| 9.2.2 | Deep-link route validity (M-05): routes are raw strings; renamed routes silently break. | LIKELY | Centralize + validate routes. |
| 9.2.3 | Stale/inactive push tokens: `pushDevices.isActive`/`lastError` exist — confirm cleanup of `DeviceNotRegistered` Expo errors. | LIKELY | On Expo receipt error, set `isActive=false`. |
| 9.2.4 | Expo push rate limits / batching (600/req, receipts) — confirm chunked sends + receipt checks. | LIKELY | Verify `expo-server-sdk` style chunking in `pushNotificationsActions.ts`. |
| 9.2.5 | Notification spam: high-frequency lifecycle events (offers, counters) — ensure `replace_active` collapses noisy updates (it does for counter-offer results). | CONFIRMED-partial | Audit each `type` for correct policy. |
| 9.2.6 | Permission UX copy + denied state handling. | MANUAL QA | Verify graceful denied path. |
| 9.2.7 | App-launch-from-notification cold start routing. | MANUAL QA | Device-test deep link from killed state. |

### 9.3 Notification test cases — see §7-G (NT-*), 40+ cases.

---

## 10. Security / Privacy Audit

| # | Area | Status | Finding / Files | Action |
|---|---|---|---|---|
| S-01 | Object-level auth | CONFIRMED | **CR-01** zone booking mutations lack ownership check. | Enforce `requireAuthenticatedZoneOwner`. |
| S-02 | Admin auth | CONFIRMED/LIKELY | **CR-03** default super-admin email; **CR-05** role-string mismatch. | Fail-closed env; canonical role. |
| S-03 | Client-supplied identity | CONFIRMED | `adminUid`, `zoneOwnerUid`, `hostUid`, `requestOwnerUid` passed as client strings into mutations across `zoneAdminBooking.ts`/`matchrooms.ts`. Even where KYC is checked, the **acting identity** should be derived server-side from the session, not trusted from args. | Derive actor from `ctx.auth`; treat args as hints only. |
| S-04 | Cross-zone data | LIKELY | Queries `listBookingHistoryForZone` enforce ownership (good), but `listBookingQueueForZone`/`listMatchroomsForZone` take `zoneId`/`ownerUid` as args without ownership assertion — a user could read another zone's queue. | Add ownership guard to read queries too. |
| S-05 | PII masking | LIKELY | CNIC stored masked + hashed (`cnicMasked`/`cnicHash`), phone masked/hashed — good design. Verify admin payment detail (M-08) and KYC review screens don't expose raw PII. | Whitelist returned fields. |
| S-06 | Provider payload exposure | LIKELY | Admin payment detail returns selected `providerPayload` subfields (not whole blob) — good; confirm no MSISDN/card. | Audit IPN field whitelist. |
| S-07 | KYC bypass envs | CONFIRMED | `SKIP_KYC_VERIFICATION`/`SKIP_PHONE_OTP`. | Block in prod (M-12). |
| S-08 | Deep-link protection | RISK | Custom scheme `matchhai://` — ensure deep links validate auth/role before rendering protected routes. | Guard route entry on session/role. |
| S-09 | Rate limiting / abuse | RISK | No app-level rate limiting visible on mutations (registration, OTP resend has `resendCount`, payment has TTL). | Add per-user mutation throttles on sensitive actions. |
| S-10 | Account deletion | LIKELY-MISSING | Apple/Google require in-app account deletion. Not confirmed present. | Add account-deletion flow (store requirement). |
| S-11 | Block/report | CONFIRMED-present | `userBlocks` table + reports module exist — good for UGC moderation requirement. | Ensure block hides content + prevents invites (`restrictInvitesToFriends` exists). |
| S-12 | Secrets in repo | CONFIRMED | Convex URLs + super-admin email + EAS projectId are in `eas.json`/`app.json` (public-ish). No private keys seen in client. Easypaisa/Didit secrets must be server-only Convex env. | Confirm no provider secrets in client bundle. |

### 10.x Security test cases — see §7-J (SEC-*), 30+ cases.

---

## 11. Backend / Database / Convex Audit

### 11.1 Schema [CONFIRMED]
- 30+ tables, broad index coverage on hot paths (users by_email/usernameLower/authId/role/accountType/updatedAt; matchrooms by_status/game/zoneId/hostUid/matchCode; notifications rich indexes incl. by_dedupeKey; paymentTransactions by_orderRefNum/checkoutToken/bookingIntentId/status+createdAt).
- **Gaps:** `bookingRequests` lacks a `by_zoneId_and_status` index → H-02 full scan. `matchrooms` lacks `by_zoneOwnerUid` → H-03 `.take(200)` heuristic. `walletTransactions.by_reference` good for idempotency.
- **`v.any()` overuse** (H-08) on money/lifecycle fields.
- **Naming/typing debt:** `teamMembers.odxerId` (M-01), string `senderUid` (M-02).

### 11.2 Queries / mutations / actions
- Good separation of `query`/`mutation`/`internalMutation`/`action`. Idempotency via dedupe/active-pointers. 
- **Risk:** global `.collect()` in zone queue (H-02), `.take(200)` (H-03), unverified pagination on admin lists (H-05).
- **Race:** broadcast confirm (H-07), hold capture (8.2.4).

### 11.3 Crons
- `LIFECYCLE_CRON_INTERVAL_MS = 2 min`. Verify each cron uses indexed status+time queries and bounded batches (M-10). `crons.ts` + `matchroomBroadcast.expire*` schedulers.

### 11.4 Auth helpers
- `requireKycVerified` (kycGate), `requireAuthenticatedZoneOwner` (zoneAdminBooking), `authComponent.getAuthUser`, chat auth strict resolver. **Inconsistently applied** (S-01/S-04).

### 11.5 Backend test cases — see §7-K (BE-*), 30+ cases.

---

## 12. Performance / Scalability Audit

| # | Area | Status | Finding | Action |
|---|---|---|---|---|
| P-01 | Zone queue scan | CONFIRMED | Global `bookingRequests` scan every 5s/zone (H-02). | Index + per-zone query. |
| P-02 | Matchroom list cap | CONFIRMED | `.take(200)` global (H-03). | Indexed per-zone. |
| P-03 | Polling vs reactive | CONFIRMED | 5s `setInterval` polling in services (H-04) despite code comments recommending `useQuery`. | Migrate to subscriptions; background backoff. |
| P-04 | Admin lists | LIKELY | Pagination unverified (H-05). | Cursor paginate. |
| P-05 | Fonts/bundle | RISK | 4 Google font families + `firebase` + dual auth libs (L-03/L-04). | Trim unused deps/fonts. |
| P-06 | Lists rendering | MANUAL QA | Verify FlatList (not ScrollView.map) on long lists (discover, inbox, admin tables), `keyExtractor`, memoized rows. | Audit list components. |
| P-07 | Timers/intervals | LIKELY | Polling registry has release; verify all `setInterval`/reminder timers cleaned on unmount/logout. | Confirm cleanup. |
| P-08 | Startup | MANUAL QA | Session refresh on mount + token fetch; ensure no blocking waterfall. | Measure cold start. |
| P-09 | Image optimization | MANUAL QA | `expo-image` used (good); verify caching + sized remote images. | Confirm. |
| P-10 | Console/log spam | LIKELY | Many `console.log("[settlement]...")`/Logger.info in hot paths. | Gate verbose logs behind `__DEV__`. |

### 12.x Perf test cases — see §7-K (BE-*/PERF block).

---

## 13. API / Rate Limit / Reliability Audit

| External | Used in | Status | Risk / Action |
|---|---|---|---|
| **Easypaisa** | `easypaisa.ts`, `easypaisaNode.ts`, `easypaisaRest.ts`, `http.ts` (callback/IPN) | CONFIRMED present | Strong idempotency/TTL. Verify: callback signature validation, retry/backoff on initiate timeout (`markCheckoutPendingAfterInitiateTimeout` exists — good), duplicate-IPN handling via `callbackCount`. Sandbox vs prod env (CR-04). |
| **Didit KYC** | `kyc.ts`, `useDiditKyc.ts`, `identityVerifications` | CONFIRMED present | Verify webhook auth, `startTokenHash`/expiry, status reconciliation, expired sessions. |
| **Expo Push** | `pushNotificationsActions.ts`, `pushRegistration.ts`, `pushDevices` | CONFIRMED present | Chunk to ≤100/req, check receipts, deactivate `DeviceNotRegistered` (9.2.3/9.2.4). |
| **Steam / FACEIT / PSN** | `externalApis.ts`, `psn-api`, `psnTokenCache.ts`, `externalApiService.ts` | CONFIRMED present | Rate limits + caching (`*LastSyncedAt`, `psnTokenCache`). Verify graceful fallback + no blocking onboarding if provider down. |
| **Support AI / Knowledge** | `support.ts`, `supportKnowledge.ts`, `supportAssistant.ts`, `ai-support.tsx` | CONFIRMED present | Verify timeout/fallback to human; PII not sent to model. |
| **Phone OTP (Veevotech)** | `phoneOtp.ts`, `phoneVerifications` | CONFIRMED present | `attempts`/`resendCount`/expiry exist — good throttling. |

### 13.x Reliability test cases — see §7-I/§7-K.

---

## 14. App Store / Play Store Readiness

### 14.1 Apple checklist
| Item | Status | Action |
|---|---|---|
| iOS permission strings (photo/camera) | **FAIL (CR-02)** | Add usage strings + picker plugins. |
| Mic usage string | PASS | Present. |
| `ITSAppUsesNonExemptEncryption:false` | PASS | Present. |
| Account deletion in-app | LIKELY MISSING (S-10) | Add — hard requirement. |
| UGC moderation (block/report) | PARTIAL PASS | `userBlocks`+reports present; ensure block enforcement. |
| Sign in with Apple (if 3rd-party social login used) | VERIFY | Better Auth email/phone; if Google/social added, Apple SIWA required. |
| iPad UI (supportsTablet) | RISK | Optimize or disable tablet. |
| Real-money/gambling wording | RISK (L-08) | Frame as venue booking, not wagering; disclaimers. |
| ATT (tracking) | LIKELY N/A | No tracking SDK seen; confirm. |
| Privacy "nutrition label" | TODO | Map collected data (email/phone/CNIC/location-areas/photos). |
| Push permission pre-prompt copy | VERIFY | Provide rationale before OS prompt. |

### 14.2 Google Play checklist
| Item | Status | Action |
|---|---|---|
| Data safety form | TODO | Declare PII (CNIC/phone/email/photos/financial). |
| Account deletion (in-app + web URL) | LIKELY MISSING | Add + public deletion URL. |
| Edge-to-edge (Android 15 / SDK 35) | RISK (L-05) | `edgeToEdgeEnabled:false` likely ignored; adopt. |
| RECORD_AUDIO justification | VERIFY | Voice messages — declare. |
| Financial/real-money policy | RISK | Booking-payment framing; PK market compliance. |
| Target API level | VERIFY | Expo 54 → SDK 35; OK. |
| FCM credentials | VERIFY | No `googleServicesFile` in config — confirm EAS-managed push creds. |

### 14.3 ASO / metadata (recommendations)
- Name: "MatchHai" (short, brandable). Subtitle idea: "Book courts. Match players. Compete." Keywords: futsal, padel, cricket, CS2, Valorant, FC, Tekken, esports, booking, matchmaking, Pakistan.
- Need: 6.7"/6.5"/5.5" iOS + Android phone screenshots, optional preview video, privacy policy + terms + support URLs (not in repo).

---

## 15. Xcode / Build / Deployment Audit

| Item | Status | Finding / Action |
|---|---|---|
| EAS profiles | CONFIRMED | `development`/`preview`/`production` exist. **`production` has no `env`** (CR-04). |
| Env separation | FAIL | One Convex deployment (`quick-panda-920`) for preview; prod unset. Create distinct staging/prod Convex + env. |
| Bundle id / package | PASS | `com.ovaisto.matchhai` (iOS & Android). Note: `owner:"matchhai"` vs bundle `ovaisto` — confirm Apple team/Play account alignment. |
| App version source | PASS | `appVersionSource:"remote"` + prod `autoIncrement`. |
| Push entitlement | PARTIAL | `expo-notifications` plugin present; iOS APNs + Android FCM creds via EAS — verify configured. |
| Associated domains / universal links | MISSING | Only custom scheme `matchhai://`. Add Associated Domains + Android App Links if web links needed. |
| URL scheme | PASS | `scheme:"matchhai"`, `EXPO_PUBLIC_APP_SCHEME` matches. |
| OTA updates | MISSING | No `expo-updates`/`runtimeVersion`. OK if not desired; note for hotfix strategy. |
| New Architecture | PASS | `newArchEnabled:true` (RN 0.81). |
| Splash/icon | PASS | Configured (icon.png, logo.png). Verify adaptive icon padding. |
| Secrets | RISK | Move Easypaisa/Didit/super-admin secrets to Convex env (server) + EAS secrets; remove public super-admin email default (CR-03). |

---

## 16. Recommended Implementation Roadmap

### Phase 1 — Release blockers (must fix)
- **Tasks:** CR-01 zone-admin ownership guard; CR-02 iOS picker plugins + permission strings; CR-03 remove default super-admin email (fail-closed env); CR-04 prod EAS env + staging/prod split; CR-05 canonical role string; CR-06 payment-status honesty + orderRef/support; S-04 read-query ownership guards; S-10 account deletion.
- **Files:** `convex/zoneAdminBooking.ts`, `convex/admin.ts`, `app.json`, `eas.json`, `app/matchrooms/book/status|pay/[intentId].tsx`, account-deletion screen + `convex/users.ts`.
- **Risk:** Med (auth + deploy topology). **Complexity:** M. **Validation:** authz unit tests; iOS build picker smoke test; prod build connects to prod Convex; attempt cross-zone action → denied.

### Phase 2 — Payment / time / notification QA
- **Tasks:** verify refund/hold idempotency (8.2.4/8.2.6), server-authoritative counter-offer time (H-10), server-side schedule validation on all inserts (H-09), server reminders 24h/2h/30m + dedupe (9.2.1), Expo token cleanup + chunking (9.2.3/9.2.4), route centralization/validation (M-05).
- **Files:** `convex/easypaisa.ts`, `convex/wallet.ts`, `convex/timing.ts`, `convex/notifications.ts`, `convex/pushNotificationsActions.ts`, `convex/crons.ts`, `src/navigation/routes.ts`.
- **Risk:** Med. **Complexity:** M-H. **Validation:** payment matrix (success/fail/pending/retry), reminder timing tests, push receipt handling.

### Phase 3 — UI / responsiveness polish
- **Tasks:** modal-consumer audit (ensure `AppModalBody scroll` on long content) (RD), device matrix QA, edge-to-edge (L-05), Dynamic Type (L-01), iPad decision.
- **Files:** modal-using screens, `app.json`, surfaces. **Risk:** Low. **Complexity:** M. **Validation:** device matrix §6.1.

### Phase 4 — Security / privacy hardening
- **Tasks:** derive actor server-side everywhere (S-03), rate limits (S-09), PII whitelist in admin/KYC (M-08/S-05), block enforcement (S-11), prod-bypass guards (M-12), provider secrets audit (S-12).
- **Risk:** Med. **Complexity:** M. **Validation:** authz/abuse test suite.

### Phase 5 — Performance / scalability
- **Tasks:** indexes for zone queue/matchrooms (H-02/H-03), paginate admin lists (H-05), polling→reactive (H-04), cron batch bounds (M-10), bundle/dep trim (L-03/L-04, fonts).
- **Risk:** Med (index/migration). **Complexity:** M. **Validation:** load test with seeded volume; Convex read metrics.

### Phase 6 — Store readiness
- **Tasks:** privacy/data-safety forms, screenshots, account deletion URL, policy wording (L-08), Apple/Google checklists §14, FCM/APNs creds.
- **Risk:** Low-Med. **Complexity:** M. **Validation:** TestFlight + Play internal testing builds.

### Phase 7 — Post-launch monitoring
- **Tasks:** payment reconciliation dashboard usage, Convex error/rate metrics (`perfInstrumentation` exists), push delivery receipts, crash reporting (add Sentry/Crashlytics — none seen), audit-log review cadence.
- **Risk:** Low. **Complexity:** M. **Validation:** dashboards live before public scale.

---

## 17. Final Launch Readiness Checklist

### Must-fix (P0)
- [ ] CR-01 zone-admin ownership guard on accept/reject/counter/walk-in/respond.
- [ ] CR-02 iOS photo/camera permission strings + picker plugins.
- [ ] CR-03 remove default super-admin email; server-only env.
- [ ] CR-04 production EAS env + staging/prod Convex separation.
- [ ] CR-05 canonical super-admin role string.
- [ ] CR-06 payment-status honesty (pending/unknown + orderRef + support).
- [ ] S-04 ownership guard on zone read queries.
- [ ] S-10 in-app account deletion.

### Should-fix (P1)
- [ ] H-01 active Convex client set before any direct mutation.
- [ ] H-02/H-03/H-05 indexes + pagination.
- [ ] H-10/H-09 server-authoritative time validation.
- [ ] 9.2.1/9.2.3 server reminders + push token cleanup.
- [ ] M-04 resource-count message/logic mismatch.
- [ ] L-05 Android edge-to-edge.

### Can-wait (P2/P3)
- [ ] v.any() typing (H-08), naming debt (M-01/M-02), bundle trim (L-03/L-04), Dynamic Type (L-01), debug screen gating (L-06), crash reporting.

### Manual QA gates
- [ ] Device matrix §6.1 (modals scroll, keyboard, safe-area, payment modal, push from cold start).
- [ ] Payment matrix (success/fail/pending/retry/refund) on Easypaisa sandbox.
- [ ] KYC happy + reject + expired.

### Backend deploy QA
- [ ] Convex prod deploy + env (Easypaisa/Didit/super-admin/skip-flags OFF).
- [ ] `npx convex deploy` typecheck of `convex/` (not covered by app `tsc`).
- [ ] Cron schedules verified on prod.

### Monitoring
- [ ] Crash reporting, payment reconciliation, push receipts, Convex rate metrics.

---
---

# TEST CASE LIBRARY (Section 7 detail)

> Priority: **P0** release-critical · **P1** important · **P2** standard · **P3** edge/polish.
> Automation: **Y** = good unit/integration/e2e candidate · **N** = manual/device.

## §7-A Auth / Onboarding (AUTH-) — 32 cases

| ID | Module | Role | Preconditions | Steps | Expected | Pri | Auto |
|---|---|---|---|---|---|---|---|
| AUTH-01 | Register | Player | App fresh install | Complete register step1 (email/pwd/username) | Account created; usernameLower unique enforced | P0 | Y |
| AUTH-02 | Register | Player | Email already used | Register with existing email | Friendly "email in use" error; no dup | P0 | Y |
| AUTH-03 | Register | Player | Username taken (diff case) | Register "Player1" when "player1" exists | Rejected on `usernameLower` | P1 | Y |
| AUTH-04 | Register | Player | Step2 | Select games/areas/age range | Persisted to onboardingStore + user doc | P1 | Y |
| AUTH-05 | Register | Player | Step3 platforms | Add Steam/FACEIT/PSN URL | Linked + external sync queued | P2 | N |
| AUTH-06 | Register | Player | Step4 | Finish onboarding | `onboardingCompleted=true`; routed to home | P0 | Y |
| AUTH-07 | Login | Player | Valid creds | Login | Session created; routed by role | P0 | Y |
| AUTH-08 | Login | Player | Wrong pwd | Login | Error; no session | P0 | Y |
| AUTH-09 | Login | Player | Offline | Login with no network | Graceful error, retry | P1 | N |
| AUTH-10 | Session | Player | Logged in, kill app | Reopen | Session restored from cache (`authSessionCache`) | P0 | N |
| AUTH-11 | Session | Player | Token expired | Trigger mutation after expiry | `SESSION_EXPIRED_MESSAGE`, prompt re-login | P0 | N |
| AUTH-12 | Session | Player | App backgrounded 1h | Resume | `refreshSessionSnapshot("resume")` refreshes token | P1 | N |
| AUTH-13 | Routing | Player | accountType=player | Login | Lands on `(player)` tabs | P0 | Y |
| AUTH-14 | Routing | Zone | accountType=zone, approved | Login | Lands on `zone` tabs | P0 | Y |
| AUTH-15 | Routing | Zone | Zone pending-review | Login | Sees pending/verification state, not full dashboard | P0 | N |
| AUTH-16 | Routing | Super | Allowlisted email | Login | Lands on `super-admin` | P0 | Y |
| AUTH-17 | Routing | Player | Non-admin tries `/super-admin` deep link | Open deep link | Blocked/redirected (verify) | P0 | N |
| AUTH-18 | Forgot pwd | Player | Has account | Request reset | Reset email/flow triggered | P1 | N |
| AUTH-19 | Reset pwd | Player | Valid reset token | Set new pwd | Pwd changed; old invalid | P1 | N |
| AUTH-20 | Reset pwd | Player | Expired token | Use stale token | Rejected | P2 | N |
| AUTH-21 | Phone OTP | Player | Onboarding | Request OTP | OTP sent; `resendCount` tracked | P1 | N |
| AUTH-22 | Phone OTP | Player | Wrong OTP x N | Enter wrong codes | Attempts limited; lockout/expiry | P1 | Y |
| AUTH-23 | Phone OTP | Player | Resend spam | Tap resend rapidly | Throttled by `resendCount` | P1 | Y |
| AUTH-24 | Email verify | Player | Unverified email | Access gated feature | `emailVerificationGate` blocks; clear CTA | P1 | N |
| AUTH-25 | KYC gate | Player | KYC not_started | Open KYC-gated action | Routed to verification-required | P0 | N |
| AUTH-26 | KYC gate | Player | KYC pending | Try transact | Allowed (per `isKycAccessAllowed`) — confirm intended | P1 | Y |
| AUTH-27 | KYC gate | Player | KYC rejected | Try transact | Blocked with message | P0 | Y |
| AUTH-28 | Suspension | Player | accountStatus=suspended | Any action | "account suspended" error; no bypass | P0 | Y |
| AUTH-29 | Suspension | Player | suspendedUntil in past | Action | Allowed again | P2 | Y |
| AUTH-30 | Logout | Player | Logged in | Logout | Session cleared; client recreated; no stale data | P0 | N |
| AUTH-31 | Multi-login | Player | Login A then login B | Switch accounts | New per-session client; no "Base version" crash | P0 | N |
| AUTH-32 | Bypass env | All | SKIP_KYC=1 in non-prod | Action | Bypass works in dev only; assert OFF in prod | P0 | Y |

## §7-B Player Matchroom Flows (MR-) — 52 cases

| ID | Module | Role | Preconditions | Steps | Expected | Pri | Auto |
|---|---|---|---|---|---|---|---|
| MR-01 | Create | Player | KYC ok | Open create, pick game | Game-specific fields render | P1 | N |
| MR-02 | Create | Player | Solo | Set start <3 days | Blocked: "at least 3 days" (server+client) | P0 | Y |
| MR-03 | Create | Player | Solo | Set start >2 months | Blocked: "up to 2 months" | P1 | Y |
| MR-04 | Create | Player | Solo valid | Set start in 4 days | Created; `lockAt = start-24h` | P0 | Y |
| MR-05 | Create | Player | Bypass client | Call mutation directly with <3d | Server rejects (H-09 check) | P0 | Y |
| MR-06 | Create | Captain | Team mode | Create team matchroom | slotsA/B + captain set | P1 | N |
| MR-07 | Create | Player | Zone mode | Pick zone+resource | Zone-specific booking request created | P0 | N |
| MR-08 | Create | Player | Broadcast mode | Pick areas | Broadcast fanout request; `waiting_for_zones` | P0 | N |
| MR-09 | Create | Player | Missing required field | Submit | Inline validation blocks | P1 | Y |
| MR-10 | Create | Player | Double-tap submit | Tap create twice | Single room (dedupe/disabled CTA) | P0 | N |
| MR-11 | Join | Player | Open room w/ slot | Request join | Booking intent `pending_approvals` | P0 | N |
| MR-12 | Join | Player | Captain approves | Captain accepts | Intent `approved_pending_payment` | P0 | N |
| MR-13 | Join | Player | Private room | Try join | Blocked unless invited | P1 | N |
| MR-14 | Join | Player | Room full | Try join | Blocked (`currentPlayers>=maxPlayers`) | P0 | Y |
| MR-15 | Join | Player | Locked room | Try join | Blocked (`isJoinLocked`) | P0 | Y |
| MR-16 | Invite | Captain | Has slot | Invite player | Invite notification; `INVITE_TTL=24h` | P1 | N |
| MR-17 | Invite | Player | Invite expired | Open stale invite | Expired state, not actionable | P2 | Y |
| MR-18 | Pay | Player | Approved intent | Pay & Review | Easypaisa/wallet hold initiated | P0 | N |
| MR-19 | Pay | Player | Wallet sufficient | Use wallet | Hold placed (`heldStatus=held`) | P0 | Y |
| MR-20 | Pay | Player | Wallet insufficient | Use wallet | Blocked; offered top-up | P0 | Y |
| MR-21 | Status | Player | Payment pending | Open status | Clear pending + orderRef + support (CR-06) | P0 | N |
| MR-22 | Status | Player | Payment success | Return from EP | Confirmed; slot `confirmed` | P0 | N |
| MR-23 | Status | Player | Payment fail | EP declines | Failure copy; retry; no false success | P0 | N |
| MR-24 | Status | Player | App killed mid-pay | Reopen status | State reconciles via `syncTransactionStatus` | P0 | N |
| MR-25 | Lifecycle | System | Room not full at lock | Cron at lockAt | Behavior per policy (lock or hold) | P0 | Y |
| MR-26 | Lifecycle | System | Not full at start | `startMatch` | `canStartMatchroom` fails → expire `roster_incomplete` (CONFIRMED) | P0 | Y |
| MR-27 | Lifecycle | Host | Full roster | Start | `in-progress`; held intents captured | P0 | Y |
| MR-28 | Lifecycle | Host | Start w/ only host | Force start | Rejected (roster guard) | P0 | Y |
| MR-29 | Lifecycle | System | Past expiry, unpaid | Cron | Room expired; holds released | P0 | Y |
| MR-30 | Complete | Host | In-progress | Complete | `completed`; result verification opens | P0 | N |
| MR-31 | Result | Captain | Completed | Submit captain report | Recorded; awaits 2nd captain (`RESULT_CAPTAIN_2h`) | P0 | N |
| MR-32 | Result | Captain | Reports conflict | Both report different | Goes to participant vote | P1 | Y |
| MR-33 | Result | Player | Vote window | Cast vote | Counted; `RESULT_PARTICIPANT_VOTE_12h` | P1 | N |
| MR-34 | Result | System | Vote deadline passes | Cron | Escalates to admin_review (H-06) | P0 | Y |
| MR-35 | Result | Admin | admin_review | Resolve | `resolved` + finalWinner; stats update | P1 | N |
| MR-36 | Result | Player | Invalid verification state | Submit | Routed to admin review (CONFIRMED) | P1 | Y |
| MR-37 | Broadcast | Zone | Fanout open | Zone accepts | Offer created; `waiting`→offer; 2h window | P0 | N |
| MR-38 | Broadcast | Player | Multiple zone offers | Two zones accept | Only one offer allowed per request (guard) / first-wins (H-07) | P0 | Y |
| MR-39 | Broadcast | Player | Offer expires | No selection in 2h | `expireBroadcastCounterOffer` fires | P1 | Y |
| MR-40 | Broadcast | Player | Select venue | Confirm a zone | `zone_confirmed`; others released | P0 | N |
| MR-41 | Cancel | Host | Open room | Cancel | `cancelled`; holds released; players notified | P0 | N |
| MR-42 | Cancel | Player | Paid then cancelled | Host cancels | Refund to wallet; notification | P0 | N |
| MR-43 | My rooms | Player | Has rooms | Open my.tsx | Lists by status; correct counts | P1 | N |
| MR-44 | Detail | Player | Invalid/deleted room id | Open `[id]` | Safe empty/error state, no crash | P0 | Y |
| MR-45 | Detail | Player | Stuck state | Open room mid-transition | No invalid modal/stuck UI | P1 | N |
| MR-46 | Chat | Player | In room | Send message/image | Delivered; image needs iOS perms (CR-02) | P1 | N |
| MR-47 | Vote | Player | vote.tsx | Open vote screen | Renders options; submits | P1 | N |
| MR-48 | Result screen | Player | result.tsx | Open result | Correct winner/state | P1 | N |
| MR-49 | Duplicate join | Player | Already in room | Request join again | Prevented (existing intent) | P1 | Y |
| MR-50 | Seat reservation | Captain | Team room | Reserve slots | `reservedSlots` honored; `reservedForUid` | P1 | Y |
| MR-51 | Time TZ | Player | Create at 11pm local | Set next-day time | Stored time matches local (M-07 TZ) | P0 | N |
| MR-52 | Lock exemption | System | `startedWithFullRoster=true` | Lifecycle | Exempt from not-full expiry (CONFIRMED L90/135/153) | P1 | Y |

## §7-C Team / Team Challenge (TM-) — 30 cases

| ID | Module | Role | Preconditions | Steps | Expected | Pri | Auto |
|---|---|---|---|---|---|---|---|
| TM-01 | Create team | Player | KYC ok | Create team (name/game) | Team + captain `teamMembers` row | P1 | Y |
| TM-02 | Create team | Player | Dup name (case) | Create "Alpha" vs "alpha" | Rejected on `nameLower` | P1 | Y |
| TM-03 | Invite | Captain | Team exists | Invite member | Invite notification | P1 | N |
| TM-04 | Join | Player | Invited | Accept | Added; `memberCount` inc | P1 | Y |
| TM-05 | Roster | Captain | main/sub sizes | Assign roles | `rosterRole`/`rosterOrder` honored vs `teamRosterRules` | P1 | Y |
| TM-06 | Roster | Captain | Exceed maxMembers | Add over cap | Blocked | P1 | Y |
| TM-07 | Captain transfer | Captain | 2+ members | Transfer captaincy | New captain; old becomes member | P1 | N |
| TM-08 | Remove member | Captain | Member exists | Remove | Removed; counts update | P2 | Y |
| TM-09 | Delete team | Captain | Team active | Delete | `status=deleted`, `deletedAt` | P2 | Y |
| TM-10 | Challenge create | Captain | 2 teams | Create challenge | `pending`; opponent notified | P0 | N |
| TM-11 | Challenge time | Captain | scheduledAt <2d | Set soon | Blocked: min 2 days | P0 | Y |
| TM-12 | Challenge time | Captain | scheduledAt >2mo | Set far | Blocked: max 2 months | P1 | Y |
| TM-13 | Challenge accept | Captain B | Pending | Accept | `accepted`; venue step | P0 | N |
| TM-14 | Challenge reject | Captain B | Pending | Reject | `rejected`; notify A | P1 | Y |
| TM-15 | Venue propose | Captain A | accepted | Propose venue | `venue_proposed` | P1 | N |
| TM-16 | Venue alt | Captain B | proposed | Counter venue | `alternativeVenueByCaptainB` set | P1 | N |
| TM-17 | Venue confirm | Both | venue agreed | Confirm | `venue_confirmed`; matchroom link | P0 | N |
| TM-18 | Payment | Captain | venue_confirmed | Pay team share | `teamAPaymentStatus=paid` | P0 | N |
| TM-19 | Payment | Both | Both pay | Complete payments | Both paid → ready | P0 | Y |
| TM-20 | Admin pending | System | dispute | `admin_pending` | Super admin can resolve | P1 | N |
| TM-21 | Expire | System | No response | Deadline | `expired`; notify | P1 | Y |
| TM-22 | Edge | Captain | Opponent team deleted | Open challenge | Safe handling, no crash | P0 | Y |
| TM-23 | Edge | Player | Member removed mid-challenge | Lineup recompute | Lineup valid or blocked | P1 | N |
| TM-24 | Lineup | Captain | Set lineupA | Submit | `lineupA` stored | P2 | Y |
| TM-25 | Challenge chat | Captain | challenge exists | Send msg | Delivered to participants | P2 | N |
| TM-26 | Challenge chat | Captain | Send image | Attach | Needs iOS perms (CR-02) | P2 | N |
| TM-27 | Result | Captain | completed | Set winner | `result.winnerId`; stats | P1 | N |
| TM-28 | Notifications | Captain | each transition | Observe | Correct dedupe per type | P1 | Y |
| TM-29 | Common areas | Captain | both teams | Compute `commonAreas` | Intersection correct | P2 | Y |
| TM-30 | Concurrency | Both | simultaneous venue confirm | Race | Single confirmed venue | P1 | Y |

## §7-D Zone Admin Flows (ZA-) — 42 cases

| ID | Module | Role | Preconditions | Steps | Expected | Pri | Auto |
|---|---|---|---|---|---|---|---|
| ZA-01 | Auth | Zone | Logged in, owns zone | Open bookings | Queue loads (own zone only) | P0 | N |
| ZA-02 | Auth | Zone | Cold start, tap Accept fast | Accept before client ready | Must not throw `Unauthenticated` (H-01) | P0 | N |
| ZA-03 | Auth | Attacker | KYC-verified non-owner | Call `acceptBookingRequest` other zoneId | **DENIED** (CR-01 fix) | P0 | Y |
| ZA-04 | Auth | Attacker | non-owner | Call `rejectBookingRequest` other zone | DENIED (CR-01) | P0 | Y |
| ZA-05 | Auth | Attacker | non-owner | Call `sendCounterOffer` other zone | DENIED (CR-01) | P0 | Y |
| ZA-06 | Auth | Attacker | non-owner | Call `listBookingQueueForZone` other zone | DENIED (S-04) | P0 | Y |
| ZA-07 | Accept | Zone | Open request, resources avail | Accept w/ resources | Matchroom created/locked; resources booked | P0 | N |
| ZA-08 | Accept | Zone | Resource taken meanwhile | Accept | Error "no longer available"; no partial book | P0 | Y |
| ZA-09 | Accept | Zone | Wrong resource type | Accept PC req w/ console | Rejected (resource-fit) | P1 | Y |
| ZA-10 | Accept | Zone | PC game | Accept | Resource count matches policy (M-04: msg says 2, code 10) | P1 | Y |
| ZA-11 | Accept | Zone | Resource other branch | Accept | Rejected (branch mismatch) | P1 | Y |
| ZA-12 | Reject | Zone | Open request | Reject w/ reason | `cancelled`; player notified; holds released | P0 | N |
| ZA-13 | Reject | Zone | Broadcast request | Reject | `broadcast_rejected`; offers rejected | P1 | Y |
| ZA-14 | Counter | Zone | Open request | Send ±2h alt time | Offer created; within window | P0 | N |
| ZA-15 | Counter | Zone | Alt time >2h | Send | Rejected (window) | P0 | Y |
| ZA-16 | Counter | Zone | Alt time in past | Send | Rejected (past) | P0 | Y |
| ZA-17 | Counter | Zone | Omit `proposedStartAts` | Send via API | Server should still validate (H-10) | P0 | Y |
| ZA-18 | Counter | Player | Receives offer | Accept option | Matchroom locked; resources | P0 | N |
| ZA-19 | Counter | Player | Rejects all | Reject | Offer rejected; zone notified | P1 | Y |
| ZA-20 | Counter | System | Offer not answered | 2h passes | Expired; resources released | P1 | Y |
| ZA-21 | Walk-in | Zone | Create walk-in <1d | Set today | Blocked: min 1 day | P0 | Y |
| ZA-22 | Walk-in | Zone | Valid next-day | Create | Room created; seats hydrated | P0 | N |
| ZA-23 | Walk-in | Zone | venue_pay | Create | `paymentStatus=paid`; slots confirmed | P1 | Y |
| ZA-24 | Walk-in | Zone | guest_pay | Create | `unpaid`; slots reserved | P1 | Y |
| ZA-25 | Walk-in | Zone | Known players + captain | Create | Captain assigned to correct team | P1 | Y |
| ZA-26 | Walk-in | Zone | Odd seat count | Create | Single-team slots built correctly | P2 | Y |
| ZA-27 | Queue | Zone | Many requests | Open queue | Deduped, sorted desc, active only | P1 | Y |
| ZA-28 | Queue | Zone | Large dataset | Load | No timeout (H-02 perf) | P1 | N |
| ZA-29 | Matchrooms | Zone | >200 rooms | Open list | All own rooms shown (H-03 cap risk) | P1 | N |
| ZA-30 | History | Zone | Past requests | Open history | Ownership-checked; correct rows | P1 | Y |
| ZA-31 | Resources | Zone | Manage | Add/edit resource | Persisted; lifecycle correct | P1 | N |
| ZA-32 | Resources | Zone | Maintenance toggle | Set maintenance | Not bookable | P2 | Y |
| ZA-33 | Pricing | Zone | Add rule | Time/day rule | Applied to quotes | P1 | N |
| ZA-34 | Pricing | Zone | Overlapping rules | Priority | Highest priority wins | P2 | Y |
| ZA-35 | Withdrawal | Zone | Has balance, KYC | Request withdrawal | Created; super-admin queue | P0 | N |
| ZA-36 | Withdrawal | Zone | KYC not verified | Request | Blocked (withdrawal KYC msg) | P0 | Y |
| ZA-37 | Notifications | Zone | New request | Observe | Notification + push | P1 | N |
| ZA-38 | Profile | Zone | Edit branch | Update | Saved; reflected | P2 | N |
| ZA-39 | Support | Zone | Open ticket | Create | Ticket created | P2 | N |
| ZA-40 | AI support | Zone | Ask question | Query | Answer or fallback; no PII leak | P2 | N |
| ZA-41 | Audit | Zone | Actions taken | Open audit | `zoneAuditEvents` listed | P2 | Y |
| ZA-42 | Error UI | Zone | Backend error | Trigger | Friendly message, no raw Convex error | P0 | N |

## §7-E Super Admin Flows (SA-) — 50 cases

| ID | Module | Role | Preconditions | Steps | Expected | Pri | Auto |
|---|---|---|---|---|---|---|---|
| SA-01 | Auth | Super | Allowlisted email | Open super-admin | Access granted | P0 | Y |
| SA-02 | Auth | Player | Non-allowlisted | Open super-admin route | DENIED | P0 | Y |
| SA-03 | Auth | Attacker | Register default email (env unset) | Login | Must NOT get admin (CR-03 fix) | P0 | Y |
| SA-04 | Auth | Super | role="super_admin" set | Check gate | Recognized (CR-05 canonical) | P0 | Y |
| SA-05 | Dashboard | Super | Data exists | Open | Summary stats render; no scan timeout | P1 | N |
| SA-06 | Users | Super | Users exist | List users | Paginated (H-05); search works | P1 | N |
| SA-07 | Users | Super | Pick user | Set role | Role updated; audited | P0 | Y |
| SA-08 | Users | Super | Suspend user | Suspend | `accountStatus=suspended`; user blocked | P0 | Y |
| SA-09 | Users | Super | Unsuspend | Lift | Access restored | P1 | Y |
| SA-10 | Zones | Super | Pending zone | Approve | `active`/migration; owner notified | P0 | N |
| SA-11 | Zones | Super | Reject zone | Reject w/ reason | `rejected`; reason stored | P0 | Y |
| SA-12 | Zones | Super | Suspend zone | Suspend | Zone offline | P1 | Y |
| SA-13 | Zones | Super | Migration failed | Retry migration | Re-runs; status updates | P1 | N |
| SA-14 | Payments | Super | Transactions exist | List Easypaisa | Paginated; correct statuses | P0 | N |
| SA-15 | Payments | Super | Payment by orderRef | Open detail | Shows status, flags, whitelisted payload (M-08) | P0 | N |
| SA-16 | Payments | Super | Anomaly flagged | Open attention item | Flag visible; deep-link works | P0 | Y |
| SA-17 | Payments | Super | List V2 | Filter/search | Correct results | P1 | N |
| SA-18 | Payments | Super | Sensitive data | View detail | No raw MSISDN/card (S-06) | P0 | N |
| SA-19 | Withdrawals | Super | Pending request | Approve | Approved; zone notified; ledger | P0 | N |
| SA-20 | Withdrawals | Super | Reject | Reject w/ reason | Rejected; notified | P0 | Y |
| SA-21 | Withdrawals | Super | Double approve | Approve twice | Idempotent; no double payout | P0 | Y |
| SA-22 | Identity | Super | Pending KYC | List verifications | Filtered by status | P1 | N |
| SA-23 | Identity | Super | Manual verify | Approve identity | `verified`; user `kycVerificationStatus` synced | P0 | N |
| SA-24 | Identity | Super | View CNIC | Open record | Only masked CNIC shown (S-05) | P0 | N |
| SA-25 | Reports | Super | Open reports | List | Paginated; status filter | P1 | N |
| SA-26 | Reports | Super | Resolve report | Set status | Updated; reporter/target handled | P1 | Y |
| SA-27 | Support | Super | Tickets exist | List | Open/assigned/resolved filters | P1 | N |
| SA-28 | Support | Super | Assign ticket | Assign | `assignSupportTicket` records | P2 | Y |
| SA-29 | Support | Super | Internal note | Add note | Visible to admins only | P2 | Y |
| SA-30 | Support | Super | Reply to user | Send reply | User receives (email/notification) | P1 | N |
| SA-31 | Support | Super | Resolve | Resolve | `resolved` state | P2 | Y |
| SA-32 | Support | Super | Link entities | Link ticket→user/zone | Linked references | P2 | Y |
| SA-33 | Matchrooms | Super | Rooms exist | List/monitor | Status visible | P1 | N |
| SA-34 | Matchrooms | Super | Open room detail | View | Players/result/state | P1 | N |
| SA-35 | Result dispute | Super | admin_review room | Resolve | finalWinner set; stats | P1 | N |
| SA-36 | Audit logs | Super | Admin actions | List | `superAdminAuditLogs` with actor identity | P1 | Y |
| SA-37 | Audit logs | Super | Denied action | Attempt | Logged as `denied` | P1 | Y |
| SA-38 | Notifications | Super | Admin notifications | List/mark read | Read/unread + archive work | P2 | Y |
| SA-39 | UI | Super | Inner page | Open `payment/[orderRefNum]` | Back arrow + consistent header | P1 | N |
| SA-40 | UI | Super | Inner page | Open `request/[id]` | Back arrow present | P1 | N |
| SA-41 | UI | Super | Inner page | Open `report/[id]` | Back arrow present | P1 | N |
| SA-42 | UI | Super | Inner page | Open `support-ticket/[id]` | Back arrow present | P1 | N |
| SA-43 | UI | Super | Drawer | Open/close nav drawer | Consistent across pages | P2 | N |
| SA-44 | UI | Super | Large table | Scroll | Smooth; spacing consistent | P2 | N |
| SA-45 | Bootstrap | Super | First-run | `bootstrapInitialSuperAdmin` | Creates initial admin once | P1 | Y |
| SA-46 | Allowlist | Super | Env-configured admins | Login each | Each allowlisted admin works | P1 | N |
| SA-47 | Filters | Super | Apply filters | Filter lists | Active count + reset correct | P2 | N |
| SA-48 | Easypaisa screen | Super | Open `easypaisa.tsx` | Reconcile view | Lists txns; sync action | P1 | N |
| SA-49 | Masking | Super | Bank/withdrawal detail | View | Bank details masked appropriately | P0 | N |
| SA-50 | Perf | Super | 10k users/txns | Load lists | No timeout; paginated | P1 | N |

## §7-F Payment / Wallet / Easypaisa (PW-) — 52 cases

| ID | Module | Role | Preconditions | Steps | Expected | Pri | Auto |
|---|---|---|---|---|---|---|---|
| PW-01 | Top-up | Player | Wallet screen | Initiate top-up | `paymentTransaction` created (`wallet_topup`) | P0 | N |
| PW-02 | Top-up | Player | Active top-up exists same amt | Initiate again | Reuses active txn (idempotent) | P0 | Y |
| PW-03 | Top-up | Player | Active top-up diff amt | Initiate | `ACTIVE_TOPUP_IN_PROGRESS` error | P0 | Y |
| PW-04 | Top-up | Player | Stuck top-up | Cancel pending | Cancel path exists (M-06) | P1 | N |
| PW-05 | Top-up | Player | EP success | Return | Wallet credited once; ledger `deposit` | P0 | N |
| PW-06 | Top-up | Player | EP duplicate IPN | Provider resends | Single credit (callbackCount dedupe) | P0 | Y |
| PW-07 | Top-up | Player | EP fail | Decline | No credit; failure copy | P0 | N |
| PW-08 | Top-up | Player | TTL expiry | Wait 15m | Txn `expired`; can retry | P1 | Y |
| PW-09 | Booking pay | Player | Approved intent | Pay | Reuses active intent txn | P0 | Y |
| PW-10 | Booking pay | Player | Pay other's intent | Call API w/ other intentId | DENIED (`createdByUid` check) | P0 | Y |
| PW-11 | Booking pay | Player | EP success | Return | Intent `confirmed`; slot confirmed | P0 | N |
| PW-12 | Booking pay | Player | EP pending | Return | Pending state + orderRef (CR-06) | P0 | N |
| PW-13 | Booking pay | Player | EP fail | Return | Failure; retry; no slot confirm | P0 | N |
| PW-14 | Wallet hold | Player | Wallet funds | Pay via wallet | `hold` placed; balance reserved | P0 | Y |
| PW-15 | Wallet hold | Player | Insufficient | Pay via wallet | Blocked; top-up CTA | P0 | Y |
| PW-16 | Hold capture | System | Match starts | Capture | `hold_capture`; held→captured once | P0 | Y |
| PW-17 | Hold capture | System | Double capture attempt | Re-run | Idempotent (8.2.4) | P0 | Y |
| PW-18 | Hold release | System | Room cancelled | Release | `hold_release`; balance restored | P0 | Y |
| PW-19 | Hold release | System | Release captured hold | Reject after capture | `refundCapturedHolds` refunds (8.2.6) | P0 | Y |
| PW-20 | Refund | Player | Booking rejected | Zone rejects | Refund→wallet; notification | P0 | N |
| PW-21 | Refund | Player | Idempotent refund | Re-trigger | Single refund | P0 | Y |
| PW-22 | Settlement | System | Full approved zone room | Accept | `merchant_capture` marked once | P1 | Y |
| PW-23 | Settlement | System | Re-accept | Repeat | No double settlement | P1 | Y |
| PW-24 | Status screen | Player | Mid-pay app kill | Reopen | Reconciles via sync; honest state | P0 | N |
| PW-25 | Status screen | Player | "I've paid/Continue" | Tap | Triggers `syncTransactionStatus` | P0 | N |
| PW-26 | Status screen | Player | "Do this later" | Tap | Returns; intent stays payable | P1 | N |
| PW-27 | iOS modal | Player | EP browser | Return to app | Buttons tappable (MANUAL — CR-06/8.2.5) | P0 | N |
| PW-28 | Pay&Review | Player | Open | View | Amount/slots/currency correct | P0 | N |
| PW-29 | Pay&Review | Player | Stale price | Open after price change | Recomputed or blocked | P1 | N |
| PW-30 | Payer mismatch | Player | Pay from other's EP acct | Different MSISDN | Allowed but settles to platform; refund→wallet (8.2.3) | P1 | N |
| PW-31 | Concurrency | Player | Two devices pay same intent | Parallel | Single confirm (active pointer) | P0 | Y |
| PW-32 | Currency | Player | All flows | Inspect | All "PKR"; no mixed math | P1 | Y |
| PW-33 | Transactions | Player | History | Open wallet | `walletTransactions` listed, correct signs | P1 | N |
| PW-34 | Held balance | Player | Active hold | View wallet | `walletHeldBalance` shown separately | P1 | Y |
| PW-35 | Unpaid bookings | Player | Pending intents | View | Listed with pay CTA | P1 | N |
| PW-36 | Provider down | Player | EP unreachable | Initiate | `markCheckoutPendingAfterInitiateTimeout` (graceful) | P0 | Y |
| PW-37 | Callback signature | System | Forged IPN | Send fake callback | Rejected (verify signature) | P0 | Y |
| PW-38 | Reconciliation | Super | Mismatch txn | Open detail | Attention flag + manual sync | P0 | N |
| PW-39 | OrderRef gen | System | Many txns | Generate | Unique `orderRefNum` (`by_orderRefNum`) | P1 | Y |
| PW-40 | Expiry sweep | System | Old `created` txns | Cron/TTL | Expired; pointers cleared | P1 | Y |
| PW-41 | Pointer clear | System | Txn finalizes | Complete | `clearActivePaymentPointerIfMatching` runs | P1 | Y |
| PW-42 | Wallet→withdrawal | Player | Player withdrawal? | Check | Confirm if players can withdraw (vs zones only) | P1 | N |
| PW-43 | Min/max amount | Player | Top-up bounds | Enter 0/huge | Validated | P1 | Y |
| PW-44 | Negative balance | Player | Edge | Force | Never negative | P0 | Y |
| PW-45 | Notification | Player | Payment events | Each | Notification fired w/ dedupe | P1 | Y |
| PW-46 | Audit | Super | Payment ops | Review | Traceable in logs/payload | P1 | N |
| PW-47 | Prod env | All | Prod build | Pay | Connects to prod Convex (CR-04) | P0 | N |
| PW-48 | Multi-attempt | Player | Retry after fail | Re-pay | New attempt or reuse correctly | P0 | Y |
| PW-49 | Phone source | Player | Profile phone | Checkout | `checkoutPhoneMasked` recorded | P2 | Y |
| PW-50 | Team challenge pay | Captain | Both pay | Pay | Both `paid` → ready | P0 | N |
| PW-51 | Refund target | Player | Refund | Inspect | Goes to wallet, not payer phone | P0 | N |
| PW-52 | Ledger integrity | System | Sum check | Reconcile | Σ ledger == balance+held | P0 | Y |

## §7-G Notifications / Push / Reminders (NT-) — 40 cases

| ID | Module | Role | Preconditions | Steps | Expected | Pri | Auto |
|---|---|---|---|---|---|---|---|
| NT-01 | Push reg | Player | First login | Grant permission | `pushDevices` row; expo token saved | P0 | N |
| NT-02 | Push reg | Player | Deny permission | Decline | Graceful; `permissionStatus=denied` | P1 | N |
| NT-03 | Push reg | Player | Token refresh | Reinstall | Old token deactivated; new active | P1 | N |
| NT-04 | Push send | System | Event fires | Trigger | Push delivered; `pushState=sent` | P0 | N |
| NT-05 | Push send | System | DeviceNotRegistered | Stale token | `isActive=false` set (9.2.3) | P0 | Y |
| NT-06 | Push batch | System | >100 recipients | Broadcast | Chunked ≤100 (9.2.4) | P1 | Y |
| NT-07 | Dedupe | System | Same event twice | Fire | `upsert_active` collapses | P0 | Y |
| NT-08 | Dedupe | System | Counter-offer result | Re-fire | `replace_active` single active | P0 | Y |
| NT-09 | Dedupe | System | Versioned | New version | `versioned_new` creates fresh | P1 | Y |
| NT-10 | Dedupe | System | Friend req reverse | A→B then B→A | Both dedupe (M-09 gap) | P2 | Y |
| NT-11 | Reminder | Player | Upcoming room | 15m before | Local reminder fires once | P1 | N |
| NT-12 | Reminder | Player | Past start room | Reconcile | No "starts soon" reminder (CONFIRMED) | P0 | Y |
| NT-13 | Reminder | Player | Completed room | Reconcile | No reminder scheduled | P1 | Y |
| NT-14 | Reminder | Player | 24h server reminder | Cron | Fired + deduped (9.2.1) | P1 | Y |
| NT-15 | Reminder | Player | 2h server reminder | Cron | Fired once | P1 | Y |
| NT-16 | Reminder | Player | 30m server reminder | Cron | Fired once; no false 15m | P0 | Y |
| NT-17 | Reminder | Player | Room rescheduled | Update | Old reminder cancelled, new set | P1 | N |
| NT-18 | Read state | Player | Unread notif | Open | Marked read; `readAt` | P1 | Y |
| NT-19 | Unread count | Player | N unread | View badge | Count accurate (`countMyUnread`) | P1 | Y |
| NT-20 | Archive | Player | Notif | Archive | `isArchived`; hidden from inbox | P2 | Y |
| NT-21 | Deep link | Player | Booking accepted | Tap | Routes to `/matchrooms/{id}` | P0 | N |
| NT-22 | Deep link | Player | Booking rejected | Tap | Routes to `/(player)/inbox` | P1 | N |
| NT-23 | Deep link | Zone | Counter result | Tap | Routes to `/zone/modules/bookings?...` | P1 | N |
| NT-24 | Deep link | Player | Renamed/invalid route | Tap | Graceful fallback (M-05) | P0 | N |
| NT-25 | Cold start | Player | App killed | Tap push | Opens to correct route | P0 | N |
| NT-26 | Foreground | Player | App open | Receive push | In-app banner/handler (NotificationRuntimeBridge) | P1 | N |
| NT-27 | Background | Player | App background | Receive | Delivered to tray | P1 | N |
| NT-28 | Categories | Player | Various types | Inbox | Correct category mapping (`notificationCategories`) | P2 | Y |
| NT-29 | Filters | Player | Inbox filters | Filter | Active count + reset | P2 | N |
| NT-30 | Spam | System | Rapid events | Fire many | Collapsed via dedupe; no flood | P1 | Y |
| NT-31 | Recipient role | System | zone_admin notif | Send | Only zone admin sees | P1 | Y |
| NT-32 | Recipient role | System | super_admin notif | Send | Only super admin sees | P0 | Y |
| NT-33 | Expiry | System | TTL notif | Expire | `expired` state | P2 | Y |
| NT-34 | Privacy | System | Notif body | Inspect | No sensitive PII in push payload | P0 | Y |
| NT-35 | KYC notif | Player | KYC status change | Update | `kycNotifications` fired | P1 | Y |
| NT-36 | Withdrawal notif | Zone | Decision | Approve/reject | `withdrawalNotifications` fired | P1 | Y |
| NT-37 | Cleanup | System | Logout | Sign out | Local reminders cancelled/cleaned | P1 | N |
| NT-38 | Multi-device | Player | 2 devices | Receive | Both get push (active tokens) | P2 | N |
| NT-39 | Permission copy | Player | Pre-prompt | View | Rationale before OS prompt | P1 | N |
| NT-40 | Rate limit | System | Expo limits | High volume | Backoff/receipts handled | P1 | Y |

## §7-H KYC / Reports / Support (KRS-) — 30 cases

| ID | Module | Role | Preconditions | Steps | Expected | Pri | Auto |
|---|---|---|---|---|---|---|---|
| KRS-01 | KYC | Player | not_started | Start KYC | Didit session; `startTokenHash` set | P0 | N |
| KRS-02 | KYC | Player | In Didit flow | Complete CNIC+face | `in_review`/`verified` via webhook | P0 | N |
| KRS-03 | KYC | Player | Webhook callback | Provider posts result | Status synced; user updated | P0 | N |
| KRS-04 | KYC | Player | Forged webhook | Fake callback | Rejected (auth/signature) | P0 | Y |
| KRS-05 | KYC | Player | Session expired | Resume stale | `startTokenExpiresAt` enforced | P1 | Y |
| KRS-06 | KYC | Player | Rejected | View status | Reason shown; can retry | P1 | N |
| KRS-07 | KYC | Player | Email source-of-truth | Verify email used | KYC uses canonical email | P1 | Y |
| KRS-08 | KYC | Player | CNIC storage | Inspect DB | Only `cnicMasked`+`cnicHash` (no raw) | P0 | Y |
| KRS-09 | KYC | Player | Verified | Unlock features | KYC-gated actions allowed | P0 | Y |
| KRS-10 | KYC | Zone | zone_owner role | KYC | Role-specific verification works | P1 | N |
| KRS-11 | Reports | Player | View profile/room | Report user/content | Report created | P1 | N |
| KRS-12 | Reports | Player | Duplicate report | Re-report | Deduped or limited | P2 | Y |
| KRS-13 | Reports | Player | Report self | Attempt | Blocked | P2 | Y |
| KRS-14 | Reports | Super | Open report | Review | Detail w/ context; privacy preserved | P1 | N |
| KRS-15 | Reports | Super | Action | Resolve/dismiss | Status set; parties handled | P1 | Y |
| KRS-16 | Block | Player | Another user | Block | `userBlocks` row; content hidden | P1 | Y |
| KRS-17 | Block | Player | Blocked user invites | Invite attempt | Prevented | P1 | Y |
| KRS-18 | Block | Player | Unblock | Remove | Visibility restored | P2 | Y |
| KRS-19 | Support | Player | Open support | Create ticket | Ticket created; confirmation | P1 | N |
| KRS-20 | Support | Player | With orderRef | Payment issue | Ticket links payment (linkEntities) | P0 | N |
| KRS-21 | Support | Player | AI assistant | Ask | Answer or human fallback | P2 | N |
| KRS-22 | Support | Player | PII in question | Ask | PII not leaked to model | P0 | N |
| KRS-23 | Support | Super | Reply | Respond | User notified (email/notif) | P1 | N |
| KRS-24 | Support | Super | Internal note | Add | Admin-only visibility | P2 | Y |
| KRS-25 | Support | Super | Assign | Assign admin | Recorded | P2 | Y |
| KRS-26 | Support | Super | Resolve | Close | `resolved` | P2 | Y |
| KRS-27 | Support email | System | Ticket reply | Send | `supportEmail` delivers | P1 | N |
| KRS-28 | KYC notif | Player | Status change | Observe | Notification fired | P1 | Y |
| KRS-29 | Reports privacy | Super | Reporter identity | View | Reporter protected per policy | P1 | N |
| KRS-30 | Account deletion | Player | Logged in | Delete account | Data removed/anonymized (S-10 — must add) | P0 | N |

## §7-J Security / Access Control (SEC-) — 32 cases

| ID | Module | Role | Preconditions | Steps | Expected | Pri | Auto |
|---|---|---|---|---|---|---|---|
| SEC-01 | Authz | Attacker | KYC-verified player | Accept booking other zone | DENIED (CR-01) | P0 | Y |
| SEC-02 | Authz | Attacker | player | Reject booking other zone | DENIED (CR-01) | P0 | Y |
| SEC-03 | Authz | Attacker | player | Counter-offer other zone | DENIED (CR-01) | P0 | Y |
| SEC-04 | Authz | Attacker | player | Walk-in for other zone | DENIED (CR-01) | P0 | Y |
| SEC-05 | Authz | Attacker | player | Read other zone queue | DENIED (S-04) | P0 | Y |
| SEC-06 | Authz | Attacker | player | Read other zone matchrooms | DENIED (S-04) | P0 | Y |
| SEC-07 | Authz | Attacker | spoof adminUid | Pass victim adminUid | Server ignores arg; uses session (S-03) | P0 | Y |
| SEC-08 | Authz | Player | non-admin | Call any `api.admin.*` mutation | DENIED (allowlist gate) | P0 | Y |
| SEC-09 | Authz | Player | non-admin | `setUserRole` self→admin | DENIED | P0 | Y |
| SEC-10 | Authz | Player | non-admin | `setZoneStatus` | DENIED | P0 | Y |
| SEC-11 | Authz | Player | non-admin | `approveZoneWithdrawal` | DENIED | P0 | Y |
| SEC-12 | Authz | Player | non-admin | `manuallyVerifyIdentity` | DENIED | P0 | Y |
| SEC-13 | Default admin | Attacker | env unset | Register default email | NOT admin (CR-03 fix) | P0 | Y |
| SEC-14 | Role string | Super | role="super_admin" | Gate check | Recognized (CR-05) | P0 | Y |
| SEC-15 | Pay authz | Attacker | other's intent | Checkout | DENIED (`createdByUid`) | P0 | Y |
| SEC-16 | Pay authz | Attacker | forged IPN | Post callback | Rejected (signature) | P0 | Y |
| SEC-17 | PII | Super | KYC record | View | Masked CNIC only | P0 | N |
| SEC-18 | PII | Super | Payment detail | View | No raw MSISDN/card (M-08) | P0 | N |
| SEC-19 | PII | Super | Withdrawal | View | Bank details masked | P0 | N |
| SEC-20 | PII | System | Push payload | Inspect | No sensitive data | P0 | Y |
| SEC-21 | Deep link | Attacker | unauth | Open `matchhai://super-admin` | Blocked (auth gate) | P0 | N |
| SEC-22 | Deep link | Attacker | player | Open zone deep link | Role-gated | P0 | N |
| SEC-23 | Session | Attacker | stolen stale token | Use after logout | Rejected | P0 | N |
| SEC-24 | Rate limit | Attacker | OTP resend | Spam | Throttled (`resendCount`) | P1 | Y |
| SEC-25 | Rate limit | Attacker | mutation spam | Flood accept/pay | Throttle/idempotent (S-09) | P1 | Y |
| SEC-26 | Bypass env | System | prod | Inspect | SKIP_KYC/OTP OFF (M-12) | P0 | Y |
| SEC-27 | Secrets | System | client bundle | Inspect | No Easypaisa/Didit secrets in client (S-12) | P0 | N |
| SEC-28 | IDOR | Attacker | other user's notif | Mark read | DENIED (toUid scope) | P1 | Y |
| SEC-29 | IDOR | Attacker | other's booking intent | Cancel | DENIED | P0 | Y |
| SEC-30 | IDOR | Attacker | other's withdrawal | Manipulate | DENIED | P0 | Y |
| SEC-31 | Block enforce | Player | blocked user | Sees content | Hidden (S-11) | P1 | Y |
| SEC-32 | Audit | Super | denied action | Attempt | Logged `denied` w/ identity | P1 | Y |

## §7-I UI / Responsiveness / Device (RD-) — 50 cases

| ID | Module | Device/Context | Steps | Expected | Pri | Auto |
|---|---|---|---|---|---|---|
| RD-01 | Long modal | Samsung A32 | Open long content modal | Scrollable (uses `AppModalBody scroll`) | P0 | N |
| RD-02 | Long modal | iPhone SE | Open long modal | Content scrolls within 75% cap | P0 | N |
| RD-03 | Long modal | All | Audit consumers | Every long modal sets `scroll`/ScrollView | P0 | N |
| RD-04 | Raw modal | All | Find raw `<Modal><View>` | None clip content unscrollably | P0 | N |
| RD-05 | Sheet | iPhone Pro Max | Open bottom sheet | Respects 82% + home indicator | P1 | N |
| RD-06 | Footer CTA | iPhone w/ indicator | Open modal w/ footer | Button above home indicator | P0 | N |
| RD-07 | Keyboard | Android | Open form modal | `keyboardAware` keeps input visible | P0 | N |
| RD-08 | Keyboard | iOS | Open form modal | Interactive dismiss works | P1 | N |
| RD-09 | Keyboard | Small Android | Login form | Inputs not hidden | P0 | N |
| RD-10 | Safe area | Android gesture nav | All screens | No content under nav bar | P1 | N |
| RD-11 | Edge-to-edge | Android 15 | All screens | Content respects insets (L-05) | P0 | N |
| RD-12 | Notch | iPhone | Headers | Not under notch | P1 | N |
| RD-13 | Tabs | All | Bottom nav | `useTabBarClearance` prevents overlap | P1 | N |
| RD-14 | Filter chips | Small screen | Discover filters | Chips wrap, no overflow | P1 | N |
| RD-15 | Cards | All | Long titles | Truncate/ellipsize | P2 | N |
| RD-16 | Dashboard | All | Home | Tiles responsive | P2 | N |
| RD-17 | Discover lists | All | Scroll long list | FlatList perf, no jank (P-06) | P1 | N |
| RD-18 | Admin tables | Tablet | Super-admin lists | Usable layout | P2 | N |
| RD-19 | Pay&Review | iPhone SE | Open | All info visible/scroll | P0 | N |
| RD-20 | Booking status | iPhone SE | Open | Buttons reachable | P0 | N |
| RD-21 | Payment modal | iOS | EP browser return | Buttons tappable (8.2.5) | P0 | N |
| RD-22 | Dynamic Type | iOS large text | Modal headers | Legible (L-01 forces no-scale) | P2 | N |
| RD-23 | Dynamic Type | Android large font | Forms | No clipped labels | P2 | N |
| RD-24 | Landscape | All | Rotate | Portrait-locked (orientation) holds | P2 | N |
| RD-25 | iPad | iPad | Open app | Not stretched phone UI (or disable tablet) | P1 | N |
| RD-26 | Drawer | Super | Open nav drawer | Smooth; backdrop dismiss | P2 | N |
| RD-27 | Empty states | All | No data screens | Friendly empty state component | P1 | N |
| RD-28 | Loading states | All | Slow network | Skeleton/spinner, no blank | P1 | N |
| RD-29 | Error states | All | Backend error | Friendly error + retry | P0 | N |
| RD-30 | Disabled CTA | All | Submitting | Buttons disabled (no double-submit) | P0 | N |
| RD-31 | Destructive | All | Cancel/reject | Destructive styling + confirm | P1 | N |
| RD-32 | Toast | All | Action result | Toast renders above modal | P2 | N |
| RD-33 | Date picker | All | Pick date | Native picker; min/max bounds | P1 | N |
| RD-34 | Time picker | All | Pick time | Correct local time | P0 | N |
| RD-35 | Image picker | iOS | Pick photo | Works after CR-02 fix | P0 | N |
| RD-36 | Chat input | All | Type/attach | Input + attach usable | P2 | N |
| RD-37 | Carousels | All | Horizontal scroll | Smooth | P2 | N |
| RD-38 | Tap targets | All | Small buttons | ≥44pt targets | P2 | N |
| RD-39 | Contrast | All | Dark theme | WCAG AA on muted text | P1 | N |
| RD-40 | Splash | All | Cold start | Splash → app, no flash | P2 | N |
| RD-41 | Back nav | All | Inner pages | Back arrow consistent | P1 | N |
| RD-42 | Android back | Android | Hardware back | Closes modal not app | P1 | N |
| RD-43 | Predictive back | Android | Gesture | Behaves (disabled flag) | P2 | N |
| RD-44 | Stuck modal | All | Mid-action | No unclickable stuck modal | P0 | N |
| RD-45 | Dismiss | All | `dismissDisabled` | Can't dismiss during submit | P1 | N |
| RD-46 | Font load | All | Cold start | No invisible text flash | P2 | N |
| RD-47 | Long lists scroll | All | Inbox 200+ | Smooth, paginated | P1 | N |
| RD-48 | Zone bookings | A32 | Action sheets | Allocation/counter sheets scroll | P0 | N |
| RD-49 | Skill modal | All | `SkillAssessmentModal` | Long content scrolls | P1 | N |
| RD-50 | Orientation lock | iPad | Rotate | Consistent (or tablet design) | P2 | N |

## §7-K Backend / Store / Build (BE- / ST-) — 30 cases

| ID | Module | Role | Preconditions | Steps | Expected | Pri | Auto |
|---|---|---|---|---|---|---|---|
| BE-01 | Index | System | Large bookingRequests | Zone queue load | Indexed query, no full scan (H-02) | P1 | Y |
| BE-02 | Index | System | >200 matchrooms/zone | Zone list | All returned (H-03 fix) | P1 | Y |
| BE-03 | Pagination | Super | Large lists | Admin lists | Cursor-paginated (H-05) | P1 | Y |
| BE-04 | Cron | System | Lifecycle tick | 2-min cron | Bounded batch; indexed (M-10) | P1 | Y |
| BE-05 | Cron | System | Lock time | Tick | Rooms lock at start-24h | P0 | Y |
| BE-06 | Cron | System | Expire not-full | Tick | Expired correctly | P0 | Y |
| BE-07 | Cron | System | Result deadlines | Tick | Escalate/resolve (H-06) | P0 | Y |
| BE-08 | Cron | System | Broadcast expiry | Scheduler | Offers expire; resources freed | P1 | Y |
| BE-09 | Idempotency | System | Re-run mutations | Repeat | No duplicate side-effects | P0 | Y |
| BE-10 | Race | System | Concurrent accept | Two zones | First-writer-wins (H-07) | P0 | Y |
| BE-11 | Orphans | System | Cancelled flows | Inspect | No orphan holds/resources | P1 | Y |
| BE-12 | Stale holds | System | Abandoned intent | TTL | Hold released | P0 | Y |
| BE-13 | Schema | System | v.any() fields | Inspect | Plan typed validators (H-08) | P2 | N |
| BE-14 | Types | System | `convex/` typecheck | `convex deploy` (later) | No Convex type errors | P1 | Y |
| BE-15 | Migration | Super | branch model | Retry migration | Succeeds/records error | P1 | N |
| BE-16 | Audit | System | All admin ops | Inspect | Logged with identity | P1 | Y |
| BE-17 | Data retention | System | Old records | Policy | Defined retention (chat/notif/txn) | P2 | N |
| ST-01 | iOS perms | Build | iOS build | Image pick | Permission strings present (CR-02) | P0 | N |
| ST-02 | iOS perms | Build | Mic | Voice msg | Mic string present | P1 | N |
| ST-03 | Prod env | Build | production profile | Build | Convex URL set (CR-04) | P0 | N |
| ST-04 | Env split | Build | staging vs prod | Build each | Distinct backends | P0 | N |
| ST-05 | Push creds | Build | iOS/Android | Send push | APNs/FCM configured | P0 | N |
| ST-06 | Account deletion | Store | Apple/Google | Review | In-app deletion present (S-10) | P0 | N |
| ST-07 | Data safety | Store | Play form | Submit | Declares CNIC/phone/email/photos/financial | P0 | N |
| ST-08 | Privacy label | Store | Apple | Submit | Accurate nutrition label | P0 | N |
| ST-09 | Edge-to-edge | Build | Android 15 | Run | Insets respected (L-05) | P1 | N |
| ST-10 | Tablet | Store | iPad | Review | Optimized or disabled | P1 | N |
| ST-11 | Money wording | Store | Listing/UI | Review | Booking-payment framing (L-08) | P1 | N |
| ST-12 | Deps | Build | bundle | Analyze | Trim firebase/dual-auth/fonts (L-03/04, P-05) | P2 | N |
| ST-13 | Debug screen | Build | prod | Routes | `debug/perf` gated (L-06) | P2 | N |

---

## Appendix A — Files & areas inspected (representative)

**Convex (deep/targeted):** `schema.ts`, `zoneAdminBooking.ts`, `kycGate.ts`, `timing.ts`, `easypaisa.ts`, `admin.ts`, `matchrooms.ts`, `notifications.ts`. **Convex (structural/index map):** `wallet.ts`, `matchroomBroadcast.ts`, `crons.ts`, `teamChallenges.ts`, `teams.ts`, `zones.ts`, `zoneWithdrawals.ts`, `zonePilot.ts`, `bookings.ts`, `reports.ts`, `support.ts`, `kyc.ts`, `externalApis.ts`, `pushNotificationsActions.ts`, `http.ts`, `auth.ts`, `discover.ts`, `dashboard.ts` (45 modules total).
**App/src (deep):** `AuthenticatedConvexProvider.tsx`, `lib/convex.ts`, `AppModalPrimitives.tsx`, `services/convex/zoneAdminBookingService.ts`, `services/reminderManager.ts`. **App/src (structural):** full `app/` route tree (player tabs, matchrooms create/book/detail, teams, zone modules, super-admin pages, auth), `src/services/convex/*`, `src/features/*`, `src/hooks/*`, `src/store/*`, `src/utils/*`.
**Config:** `app.json`, `eas.json`, `package.json`, `tsconfig.json`, `convex/tsconfig.json`.

## Appendix B — Severity tally

| Severity | Count |
|---|---|
| Critical | 6 (CR-01…CR-06) |
| High | 10 (H-01…H-10) |
| Medium | 12 (M-01…M-12) |
| Low | 8 (L-01…L-08) |
| Security/Privacy (S-) | 12 tracked items |
| Payment edge (8.2.x) | 7 |
| Notification (9.2.x) | 7 |
| Perf (P-) | 10 |
| **Total test cases** | **~430** (AUTH 32, MR 52, TM 30, ZA 42, SA 50, PW 52, NT 40, KRS 30, SEC 32, RD 50, BE/ST 30) |

*End of audit.*

---

## Section 18 — Super Admin access model audit

**Source of truth:** the **backend** is authoritative. Two independent server gates enforce Super Admin; the client only routes.

| Layer | File | Gate function | What it checks |
|---|---|---|---|
| Backend (admin dashboard queries/mutations, session-token based) | `convex/admin.ts` | `getAuthenticatedAdmin` → `isAuthorizedSuperAdmin(profile,email)` | active **allowlist email** OR DB `role` ∈ {`super_admin`,`super-admin`} |
| Backend (identity/`ctx.auth` based, e.g. matchrooms, self-or-admin) | `convex/authz.ts` | `requireSuperAdmin` → `isSuperAdminProfile` | DB `role` ∈ {`super_admin`,`super-admin`} OR **allowlist email** |
| Client (routing + route guard only — NOT a security boundary) | `src/utils/accountRouting.ts`, `app/super-admin/_layout.tsx` | `isSuperAdminProfile(user)` | DB `role` OR `EXPO_PUBLIC_SUPER_ADMIN_EMAIL*` OR legacy id |

**Gate composition (Q1/Q2):** access = **env allowlist email match (active)** OR **DB user `role`**. No `accountType` grant. **No hardcoded email/id fallback** — all three layers fail closed if env is empty (CR-03 remediated). `accountType` stays `player`/`zone` even for super admins; role is the privilege field.

**Role canonicalization (Q5):** canonical = `super_admin` (underscore). Legacy `super-admin` (hyphen) is still **accepted on read** everywhere so existing/seed admins aren't locked out. ⚠️ `demoSeed.ts` writes the hyphen form; `getDashboardSummary` counts only `userRoles["super-admin"]`, so a `super_admin` (underscore) admin is undercounted in the dashboard stat (cosmetic).

**⚠️ Key structural risk — three divergent env sets.** Each gate reads a *different* variable set:
- `convex/admin.ts`: `SUPER_ADMIN_EMAIL`, `EXPO_PUBLIC_SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_EMAIL_{JUNAID,EHTESHAN,ZEERAK,MUBEEN,SAAD,OVAIS}`, **`SUPER_ADMIN_ALLOWLIST_JSON`**
- `convex/authz.ts`: same as above **minus** `SUPER_ADMIN_ALLOWLIST_JSON` (a JSON-only admin passes the dashboard gate but FAILS identity-based `requireSuperAdmin` paths)
- client: `EXPO_PUBLIC_SUPER_ADMIN_EMAIL`, `EXPO_PUBLIC_SUPER_ADMIN_EMAIL_{NAMES}`, `EXPO_PUBLIC_SUPER_ADMIN_EMAILS` (CSV)

Consequence: an **email-allowlist** partner must be set in **both** a server var *and* the matching `EXPO_PUBLIC_` client var, or the client route guard (`_layout.tsx`) redirects them out even though the backend would authorize. The only way to satisfy **all** gates with a **single** change is **DB `role = "super_admin"`**.

**Client routing (Q6):** ✅ correct. `login.tsx` → `isSuperAdminProfile` → `router.replace(superAdminHome)`; `getDefaultSignedInRoute` and the `_layout.tsx` guard agree.

**Backend independent enforcement (Q7):** ✅ yes. Every super-admin query/mutation calls `getAuthenticatedAdmin(sessionToken)` server-side; never trusts client routing. Identity paths use `requireSuperAdmin`.

**Self-promotion (Q10):** ✅ **not possible.** `role` is in `PROTECTED_USER_FIELDS` (`convex/users.ts`) and stripped by `stripProtectedUserFields` in `updateFullProfile`/`updateGamePreferences`. `users.create` does not accept `role`. No client mutation writes `role`.

**Create another super admin from UI (Q11):** ❌ no UI/mutation exists. `getSuperAdminAllowlistConfig` is **read-only**. Adding an admin requires env (Convex dashboard) or a direct DB role write. There is **no** in-app "grant super admin" flow, no audit-logged role-change mutation.

**Unsafe hardcoded fallback (Q8):** none found.

## Section 19 — Current Super Admin accounts found / configured

| Email | How discoverable | Status |
|---|---|---|
| `EXPO_PUBLIC_SUPER_ADMIN_EMAIL` (primary) | set **non-empty** in `.env.local`; domain `@matchhai.com`; **value is NOT `ovais@matchhai.com`** (some other matchhai.com address — likely the original super admin) | Active on client routing; backend depends on Convex deployment env |
| `ovais@matchhai.com` | **Not** the value of `EXPO_PUBLIC_SUPER_ADMIN_EMAIL` in `.env.local`; the `Ovais` slot (`SUPER_ADMIN_EMAIL_OVAIS` / `EXPO_PUBLIC_SUPER_ADMIN_EMAIL_OVAIS`) exists in code but is **empty/absent in `.env.local`** | **Cannot confirm active from local files.** Would be active only if `SUPER_ADMIN_EMAIL_OVAIS` is set in the **Convex dashboard** (not readable here) or the user holds DB `role`. **Verify in Convex dashboard env + `users` table.** |
| Partner slots Junaid, Ehteshan, Zeerak, Mubeen, Saad | dedicated env slots exist in code; **all empty/absent in `.env.local`** | **Not configured** (no partner accounts exist yet) |
| `demo_superadmin` (`buildEmail("super",0)`) | `demoSeed.ts` sets `role:"super-admin"` | Exists **only** in seeded/demo deployments |

> Server-only (non-`EXPO_PUBLIC_`) values live in the **Convex deployment env**, which this audit cannot read. No secrets/values were printed.

**Q3 — Is `ovais@matchhai.com` env- or DB-configured?** Indeterminate from repo. Not via local `EXPO_PUBLIC_SUPER_ADMIN_EMAIL`. Confirm via Convex dashboard (`SUPER_ADMIN_EMAIL_OVAIS`) and the `users` table (`role`).
**Q4 — Other users already super admin?** None configured in local env. DB roles can't be enumerated from the repo — query the `users` table for `role ∈ {super_admin, super-admin}`.

## Section 20 — How to safely add five partner Super Admin accounts (Q9)

Five named slots already exist (`Junaid, Ehteshan, Zeerak, Mubeen, Saad`) — Ovais is the 6th. **Yes, five partner Super Admins can be added with no code change.** Recommended, in order of safety:

**Option A (preferred — DB role, satisfies all gates in one place):**
1. Create/verify each partner's normal account (email/password via the standard auth flow — **do not create passwords for them**; have them register).
2. A trusted operator sets `role = "super_admin"` on each `users` row (Convex dashboard data editor, or a new audit-logged internal mutation — see Section 22). This is recognized by `admin.ts`, `authz.ts`, **and** the client guard simultaneously.
3. No env changes needed.

**Option B (env allowlist — must set BOTH targets):**
1. In the **Convex deployment dashboard** (server env): set `SUPER_ADMIN_EMAIL_JUNAID … _SAAD` to the partner emails (lowercase). Covers `admin.ts` + `authz.ts`.
2. In the **app build env** (`.env.local` / `eas.json` per profile): set the matching `EXPO_PUBLIC_SUPER_ADMIN_EMAIL_JUNAID … _SAAD` so the client routes them and `_layout.tsx` doesn't redirect them out. Requires an **app rebuild/redeploy**.
3. Alternative: a single `SUPER_ADMIN_ALLOWLIST_JSON` on the server covers `admin.ts` only — **not** `authz.ts` identity paths — so avoid JSON-only for full coverage.

## Section 21 — Required env / database steps (Q12)

- **Option A:** **DB only** (one `role` write per partner). No env, no rebuild.
- **Option B:** **Convex env + app env + app rebuild.** Server var alone authorizes the backend but the client guard blocks the route; client var alone routes them but the backend denies every query.
- Either way: emails must be **lowercase**; canonical role string is **`super_admin`** (use underscore for new data).

## Section 22 — Security risks & missing Super Admin management tooling

| ID | Risk | Severity | Recommendation |
|---|---|---|---|
| SA-A | Three divergent env-var sets (admin.ts / authz.ts / client) → partial-config foot-gun; JSON allowlist not honored by `authz.ts` | High | Centralize allowlist resolution in one shared module imported by both Convex gates; make `authz.ts` read the JSON allowlist too. Prefer DB-role onboarding to sidestep entirely. |
| SA-B | No in-app, audit-logged grant/revoke Super Admin mutation; role changes done by raw DB edits | High | Add an internal mutation `grantSuperAdmin`/`revokeSuperAdmin` that **requires an existing authenticated Super Admin**, writes canonical `super_admin`, and logs to `superAdminAuditLogs`. Never client-self-callable. |
| SA-C | `demoSeed.ts` writes legacy `super-admin`; `getDashboardSummary` counts only the hyphen variant | Low | Seed canonical `super_admin`; count both forms in the dashboard stat. |
| SA-D | `ovais@matchhai.com` activation unverifiable from repo | Info | Confirm in Convex dashboard env (`SUPER_ADMIN_EMAIL_OVAIS`) and `users` table before relying on it. |
| SA-E | Onboarding via env requires app rebuild for the client var | Medium | Standardize on **DB role** for partners so no rebuild is needed and all gates agree. |

**Validation checklist:**
- ✅ Existing primary Super Admin (configured `EXPO_PUBLIC_SUPER_ADMIN_EMAIL`) still authorized — gate unchanged.
- ✅ Non-Super-Admin blocked at backend (`getAuthenticatedAdmin`/`requireSuperAdmin` throw) **and** client (`_layout.tsx` redirect).
- ✅ Normal user cannot self-promote (`role` protected/denylisted).
- ⚠️ Role strings consistent on **read**; standardize **writes** to `super_admin`.
- ✅ No unsafe hardcoded fallback remains.

*End of Super Admin access audit.*

