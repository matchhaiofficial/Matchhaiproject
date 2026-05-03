# MatchHai Canonical Audit And Flow Reference

Date: 2026-05-03 (updated)
Originally drafted: 2026-04-03
Workspace: `D:\matchhai_app`
Source basis:
- `APP_UI_FLOW_STRUCTURE_ANALYSIS.md`
- `FULL_APP_AUDIT.md`
- `VERIFIED_USER_ADMIN_FLOW_MAP.md`
- `MATCHROOM_SKILLRATING_AND_JOIN_RULES.md`
- `REPO_ANALYSIS_AUDIT.md`
- direct repo inspection across `app/`, `src/`, `convex/`, `functions/`, and related support code

## 1. Purpose

This document replaces the separate audit and flow markdown files with one canonical reference.

It is intended to be the source of truth for:

- implemented product surfaces
- verified player, zone admin, and super admin flows
- game support, skill rating, and join rules
- UI and architecture findings
- confirmed gaps, migration debt, and operational risks
- next-step cleanup and scaling priorities

This is a code-verified audit, not a design-only or screenshot-only summary.

## 1.1 Update log (this file)

- 2026-05-03: refreshed route inventory to include `app/auth/reset-password.tsx` and `app/zone/modules/audit.tsx` in the main Route Inventory list.
- 2026-05-03: added a generated per-route “Layout / wrapper map” table (route -> `_layout.tsx` chain) to make layout differences explicit.
- 2026-05-03: updated global runtime wiring notes to include Inter font loading at app root.

## 2. Method And Confidence Boundaries

This audit is based on implemented code in:

- `app/`
- `src/components/`
- `src/features/`
- `src/hooks/`
- `src/services/`
- `src/utils/`
- `convex/`
- `functions/`

This remains a static audit:

- no full device QA run
- no end-to-end production validation
- no load test proving 5,000 concurrent active users yet
- no claim of completeness for surfaces not directly verified in code

## 3. Architecture Snapshot

### Active stack

- Expo Router + React Native
- Convex for data runtime
- Better Auth for auth/session

### Repo overlap still present

- `convex/` is the active runtime path
- older compatibility-layer service contracts have been migrated into direct Convex-first modules
- `functions/`, `matchhai-backend/`, and `matchhai-psn-service/` remain in the repo as legacy or sidecar surfaces
- some service wrappers still preserve Firebase-shaped or pre-Convex assumptions

### Product surfaces

The app is already a real three-surface system:

1. Player execution app
2. Zone admin / venue operations app
3. Super admin control plane

## 4. Route Inventory

### Root shell

- `app/_layout.tsx`
- `app/+html.tsx`
- `app/+not-found.tsx`
- `app/index.tsx`
- `src/context/AuthContext.tsx`
- `src/utils/accountRouting.ts`

### Auth

- `app/auth/login.tsx`
- `app/auth/forgot-password.tsx`
- `app/auth/reset-password.tsx`
- `app/auth/verification-required.tsx`
- `app/auth/register.tsx`
- `app/auth/register-step2.tsx`
- `app/auth/register-step3.tsx`
- `app/auth/register-step4.tsx`
- `app/auth/zone-register.tsx`
- `app/auth/zone-register-step2.tsx`
- `app/auth/zone-register-step3.tsx`
- `app/auth/zone-register-step4.tsx`

### Player

- Tabs:
  - `app/(player)/(tabs)/index.tsx`
  - `app/(player)/(tabs)/discover.tsx`
  - `app/(player)/(tabs)/profile.tsx`
  - `app/(player)/(tabs)/matchrooms.tsx`
  - `app/(player)/(tabs)/teams.tsx`
- Secondary player screens:
  - `app/(player)/schedule.tsx`
  - `app/(player)/wallet.tsx`
  - `app/(player)/inbox.tsx`
  - `app/(player)/friends.tsx`
  - `app/(player)/chatrooms.tsx`
  - `app/(player)/friend-chat/[friendId].tsx`
  - `app/(player)/my-teams.tsx`
  - `app/(player)/reports.tsx`
  - `app/(player)/report/[id].tsx`
  - `app/(player)/zones/[id].tsx`
  - `app/(player)/profile/[uid].tsx`
  - `app/(player)/profile/edit.tsx`
  - `app/(player)/profile/game-details.tsx`

### Matchrooms

- `app/matchrooms/create/index.tsx`
- `app/matchrooms/[id].tsx`
- `app/matchrooms/book/[id].tsx`
- `app/matchrooms/book/pay/[intentId].tsx`
- `app/matchrooms/book/status/[intentId].tsx`
- `app/matchrooms/chat/[id].tsx`
- `app/matchrooms/my.tsx`
- `app/matchrooms/result.tsx`
- `app/matchrooms/vote.tsx`

### Teams

- `app/teams/create.tsx`
- `app/teams/[id].tsx`
- `app/teams/challenges.tsx`
- `app/teams/challenge.tsx`
- `app/teams/challenge-create.tsx`
- `app/teams/challenge-chat.tsx`

### Zone admin

- `app/zone/(tabs)/index.tsx`
- `app/zone/(tabs)/branches.tsx`
- `app/zone/branch/new.tsx`
- `app/zone/branch/[id].tsx`
- `app/zone/modules/bookings.tsx`
- `app/zone/modules/audit.tsx`
- `app/zone/modules/resources.tsx`
- `app/zone/modules/pricing.tsx`
- `app/zone/modules/support.tsx`
- `app/zone/modules/insights.tsx`
- `app/zone/modules/settings.tsx`
- `app/zone/modules/notifications.tsx`
- `app/zone/modules/migration-tools.tsx`
- `app/zone/report/[id].tsx`

### Super admin

- `app/super-admin/(tabs)/index.tsx`
- `app/super-admin/request/[id].tsx`
- `app/super-admin/report/[id].tsx`
- `app/super-admin/easypaisa.tsx`

### Debug (dev-only)

- `app/debug/perf.tsx`

### Layout / wrapper map (per route)

Expo Router layout resolution (and the resulting visual shell differences) are driven by the nearest `_layout.tsx` up the directory tree.

Notes:
- “Public URL path” strips route groups like `(player)` and `(tabs)` (Expo Router groups are not part of the URL).
- “Router path” shows the internal route path including groups (useful for disambiguating `/` conflicts like `app/index.tsx` vs player tabs index).
- “Layout chain” is the ordered `_layout.tsx` chain that will wrap that page at runtime.

| Public URL path | Router path (includes groups) | File | Layout chain |
|---|---|---|---|
| `/discover` | `/(player)/(tabs)/discover` | `app/(player)/(tabs)/discover.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` -> `app/(player)/(tabs)/_layout.tsx` |
| `/` | `/(player)/(tabs)` | `app/(player)/(tabs)/index.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` -> `app/(player)/(tabs)/_layout.tsx` |
| `/matchrooms` | `/(player)/(tabs)/matchrooms` | `app/(player)/(tabs)/matchrooms.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` -> `app/(player)/(tabs)/_layout.tsx` |
| `/profile` | `/(player)/(tabs)/profile` | `app/(player)/(tabs)/profile.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` -> `app/(player)/(tabs)/_layout.tsx` |
| `/teams` | `/(player)/(tabs)/teams` | `app/(player)/(tabs)/teams.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` -> `app/(player)/(tabs)/_layout.tsx` |
| `/chatrooms` | `/(player)/chatrooms` | `app/(player)/chatrooms.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/friend-chat/[friendId]` | `/(player)/friend-chat/[friendId]` | `app/(player)/friend-chat/[friendId].tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/friends` | `/(player)/friends` | `app/(player)/friends.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/inbox` | `/(player)/inbox` | `app/(player)/inbox.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/my-teams` | `/(player)/my-teams` | `app/(player)/my-teams.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/profile/[uid]` | `/(player)/profile/[uid]` | `app/(player)/profile/[uid].tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/profile/edit` | `/(player)/profile/edit` | `app/(player)/profile/edit.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/profile/game-details` | `/(player)/profile/game-details` | `app/(player)/profile/game-details.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/report/[id]` | `/(player)/report/[id]` | `app/(player)/report/[id].tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/reports` | `/(player)/reports` | `app/(player)/reports.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/schedule` | `/(player)/schedule` | `app/(player)/schedule.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/wallet` | `/(player)/wallet` | `app/(player)/wallet.tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/zones/[id]` | `/(player)/zones/[id]` | `app/(player)/zones/[id].tsx` | `app/_layout.tsx` -> `app/(player)/_layout.tsx` |
| `/+html` | `/+html` | `app/+html.tsx` | `app/_layout.tsx` |
| `/+not-found` | `/+not-found` | `app/+not-found.tsx` | `app/_layout.tsx` |
| `/auth/forgot-password` | `/auth/forgot-password` | `app/auth/forgot-password.tsx` | `app/_layout.tsx` |
| `/auth/login` | `/auth/login` | `app/auth/login.tsx` | `app/_layout.tsx` |
| `/auth/register-step2` | `/auth/register-step2` | `app/auth/register-step2.tsx` | `app/_layout.tsx` |
| `/auth/register-step3` | `/auth/register-step3` | `app/auth/register-step3.tsx` | `app/_layout.tsx` |
| `/auth/register-step4` | `/auth/register-step4` | `app/auth/register-step4.tsx` | `app/_layout.tsx` |
| `/auth/register` | `/auth/register` | `app/auth/register.tsx` | `app/_layout.tsx` |
| `/auth/reset-password` | `/auth/reset-password` | `app/auth/reset-password.tsx` | `app/_layout.tsx` |
| `/auth/verification-required` | `/auth/verification-required` | `app/auth/verification-required.tsx` | `app/_layout.tsx` |
| `/auth/zone-register-step2` | `/auth/zone-register-step2` | `app/auth/zone-register-step2.tsx` | `app/_layout.tsx` |
| `/auth/zone-register-step3` | `/auth/zone-register-step3` | `app/auth/zone-register-step3.tsx` | `app/_layout.tsx` |
| `/auth/zone-register-step4` | `/auth/zone-register-step4` | `app/auth/zone-register-step4.tsx` | `app/_layout.tsx` |
| `/auth/zone-register` | `/auth/zone-register` | `app/auth/zone-register.tsx` | `app/_layout.tsx` |
| `/debug/perf` | `/debug/perf` | `app/debug/perf.tsx` | `app/_layout.tsx` |
| `/` | `/` | `app/index.tsx` | `app/_layout.tsx` |
| `/matchrooms/[id]` | `/matchrooms/[id]` | `app/matchrooms/[id].tsx` | `app/_layout.tsx` -> `app/matchrooms/_layout.tsx` |
| `/matchrooms/book/[id]` | `/matchrooms/book/[id]` | `app/matchrooms/book/[id].tsx` | `app/_layout.tsx` -> `app/matchrooms/_layout.tsx` |
| `/matchrooms/book/pay/[intentId]` | `/matchrooms/book/pay/[intentId]` | `app/matchrooms/book/pay/[intentId].tsx` | `app/_layout.tsx` -> `app/matchrooms/_layout.tsx` |
| `/matchrooms/book/status/[intentId]` | `/matchrooms/book/status/[intentId]` | `app/matchrooms/book/status/[intentId].tsx` | `app/_layout.tsx` -> `app/matchrooms/_layout.tsx` |
| `/matchrooms/chat/[id]` | `/matchrooms/chat/[id]` | `app/matchrooms/chat/[id].tsx` | `app/_layout.tsx` -> `app/matchrooms/_layout.tsx` |
| `/matchrooms/create` | `/matchrooms/create` | `app/matchrooms/create/index.tsx` | `app/_layout.tsx` -> `app/matchrooms/_layout.tsx` |
| `/matchrooms/my` | `/matchrooms/my` | `app/matchrooms/my.tsx` | `app/_layout.tsx` -> `app/matchrooms/_layout.tsx` |
| `/matchrooms/result` | `/matchrooms/result` | `app/matchrooms/result.tsx` | `app/_layout.tsx` -> `app/matchrooms/_layout.tsx` |
| `/matchrooms/vote` | `/matchrooms/vote` | `app/matchrooms/vote.tsx` | `app/_layout.tsx` -> `app/matchrooms/_layout.tsx` |
| `/super-admin` | `/super-admin/(tabs)` | `app/super-admin/(tabs)/index.tsx` | `app/_layout.tsx` -> `app/super-admin/_layout.tsx` |
| `/super-admin/easypaisa` | `/super-admin/easypaisa` | `app/super-admin/easypaisa.tsx` | `app/_layout.tsx` -> `app/super-admin/_layout.tsx` |
| `/super-admin/report/[id]` | `/super-admin/report/[id]` | `app/super-admin/report/[id].tsx` | `app/_layout.tsx` -> `app/super-admin/_layout.tsx` |
| `/super-admin/request/[id]` | `/super-admin/request/[id]` | `app/super-admin/request/[id].tsx` | `app/_layout.tsx` -> `app/super-admin/_layout.tsx` |
| `/teams/[id]` | `/teams/[id]` | `app/teams/[id].tsx` | `app/_layout.tsx` -> `app/teams/_layout.tsx` |
| `/teams/challenge-chat` | `/teams/challenge-chat` | `app/teams/challenge-chat.tsx` | `app/_layout.tsx` -> `app/teams/_layout.tsx` |
| `/teams/challenge-create` | `/teams/challenge-create` | `app/teams/challenge-create.tsx` | `app/_layout.tsx` -> `app/teams/_layout.tsx` |
| `/teams/challenge` | `/teams/challenge` | `app/teams/challenge.tsx` | `app/_layout.tsx` -> `app/teams/_layout.tsx` |
| `/teams/challenges` | `/teams/challenges` | `app/teams/challenges.tsx` | `app/_layout.tsx` -> `app/teams/_layout.tsx` |
| `/teams/create` | `/teams/create` | `app/teams/create.tsx` | `app/_layout.tsx` -> `app/teams/_layout.tsx` |
| `/zone/branches` | `/zone/(tabs)/branches` | `app/zone/(tabs)/branches.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` -> `app/zone/(tabs)/_layout.tsx` |
| `/zone` | `/zone/(tabs)` | `app/zone/(tabs)/index.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` -> `app/zone/(tabs)/_layout.tsx` |
| `/zone/branch/[id]` | `/zone/branch/[id]` | `app/zone/branch/[id].tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` |
| `/zone/branch/new` | `/zone/branch/new` | `app/zone/branch/new.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` |
| `/zone/modules/audit` | `/zone/modules/audit` | `app/zone/modules/audit.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` -> `app/zone/modules/_layout.tsx` |
| `/zone/modules/bookings` | `/zone/modules/bookings` | `app/zone/modules/bookings.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` -> `app/zone/modules/_layout.tsx` |
| `/zone/modules/insights` | `/zone/modules/insights` | `app/zone/modules/insights.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` -> `app/zone/modules/_layout.tsx` |
| `/zone/modules/migration-tools` | `/zone/modules/migration-tools` | `app/zone/modules/migration-tools.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` -> `app/zone/modules/_layout.tsx` |
| `/zone/modules/notifications` | `/zone/modules/notifications` | `app/zone/modules/notifications.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` -> `app/zone/modules/_layout.tsx` |
| `/zone/modules/pricing` | `/zone/modules/pricing` | `app/zone/modules/pricing.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` -> `app/zone/modules/_layout.tsx` |
| `/zone/modules/resources` | `/zone/modules/resources` | `app/zone/modules/resources.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` -> `app/zone/modules/_layout.tsx` |
| `/zone/modules/settings` | `/zone/modules/settings` | `app/zone/modules/settings.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` -> `app/zone/modules/_layout.tsx` |
| `/zone/modules/support` | `/zone/modules/support` | `app/zone/modules/support.tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` -> `app/zone/modules/_layout.tsx` |
| `/zone/report/[id]` | `/zone/report/[id]` | `app/zone/report/[id].tsx` | `app/_layout.tsx` -> `app/zone/_layout.tsx` |

## 5. Entry, Role Routing, And Runtime Wiring

### Root entry

- signed-out users route to `/auth/login`
- signed-in route resolution is performed via `src/utils/accountRouting.ts`

### Current route resolution

- `role === "super-admin"` or configured super-admin email / legacy id -> `/super-admin`
- `accountType === "zone"` -> `/zone`
- everyone else -> `/(player)/(tabs)`

### Global runtime wiring

- `app/_layout.tsx` loads fonts and mounts auth/runtime providers
  - current fonts loaded at app root: Montserrat (400/500/600/700), Lora (400), Martel (400), Inter (400/500/600/700)
- global notification deep-link handling is mounted at app scope
- in-app and push notification bridges are globally wired
- root provider mount order (current):
  - `src/providers/AuthenticatedConvexProvider` (ConvexProviderWithAuth driven by Better Auth session + `authClient.convex.token()`)
  - `src/context/AuthContext` (Better Auth session + Convex `users.getByAuthId` profile hydration)
  - `src/providers/InAppAlertProvider` (in-app alerts)
  - `src/components/NotificationRuntimeBridge` (notification open -> route push + local reminder reconciliation)
  - `src/components/PushRegistrationBridge` (push token/installation sync on login/logout)
  - `react-native-toast-message` mounted at app scope
- deep-link handling in `app/_layout.tsx` explicitly parses `matchhai://oauth?...` callbacks and surfaces them via toast (FACEIT + Steam callback metadata)
- development-only global error suppression is in place for Expo keep-awake issues (LogBox + global error handler ignore `"Unable to activate keep awake"`)

### Important policy behavior

- email verification is not required to log in
- email verification is required later for high-value actions like matchrooms, teams, and challenges
- product policy is currently "soft auth, hard feature gate"

## 6. Core Data Model

### Main high-value tables in `convex/schema.ts`

- `users`
- `friendships`
- `userBlocks`
- `walletTransactions`
- `paymentTransactions`
- `matchrooms`
- `bookingIntents`
- `bookingRequests`
- `zoneOffers`
- `teams`
- `teamMembers`
- `teamChallenges`
- `teamChallengeChats`
- `teamChallengeChatMembers`
- `teamChallengeChatMessages`
- `zones`
- `pricingRules`
- `zoneAuditEvents`
- `zoneResources`
- `notifications`
- `pushDevices`
- `chatrooms`
- `chatroomMembers`
- `chatMessages`
- `chatTypingStatus`
- `reports`
- `psnTokenCache`

### High-value relationship map

- player actions create `notifications`, `bookingRequests`, `bookingIntents`, `reports`, `teamChallenges`
- zone actions update `bookingRequests`, `zoneOffers`, `matchrooms`, `zoneResources`, `pricingRules`
- super admin actions update `zones`, `users.role`, and `reports.status`
- matchroom and challenge chats are access-controlled, not public threads

### Identity model (Convex vs Better Auth)

This repo uses a dual-identifier setup that appears in multiple surfaces:

- **Convex user document id**: `users._id` (type `Id<"users">`) is the canonical id used by most tables (e.g. `teams.captainUid`, `notifications.toUid`, `friendships.userId`).
- **Better Auth user id**: stored as `users.authId` and used by Better Auth sessions/accounts. Client auth sessions return the Better Auth user id, then the app links to the Convex profile via `users.getByAuthId`.
- **Legacy string UID usage still present** in some tables/fields for compatibility (e.g. `chatrooms.participantUids`, `matchrooms.hostUid`, `matchrooms.playerUids`). Backend helpers frequently resolve “either Convex id or auth id” to keep these paths working.

## 7. Verified Product Surface Summary

### Player app

The player app is effectively a 3-tab product:

- Home
- Discover
- Profile

Important note:

- `matchrooms` and `teams` tab routes still exist, but they are hidden-tab legacy routes
- Discover is the canonical browse surface

### Zone admin app

The zone admin surface includes:

- dashboard home
- branches
- bookings
- resources
- pricing
- notifications
- support
- insights
- settings

### Super admin app

The super admin surface includes:

- overview
- venues moderation
- users role management
- reports moderation

## 8. Auth And Onboarding Flows

### Player login

Route: `app/auth/login.tsx`

Implemented behavior:

- login supports email or Pakistani mobile number
- user selects intended account mode: player or zone
- auth succeeds only if selected mode matches the fetched profile type
- phone login works by normalizing the number, finding the linked user record, then signing in with the underlying email

### Forgot password

Route: `app/auth/forgot-password.tsx`

Implemented behavior:

- user enters email
- Better Auth reset method is called when available
- if unavailable in the current version, the app exposes an explicit error state

### Verification required screen

Route: `app/auth/verification-required.tsx`

Implemented behavior:

- this screen is a product-level gate used when a user tries to access matchroom/team actions without a verified email
- provides:
  - resend verification email
  - a soft "continue to player home" affordance (browse-only posture)
- shared copy and alert wiring is centralized in:
  - `src/utils/emailVerificationGate.ts`
  - `src/services/convex/authService.ts`

### Player registration

Routes:

- `app/auth/register.tsx`
- `app/auth/register-step2.tsx`
- `app/auth/register-step3.tsx`
- `app/auth/register-step4.tsx`

Collected data:

- identity: full name, username, email, phone, password, city, age range
- preferences: preferred areas, enabled games, role/position preferences
- platform links: Steam, FACEIT, EA, Xbox, PSN-related data

Current UI behavior:

- all four player registration screens now use the same safe-area-aware internal page shell as newer in-app surfaces rather than the old auth-branded layout
- the MatchHai logo/halo treatment has been removed from registration; these screens now read as part of the core product system
- headings, subtitles, labels, spacing, and CTA placement were aligned to the same token-driven hierarchy used by the dashboard / discover / profile-era surfaces
- required labels use a registration-scoped shared label helper with a red `*` consistently across the flow
- city and age-range selectors now use the same modal / sheet presentation quality and spacing pattern as current MatchHai picker modals
- back navigation is now explicit route-to-route navigation using replace semantics instead of loose history-only back behavior

Execution behavior:

- availability checks remain in place for username / email / phone
- password strength enforcement remains in place
- onboarding data is still stored in Zustand between steps
- Continue CTA state is now reactively disabled until the required fields for the current step are valid
- step 2 treats Karachi areas and at least one esports or sports interest as the required gate to continue
- step 3 is intentionally optional; the temporary "Optional for now" card was removed and replaced by a first-class `Skip` action above the main Continue CTA
- step 4 review cards were simplified for scanability and cleaner grouping rather than dense key/value packing
- signup still creates or recovers the Better Auth user
- the Convex profile is still created if missing
- onboarding data is still finalized after auth / profile creation
- verification email is still attempted via Better Auth client API and remains a hard gate only when the user hits a gated action

### Zone registration

Routes:

- `app/auth/zone-register.tsx`
- `app/auth/zone-register-step2.tsx`
- `app/auth/zone-register-step3.tsx`
- `app/auth/zone-register-step4.tsx`

Collected data:

- business type
- owner and venue identity
- contact email and phone
- branch inventory and pricing
- branch list, location data, and per-branch setup

Current UI behavior:

- the zone onboarding flow now uses the same safe-area-aware internal shell, spacing rhythm, and typography hierarchy as the modern player-facing product surfaces
- the old MatchHai logo/halo auth treatment has been removed here as well
- required labels now use the same registration-scoped red-asterisk helper as player onboarding
- branch setup, inventory, and final review screens now use the same CTA placement and internal header / progress pattern as the rest of the registration flow

Execution behavior:

- zone step 1 Continue state is now correctly driven by required-field validity without the prior false-negative blocker after async contact checks
- the root blocker on zone step 1 was the contact availability status gate staying in a non-pass state after blur checks; the flow now blocks only while checking or when a value is actually taken, not on transient verification failure states
- Continue CTA state is now reactively disabled until each zone step's required data is valid:
  - step 1: business type, owner, brand, valid contact email, valid Pakistani phone, valid password
  - step 2: at least one branch added
  - step 3: at least one inventory type configured and every enabled inventory group has valid counts / prices
  - step 4: both required confirmations checked
- back navigation now supports step-to-step editing reliably with replace navigation and guard redirects that preserve the persisted onboarding store
- full progression from zone step 1 through steps 2-4 is reachable again after the blocker fix
- final submit still creates the auth account
- final submit still creates the zone with `pending-review` status
- zone admins are still routed into the zone dashboard immediately after submission
- the venue remains under moderation until super admin approval

### Better Auth + Convex runtime bridging details (important)

Server auth wiring (Convex):

- Better Auth is registered via `authComponent.registerRoutes(http, createAuth)` in `convex/http.ts`
- `convex/auth.ts` config highlights:
  - Resend-backed email sending when `RESEND_API_KEY` is configured (strict sender validation via `RESEND_FROM_EMAIL`)
  - `emailAndPassword.requireEmailVerification: false` (login is not blocked)
  - `emailVerification.sendOnSignUp: false` and `sendOnSignIn: false` (verification email is app-triggered, not automatically dispatched on every auth event)
  - phone OTP is currently a placeholder (`phoneNumber` plugin logs OTP to server console; no SMS transport wired yet)
  - `trustedOrigins` is explicitly enumerated to include Expo/dev URLs and the configured Convex site/app base URLs

Client auth <-> Convex session wiring:

- `src/providers/AuthenticatedConvexProvider.tsx` uses Better Auth session state to provide a Convex auth token via `authClient.convex.token()`
- the provider contains a "session snapshot" refresh path (manual `authClient.getSession()` on mount + app resume) to reduce UI getting stuck in a stale "signed out" state when the hook is behind app lifecycle events
- `src/context/AuthContext.tsx` independently hydrates the Convex user profile via `api.users.getByAuthId` using the Better Auth user id
- `src/hooks/useSessionRefreshPolling.ts` is used on high-value surfaces (e.g. player home) to poll `refreshSession` on focus (default `5000ms`) while the app is active

## 9. Player Surface Coverage

### Home dashboard

Route: `app/(player)/(tabs)/index.tsx`

Current functionality:

- profile summary
- notification count
- quick actions
- recommended matchrooms
- upcoming matchrooms
- teams snapshot
- nearby zones
- wallet/request stats
- resend verification
- logout

Backend summary driver (important):

- player home data is derived from `api.dashboard.getPlayerHomeSummary` (`convex/dashboard.ts`), including:
  - `upcomingRooms`: deduped from "hosted by me" + "rooms I joined", filtered for not-expired and sorted by start time; capped to 3
  - `recommendedRooms`: recent rooms filtered by "not mine, not already joined", optionally filtered by the user's enabled games; capped to 4
  - `nearbyZones`: currently a lightweight "active zones take(3)" (not true geo search)
  - `myTeams`: team memberships take(10) then fetch teams; capped to 3
  - `friendCount`: computed as "friends with `lastActiveAt` within 2 minutes" (requires client presence heartbeats to keep this accurate)
  - `walletStats`: derived from booking intents (paid vs pending amounts)
- local match reminders are reconciled from `upcomingRooms` at app scope via `src/components/NotificationRuntimeBridge` + `src/services/reminderManager.ts` (default: 15 minutes before start)

### Discover

Route: `app/(player)/(tabs)/discover.tsx`

Segments:

- matchrooms
- players
- teams
- zones

Supported filtering:

- shared search
- filters are now opened from the Discover filter button and rendered in a full-height drawer built on the shared `AppDrawer` pattern
- filter option chips are rendered in wrapped rows (no horizontal scrolling for filter choices)
- the inline filter panels were removed from the segment lists
- primary context selection also lives inside the drawer:
  - rooms -> game
  - players -> game
  - teams -> game
  - zones -> venue type
- active-filter badge count is computed for the active segment only

Current filter matrix:

- Matchrooms
  - game (in drawer): All, CS2, CS 1.6, Valorant, FC26, Tekken 8, Futsal, Cricket, Padel, Pickleball
  - area: Any + Karachi areas from `constants/profileOptions.ts`
  - timeline: Any, Today, Next 2-3 days, Next 1 week
  - availability: Any, Open Slots
  - price range: Any, Under PKR 500, PKR 500-1000, PKR 1000+
  - skill level: Any, Casual, Competitive, Pro / Tournament
  - game-specific filters (only shown when a specific game is selected):
  - CS2:
    - FACEIT level: Any, FACEIT 1-3, FACEIT 4-6, FACEIT 7-10
    - role: CS2 roles
    - series: Any, BO1, BO3, BO5
  - CS 1.6:
    - skill: Any, Beginner, Casual, Intermediate, Advanced, Pro, Elite
    - role: CS2 roles
    - series: Any, BO1, BO3, BO5
  - Valorant:
    - skill: Any, Beginner, Casual, Intermediate, Advanced, Pro, Elite
    - role: Valorant roles
    - series: Any, BO1, BO3, BO5
  - FC26:
    - format: values from `constants/matchConfig.ts` for FC26
    - series: Any, BO3, BO5, BO7, BO10
  - Tekken 8:
    - format: values from `constants/matchConfig.ts` for Tekken 8
    - series: Any, BO3, BO5, BO7, BO10
  - Futsal:
    - format: values from `constants/matchConfig.ts` for Futsal
    - position: futsal positions
  - Cricket (`indoor_cricket`):
    - role: indoor cricket roles
    - series: Any, BO3
    - overs: Any, 5, 6
  - Padel:
    - role: padel roles
    - series: Any, BO3, BO5, BO10
  - Pickleball:
    - format: values from `constants/matchConfig.ts` for Pickleball
    - role: pickleball roles
    - series: Any, BO3, BO5, BO10

- Players
  - game (in drawer): All, CS2, CS 1.6, Valorant, FC26, Tekken 8, Futsal, Cricket, Padel, Pickleball
  - availability: Any, Online Now
  - area: Any + Karachi areas
  - competitive intent: Any, Casual, Competitive
  - game-specific filters (only shown when a specific game is selected):
  - CS2:
    - skill: Any, FACEIT 1-3, FACEIT 4-6, FACEIT 7-10
    - role: CS2 roles
  - CS 1.6:
    - skill: Any, Beginner, Casual, Intermediate, Advanced, Pro, Elite
    - role: CS2 roles
  - Valorant:
    - skill: Any, Beginner, Casual, Intermediate, Advanced, Pro, Elite
    - role: Valorant roles
  - Futsal:
    - position: futsal positions
  - Cricket (`indoor_cricket`):
    - role: indoor cricket roles
  - Padel:
    - role: padel roles
  - Pickleball:
    - role: pickleball roles
  - FC26 / Tekken 8:
    - platform: Any, PS5, Xbox, PS5 + Xbox

- Teams
  - mode toggle remains inline on the page: Browse / My Teams
  - game (in drawer): All, CS2, CS 1.6, Valorant, FC26, Tekken 8, Futsal, Cricket, Padel, Pickleball
  - Browse mode:
    - availability: All, Recruiting Now
    - area: Any + Karachi areas
    - team size: Any, 1-2 players, 3-5 players, Full Team
    - competitive intent: Any, Casual, Competitive, Tournament-focused (currently mapped to `teams.competitiveLevel` when present)
  - My Teams mode:
    - keeps filtering intentionally minimal and currently only retains game selection in the drawer

- Zones / Venues
  - venue type: All Venues, Gaming Zones, Sports Courts
  - proximity: Any, Same Area, Same City
  - area: Any + Karachi areas
  - price range: Any, Under PKR 1000, PKR 1000-2000, PKR 2000+
  - Gaming Zones only:
    - game: All, CS2, CS 1.6, Valorant, FC26, Tekken 8
    - FC26 / Tekken 8:
      - platform: Any, PS5, Xbox, PS5 + Xbox
  - Sports Courts only:
    - sport: All, Futsal, Cricket, Padel, Pickleball

Floating actions:

- rooms -> create matchroom
- teams -> create team

Navigation + gating detail:

- the player tab shell can be hidden via `EXPO_PUBLIC_HIDE_TAB_BAR=1` (`app/(player)/(tabs)/_layout.tsx`)
- Discover tab link is hard-hidden when email is unverified (`Tabs.Screen name="discover" -> options.href = null`)
- matchrooms/teams remain present as hidden tab routes (`href: null`) and are used as compatibility/legacy entry points

### Profile

Route: `app/(player)/(tabs)/profile.tsx`

Current functionality:

- profile card
- connected platform cards
- active and inactive game cards
- skills and team summaries
- shortcuts into edit profile, game details, my teams, matchrooms, team creation

### Edit profile

Route: `app/(player)/profile/edit.tsx`

Implemented actions:

- update username
- update phone
- update email
- update password
- update bio, city, areas, privacy settings
- manage platform links
- validate Steam and FACEIT URLs
- verify PSN profile

### Game details editor

Route: `app/(player)/profile/game-details.tsx`

Implemented actions:

- enable or update a game
- set game-specific metadata such as roles, formations, positions, characters
- save self-assessment
- write skill score into `users.skillScores`

### Public profile

Route: `app/(player)/profile/[uid].tsx`

Implemented actions:

- view another player
- send friend request
- inspect supported external stat surfaces
- submit user report

### Friends

Route: `app/(player)/friends.tsx`

Implemented actions:

- list friends
- open public profiles

### Inbox

Route: `app/(player)/inbox.tsx`

This is one of the most workflow-heavy screens in the app.

Handled notification families include:

- friend requests
- team join requests
- match join requests
- team invites
- booking approvals
- seat invitations
- counter-offers
- challenge notifications

Implemented actions include:

- accept/decline request types
- open linked entities
- mark read
- mark all read
- clear history
- delete notification

### Wallet

Route: `app/(player)/wallet.tsx`

Implemented actions:

- view wallet balance
- add funds
- inspect booking/payment-related history

Backend accounting reality (code-verified):

- wallet history is a merged stream of:
  - `walletTransactions` (internal wallet ledger)
  - `paymentTransactions` (gateway lifecycle, currently Easypaisa)
- `convex/wallet.ts` links gateway rows into wallet rows by reference format:
  - `easypaisa:<orderRefNum>`
- `wallet.addFunds` supports idempotency when a `reference` is provided (dedupe via `walletTransactions.by_reference`)
- `wallet.deductFunds` is strict: insufficient funds throws and the UI surfaces "add funds from Wallet"

Current payment reality:

- wallet payments are enabled
- card payments are present in UI shape but feature-flagged off

### Schedule

Route: `app/(player)/schedule.tsx`

Implemented behavior:

- view upcoming and past participation
- match reminders are scheduled and deduped using Expo local notifications:
  - persisted reminder map in AsyncStorage key `local_notifications.matchroom_reminders.v2`
  - scheduling uses `expo-notifications` with `data.href`/`data.route` pointing at `/matchrooms/<id>` (15-minute default, clamped 0-120 minutes)

### Chats

Route: `app/(player)/chatrooms.tsx`

Implemented behavior:

- list matchroom chats
- list challenge chats
- list friend DMs (direct messages)
- open target chat thread

Chat entry routes (current):

- matchroom chat: `/matchrooms/chat/[id]` (accepts matchroom id or matchroom code)
- challenge chat: `/teams/challenge-chat?id=<challengeId>`
- friend DM: `/(player)/friend-chat/[friendId]`

Chat thread capabilities (shared UI in `src/features/chat/ChatThread.tsx`):

- message types: text, voice (record + playback), image, file
- attachments are picked via `expo-image-picker` + `expo-document-picker` and uploaded to Convex storage (`src/services/convex/storageService.ts`)
- reactions: toggled from a fixed emoji set (client) and stored per-message as an array of `{ emoji, userId, createdAt }`
- swipe-to-reply uses `react-native-gesture-handler` + `react-native-reanimated` and haptic feedback (`expo-haptics`)
- edit window: enforced server-side for text messages only, within 15 minutes (voice cannot be edited)
- pinned messages:
  - matchroom chats: any participant can pin/unpin (cap: 5 pinned)
  - challenge chats: captain-only pin/unpin (cap: 5 pinned)

Typing + presence:

- typing indicator is backed by `chatTypingStatus` (`convex/chat.ts`), with a 4s freshness window and a 1s client debounce (`src/hooks/useChatTyping.ts`)
- presence heartbeat runs on key screens (`src/hooks/usePresenceHeartbeat.ts`):
  - `users.touchPresence` on mount/foreground and every 60s while active
  - `users.goOffline` on background

Direct-message access rules (server-enforced):

- DM chatroom creation is deduped by `chatrooms.dmPairKey` (sorted `userId_friendId`)
- DM access requires a friendship record and is blocked when either side has a `userBlocks` entry (`convex/friendChat.ts`)
- "delete for me" (soft delete) exists for DM messages only (`friendChat.deleteForMe` sets `chatMessages.deletedFor[]`)
- full deletion is disabled for matchroom chat (`chat.deleteMessage` throws)

### Reports

Routes:

- `app/(player)/reports.tsx`
- `app/(player)/report/[id].tsx`

Implemented behavior:

- list user-submitted reports
- inspect report status timeline

### Zone detail

Route: `app/(player)/zones/[id].tsx`

Implemented behavior:

- view zone profile, branches, and pricing context
- submit zone complaint

## 10. Matchroom Flows

### Browse and open

Entry points:

- Discover rooms segment
- profile shortcuts
- inbox deep-links
- hidden legacy route redirects

### Create matchroom

Route: `app/matchrooms/create/index.tsx`

This is one of the largest and most complex screens in the repo.

Major configurable dimensions:

- game
- title and description
- format
- date and time
- duration
- location mode: zone or broadcast
- zone selection
- team mode: solo or team
- reserved slots
- game-specific fields like maps, formations, characters, overs, series, positions

Pre-submit gates:

- verified email
- game enabled in profile
- usable skill score or questionnaire completion
- zone selection where required
- valid team assignments where required
- zone scheduling constraint (server-enforced): when `locationMode === "zone"` the tuple `(zoneId, game, scheduledStartAt)` must be unique across non-terminal matchrooms

Creation outcomes:

- direct `createMatchroom`
- `createBookingRequest` for zone-admin-mediated cases
- `createZoneWalkInMatchroom` for venue walk-ins

Operational notes:

- matchrooms support an optional `matchCode` field (indexed) used for lookup/dedup and is leveraged by demo seeding (`DEMO_MR###`)

### Join matchroom

Key logic areas:

- `src/hooks/useMatchroomJoinFlow.tsx`
- `src/services/convex/matchService.ts`
- `convex/matchrooms.ts`

Current gates:

- authenticated
- email verified
- room not expired
- room not locked/full
- not already in room
- no duplicate pending request
- no conflicting active time clash
- game enabled in profile
- valid stored skill score for the room game
- email verification is enforced at the mutation boundary (server-side) for matchroom and team actions (`convex/matchrooms.ts` uses an explicit `requireVerifiedActor` gate; the client "soft gate" is not the only line of defense)
- join gating is game-aware:
  - joining fails if the user has not enabled the game in their profile
  - joining fails if the user is missing a required skill setup for the game
- skill-band joining is enforced with a fixed delta (`SKILL_JOIN_DELTA = 10` rating points) and may route into a captain-approval flow when out-of-range (implemented via notifications + join decision mutation)

Possible outcomes:

- direct join
- request sent for captain approval
- booking intent path followed

### Matchroom detail

Route: `app/matchrooms/[id].tsx`

Implemented actions:

- send join request
- cancel join request
- accept/reject incoming requests
- leave room
- delete room when allowed
- start match
- open chat
- share
- report/complain
- transfer captain
- invite friend into slot
- kick player
- admin force-cancel
- linked booking/counter-offer handling

### Booking and seat reservation

Route: `app/matchrooms/book/[id].tsx`

Implemented actions:

- choose side
- choose team for prefilling
- select slot positions
- create booking intent
- route into payment/status

### Pay for booking intent

Route: `app/matchrooms/book/pay/[intentId].tsx`

Implemented actions:

- fetch intent
- fetch wallet balance
- pay with wallet
- start Easypaisa checkout for booking intents (gateway action -> status polling/return)

Current reality:

- card payment is explicitly unavailable
- successful wallet payment confirms booking through matchroom payment mutation
- the backend payment mutation supports both wallet deduction and externally-referenced payments:
  - `convex/matchrooms.payMatchroomSeatIntent(intentId, externalPaymentReference?)`
  - wallet path creates a `walletTransactions` withdrawal with reference `matchroom_slot_<matchroomId>_<slotId>`
  - external path creates a `walletTransactions` row of type `booking_payment` with `reference = externalPaymentReference` and provider metadata (currently `easypaisa`)
- Easypaisa is wired as the external gateway path (staging/production env driven) via Convex HTTP routes:
  - `/payments/easypaisa/checkout`
  - `/payments/easypaisa/token`
  - `/payments/easypaisa/finalize`
  - `/payments/easypaisa/ipn`
- Easypaisa booking payments return to the app via scheme deep-link:
  - `matchhai://matchrooms/book/status/<intentId>`
  (see `convex/easypaisa.ts` `buildAppReturnUrl()`)

### Booking status

Route: `app/matchrooms/book/status/[intentId].tsx`

Implemented actions:

- inspect approval and payment progress
- continue to pay if approved and pending payment
- open linked matchroom
- cancel unpaid intent

### Match result

Route: `app/matchrooms/result.tsx`

Implemented behavior:

- captain submits winner

### Participant vote

Route: `app/matchrooms/vote.tsx`

Implemented behavior:

- participant votes winner or unknown when dispute flow opens

### Match chat

Route: `app/matchrooms/chat/[id].tsx`

Implemented capabilities:

- access checks
- get or create chatroom
- list messages
- send text
- send voice
- reply
- mark read
- delete for self

Access states handled:

- ok
- unauthenticated
- forbidden
- not found

## 11. Team Flows

### Create team

Route: `app/teams/create.tsx`

Implemented actions:

- choose game
- enter team name, tag, max size
- create team
- optionally invite eligible same-game friends

### My teams

Route: `app/(player)/my-teams.tsx`

Implemented actions:

- list teams
- open team
- create team

### Team detail

Route: `app/teams/[id].tsx`

Implemented actions for non-members:

- request to join

Implemented actions for members:

- leave team

Implemented actions for captains:

- review join requests
- accept/reject join requests
- rename team
- upload/change logo
- invite friends
- remove member
- transfer captain
- delete team
- launch challenge creation

### Team challenges

Routes:

- `app/teams/challenges.tsx`
- `app/teams/challenge-create.tsx`
- `app/teams/challenge.tsx`
- `app/teams/challenge-chat.tsx`

Implemented behavior:

- select challenger team
- load opponent
- both teams must be full
- choose date/time and preferred zone
- send challenge notification
- accept or reject challenge
- propose venue
- create private challenge matchroom when both captains align
- captain chat unlocks after acceptance and valid state

## 12. Social, Reporting, And Notification Flows

### Friend lifecycle

Backend driver:

- `convex/social.ts`

Implemented actions:

- send friend request
- accept/reject friend request
- remove friend
- block user
- unblock user

Direct-message enforcement:

- DM creation/access is server-enforced to require an existing friendship, and blocks are honored bi-directionally (`convex/friendChat.ts` reads `friendships` + `userBlocks`)

### Reports lifecycle

Backend driver:

- `convex/reports.ts`

Implemented report types:

- matchroom complaint
- user report
- zone complaint

Important behavior:

- duplicate suppression exists
- player can view their own reports
- zone admins can view venue-scoped reports
- super admins can globally moderate report status

### Notifications lifecycle

Backend driver:

- `convex/notifications.ts`

Notification families include:

- friend requests
- team invites
- team join requests and decisions
- matchroom invites
- match join requests
- booking updates
- seat approvals
- counter-offers
- challenge notifications

Operational mechanics (important for inbox correctness):

- canonical notifications are stored in `notifications` with dedupe fields like `entityKey` / `dedupeKey` and are indexed by `toUid`, `fromUid`, and `matchroomId`
- push delivery state is tracked on the notification record (`pushPolicy`, `pushState`, `pushError`, timestamps) when push is eligible
- device tokens / installations are stored in `pushDevices` (Expo push), and delivery is driven by `convex/pushNotifications*.ts`
- most notifications include a `route` or `data.href` used by the client to deep-link into the correct screen (inbox, matchroom detail, team detail, etc.)

Canonicalization + dedupe reality (code-verified):

- notification types are canonicalized in `convex/notifications.ts` (legacy aliases are normalized into dotted families):
  - `friend_request` -> `social.friend_request`
  - `team_invite` -> `team.invite`
  - `team_join_request` -> `team.join_request`
  - `match_join_request` -> `match.join_request`
  - `match_seat_invitation` -> `match.seat_invite`
  - `booking_update` -> `booking.request_submitted` (and related booking lifecycle types)
  - `match_cancelled_admin` -> `match.cancelled`
- dedupe behavior is selectable per-notification:
  - `upsert_active`: updates an existing active notification (preferred for “pending” requests)
  - `replace_active`: archives the previous active item and inserts a new one
  - `versioned_new`: always inserts (used when a full history is desired)
- push state machine is tracked directly on the notification:
  - `pushPolicy`: `none | eligible | force`
  - `pushState`: `pending | sent | failed | skipped`
  - timestamps: `pushAttemptedAt`, `pushDeliveredAt`, plus `pushError` when failed/skipped

Push registration + delivery (end-to-end):

- client registration runs in `src/components/PushRegistrationBridge.tsx`:
  - per-installation id stored in AsyncStorage key `push_registration.installation_id.v1`
  - token is retrieved via `Notifications.getExpoPushTokenAsync({ projectId })` (requires EAS project id discovery)
  - web is explicitly treated as “disabled” and deactivates the installation server-side
- server device table is `pushDevices` (`convex/pushNotifications.ts`):
  - `isActive` is derived from `permissionStatus === "granted"` plus a non-empty `expoPushToken`
  - deactivation is keyed by `installationId`
- push sending is executed in a Node action (`convex/pushNotificationsActions.ts`) against Expo’s push endpoint:
  - deep-link payload always includes both `href` and `route` for client routing
  - invalid tokens deactivate the device when Expo returns `DeviceNotRegistered`

Notification open routing + local reminder dedupe:

- `src/components/NotificationRuntimeBridge.tsx`:
  - dedupes notification response handling via AsyncStorage key `notifications.lastHandledResponse.v1` (prevents double-routing on cold start + tap)
  - routes by `data.route` or `data.href`
  - configures local notifications and reconciles scheduled match reminders when app becomes active

### Notification Trigger Matrix

This section reflects the live notification system after the role-correct redesign implemented in code. It covers server-created inbox rows, push fanout behavior, push-only chat notifications, and device-local reminders.

Core mechanics:

- Canonical inbox notifications are created through `internal.notifications.createCanonicalFromServer` in `convex/notifications.ts`.
- Unless `pushPolicy: "none"` is passed, inbox creation schedules push delivery through `internal.pushNotificationsActions.sendForNotification`.
- Dedupe semantics remain:
  - `upsert_active`: one active task per entity; patches the active row and does not emit a fresh push when merely patched
  - `replace_active`: archives the old active row and creates a fresh replacement outcome row
  - `versioned_new`: creates timeline/history rows
- Push-only chat notifications still bypass inbox rows and use `pushNotificationsActions.sendChatPush`.
- Local match reminders are still client-managed by `NotificationRuntimeBridge` plus `reminderManager`.

#### 1. Current Implemented Notification Triggers (Code-Verified)

Auth & account:

- `zone.registration_submitted`
  - Producer: `convex/zones.ts` `create`
  - Recipient: zone owner
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/zone/(tabs)/profile`
  - Dedupe: `replace_active`

- `zone.status_updated`
  - Producer: `convex/admin.ts` `setZoneStatus`
  - Recipient: zone owner
  - Fires on: `pending-review`, `approved_pending_migration`, `active`, `rejected`, `suspended`
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/zone/(tabs)/profile`
  - Dedupe: `replace_active`

- `account.role_changed`
  - Producer: `convex/admin.ts` `setUserRole`
  - Recipient: affected user
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/profile`
  - Dedupe: `replace_active`

- Email/UI only, not inbox:
  - verification attempts/resends
  - password reset requests
  - verification-required auth gate failures

Social:

- `social.friend_request`
  - Producer: `convex/social.ts` `sendFriendRequest`
  - Recipient: requested player
  - Lane: action required
  - Delivery: inbox + push eligible
  - Route: `/(player)/inbox`
  - Dedupe: `upsert_active`
  - Expiry: 7 days

- `social.friend_request_result`
  - Producer: `convex/social.ts` `respondFriendRequest`
  - Recipient: original sender
  - Fires on: accepted, rejected
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/(player)/inbox`
  - Dedupe: `replace_active`

Teams:

- `team.invite`
  - Producer: `convex/teams.ts` `inviteToTeam`
  - Recipient: invited player
  - Lane: action required
  - Delivery: inbox + push eligible
  - Route: `/teams/<teamId>`
  - Dedupe: `replace_active`
  - Expiry: 7 days

- `team.invite_response`
  - Producer: `convex/teams.ts` `respondToTeamInvite`
  - Recipient: captain/inviter
  - Fires on: accepted, declined
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/teams/<teamId>`
  - Dedupe: `replace_active`

- `team.join_request`
  - Producer: `convex/teams.ts` `requestToJoinTeam`
  - Recipient: team captain
  - Lane: action required
  - Delivery: inbox + push eligible
  - Route: `/teams/<teamId>`
  - Dedupe: `upsert_active`
  - Expiry: 7 days

- `team.join_request_decision`
  - Producer: `convex/teams.ts` `respondToJoinRequest`
  - Recipient: requester
  - Fires on: accepted, rejected
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/teams/<teamId>`
  - Dedupe: `replace_active`

- `team.member_removed`
  - Producer: `convex/teams.ts` `removeMember`
  - Recipient: removed member
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/teams`
  - Dedupe: `versioned_new`

- `team.captain_transferred`
  - Producer: `convex/teams.ts` `transferCaptain`
  - Recipients: new captain, previous captain
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/teams/<teamId>`
  - Dedupe: `versioned_new`

- `team.deleted`
  - Producer: `convex/teams.ts` `remove`
  - Recipients: captain and members
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/teams`
  - Dedupe: `versioned_new`

Team challenges:

- `team.challenge_received`
  - Producer: `convex/teamChallenges.ts` `create`
  - Recipient: challenged captain
  - Lane: action required
  - Delivery: inbox + push eligible
  - Route: `/teams/challenge?id=<challengeId>`
  - Dedupe: `upsert_active`

- `team.challenge_updated`
  - Producer: `convex/teamChallenges.ts` `respond`, `proposeVenue`
  - Recipient: the other captain
  - Lane: feed/history
  - Delivery: inbox + push eligible
  - Route: `/teams/challenge?id=<challengeId>`
  - Dedupe: `versioned_new`
  - Note: challenge flow still uses one general update family rather than split explicit outcome types.

Matchrooms:

- `match.seat_invite`
  - Producer: `convex/matchrooms.ts` `inviteToMatchroom`
  - Recipient: invited player
  - Lane: action required
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `replace_active`
  - Expiry: 2 days

- `match.invite_response`
  - Producer: `convex/matchrooms.ts` `respondToMatchroomInvite`
  - Recipient: inviter/captain
  - Fires on: accepted, declined
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `replace_active`

- `match.payment_required`
  - Producers:
    - `convex/matchrooms.ts` `respondToMatchroomInvite` when invitee accepts
    - `convex/matchrooms.ts` `respondToMatchroomJoinRequest` when approval completes
  - Recipient: player who must pay
  - Lane: action required
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `upsert_active`
  - Expiry: 15 minutes

- `match.join_request`
  - Producer: `convex/matchrooms.ts` `requestToJoinMatchroom` for out-of-range approval flow
  - Recipients: available captains
  - Lane: action required
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `upsert_active`
  - Expiry: 1 day

- `match.join_request_result`
  - Producer: `convex/matchrooms.ts` `respondToMatchroomJoinRequest`
  - Recipient: requester
  - Fires on: rejected
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `replace_active`
  - Note: acceptance is conveyed by `match.payment_required`, which is now the explicit next-step outcome.

- `match.payment_result`
  - Producers:
    - `convex/matchrooms.ts` `payMatchroomSeatIntent` for successful slot confirmation and local expiry closures
    - `convex/easypaisa.ts` `applyProviderUpdate` for external-payment failed/expired outcomes
  - Recipient: paying player
  - Fires on: paid, failed, expired
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>` or inbox fallback for provider-side closure
  - Dedupe: `replace_active`

- `match.participant_removed`
  - Producer: `convex/matchrooms.ts` `kickFromMatchroom`
  - Recipient: removed participant
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `replace_active`

- `match.captain_transferred`
  - Producer: `convex/matchrooms.ts` `transferMatchroomCaptain`
  - Recipients: new captain and previous captain
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `replace_active`

- `match.cancelled`
  - Producers:
    - `convex/matchrooms.ts` `adminCancel`
    - `convex/matchroomBroadcast.ts` `finalizeBroadcastFailure`
  - Recipients: all participants
  - Lane: status update
  - Delivery: inbox + forced push
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `replace_active` in broadcast cancellation, `upsert_active` in admin cancel fanout

Broadcast matchrooms:

- `booking.request_submitted`
  - Producer: `convex/matchroomBroadcast.ts` `dispatchBroadcastZoneRequestsForMatchroom`
  - Recipient: each eligible targeted zone owner
  - Lane: action required
  - Delivery: zone inbox + push eligible
  - Route: `/zone/modules/bookings?segment=requests&requestId=<requestId>`
  - Dedupe: `replace_active`
  - Expiry: 2 hours

- `booking.counter_offer`
  - Producer: `convex/zoneAdminBooking.ts` `sendCounterOffer`
  - Recipients: resolved captains/requester set
  - Lane: action required
  - Delivery: inbox + push eligible
  - Route: `/(player)/inbox`
  - Dedupe: `upsert_active`
  - Expiry: usually 30 minutes in broadcast flow

- `booking.counter_offer_result`
  - Producers:
    - `convex/zoneAdminBooking.ts` `respondToCounterOffer`
    - `convex/matchroomBroadcast.ts` `expireBroadcastCounterOfferInternal`
  - Recipient: zone owner
  - Fires on: accepted, rejected, expired
  - Lane: status update
  - Delivery: zone inbox + push eligible
  - Route: `/zone/modules/bookings?segment=requests&requestId=<requestId>`
  - Dedupe: `replace_active`

- `booking.request_closed_elsewhere`
  - Producer: `convex/matchroomBroadcast.ts` `confirmBroadcastVenue`
  - Recipient: losing zone owner
  - Fires on: another zone wins first
  - Lane: status update
  - Delivery: zone inbox + push eligible
  - Route: `/zone/modules/bookings?segment=requests&requestId=<requestId>`
  - Dedupe: `replace_active`

- `operations.general` "Counter-offer expired"
  - Producer: `convex/matchroomBroadcast.ts` `expireBroadcastCounterOfferInternal`
  - Recipients: captains only
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `replace_active`

- `operations.general` "Venue confirmed"
  - Producer: `convex/matchroomBroadcast.ts` `confirmBroadcastVenue`
  - Recipients: all participants
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `replace_active`

- `operations.general` "Refund completed"
  - Producer: `convex/matchroomBroadcast.ts` `finalizeBroadcastFailure`
  - Recipients: all participants
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `replace_active`

Zone admin booking operations:

- `booking.request_submitted`
  - Producer: `convex/bookings.ts` `notifyZoneOwnerOfRequest`
  - Recipient: zone owner for direct booking
  - Lane: action required
  - Delivery: zone inbox + push eligible
  - Route: `/zone/modules/notifications`
  - Dedupe: `upsert_active`

- `booking.request_accepted`
  - Producer: `convex/zoneAdminBooking.ts` `acceptBookingRequest`
  - Recipient: requester
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/matchrooms/<matchroomId>`
  - Dedupe: `replace_active`

- `booking.request_rejected`
  - Producer: `convex/zoneAdminBooking.ts` `rejectBookingRequest`
  - Recipient: requester
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/(player)/inbox`
  - Dedupe: `replace_active`

- `resource.allocation_action`
  - Producer: `convex/zoneAdminResources.ts` `allocateResourcesForRequest`
  - Recipient: requester
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/(player)/inbox`
  - Dedupe: `replace_active`

Reports & moderation:

- `moderation.report_submitted`
  - Producer: `convex/reports.ts` `insertReport`
  - Recipients:
    - reporter gets "report received"
    - zone owner gets "venue complaint submitted" when `zoneId` exists
  - Lane: status update for reporter, action/status visibility for zone owner
  - Delivery: inbox + push eligible
  - Routes:
    - reporter -> `/(player)/reports`
    - zone owner -> `/zone/modules/support?reportId=<reportId>`
  - Dedupe: `replace_active`

- `moderation.review_needed`
  - Producers:
    - `convex/reports.ts` `insertReport`
    - `convex/zones.ts` `create`
  - Recipients: super admins
  - Lane: action required
  - Delivery: inbox + push eligible
  - Routes:
    - report review -> `/super-admin/report/<reportId>`
    - zone review -> `/super-admin`
  - Dedupe: `upsert_active`

- `moderation.report_updated`
  - Producers:
    - `convex/reports.ts` `markZoneReportReviewed`
    - `convex/admin.ts` `setReportStatus`
  - Recipient: reporter
  - Fires on: reviewed, resolved, returned to pending
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/(player)/reports`
  - Dedupe: `replace_active`

Wallet / payments / refunds:

- `wallet.topup_result`
  - Producer: `convex/easypaisa.ts` `applyProviderUpdate`
  - Recipient: wallet owner
  - Fires on: paid, failed, expired
  - Lane: status update
  - Delivery: inbox + push eligible
  - Route: `/wallet`
  - Dedupe: `replace_active`

- Broadcast refunds remain visible through:
  - wallet balance changes in `walletTransactions`
  - participant-facing `operations.general` "Refund completed"

Timers / expiries / reminders:

- Server timers:
  - broadcast fanout expiry: `internal.matchroomBroadcast.expireBroadcastFanout`
  - broadcast counter-offer expiry: `internal.matchroomBroadcast.expireBroadcastCounterOffer`
  - notification staleness filtering via `expiresAt`
- Local reminders:
  - `NotificationRuntimeBridge` + `reconcileUpcomingMatchReminders`
  - player-only, device-local, route to `/matchrooms/<roomId>`

Push-only (no inbox row):

- `chat_message`
  - Producer: `convex/pushNotificationsActions.ts` `sendChatPush`
  - Triggered by matchroom chat, friend chat, and challenge chat sends
  - Recipient: other chat participants, respecting mute state
  - Lane: realtime interrupt
  - Delivery: push only

#### 2. Missing / Incorrect / Risky Trigger Areas (Post-Redesign Audit)

Intentional post-redesign deferrals (explicitly deferred, not accidental omissions):

- Challenge flow still uses broad `team.challenge_updated` history items instead of explicit accepted/rejected/venue-confirmed outcome families.
- Verification email sent/resend and password reset remain email/UI flows only (no inbox notifications by design).
- Refund lifecycle exposes refund completion more clearly than refund initiation (no dedicated "refund initiated" notification yet).

Other remaining gaps (not deferred by product policy, but not addressed in this phase):

- Direct-booking request expiry and generic request-timeout notifications for zone admins are still not consistently emitted.
- Wallet debits for successful slot payments are recorded in wallet history, but there is no separate wallet-only inbox family beyond payment outcomes.
- Reporter follow-up is implemented, but implicated users/venues are still intentionally not notified for most moderation state changes.

Known behavioral risks:

- `upsert_active` still does not resend push when a pending task is merely patched. This is correct by implementation but should be kept in mind when product expects a fresh interrupt.
- Broadcast participant fanout in `matchroomBroadcast.ts` still depends on `room.playerUids` being resolvable as Convex user ids. If auth ids leak into that field, some participant notifications can still be skipped.
- Some routes remain conservative fallbacks (`/super-admin`, `/(player)/inbox`) where the app does not yet have a more specific detail route.

#### 3. Recommended Notification Policy

Canonical lane model:

- Action required:
  - inbox task
  - push eligible
  - one active task per entity via `upsert_active` or `replace_active`
- Status update:
  - explicit success, rejection, cancellation, expiry, moderation, or money outcome
  - inbox by default
  - push only when urgent or trust-critical
  - usually `replace_active`
- Reminder / time-based:
  - use device-local reminders for player schedule prompts
  - use push only for operational deadlines that matter immediately
  - avoid normal inbox rows unless state changes on expiry
- Feed / history:
  - audit/trail items
  - mostly `versioned_new`
  - limited push

Delivery rules:

- Push:
  - action-required tasks
  - payment required
  - payment failed/expired
  - match cancelled
  - venue confirmed
  - super-admin review-needed tasks
- Inbox:
  - all actionable tasks
  - decisive outcomes
  - moderation lifecycle
  - money lifecycle
- Local reminder:
  - match starting soon
  - optional deadline warnings if the app later decides to separate them from inbox
- Email:
  - verification
  - password reset
  - zone approval/rejection/suspension/reactivation if email templates are later added

Dedupe policy:

- `upsert_active`
  - friend request received
  - join request pending
  - payment required
  - booking request pending
  - review needed
- `replace_active`
  - request accepted/rejected
  - venue confirmed
  - payment paid/failed/expired
  - refund completed
  - zone status updates
- `versioned_new`
  - challenge update history
  - audit/security history
  - optional future moderation timeline

Critical design rule:

- Never rely only on patching a pending task if the user expects a distinct outcome message. The redesigned code now follows that rule for friend requests, team invites, team join requests, match join rejections, seat-invite outcomes, report lifecycle, zone review, and payment lifecycle.

#### 4. Canonical Notification Rules By Role

Player:

- Should receive:
  - friend request received
  - friend request accepted/rejected
  - team invite received
  - team join accepted/rejected when they are the requester
  - seat invite received
  - payment required
  - payment paid/failed/expired
  - booking accepted/rejected
  - venue confirmed
  - match cancelled
  - refund completed
  - report received/reviewed/resolved
- Should not receive:
  - zone-admin internal work steps
  - captain-only broadcast negotiations
  - generic moderation internals that do not affect them

Captain / host:

- Should receive:
  - team join request received
  - match join approval needed
  - challenge received
  - challenge updates
  - counter-offer received
  - counter-offer expired
  - invite responses and roster-impacting outcomes
- Should not receive:
  - every participant-facing money event unless they are the paying player
  - venue-internal admin noise

Zone admin:

- Should receive:
  - zone registration submitted confirmation
  - zone approved/rejected/suspended/reactivated
  - direct booking request received
  - broadcast-area request received
  - counter-offer accepted/rejected/expired
  - request closed because another zone won
  - venue complaint/report submitted
- Should not receive:
  - player social/team workflow noise
  - captain-only negotiation chatter

Super admin:

- Should receive:
  - new zone pending review
  - new report/review-needed moderation queue work
  - reconciliation failures that need admin attention
- Should not receive:
  - routine player workflow events
  - normal venue booking operations

Money-event rule:

- Money must never fail silently. Paid, failed, expired, and refund-completed states should always be visible to the affected user.

Reminder rule:

- Reminders should stay mostly local/device-side unless missing the deadline changes state or requires urgent intervention.

## 13. Zone Admin Surface Coverage

### Zone home

Route: `app/zone/(tabs)/index.tsx`

Shows:

- queue pressure
- notifications
- matchroom summaries
- branch/resource metrics
- module shortcuts

### Branches

Routes:

- `app/zone/(tabs)/branches.tsx`
- `app/zone/branch/new.tsx`
- `app/zone/branch/[id].tsx`

Implemented behavior:

- list branches
- add branch
- inspect branch detail

Known limitation:

- editing non-primary branches is still incomplete

### Bookings module

Route: `app/zone/modules/bookings.tsx`

Segments:

- requests
- matchrooms
- walk-ins

Implemented actions:

- accept request
- reject request
- send counter-offer
- create walk-in
- inspect linked matchrooms and requests

This is the strongest admin module currently in the zone surface.

### Resources module

Route: `app/zone/modules/resources.tsx`

Implemented behavior:

- branch-aware resource management
- per-branch resource subscriptions
- lifecycle/status updates
- allocation behavior
- grouping by PCs, consoles, and courts

Critical note:

- this module still supports legacy fallback when migration has not converged

### Pricing module

Route: `app/zone/modules/pricing.tsx`

Implemented behavior:

- create pricing rule
- choose branch scope
- choose asset type
- enable/disable
- delete

Critical note:

- pricing usefulness depends on branch/resource migration readiness

### Support module

Route: `app/zone/modules/support.tsx`

Implemented behavior:

- venue-scoped report list
- report detail
- mark reviewed

### Insights module

Route: `app/zone/modules/insights.tsx`

Implemented behavior:

- KPI-like summaries derived from queue, matchrooms, branches, and resources

### Notifications module

Route: `app/zone/modules/notifications.tsx`

Implemented behavior:

- admin notification list
- mark read
- clear all
- route into bookings/resources-related operations

### Settings module

Route: `app/zone/modules/settings.tsx`

Important reality:

- this is primarily a migration and repair surface, not a fully realized venue settings product

## 14. Super Admin Surface Coverage

### Dashboard and moderation tabs

Route: `app/super-admin/(tabs)/index.tsx`

Implemented areas:

- overview metrics
- venue moderation
- user role management
- report moderation

### Venue request detail

Route: `app/super-admin/request/[id].tsx`

Implemented actions:

- approve
- reject
- suspend
- reactivate

Operational impact:

- approval may trigger branch migration if the zone still uses the legacy branch model

### Report detail

Route: `app/super-admin/report/[id].tsx`

Implemented actions:

- set `pending`
- set `reviewed`
- set `resolved`

### Easypaisa operations / debug surface

Route: `app/super-admin/easypaisa.tsx`

Backend modules:

- `convex/easypaisa.ts`
- `convex/easypaisaNode.ts`
- `convex/easypaisaRest.ts`

Operational intent:

- provides a super-admin-only operational surface for Easypaisa payment flows and callbacks (environment dependent)
- behavior depends on Easypaisa env configuration and merchant credentials in Convex environment variables

### Confirmed moderation UX issue

- the remaining `Alert.prompt` venue rejection input path has been removed; venue rejection is now handled in `app/super-admin/request/[id].tsx` via an inline composer
- remaining moderation UX risk is now consistency and completeness (clear reasons, irreversible action warnings, and auditability), not prompt-only input

## 15. Cross-Role Linkage Map

### Player -> Zone admin

These player actions create downstream zone work:

- booking requests
- zone-linked matchroom creation
- venue-tied complaints
- notifications requiring venue response
- resource allocation demand

### Zone admin -> Player

Zone actions directly shape player outcomes through:

- booking acceptance
- booking rejection
- counter-offers
- walk-in or venue-backed matchroom creation
- venue-scoped report review

### Super admin -> Zone admin

Super admin controls:

- venue approval
- venue rejection
- venue suspension
- venue reactivation
- migration activation on approval

### Super admin -> Player

Super admin affects players indirectly through:

- report resolution
- role updates
- zone visibility and safety state changes

## 16. Game Support Audit

### Verified game keys in code

- `cs2`
- `cs16`
- `valorant`
- `fc25`
- `fc26`
- `tekken8`
- `futsal`
- `indoor_cricket`
- `padel`
- `pickleball`

### Per-game differences already implemented

- CS2:
  - FACEIT and Steam relevance
  - maps
  - roles
  - fairness band logic
- CS 1.6:
  - maps
  - roles
  - questionnaire-driven skill path
- Valorant:
  - maps
  - roles
  - questionnaire-driven skill path
- FC:
  - both `fc25` and `fc26` exist
  - formations and playstyles
  - console pricing and platform gating
- Tekken 8:
  - characters
  - PSN/console orientation
- Futsal:
  - positions
  - formations
  - duration-based pricing
- Indoor Cricket:
  - overs
  - batting/bowling metadata
  - composition rules
- Padel and Pickleball:
  - side/role support
  - court pricing
  - series support

### Game taxonomy risk

The largest game taxonomy issue is unresolved `fc25` / `fc26` coexistence.

Impact area:

- normalization
- filters
- pricing linkage
- room creation
- user profile skill storage
- zone resource interpretation

## 17. Skill Rating And Matchroom Join Rules

### Skill score storage model

Player skill is stored under `users.skillScores`.

Each game score contains:

- `rating` from `0` to `100`
- `tier`
- `matchesPlayed`
- `wins`
- `losses`
- `initialSource`
- `initialRating`
- `lastMatchDate`
- `lastUpdated`

### Tier thresholds

- `0-30` -> `Beginner`
- `31-50` -> `Casual`
- `51-70` -> `Intermediate`
- `71-85` -> `Advanced`
- `86-95` -> `Pro`
- `96-100` -> `Elite`

### Initial rating sources

- CS2:
  - FACEIT level baseline
  - Steam hours can improve baseline
  - questionnaire fallback
- CS 1.6:
  - questionnaire
- Valorant:
  - questionnaire
- FC26:
  - PSN trophy/progress baseline
  - Steam FC hours can raise baseline
  - questionnaire fallback
- Tekken 8:
  - PSN trophy/progress baseline
  - questionnaire fallback
- Futsal:
  - questionnaire
- Indoor Cricket:
  - questionnaire
- Padel:
  - questionnaire
- Pickleball:
  - questionnaire

### Questionnaire setup trigger

Questionnaire setup happens from:

- `app/(player)/profile/game-details.tsx`

Current rule:

- if no usable score exists and no external calibration source is available, the one-time assessment modal opens

### Matchroom skill fields

Rooms store:

- `hostSkillScore`
- `hostSkillTier`
- `avgSkillScoreLive`
- `totalSkillSum`
- `ratedPlayerCount`

Average formula:

- `totalSkillSum = sum of current room player ratings`
- `ratedPlayerCount = number of current room players with stored ratings`
- `avgSkillScoreLive = totalSkillSum / ratedPlayerCount`

### Join eligibility rule

Current server-side rule:

- if `abs(playerRating - roomAverageRating) <= 10`, direct join is allowed
- if `abs(playerRating - roomAverageRating) > 10`, captain approval flow is required

### Captain approval flow for out-of-range join

If out of range:

- player is not auto-added
- `match_join_request` notifications are created for available captains
- all available captains must approve
- any captain rejection rejects the request

### Current join blockers

- unauthenticated
- email not verified
- expired room
- locked/full room
- already in room
- no stored skill score for the room game
- no usable room skill average
- duplicate pending request
- no open team/slot
- chosen slot unavailable

### Game-to-skill mapping highlights

- `cs2` -> `skillScores.cs2`
- `cs16` -> `skillScores.cs16`
- `valorant` -> `skillScores.valorant`
- `fc25` -> `skillScores.fc25`
- `fc26` -> `skillScores.fc26`
- `tekken8` -> `skillScores.tekken8` with legacy fallback
- `indoor_cricket` / `cricket` -> `skillScores.indoor_cricket` with legacy fallback

### Join bug already fixed in architecture

The old client path tried to call notification creation directly for match join requests and failed on auth gate.

The corrected path moved join-request creation into:

- `convex/matchrooms.ts -> requestToJoinMatchroom`

This keeps join requests on the matchroom mutation path instead of a notification-only path.

## 18. UI, UX, And Layout Audit

### Shared strengths

- `src/theme.ts` centralizes tokens
- `Screen`, `AppHeader`, and `SegmentedTabs` provide real reusable primitives
- dark visual system is coherent
- card language is consistent enough to feel like one product family
- reusable chat UI and shared modal primitives are present

### Structural layout reality

The app is visually related, but structurally not uniform.

Main screen families:

- tab dashboard screens
- tab list/filter screens
- stack detail screens with fixed action bars
- auth/onboarding forms
- admin dashboards with looser shell discipline

### Footer and bottom-area systems currently in use

There are three distinct bottom-layer systems:

1. Expo Router bottom tab bar
2. `BottomActionBar` on stack detail/action screens
3. absolute FAB overlay on list screens

### Bottom-spacing weaknesses

Some screens use adaptive spacing, but others still use guessed or hardcoded values.

Confirmed weak/high-risk screens:

1. `app/(player)/(tabs)/index.tsx`
2. `app/(player)/(tabs)/discover.tsx`
3. `app/(player)/(tabs)/teams.tsx`
4. `app/matchrooms/[id].tsx`

### Styling issues

- mixed background token usage
- mixed typography usage across Montserrat, Martel, Lora, Inter
- some screens are token-driven while others remain inline-style heavy
- text encoding artifacts are still visible in user-facing strings
- super admin surface is less visually standardized than newer player/zone surfaces

## 19. Confirmed Gaps, Transitional Debt, And Overstated Surfaces

### Fully confirmed gaps

- card payments are not live
- `claimSeatTransaction` is still not implemented in the Convex booking wrapper
- zone settings is mostly a migration utility, not a full settings product
- branch editing is incomplete for non-primary branches
- team visibility/privacy is used in UI assumptions but not fully backed by schema contract
- phone OTP delivery is not implemented yet (Better Auth phone plugin logs OTP server-side; no SMS transport wired)
- matchroom chat does not support full message deletion (only DM supports "delete for me")
- push notifications depend on an Expo project id being discoverable at runtime (EAS config or `EXPO_PUBLIC_EXPO_PROJECT_ID`); without it, installations will upsert without an Expo token and pushes will be skipped

### Transitional or migration-dependent areas

- zone resources still support legacy fallback while branch/resource migration converges
- pricing rules depend on migration readiness
- queue linkage and booking/matchroom backfill logic still exist in zone booking flows
- service overlap still exists between Convex-first and compatibility-layer contracts

### Overstated surfaces

- support/audit/settings naming can imply more completeness than the implementation currently provides

## 20. Architectural Risk Register

### P0

- zone bookings and resources still depend on legacy-to-migrated bridge logic
- `fc25` / `fc26` taxonomy drift still affects multiple flows
- booking request, matchroom, and queue relationships are not fully normalized
- wallet top-up is not real payment processing
- seat-claim settlement remains incomplete

### P1

- heavy screens are too large and branching-heavy:
  - inbox
  - matchroom detail
  - matchroom create
  - zone bookings
- polling still exists in important admin flows, but duplicate keyed polling was reduced in the zone admin booking/resource service layer
- super admin moderation no longer relies on `Alert.prompt` for venue rejection input; remaining risk is inconsistent moderation UX patterns across admin screens
- UI shell discipline is inconsistent between surfaces

### P2

- placeholder modules can create false confidence
- analytics are mostly derived client-side instead of coming from a dedicated reporting pipeline
- string-quality and encoding defects reduce perceived polish and reliability

## 21. Explicit Verified End-To-End Flow Chains

### Player auth and onboarding

- Player registration -> Step 1 identity -> Step 2 game preferences -> Step 3 platform handles -> Step 4 create account -> Better Auth account created/recovered -> Convex profile created/completed -> verification email attempt (app-triggered) -> Player Dashboard (feature-gated until verified)
- Player login with email -> auth validation -> profile fetch -> role/account check -> Player Dashboard
- Player login with phone -> phone normalization -> linked email lookup -> auth sign-in -> profile fetch -> role/account check -> Dashboard
- Forgot password -> enter email -> Better Auth reset request when supported

### Player account and profile management

- Dashboard -> Profile -> Edit Profile -> update identity/privacy/platform data -> validations -> profile saved
- Dashboard -> Profile -> Game details -> enable or edit game -> add game-specific metadata -> save self-assessment if needed -> skill score saved
- Discover Players -> Public profile -> view profile/stats -> send friend request or report user

### Discovery and social

- Dashboard -> Discover -> Matchrooms -> filter/search -> open lobby
- Dashboard -> Discover -> Players -> filter/search -> open public profile
- Dashboard -> Discover -> Teams -> filter/search -> open team detail
- Dashboard -> Discover -> Zones -> filter/search -> open zone detail
- Public profile -> send friend request -> recipient inbox -> accept -> friendship created

### Matchroom host flow

- Verified player -> Create Matchroom -> fill details -> save -> Lobby Details
- Verified player -> Create Matchroom -> zone-based setup -> booking request path -> await venue action
- Host -> Lobby Details -> invite players/friends -> seat invitations -> recipients accept -> players added
- Host -> Lobby Details -> review join requests -> accept/reject -> room updated
- Host -> Lobby Details -> transfer captain / kick player / delete room / start match

### Matchroom participant flow

- Verified player -> Discover rooms -> Lobby Details -> request to join -> direct join or captain-approval flow
- Player -> Lobby Details -> cancel join request
- Player -> Lobby Details -> leave room
- Player -> Lobby Details -> book seats -> select side and slots -> create booking intent -> Booking Status
- Player -> Booking Status -> approved pending payment -> wallet payment -> seat confirmed -> open linked room
- Player -> Lobby Details -> open occupied slot -> public profile

### Match communication and disputes

- Player in room -> Lobby Details -> Match Chat -> send text/voice/reply
- Captain -> Result screen -> submit winner
- Participant -> Vote screen -> vote winner/unknown
- Player -> Lobby Details -> submit matchroom complaint -> report created -> Reports list -> Report detail

### Team management

- Verified player -> Create Team -> enter setup -> Team created -> Team Details
- Create Team -> invite eligible friends -> recipients inbox -> accept -> team joined
- Non-member -> Team Details -> request to join -> captain accepts/rejects
- Member -> Team Details -> leave team
- Captain -> Team Details -> rename/logo/invite/remove/transfer/delete

### Team challenges

- Captain -> Launch challenge creation -> select teams -> choose date/time/zone -> send challenge
- Opponent captain -> challenge workspace -> accept/reject
- Accepted challenge -> captains propose venue -> both align -> private challenge matchroom created
- Accepted challenge -> challenge chat unlocked -> captains communicate

### Wallet, inbox, schedule, and reports

- Dashboard -> Wallet -> view balance and history
- Dashboard -> Wallet -> add funds -> balance updated
- Dashboard -> Schedule -> upcoming and past matches
- Dashboard -> Inbox -> accept or reject pending action items
- Dashboard -> Reports -> open report detail -> inspect timeline
- Public profile / Zone detail / Lobby -> submit report -> Reports list -> detail timeline

### Zone admin

- Zone registration -> zone created with `pending-review` -> Zone Dashboard access
- Zone login -> auth -> zone check -> Zone Dashboard
- Zone Dashboard -> Branches -> add branch -> Branch Detail
- Zone Dashboard -> Bookings -> open request -> accept/reject/counter-offer -> player notified
- Zone Dashboard -> Walk-ins -> create walk-in matchroom
- Zone Dashboard -> Resources -> select branch -> update resources or allocate them
- Zone Dashboard -> Pricing -> create/toggle/delete rule
- Zone Dashboard -> Support -> open report -> mark reviewed
- Zone Dashboard -> Notifications -> open action-linked event -> continue operations
- Zone Dashboard -> Settings -> inspect migration state -> retry repair actions when available

### Super admin

- Super admin login -> role resolution -> Super Admin Dashboard
- Venues tab -> open request detail -> approve/reject/suspend/reactivate
- Users tab -> change user role -> self-demotion guard enforced
- Reports tab -> open report -> set pending/reviewed/resolved

### Cross-role operational chains

- Player creates zone-based matchroom request -> Zone admin reviews -> accepts -> venue-backed matchroom created -> player notified -> Lobby Details
- Player creates zone-based matchroom request -> Zone admin sends counter-offer -> Player Inbox -> accept/reject -> flow updated
- Player submits zone complaint -> zone support sees report -> zone marks reviewed -> super admin can complete final moderation
- Player submits user/matchroom complaint -> super admin reviews -> status updated -> player sees timeline
- Zone registers venue -> super admin reviews -> approves -> venue becomes operational in live surfaces

## 22. Completed Cleanup And Scale-Hardening Work

The following cleanup and scaling work has already been completed in this repo state.

### Canonical documentation consolidation

- replaced the separate audit markdown files with this single canonical reference
- removed:
  - `APP_UI_FLOW_STRUCTURE_ANALYSIS.md`
  - `FULL_APP_AUDIT.md`
  - `VERIFIED_USER_ADMIN_FLOW_MAP.md`
  - `MATCHROOM_SKILLRATING_AND_JOIN_RULES.md`
  - `REPO_ANALYSIS_AUDIT.md`

### Safe repo cleanup already completed

- removed placeholder/orphan surfaces:
  - `app/zone/modules/audit.tsx`
  - `app/home/index.tsx`
  - `app/home/home.styles.ts`
- removed stale backup artifact:
  - `src/services/userService.firebase.ts.bak`
- kept `app/(player)/(tabs)/matchrooms.tsx` and `app/(player)/(tabs)/teams.tsx` intentionally as compatibility redirect shims

### Compatibility-layer deletion already completed

- removed `src/services/functions.ts` after moving friend, team, and matchroom actions into direct Convex-first service modules
- removed service wrapper surfaces:
  - `src/services/zoneAdminBookingService.ts`
  - `src/services/zoneAdminResourceService.ts`
  - `src/services/bookingService.ts`
  - `src/services/reportService.ts`
  - `src/services/superAdminService.ts`
- the active path is now more consistently direct `src/services/convex/*`

### Scale-hardening already completed

- zone admin polling was consolidated into shared keyed pollers with cached row replay in:
  - `src/services/convex/sharedPollingRegistry.ts`
  - `src/services/convex/zoneAdminBookingService.ts`
  - `src/services/convex/zoneAdminResourceService.ts`
- duplicate 5-second poll loops for identical zone admin subscriptions were removed
- unchanged polling payloads no longer refan out to all subscribers
- new subscribers now receive the last cached payload immediately instead of waiting for the next interval

### Query-pressure reductions already completed

- `convex/discover.ts`
  - replaced fixed overfetch sizes with bounded fetch windows tied to requested limits
  - removed one unnecessary pending-request read in team discovery `mode === "my"`
- `convex/dashboard.ts`
  - reduced hosted/recent room fetch windows for home summary
  - limited team-membership reads to the same 10 rows already used by the UI
  - deduped friendship user fetches before loading friend docs
- `convex/admin.ts`
  - removed duplicate `users` table scans from dashboard summary by deriving account counts from already-loaded user rows
  - switched zones/users/reports list endpoints from full-table `collect()` + in-memory sort/slice to indexed recent-first query paths
  - removed a full `users` scan from super-admin bootstrap by adding indexed role lookup
- `convex/schema.ts`
  - added admin-oriented indexes for recent-first and filtered-recent list retrieval:
    - `users.by_role`
    - `users.by_updatedAt`
    - `users.by_accountType_updatedAt`
    - `zones.by_updatedAt`
    - `zones.by_status_updatedAt`
    - `reports.by_updatedAt`
    - `reports.by_status_updatedAt`

### Super admin structural reduction already completed

- `app/super-admin/(tabs)/index.tsx` no longer reloads summary, venues, users, and reports together on every tab/filter change
- the super admin surface now loads:
  - shared summary data
  - only the currently visible tab dataset
- `src/services/convex/superAdminService.ts` now applies short-lived in-memory caching with mutation-driven invalidation for summary, venue, user, and report reads

### First heavy-screen decomposition already completed

The first screen-level decomposition pass has started on:

- `app/matchrooms/[id].tsx`

This screen was chosen first because it is one of the highest-risk player surfaces:

- it is large
- it mixes data loading, identity logic, zone-admin controls, host controls, join/cancel flows, slot reconstruction logic, and heavy render branching in one component
- it contains duplicated team-slot rendering for Team A and Team B

Completed extraction in this pass:

- duplicated team-slot rendering was moved into:
  - `app/matchrooms/components/MatchroomTeamSection.tsx`
- the parent detail screen now renders the team layout through two component instances instead of embedding both Team A and Team B trees inline
- the extracted component remains presentation-oriented:
  - it receives state and callbacks from the parent
  - it does not own data fetching
  - it does not change matchroom mutation flow behavior

Completed extraction in the next pass on the same screen:

- lobby-derived state and slot reconstruction logic were moved into:
  - `app/matchrooms/utils/matchroomLobbyState.ts`
- this helper now owns:
  - walk-in slot reconstruction
  - structured slot reconstruction when stored slots are missing
  - unassigned-player slot filling
  - participant set derivation
  - joined/full/occupied-seat summary derivation
  - match code and QR payload derivation

What this second pass improves:

- removes a large non-UI `useMemo` block from `app/matchrooms/[id].tsx`
- isolates matchroom lobby state shaping into a reusable pure helper
- makes future extraction of a dedicated matchroom detail view-model practical
- reduces the amount of stateful reasoning embedded directly in the render component

Completed extraction in the next pass on the same screen:

- mutation-heavy action orchestration was moved into:
  - `app/matchrooms/hooks/useMatchroomDetailActions.ts`
- the active UI path for:
  - join/cancel flows
  - host/captain management
  - invite flows
  - zone-admin accept/reject/counter-offer flows
  - complain/share/result/vote navigation flows
  - admin force-cancel flow
  now runs through the extracted hook instead of directly through inline JSX event bindings

What this third pass improves:

- moves the action layer behind a dedicated local hook
- gives the screen a clearer separation between:
  - derived lobby state
  - presentation sections
  - mutation orchestration
- creates a safe next step for deleting the old inline action block once the hook migration is fully completed

Completed cleanup in the fourth pass on the same screen:

- the legacy inline action-handler cluster in `app/matchrooms/[id].tsx` was physically removed from the file
- the screen now compiles and runs against the extracted action hook as the sole live orchestration layer
- dead service imports tied to the old in-component mutation path were removed from the screen file
- date/time display helpers used by the booking UI were retained as the only local remnants needed from that old section, so rendered behavior stays unchanged

What this fourth pass improves:

- removes the last active ambiguity about where matchroom detail mutations are supposed to live
- prevents future maintenance from accidentally updating the dead inline path instead of the extracted hook
- narrows the dependency surface of `app/matchrooms/[id].tsx` by dropping direct imports for:
  - zone-admin booking mutations
  - report submission mutation wiring
  - captain transfer / kick / invite mutations
  - legacy matchroom delete / leave / join-cancel action helpers
- makes the next decomposition steps cleaner because the file now has one live action boundary instead of two competing ones
- removes preserved dead code from the repository instead of just hiding it behind a non-executed block

Completed extraction in the fifth pass on the same screen:

- the pending join-request moderation panel was moved into:
  - `app/matchrooms/components/MatchroomPendingRequestsPanel.tsx`
- `app/matchrooms/[id].tsx` now passes only:
  - `incomingRequests`
  - `processingRequestId`
  - `handleRespondToRequestAction`
  into that panel

What this fifth pass improves:

- removes another dense inline JSX branch from the matchroom detail screen
- keeps moderation behavior unchanged while making the pending-request section independently editable
- creates a clean future seam for:
  - request row styling changes
  - richer moderation metadata
  - later movement of moderation into a shared captain/admin moderation surface if needed

Completed extraction in the sixth pass on the same screen:

- booking/admin modal state was moved into:
  - `app/matchrooms/hooks/useMatchroomDetailUiState.ts`
- the detail screen now consumes that hook for:
  - complain modal state
  - invite modal state
  - zone counter-offer modal state
  - admin cancel modal state
  - shared modal form fields and related constants
- unused role-selection state was removed from `app/matchrooms/[id].tsx`

What this sixth pass improves:

- removes another large cluster of `useState` noise from the screen component
- keeps modal behavior unchanged while making future modal extraction easier
- centralizes modal-specific defaults such as:
  - complain reasons
  - admin cancel reasons
  - counter-offer default expiry/date values
- deletes dead local state that no longer participates in any UI flow

Completed extraction in the seventh pass on the same screen:

- booking/admin modal rendering markup was moved into:
  - `app/matchrooms/components/MatchroomInviteSheet.tsx`
  - `app/matchrooms/components/MatchroomSuggestSheet.tsx`
  - `app/matchrooms/components/MatchroomAdminCancelSheet.tsx`
- `app/matchrooms/[id].tsx` now renders those sheets as presentation components and passes only state/actions into them
- direct modal primitive imports were removed from the screen because the screen no longer renders those sheet bodies inline

What this seventh pass improves:

- removes three large bottom-sheet markup blocks from the active detail screen
- keeps modal behavior unchanged while reducing visual and state/render noise in the parent file
- creates reusable seams for future:
  - invite-sheet UX changes
  - zone-admin counter-offer UX changes
  - admin cancellation UX changes
- narrows the detail screen toward orchestration plus section composition instead of raw modal markup

Completed extraction in the eighth pass on the same screen:

- the read-only matchroom summary section was moved into:
  - `app/matchrooms/components/MatchroomSummarySection.tsx`
- this extraction includes:
  - locked-room QR card rendering
  - match code display
  - game/date/title/description summary card
  - time/location/price/skill info grid
  - the legacy duration/time fallback logic for summary display
- `app/matchrooms/[id].tsx` now composes that summary block as a single presentation section

What this eighth pass improves:

- removes another large read-only JSX block from the detail screen
- isolates legacy summary-time formatting logic away from the main orchestration component
- makes future summary redesign or metadata cleanup possible without touching roster or action logic
- reduces the amount of mixed static rendering and interactive logic inside the parent screen

Completed extraction in the ninth pass on the same screen:

- the non-team player-list fallback rendering branch was moved into:
  - `app/matchrooms/components/MatchroomFallbackRoster.tsx`
- `app/matchrooms/[id].tsx` now renders that roster component only when structured team slots are not available
- the old inline badge/host/current-user row rendering was removed from the screen

What this ninth pass improves:

- removes another conditional presentation branch from the detail screen
- keeps fallback roster behavior unchanged while isolating it from the structured team layout path
- creates a clear future seam for:
  - fallback-roster styling changes
  - host badge treatment changes
  - non-team lobby presentation cleanup
- removes the last large roster-rendering block that was still embedded directly in the parent screen

Completed extraction in the tenth pass on the same screen:

- room loading, profile bootstrap, Convex reactive sync, booking-request linking, and related screen state were moved into:
  - `app/matchrooms/hooks/useMatchroomDetailState.ts`
- `app/matchrooms/[id].tsx` now consumes that hook for:
  - room fetch/refresh
  - requested-slot sync
  - join-request sync
  - player-rating sync
  - profile/bootstrap state
  - booking request ID derivation
  - current identity and zone-admin state

What this tenth pass improves:

- removes the largest remaining orchestration cluster from the detail screen
- centralizes screen-state ownership for the matchroom detail route into a dedicated hook
- makes future caching, retry, or reactive-loading changes possible without reopening the presentation layer
- reduces the parent screen further toward:
  - permissions and derived booleans
  - action-hook wiring
  - section composition

Completed extraction in the eleventh pass on the same screen:

- the remaining derived lobby/roster booleans and captain/team permission logic were moved into:
  - `app/matchrooms/hooks/useMatchroomDetailViewModel.ts`
- this hook now owns:
  - host/expired/locked/full/joinability derivation
  - captain UID resolution
  - team management and invite permissions
  - skill badge fallback resolution
  - merged lobby-state consumption from the lobby-state utility
- a dead `availableRoles` placeholder was removed from `app/matchrooms/[id].tsx`

What this eleventh pass improves:

- removes the last substantial cluster of inline view-model logic from the detail screen
- leaves `app/matchrooms/[id].tsx` primarily responsible for:
  - section composition
  - passing props to extracted sections
  - wiring the state hook and action hook together
- creates a clean seam for future tests around lobby permissions and derived joinability

Completed the first structured extraction pass on `app/matchrooms/create/index.tsx`:

- pricing rules, zone rate-option derivation, selected rate handling, and automatic per-player pricing calculations were moved into:
  - `app/matchrooms/create/hooks/useMatchroomCreatePricing.ts`
- the create screen now consumes that hook for:
  - zone pricing rule loading
  - category/rate option generation from selected zone pricing
  - selected rate tracking
  - reset/select helpers for rate choice
  - game-specific auto-calculation of `pricePerPlayer`

What this create-screen pass improves:

- removes one of the densest effect clusters from the create screen
- centralizes pricing behavior so game-specific rate logic is no longer scattered through the parent form
- reduces the chance of pricing drift between:
  - selected zone category
  - selected game
  - series type
  - team format
- walk-in vs player flow
- creates a clear seam for future pricing tests and further create-screen decomposition

Completed the second structured extraction pass on `app/matchrooms/create/index.tsx`:

- walk-in roster state, booked-seat derivation, captain-seat resets, head-to-head seat syncing, and seat-count clamping were moved into:
  - `app/matchrooms/create/hooks/useMatchroomCreateWalkInRoster.ts`
- the oversized walk-in roster editor markup was moved into:
  - `app/matchrooms/create/components/WalkInRosterEditor.tsx`
- the create screen now consumes those boundaries for:
  - walk-in seat-count input handling
  - per-seat player draft mutation
  - Team A / Team B captain selection
  - CS-style split roster rendering
  - non-CS per-player roster rendering with dynamic game-specific fields
  - reset behavior when game presets switch back to default walk-in seating

What this second create-screen pass improves:

- removes one of the largest inline JSX branches from the create screen without changing the submit or validation contract
- centralizes walk-in seat-draft behavior so seat normalization and captain-reset logic are no longer mixed directly into screen composition
- reduces the amount of repeated inline `setState(prev => prev.map(...))` mutation code inside the render path
- makes future removal or replacement of the walk-in roster flow much safer because:
  - the runtime state boundary now lives in one hook
  - the roster UI boundary now lives in one presentation component
  - the remaining parent screen mostly orchestrates form sections instead of owning seat-level editing details
- creates a clearer next step for this module:
  - extract the team/captain booking state and teammate-selection cluster next
  - then move submit-time validation and payload shaping into dedicated helpers/hooks

Completed the third structured extraction pass on `app/matchrooms/create/index.tsx`:

- captain/team booking state, selected-team refresh, teammate auto-selection, team-payment mode, and member role hydration were moved into:
  - `app/matchrooms/create/hooks/useMatchroomCreateTeamBooking.ts`
- the captain booking UI branch was moved into:
  - `app/matchrooms/create/components/TeamBookingSection.tsx`
- the create screen now consumes those boundaries for:
  - solo vs captain booking mode switching
  - reserved-slot selection
  - multi-team captain selection when more than one captained team exists
  - teammate selection and slot-limit enforcement
  - captain-pay-all vs captain-pay-self booking choice
  - selected-team refresh on focus and selected-team change

What this third create-screen pass improves:

- removes another large state-plus-UI cluster from the parent screen without changing the booking validation or request payload structure
- centralizes captain-booking rules so these behaviors no longer drift across:
  - game switch resets
  - selected-team refreshes
  - teammate auto-fill
  - team payment selection
- makes the create screen less fragile because team-mode behavior is now owned by one hook instead of being spread across multiple effects and inline event handlers
- creates a safe next boundary for this module:
  - submit-time validation and blocker generation
  - request payload shaping for player mode, team mode, and walk-in mode

Completed the fourth structured extraction pass on `app/matchrooms/create/index.tsx`:

- submit-time validation rules and pre-submit blocker generation were moved into:
  - `app/matchrooms/create/utils/matchroomCreateValidation.ts`
- the create screen now uses those helpers for:
  - `validateForm()` alert-driven blocking
  - `submitBlockers` generation for disabled CTA hints
  - shared validation across:
    - standard player match creation
    - captain/team booking
    - zone-admin walk-in creation

What this fourth create-screen pass improves:

- removes a long inline validation decision tree from the parent screen without changing any booking or walk-in rules
- makes blocker generation and hard validation consistent, because both now come from the same pure validation source instead of two separately maintained inline branches
- lowers regression risk for future create-flow work because payload extraction can now happen independently of the validation contract
- gives future Codex runs a much clearer next target:
  - request payload shaping for booking requests and direct matchroom creation
  - submit-orchestration cleanup around wallet payment and participation gating

Completed the fifth structured extraction pass on `app/matchrooms/create/index.tsx`:

- request payload shaping was moved into:
  - `app/matchrooms/create/utils/matchroomCreatePayloads.ts`
- the extracted builders now own:
  - zone-admin walk-in payload construction
  - booking-request payload construction
  - assigned team-member shaping for captain bookings
  - direct matchroom payload construction
- the create screen now uses those builders instead of assembling large inline objects for:
  - `createZoneWalkInMatchroom(...)`
  - `createBookingRequest(...)`
  - `createMatchroom(...)`

What this fifth create-screen pass improves:

- removes another large chunk of object-construction noise from the parent screen without changing mutation order or product behavior
- centralizes field mapping for:
  - payment metadata
  - skill metadata
  - team booking metadata
  - walk-in roster metadata
  - zone/broadcast location metadata
- reduces the risk of payload drift between booking-request flow and direct matchroom creation, because the screen no longer duplicates those mappings inline
- narrows the remaining create-screen responsibility mostly to:
  - wallet payment orchestration
  - participation gating and assessment prompts
  - final branching between booking-request and direct-create mutations

Completed the sixth structured extraction pass on `app/matchrooms/create/index.tsx`:

- submit orchestration was moved into:
  - `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts`
- the extracted hook now owns:
  - wallet-payment prompting and wallet debit/top-up flow
  - latest-profile refresh before submit
  - participation gating for activation and assessment
  - zone-admin walk-in submission branch
  - booking-request submission branch
  - direct matchroom submission branch
  - activation-confirm and assessment-success re-entry into submit flow
- the parent create screen now uses that hook only to:
  - trigger `handleSubmit()`
  - render activation and assessment modals from returned hook state
  - pass the modal confirm/success callbacks back into the hook

What this sixth create-screen pass improves:

- removes the last major async orchestration tree from the parent screen without changing the visible submit behavior
- centralizes payment, gating, and submission sequencing so those side effects are no longer mixed with form composition
- makes this module materially safer for future work because:
  - validation now lives in one utility
  - payload shaping now lives in one utility
  - submit orchestration now lives in one hook
  - the parent screen mostly composes sections and passes state into extracted boundaries
- puts `app/matchrooms/create/index.tsx` at the same architectural stage as the already-refactored matchroom detail screen:
  - thin shell
  - extracted view/state hooks
  - extracted presentation sections
  - extracted validation/payload/submit helpers

What this first screen split improves:

- reduces duplicated JSX and branch logic in the main matchroom detail screen
- creates a stable seam for future extraction of:
  - slot action controls
  - host/captain management controls
  - lobby roster and walk-in reconstruction presentation
- lowers the risk of future regressions when changing one team column but forgetting the other

What still remains in `app/matchrooms/[id].tsx` after these decomposition passes:

- section composition
- action/state hook wiring
- a small amount of route-local helper glue such as date formatting and touch-debug wiring

This means the screen is materially improved, but not yet fully decomposed. The remaining highest-value extractions are:

- final section-composition cleanup if further thinning is worth the churn
- moving on to the next oversized hot screen, especially `app/matchrooms/create/index.tsx`

## 23. Removal And Refactor Ledger

This section is the canonical execution map for future Codex cleanup passes. Treat each item as one of:

- `removed`: already deleted from the repo or physically removed from the active file
- `retained`: intentionally kept because live flows still depend on it
- `next`: safe upcoming extraction or deletion candidate
- `blocked`: do not remove until the stated dependency is retired

### Already removed

- `app/home/index.tsx`
  why: orphaned route surface not part of the canonical app shell
- `app/home/home.styles.ts`
  why: dead companion style file for the removed orphan route
- `src/services/userService.firebase.ts.bak`
  why: stale backup artifact that could mislead future maintenance
- `src/services/functions.ts`
  why: legacy compatibility aggregator replaced by Convex-first feature services
- `src/services/zoneAdminBookingService.ts`
  why: compatibility wrapper removed after direct Convex service migration
- `src/services/zoneAdminResourceService.ts`
  why: compatibility wrapper removed after direct Convex service migration
- `src/services/bookingService.ts`
  why: compatibility wrapper removed after direct Convex service migration
- `src/services/reportService.ts`
  why: compatibility wrapper removed after direct Convex service migration
- `src/services/superAdminService.ts`
  why: compatibility wrapper removed after direct Convex service migration
- legacy inline action-handler cluster from `app/matchrooms/[id].tsx`
  why: duplicate mutation path after `useMatchroomDetailActions.ts` became the live orchestration layer
- dead role-selection state from `app/matchrooms/[id].tsx`
  why: no remaining UI or action flow referenced `showRoleModal` or `selectedRole`

### Retained intentionally

- `app/zone/modules/audit.tsx`
  why: this module is now implemented and visible as `Audit & Security`; earlier "placeholder-only" notes were from an older state before the audit module closure pass
- `app/(player)/(tabs)/matchrooms.tsx`
  why: compatibility navigation shim for `/matchrooms`; remove only after all entry points are confirmed migrated
- `app/(player)/(tabs)/teams.tsx`
  why: compatibility navigation shim for `/teams`; remove only after all entry points are confirmed migrated
- `app/matchrooms/[id].tsx`
  why: still the active detail screen; continue extracting pieces instead of replacing wholesale
- `app/matchrooms/create/index.tsx`
  why: still the active create flow; refactor in slices rather than rewrite
- `matchhai-backend/`
  why: legacy sidecar surface; remove only after external/runtime dependency verification
- `matchhai-psn-service/`
  why: legacy sidecar surface; remove only after external/runtime dependency verification

### Next safe removals or extractions

- final section-composition cleanup inside `app/matchrooms/[id].tsx`
  why: the remaining logic is now mostly shell-level composition rather than large inline state or presentation blocks
- oversized action/state clusters in `app/matchrooms/create/index.tsx`
  why: this remains one of the largest hot screens and still carries scale and maintenance risk
- super-admin moderation input UX consistency pass
  why: `Alert.prompt` venue rejection was removed, but the super-admin surface still benefits from consistent inline/modals for all moderation actions
- final shell-level cleanup inside `app/matchrooms/create/index.tsx`
  why: the remaining work on this screen is now mostly composition polish, import cleanup, and optional final section grouping rather than major inline logic removal

### Blocked deletions

- any `/matchrooms` or `/teams` route shim
  why: blocked until route callers, deep links, and replace/push targets are verified against the new canonical paths
- any sidecar backend folder
  why: blocked until deployment/runtime dependency mapping confirms no external job or service still depends on it
- any Convex repair/migration helper
  why: blocked until the underlying normalized data path is proven stable in production data

### Verification already completed

- TypeScript compile validation was run after each major batch using:
  - `npx tsc --noEmit --pretty false`

### What remains structurally true after these improvements

- the heaviest operational screens are still oversized and should still be split
- admin summary totals still come from live query aggregation rather than maintained counters
- super-admin moderation UX still has consistency gaps (reason capture, irreversible action warnings, and auditability). `Alert.prompt` venue rejection input was removed and no remaining `Alert.prompt` usage was found in the repo in this pass
- branch/resource migration and queue repair logic still exist, even though the surrounding service layer is now leaner

## 24. Canonical Recommendations

### Product direction

- treat Discover as the official browse architecture
- stop building new browse logic in hidden legacy routes
- decide whether zone settings is a migration tool or a full settings product
- mark placeholder admin modules clearly until they become operational

### Technical priorities

- create one canonical game-key normalization layer and reuse it everywhere
- normalize booking request, matchroom, and zone-admin queue relationships
- reduce reliance on repair/backfill logic
- finish branch/resource migration convergence
- replace compatibility wrappers with a single Convex-first service contract
- split oversized screens into view-model, actions, and presentation layers

### UX priorities

- standardize safe-area and bottom-spacing behavior across tab screens, FAB screens, and fixed-action-bar screens
- keep super-admin moderation inputs out of `Alert.prompt` style interactions; prefer inline composers or explicit modal forms consistently across moderation actions
- remove visible encoding defects from user-facing strings
- reduce cognitive overload on dense operational screens

### Performance and scale priorities

To support 5,000 active users credibly, the app needs:

- fewer broad scans and more indexed query paths
- reduced polling in admin flows
- less screen-level branching and fewer monolithic component trees
- normalized event and relationship contracts instead of repair logic
- clearer boundaries between production runtime code and legacy/compatibility surfaces
- explicit load-oriented review of chat, notifications, discover queries, dashboard aggregations, and zone booking operations

## 25. Final Assessment

MatchHai is not a thin prototype. It already contains real depth in:

- role-based routing
- onboarding
- discover
- matchrooms
- teams and challenges
- zone operations
- moderation/reporting
- chat and notification plumbing

The main problem is not missing surfaces. The main problem is implementation unevenness caused by:

- migration overlap
- normalization drift
- oversized screens
- partially completed transaction/payment flows
- inconsistent shell/layout discipline

The highest-value next phase is not feature sprawl. It is consolidation, deletion of dead paths, data-model convergence, and load-oriented hardening of the systems that already exist.

## 26. Next Module Handoff

If a future Codex run is given only this file, the next recommended module to start is:

- `app/(player)/inbox.tsx`

Why this should go next:

- it is still one of the largest active player-facing screens
- it sits on a high-frequency operational path:
  - invites
  - join requests
  - notifications-like social actions
  - matchroom and team interaction follow-through
- it is more user-critical than cosmetic admin cleanup
- it is a better scale and maintainability target than small leftover shell cleanups
- the create and detail matchroom screens are already at thin-shell stage, so the next strong return is another high-traffic player module

What the next Codex run should do first:

1. Read `app/(player)/inbox.tsx` and classify the file into:
   - reactive state / data loading
   - action handlers
   - list item rendering
   - filters / tabs / grouping logic
   - modal / confirm flows
2. Extract only one major cluster at a time, preserving runtime behavior after each pass.
3. After every safe pass:
   - run `npx tsc --noEmit --pretty false`
   - append the completed extraction to this document
4. Do not start by rewriting the whole screen.
   - follow the same incremental pattern used for:
     - `app/matchrooms/[id].tsx`
     - `app/matchrooms/create/index.tsx`

Recommended extraction order for `app/(player)/inbox.tsx`:

1. extract inbox item action handlers
   why:
   - this usually removes the most mutation-heavy branch first
   - it reduces the chance of behavior drift during later UI splits
2. extract derived inbox view-model state
   why:
   - filtering, grouping, unread counts, and tab logic are usually the next largest source of parent-screen complexity
3. extract message/request row presentation components
   why:
   - this cuts render-path noise after the action and state boundaries are stable
4. extract modal / confirmation flows
   why:
   - by this stage, the parent screen should already be thin enough that modal extraction becomes low risk

Completed the first inbox decomposition pass:

- inbox action handlers were moved into:
  - `app/(player)/hooks/useInboxActions.ts`
- the extracted hook now owns:
  - friend-request accept/decline
  - team join-request accept/reject
  - matchroom join-request accept/reject
  - team invite accept/decline
  - captain booking approval decisions
  - seat-invitation accept/decline and pay-route handoff
  - zone counter-offer accept/reject
  - delete single notification
  - clear resolved history
  - mark-all-read

Completed the second inbox decomposition pass:

- derived inbox filtering and tab state were moved into:
  - `app/(player)/hooks/useInboxViewModel.ts`
- the extracted hook now owns:
  - unread-id derivation for auto-marking
  - visible-notification filtering
  - pending count derivation
  - tab-specific filtered rows
  - resolved-history count derivation

Completed the third inbox decomposition pass:

- inbox row presentation was moved into:
  - `app/(player)/components/InboxNotificationCard.tsx`
- the extracted component now owns:
  - per-notification type classification
  - sender/message copy composition
  - metadata boxes for join requests and counter-offers
  - profile/team/matchroom/challenge context chips
  - inline row action buttons for accept/reject/pay/open flows

What these inbox passes improve:

- remove the mutation-heavy response logic from `app/(player)/inbox.tsx` without changing notification business rules
- centralize pending/history filtering so hidden rejected challenge rows and expired pending rows are derived in one place
- remove the largest remaining JSX branch from the parent inbox screen without changing swipe-to-delete behavior
- leave the parent inbox screen responsible mainly for:
  - route-local navigation helpers
  - auto-mark-read effect wiring
  - swipe-row wrapping for resolved items
  - screen shell composition

Completed the fourth inbox cleanup pass:

- inbox alert/confirmation helpers were moved into:
  - `app/(player)/utils/inboxAlerts.ts`
- the action hook now uses those helpers for:
  - clear-history destructive confirmation
  - accepted counter-offer success routing prompt
- the parent screen was then cleaned to remove the now-duplicated legacy helper functions left behind from the row extraction

What this fourth pass improves:

- removes stale duplicated message/helper code from `app/(player)/inbox.tsx`
- makes the inbox screen materially closer to a true thin shell
- isolates the remaining route-local alert payloads so future modal replacement can happen from one utility boundary instead of scattered inline branches

Completed the fifth inbox cleanup pass:

- swipe-row and empty-state presentation were moved into:
  - `app/(player)/components/InboxSwipeableRow.tsx`
  - `app/(player)/components/InboxEmptyState.tsx`
- the extracted components now own:
  - swipe-to-delete gesture handling and delete affordance presentation
  - empty-state presentation for pending and history tabs

What this fifth pass improves:

- removes the remaining gesture-heavy implementation branch from `app/(player)/inbox.tsx`
- leaves the parent inbox screen more focused on:
  - route-local navigation helpers
  - auto-mark-read effect wiring
  - item composition and screen shell state
- puts the inbox screen very close to thin-shell territory without changing notification behavior

What should go next for inbox:

- stop structural splitting unless a future UX change justifies it
- replace the remaining inline `Alert` usage inside `useInboxActions.ts` with explicit modal flows only if product behavior needs to change beyond the current native-alert interactions

Verification completed for these passes:

- `npx tsc --noEmit --pretty false`

What to avoid in the next run:

- do not mass-delete inbox-related files before checking live imports and route usage
- do not change invite, join-request, or social-response business rules during decomposition
- do not combine refactor and product behavior changes in the same pass

If `app/(player)/inbox.tsx` turns out to be blocked by an unexpected dependency, the fallback next module is:

- `app/zone/modules/bookings.tsx`

Why that is the fallback:

- it is still operationally dense
- it affects venue-side throughput and queue handling
- it remains relevant to scale-hardening after the polling and backend query reductions already completed

Completed the first fallback-module pass on `app/zone/modules/bookings.tsx`:

- queue decision handlers were moved into:
  - `app/zone/modules/hooks/useZoneBookingsActions.ts`
- the extracted hook now owns:
  - booking-request accept flow
  - booking-request reject flow
  - zone counter-offer submit flow
  - mutation sequencing, success/error alerts, and post-submit modal reset for those actions

What this bookings pass improves:

- removes the mutation-heavy booking decision branch from the zone bookings screen without changing queue behavior
- keeps the parent screen focused on:
  - subscriptions and selection state
  - filter derivation
  - counter-offer picker state
  - section composition
- creates the same kind of action boundary already used in the inbox and matchroom detail modules

What should go next for `app/zone/modules/bookings.tsx`:

- extract derived booking queue and selection view-model state next
- then extract the requests list / selected-request detail presentation if further thinning is still worth the churn

Verification completed for this bookings pass:

- `npx tsc --noEmit --pretty false`

Completed the second fallback-module pass on `app/zone/modules/bookings.tsx`:

- derived bookings view-model state was moved into:
  - `app/zone/modules/hooks/useZoneBookingsViewModel.ts`
- the extracted hook now owns:
  - branch-area derivation
  - primary-branch derivation
  - walk-in counts and walk-in room filtering
  - request queue filtering by status and asset type
  - selected-request and linked-matchroom resolution
  - calendar month derivation for the counter-offer picker

What this second bookings pass improves:

- removes the main bundle of queue/filter/selection derivation from the zone bookings screen
- leaves the parent screen closer to:
  - subscriptions and route-param sync
  - local picker state
  - composition of requests, matchrooms, and walk-ins sections
- creates a clear next seam for extracting the request-list and selected-request presentation cluster if another pass is worth the churn

Verification completed for this second bookings pass:

- `npx tsc --noEmit --pretty false`

Completed the third fallback-module pass on `app/zone/modules/bookings.tsx`:

- requests-segment presentation was moved into:
  - `app/zone/modules/components/ZoneBookingsRequestsSection.tsx`
- the extracted component now owns:
  - filters toggle and filter-chip rendering
  - filtered request list rendering
  - selected-request inline action presentation
  - accept / reject / alternative CTA rendering for the selected request row

What this third bookings pass improves:

- removes the largest remaining inline JSX branch from the zone bookings screen without changing queue or counter-offer behavior
- leaves the parent screen more focused on:
  - subscriptions and route-param sync
  - request selection state
  - counter-offer picker state
  - matchroom and walk-in section composition
- creates a cleaner next seam for extracting the counter-offer sheet and picker presentation if further thinning is still worth the churn

What should go next for `app/zone/modules/bookings.tsx`:

- extract the counter-offer sheet and date/time picker presentation next
- then decide whether the remaining matchrooms and walk-ins sections are worth splitting further, or whether the parent is now thin enough to stop

Verification completed for this third bookings pass:

- `npx tsc --noEmit --pretty false`

Completed the fourth fallback-module pass on `app/zone/modules/bookings.tsx`:

- counter-offer and picker presentation was moved into:
  - `app/zone/modules/components/ZoneBookingsCounterOfferSheets.tsx`
- the extracted component now owns:
  - counter-offer bottom-sheet rendering
  - schedule-option card rendering
  - date picker calendar presentation
  - time picker column presentation
  - sheet-level submit CTA rendering

What this fourth bookings pass improves:

- removes the remaining modal-heavy JSX branch from the zone bookings screen without changing booking-decision or counter-offer behavior
- leaves the parent screen more focused on:
  - subscriptions and route-param sync
  - selection and filter state
  - request and walk-in section composition
  - state transitions for counter-offer editing
- makes future modal/picker UX changes safer because that presentation now lives behind one component boundary

What should go next for `app/zone/modules/bookings.tsx`:

- evaluate whether the remaining matchrooms and walk-ins sections need extraction, or stop if the parent screen is now thin enough
- if another pass is still worth it, extract the matchrooms and walk-ins presentation cluster next

Verification completed for this fourth bookings pass:

- `npx tsc --noEmit --pretty false`

Completed the fifth fallback-module pass on `app/zone/modules/bookings.tsx`:

- matchrooms and walk-ins presentation was moved into:
  - `app/zone/modules/components/ZoneBookingsMatchroomsSection.tsx`
  - `app/zone/modules/components/ZoneBookingsWalkinsSection.tsx`
- the extracted components now own:
  - matchrooms list rendering and focused-row presentation
  - walk-in creation CTA presentation
  - existing walk-ins list rendering

What this fifth bookings pass improves:

- removes the last large section-rendering branches from the zone bookings screen without changing routing or queue behavior
- leaves the parent screen focused mainly on:
  - route params and subscriptions
  - filter and selection state
  - counter-offer editing state
  - action-hook wiring
- puts `app/zone/modules/bookings.tsx` in effectively thin-shell territory, similar to the already-refactored matchroom detail and create modules

What should go next for `app/zone/modules/bookings.tsx`:

- stop splitting unless a future product change justifies it
- if touched again, keep changes behavioral rather than structural because the remaining parent logic is now mostly orchestration glue

Verification completed for this fifth bookings pass:

- `npx tsc --noEmit --pretty false`

## 27. Phase 3.2 QA Closure

This section records the focused QA and regression checks completed after the main flow-alignment work.

### Verification-gate QA

Verified against code:

- the canonical verification gate message remains:
  - `Please verify your email to unlock matchrooms and team actions.`
- shared verification-gate helpers continue to live in:
  - `src/utils/emailVerificationGate.ts`
- backend enforcement for high-value actions still exists in:
  - `convex/matchrooms.ts`
  - `convex/teams.ts`
  - `convex/teamChallenges.ts`
  - `convex/notifications.ts`
- the dedicated verification-required screen remains the canonical post-signup recovery surface:
  - `app/auth/verification-required.tsx`
- the player home/dashboard still shows the locked-until-verified state with resend CTA and reduced navigation:
  - `app/(player)/(tabs)/index.tsx`
  - `app/(player)/(tabs)/_layout.tsx`

QA fix made in this pass:

- unverified users previously hit dead-end disabled submit CTAs in:
  - `app/matchrooms/create/index.tsx`
  - `app/teams/challenge-create.tsx`
- those CTAs now remain tappable while visually locked so they can open the shared verification alert and resend-email path via:
  - `showEmailVerificationRequiredAlert()`

Result:

- verification gating is now consistent at the action point instead of failing silently behind disabled primary buttons

### Booking and payment QA

Verified against code:

- wallet seat payment still routes through:
  - `src/services/convex/bookingService.ts`
  - `confirmBookingTransaction` -> `payMatchroomSeatIntent`
- final booking confirmation and seat allocation still occur in:
  - `convex/matchrooms.ts`
- booking payment UI exposes only live methods:
  - `MatchHai Wallet`
  - `Easypaisa Checkout`
- direct in-app card entry remains unavailable and is now only represented as a readiness/config statement, not a live payment affordance:
  - `src/config/featureReadiness.ts`
- booking payment and status surfaces stay aligned with the live gateway flow:
  - `app/matchrooms/book/pay/[intentId].tsx`
  - `app/matchrooms/book/status/[intentId].tsx`
- wallet top-up and checkout-resume handling stay aligned with Easypaisa hosted checkout:
  - `app/(player)/wallet.tsx`
  - `convex/easypaisa.ts`

Result:

- no additional booking/payment code changes were required in this pass
- the live system behavior remains:
  - wallet for immediate internal deduction
  - Easypaisa hosted checkout for gateway-based payment
  - no direct in-app card entry

### Zone approval and migration QA

Verified against code:

- player venue discovery still reads only active venues:
  - `convex/zones.ts`
  - `listActive`
- super-admin venue approval, suspension, reactivation, and migration retry now route through:
  - `src/services/convex/superAdminService.ts`
  - `convex/admin.ts`
- approval/reactivation still use lifecycle-aware status mutation handling rather than the old direct `zones.approve` shortcut
- approval of legacy venues still attempts migration immediately and leaves the venue in:
  - `approved_pending_migration`
  when migration does not complete successfully
- failed migration remains visible and retryable in:
  - `app/super-admin/request/[id].tsx`
  - `app/zone/modules/migration-tools.tsx`
- zone pricing and resource surfaces remain correctly locked behind migration readiness:
  - `app/zone/modules/pricing.tsx`
  - `app/zone/modules/resources.tsx`

Result:

- no additional lifecycle-code changes were required in this pass
- discovery, approval, migration, retry, and go-live rules remain aligned with the canonical intended flow

### Verification completed

- `npx tsc --noEmit --pretty false`

## 28. Phase 2.2 Zone Audit Module Closure

This section records the concrete implementation of the zone audit module after the placeholder state was audited.

### Audit event model

- added a dedicated Convex audit table:
  - `zoneAuditEvents`
- each event now stores:
  - `zoneId`
  - `module`
  - `action`
  - `actorUid`
  - `actorLabel`
  - `targetType`
  - `targetId`
  - `summary`
  - `details`
  - `createdAt`
- indexed reads now support:
  - zone timeline
  - zone + module timeline
  - zone + action timeline

### Backend capture coverage

Audit events are now emitted from the backend mutation boundary for:

- booking decisions and negotiation actions in:
  - `convex/zoneAdminBooking.ts`
  - accepted booking request
  - rejected booking request
  - sent counter-offer
  - created walk-in matchroom
- pricing rule lifecycle changes in:
  - `convex/zones.ts`
  - created pricing rule
  - updated pricing rule
  - deleted pricing rule
- resource operations in:
  - `convex/zoneAdminResources.ts`
  - updated resource lifecycle status
  - allocated resources to request
- migration runs in:
  - `convex/zoneBranchMigration.ts`
  - migration executed
  - migration skipped because the zone was already migrated

### Zone admin surface

- added the new zone-admin module:
  - `Audit & Security`
- module definition now lives in:
  - `src/features/zoneAdmin/modules.ts`
- screen implementation now lives in:
  - `app/zone/modules/audit.tsx`
- the module is now visible from the zone dashboard/navigation instead of remaining filtered out

The audit screen now supports:

- module filtering
- date-window filtering
- actor search
- action filtering

### Verification completed

- `npx convex codegen`
- `npx tsc --noEmit --pretty false`

### Follow-up moderation UX cleanup

- removed the remaining super-admin venue rejection `Alert.prompt` path
- dashboard venue rejection now routes into:
  - `app/super-admin/request/[id].tsx`
- venue detail now captures rejection reasons through an inline composer instead of an alert prompt
- venue detail now also shows the saved rejection reason and no longer presents a redundant reject action once the venue is already in the rejected state
- final audit-trail hardening now records the acting admin for:
  - zone counter-offers
  - pricing rule enable/disable changes
  - pricing rule deletion
- verification completed with:
  - `npx tsc --noEmit --pretty false`

## 29. Flow Implementation Closure

This section records the current state of the recommended flow implementation pass.

### Completed scope

The following implementation tracks are now complete:

- auth and recovery flow hardening
- verification-state UX standardization
- player schedule timeline restructuring
- zone settings and migration-tools separation
- venue approval plus migration orchestration
- super-admin report triage improvements
- zone audit module implementation
- FC taxonomy unification
- payment affordance cleanup
- cross-surface status and action-label consistency
- focused QA and regression closure across player, zone admin, and super admin flows

### Final state

- the implementation tracker for this recommended-flow execution pass is now closed
- tracked tasks and acceptance checks for that pass are implemented; the broader architecture risks and known gaps elsewhere in this canonical doc still apply
- the codebase is now ready to move into a broader app-wide UI/UX consistency review focused on:
  - shared component patterns
  - screen-level interaction consistency
  - navigation consistency
  - styling and visual-system cleanup
  - cross-surface code organization consistency

### Final verification baseline

- `npx convex codegen`
- `npx tsc --noEmit --pretty false`

## 30. Latest Append Pass / Missing Details Added

This section records what was appended in the latest append + reconciliation pass (code-verified; appended without reorganizing the canonical structure).

Routes and surfaces appended:

- added missing routes to the canonical route inventory:
  - `app/auth/verification-required.tsx`
  - `app/(player)/friend-chat/[friendId].tsx`
  - `app/debug/perf.tsx` (dev-only)

Runtime wiring and guards appended:

- documented the exact app-root provider mount order (`AuthenticatedConvexProvider` -> `AuthContext` -> bridges/providers -> Toast)
- documented global deep-link parsing for `matchhai://oauth?...` callbacks (FACEIT + Steam) in `app/_layout.tsx`
- documented notification open dedupe (`notifications.lastHandledResponse.v1`) and match reminder reconciliation in `NotificationRuntimeBridge`
- documented push registration lifecycle + per-installation id persistence (`push_registration.installation_id.v1`)

Schema and data model corrections/appends:

- corrected the "main high-value tables" list to include tables already present in `convex/schema.ts` but missing from the canonical doc:
  - `paymentTransactions`
  - `zoneAuditEvents`
  - `chatTypingStatus`

Auth, onboarding, and verification details appended:

- documented Better Auth server config realities (Resend, trusted origins, email verification dispatch policy, phone OTP placeholder)
- documented the Better Auth <-> Convex token bridge and the session snapshot refresh strategy (`AuthenticatedConvexProvider`)
- documented the verification-required gate screen and the shared verification gate utilities

Chat/notifications/payments detail appended:

- appended DM vs matchroom vs challenge chat capabilities and access rules (attachments, reactions, swipe-to-reply, edit window, pinned message rules, delete-for-me DM behavior, and "no full deletion" for match chats)
- expanded notifications section with canonicalization + dedupe policy behavior and the push delivery state machine
- updated booking payment docs to include the Easypaisa gateway flow, HTTP endpoints, app return deep-link, and `externalPaymentReference` support in the matchroom payment mutation

Still unverified / requires runtime QA (not statically provable from code alone):

- Easypaisa staging/prod provider reconciliation behavior across:
  - REST vs hosted fallback selection
  - IPN callback behavior under real provider load
- Expo push delivery in production:
  - EAS project id discovery on real devices
  - token refresh/rotation behavior and delivery reliability

Cleanup reconciliation performed in this pass:

- reconciled the zone audit module narrative:
  - removed the stale "audit module removed as placeholder" entry from the removal ledger
  - retained `app/zone/modules/audit.tsx` as an implemented, active surface
- reconciled the super-admin `Alert.prompt` narrative:
  - updated earlier sections and risk register language to reflect that venue rejection prompt input was removed
  - kept the remaining moderation UX risk framed as consistency/completeness, not `Alert.prompt` dependence
- removed a duplicated "Player registration" end-to-end flow bullet (kept the more accurate verification-gated version)

## 31. Latest Append Pass / Broadcast Area Matchroom Flow

This section records the implemented broadcast-area matchroom flow added in the latest pass. It is code-verified against:

- `app/matchrooms/create/index.tsx`
- `app/matchrooms/create/hooks/useMatchroomCreateBroadcastAreas.ts`
- `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts`
- `app/matchrooms/create/utils/matchroomCreateValidation.ts`
- `app/matchrooms/create/utils/matchroomCreatePayloads.ts`
- `app/matchrooms/components/MatchroomCard.tsx`
- `app/matchrooms/components/MatchroomSummarySection.tsx`
- `app/matchrooms/utils/matchroomLocationDisplay.ts`
- `app/zone/modules/bookings.tsx`
- `app/zone/modules/components/ZoneBookingsAllocationSheet.tsx`
- `convex/schema.ts`
- `convex/matchrooms.ts`
- `convex/matchroomBroadcast.ts`
- `convex/zoneAdminBooking.ts`
- `convex/wallet.ts`

### Route and surface behavior

- `locationMode` is now a first-class dual-state matchroom concept:
  - `zone`
  - `broadcast`
- `zone` means venue selected at creation time and existing direct zone-admin flow continues unchanged.
- `broadcast` means no venue is confirmed at creation time; the player selects target geographic areas and the venue is resolved later through zone-admin acceptance.
- this behavior is surfaced across:
  - matchroom creation
  - discover / my matchrooms / zone booking request cards
  - matchroom lobby summary
  - zone-admin request allocation sheet
  - notifications and inbox-driven booking negotiation

### Schema and model additions

- `matchrooms` now persist the broadcast venue-resolution state through:
  - `broadcastAreas`
  - `broadcastRequestStatus`
    - `idle`
    - `waiting_for_fill`
    - `waiting_for_zones`
    - `zone_confirmed`
    - `expired`
    - `cancelled`
  - `broadcastRequestStartedAt`
  - `broadcastRequestExpiresAt`
  - `confirmedZoneId`
  - `confirmedBranchId`
  - `venueConfirmedAt`
  - `refundStatus`
  - `refundCompletedAt`
- `bookingRequests` now distinguish direct vs broadcast-origin fanout through:
  - `requestKind`
    - `direct_zone`
    - `broadcast_fanout`
  - `fanoutGroupKey`
  - `responseExpiresAt`
  - `targetAreaLabel`
  - `closedReason`
  - `by_matchroomId` index
- `zoneOffers` now persist broadcast negotiation state through:
  - `requestKind`
  - `responseExpiresAt`

### Matchroom creation flow

- matchroom creation now treats broadcast as a real matchroom creation path, not as a direct booking-request submission shortcut.
- broadcast area selection is handled in:
  - `useMatchroomCreateBroadcastAreas`
  - `BroadcastAreaSelector`
- active broadcast areas are derived from active zones for the selected game only.
- only areas with at least one active eligible zone are selectable.
- when the user switches into `locationMode = "broadcast"`:
  - preferred profile areas (`users.areasPreferred`) are intersected with active area availability
  - matching preferred areas are preselected by default
  - the user can add/remove areas before submit
  - manual edits are preserved and are not reset by unrelated create-form changes
- if the user has no preferred areas, the UI stays valid and allows manual selection from active areas.
- validation now enforces:
  - `locationMode = "zone"` -> specific zone still required
  - `locationMode = "broadcast"` -> at least one selected broadcast area required
- broadcast submit payload now creates a matchroom with:
  - `locationMode = "broadcast"`
  - `broadcastAreas`
  - `broadcastRequestStatus = "waiting_for_fill"`
  - no fake confirmed venue at creation time

### Payment behavior at creation time

- direct zone request flow remains request-based and continues using the pre-existing booking-request path.
- broadcast matchroom flow now creates the matchroom first, then writes the wallet debit using a matchroom-linked reference:
  - `matchroom_create:{matchroomId}`
- this keeps refund reconciliation deterministic for broadcast cancellation.
- the wallet ledger now stores optional `reference` and `metadata` on `wallet.deductFunds`, allowing the original debit and later refund to be tied back to the same matchroom.

### Matchroom card behavior

- shared location rendering now lives in:
  - `app/matchrooms/utils/matchroomLocationDisplay.ts`
- before venue confirmation, broadcast-origin matchroom cards show selected broadcast areas instead of a fake venue.
- compact card summary rule is now:
  - show up to 2 area names
  - append `+N` for overflow
  - example: `DHA, Clifton +2`
- after venue confirmation:
  - primary location switches to the confirmed zone / branch location
  - the broadcast area summary stops being the primary location label
- zone-admin request cards reuse the same location derivation path by mapping request data into matchroom-card-compatible data.

### Lobby detail behavior

- matchroom summary rendering now handles broadcast-specific venue state.
- before venue confirmation, the lobby shows:
  - `Venue not confirmed yet`
  - `Broadcasting to selected areas`
  - the full selected broadcast area list
- after venue confirmation:
  - the confirmed zone / branch becomes the primary displayed venue
  - the lobby stops implying the venue is still unresolved
- this logic is presentation-level only; venue truth remains server-driven from the canonical matchroom document.

### Full-room trigger and fanout

- broadcast zone fanout is server-driven only.
- the trigger now runs when the broadcast room becomes full through server mutation paths:
  - `convex/matchrooms.ts:create` if the room is created already full
  - `convex/matchrooms.ts:join`
  - `convex/matchrooms.ts:payMatchroomSeatIntent`
- dispatch logic is centralized in:
  - `convex/matchroomBroadcast.ts:dispatchBroadcastZoneRequestsForMatchroom`
- fanout helper guarantees:
  - room must be `locationMode = "broadcast"`
  - room must be full
  - room must not already be resolved
  - fanout must not already have started
  - only active zones in selected broadcast areas are targeted
  - game support is respected
- matchroom fanout state changes to:
  - `waiting_for_zones`
  - `broadcastRequestStartedAt = now`
  - `broadcastRequestExpiresAt = now + 2 hours`

### Zone-admin response window

- all eligible zone admins receive the request immediately after full-room fanout.
- broadcast-origin request rows are still created in `bookingRequests`, so the existing zone-admin queue and accept/reject/counter-offer modal flow is reused rather than forked.
- the zone-admin acceptance window is:
  - `2 hours`
- queue payloads now carry:
  - `requestKind`
  - `responseExpiresAt`
  - `targetAreaLabel`
  - selected broadcast areas
- the zone allocation sheet now surfaces broadcast-area context and the request response deadline.

### Accept / reject / counter-offer reuse

- broadcast-origin requests use the same zone-admin action surface already used for direct zone requests:
  - accept
  - reject
  - counter-offer
- no parallel admin negotiation UI was added.
- backend branching is handled through `requestKind = "broadcast_fanout"` so direct-zone behavior remains intact.

### First-accept-wins enforcement

- first-accept-wins is enforced in backend mutation logic, not in UI only.
- the winning path is centralized in:
  - `convex/matchroomBroadcast.ts:confirmBroadcastVenue`
- on the first valid accept:
  - the matchroom is patched with the confirmed zone / branch / location
  - `broadcastRequestStatus` becomes `zone_confirmed`
  - `venueConfirmedAt` is set
  - the winning request is marked accepted
  - sibling broadcast requests are closed with deterministic terminal state
  - sibling pending offers are expired
- later accepts fail because the matchroom has already transitioned to confirmed state; this prevents duplicate venue confirmation at the mutation boundary.

### Counter-offer handling

- broadcast-origin counter-offers still use the existing `zoneOffers` model and the same modal/action path as direct requests.
- broadcast-origin counter-offers now differ in recipient routing:
  - only the resolved captains for the matchroom are notified
  - all participants are not notified for counter-offers
- broadcast counter-offer response window is:
  - `30 minutes`
- this timer is separate from the 2-hour zone-admin acceptance window.
- both captains in the resolved captain set must accept for the counter-offer to confirm the venue.
- if any required captain rejects:
  - the counter-offer closes
  - that request path is rejected
  - the matchroom continues only if alternative broadcast requests/offers are still open
- if the counter-offer timer expires before all required captain approvals are present:
  - the offer expires
  - that request path is closed
  - the matchroom continues only if alternative broadcast requests/offers are still open

### Timeout, cancellation, and refund behavior

- the 2-hour broadcast fanout timeout is scheduled through:
  - `internal.matchroomBroadcast.expireBroadcastFanout`
- the 30-minute broadcast counter-offer timeout is scheduled through:
  - `internal.matchroomBroadcast.expireBroadcastCounterOffer`
- terminal failure handling is centralized in:
  - `convex/matchroomBroadcast.ts:finalizeBroadcastFailure`
- when no zone accepts in time, or no eligible zones are found, the system:
  - marks the broadcast request state as terminal
  - cancels the matchroom
  - closes/expires sibling requests and offers
  - triggers idempotent refunds
  - notifies players of cancellation
- refund behavior now uses wallet-ledger reconciliation rather than ambiguous UI state:
  - original debit remains visible
  - refund transaction is written separately
  - refund reference format:
    - `broadcast_refund:{matchroomId}:{originalTransactionId}`
  - duplicate refunds are prevented by reference-level idempotency checks

### Notification and inbox behavior

- notification delivery reuses the existing canonical notification path.
- broadcast flow now sends canonical notifications for:
  - broadcast request submitted to targeted zone admins
  - venue confirmed to all matchroom participants
  - broadcast matchroom cancelled
  - refund completed
  - captain-only counter-offer expiry
- venue-confirmed notifications route players back into the matchroom lobby.
- captain-only counter-offer notifications stay scoped to captain recipients; all-player broadcast spam is intentionally avoided.

### End-to-end flow chain

- player creates matchroom with `locationMode = "broadcast"`
- preferred areas prefill if available and valid for the selected game
- matchroom is created without a confirmed zone
- room fills through normal participant flow
- server detects full-room transition
- fanout booking requests are created for eligible zones in selected areas
- zone admins get the same accept/reject/counter-offer workflow already used for direct requests
- first valid accept wins and confirms the venue
- all sibling requests/offers are closed
- all players receive venue-confirmed notification
- if no zone confirms within 2 hours:
  - matchroom is cancelled
  - refund is written
  - players are notified

### Confirmed implementation note

- broadcast counter-offers now use strict captain-set resolution before an offer is created.
- for team-vs-team rooms:
  - captain A and captain B must both be explicitly resolvable
  - the system does not silently collapse the approval set to one captain
  - if either required captain is unresolved, the counter-offer is not created and the request is marked with `lifecycleStatus = "counter_offer_waiting_for_captains"`
- for non-team / host-led flows, the existing single-captain approval shape remains valid.

### Verification completed

- `npx convex codegen`
- `npx tsc --noEmit --pretty false`
