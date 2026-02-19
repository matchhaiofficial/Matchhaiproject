# Convex Migration Plan (MatchHai)

This is a step-by-step checklist to migrate the existing Expo Router app from Firebase (Auth/Firestore/Storage/Functions) to a Convex-native backend with real-time queries and mutations.

## Scope And Goals
- Keep the Expo frontend app and screens.
- Remove Firebase usage from the frontend completely.
- Move all backend logic to Convex (real-time by default via reactive queries).
- Keep venue admin + super-admin flows.
- Keep Steam/FACEIT/PSN integrations, but route them behind Convex actions (the app talks only to Convex).

## Locked Product Decisions (From Our Discussion)
- Platforms: iOS + Android only.
- Auth: Convex Auth, with Email + Google + Apple sign-in.
- Account lifecycle in v1: login/register only (defer password reset, verification, deletion).
- Notifications: in-app real-time only (no background push for now).
- Payments: wallet-only (no payment gateway); keep user self-top-up for dev/test.
- Matching/discovery targeting: area-based only (no radius/geo math initially).
- Data: migrate core entities including full chat + notifications history.
- Media: do not migrate Firebase Storage objects; re-upload after cutover.
- Migration approach: incremental feature-by-feature (keep app runnable between slices).
- Frontend integration style: prefer direct Convex hooks in screens (`useQuery`, `useMutation`).
- Repo layout: add Convex backend under `./convex` in this repo.

## Convex Docs: Source Of Truth Links
Keep these links current when implementing:
- https://docs.convex.dev/home
- https://docs.convex.dev/client/react-native
- https://docs.convex.dev/database/schemas
- https://docs.convex.dev/database/indexes
- https://docs.convex.dev/functions/query-functions
- https://docs.convex.dev/functions/mutation-functions
- https://docs.convex.dev/functions/actions
- https://docs.convex.dev/functions/http-actions
- https://docs.convex.dev/file-storage/upload-files
- https://docs.convex.dev/search
- https://docs.convex.dev/database/import-export/import
- https://docs.convex.dev/auth/convex-auth
- https://labs.convex.dev/auth/setup

## Repo Facts (Current Backend Surfaces To Remove/Replace)
### Firebase usage hotspots
- Firebase client init: `src/config/firebaseConfig.ts`
- Auth state gating: `src/context/AuthContext.tsx`, `app/index.tsx`, `app/_layout.tsx`
- Firestore usage in services and routes (examples): `src/services/*`, `app/**/*.tsx`, `src/features/discover/*`
- Firebase Functions project exists: `functions/`
- Firebase rules exist: `firestore.rules`, `storage.rules`

### Firestore collections used in code
Top-level collections referenced by `collection(db, ...)`/`doc(db, ...)`:
- `users`
- `teams`
- `matchrooms`
- `chatrooms`
- `booking_intents`
- `booking_requests`
- `booking_offers`
- `zones`
- `notifications`
- `team_match_challenges`
- `team_match_chats`
- `reports`

Subcollection patterns used in code:
- `users/{uid}/friends/*`
- `teams/{teamId}/members/*`
- `zones/{zoneId}/branches/*`
- `zones/{zoneId}/branches/{branchId}/resources/*`
- `users/{uid}/wallet_transactions/*`

### Existing flows present in code (to account for in migration)
- Password/email changes in profile edit: `app/(player)/profile/edit.tsx` (defer in v1, but be aware of UX impact)
- Forgot password screen exists: `app/auth/forgot-password.tsx` (defer or remove until supported)
- Matchroom result + vote screens exist: `app/matchrooms/result.tsx`, `app/matchrooms/vote.tsx`
- “My matchrooms” exists: `app/matchrooms/my.tsx`
- Friends screen exists: `app/(player)/friends.tsx`
- Reports collection exists: `src/services/reportService.ts` (moderation/abuse flow)

## Deliverables
- [ ] Keep this file as the authoritative checklist and mark items done as implementation progresses.
- [ ] Optional: add a brief `DECISIONS.md` if new product decisions are made during the migration.

---

## Phase 0: Baseline And Guardrails
- [ ] Define a manual smoke checklist for current app behavior (pre-migration) covering: auth gate, discover lists, matchroom create, lobby, chat, teams, venue admin dashboard, super-admin request review.
- [ ] Create a “Firebase touchpoints” inventory: every file importing `firebase/*` or using `db/auth/storage`.
- [ ] Decide a cutover date and whether to dual-run Firebase + Convex temporarily (only if needed for production migration).
- [ ] Define initial acceptance criteria for v1 migration (what must work end-to-end).

## Phase 1: Add Convex Backend (`./convex`)
- [ ] Create Convex project in this repo (per Convex docs).
- [ ] Configure Convex Auth (deferred until Firebase Auth is removed):
  - [ ] Enable Email/password auth (deferred).
  - [ ] Enable Google OAuth (deferred).
  - [ ] Enable Apple sign-in (iOS) (deferred).
  - [ ] Configure Expo deep link redirects for auth callback flows (deferred).
- [x] Add environment variable wiring for the app (at minimum `EXPO_PUBLIC_CONVEX_URL`).
- [ ] Implement role model in Convex (player, zoneAdmin, superAdmin) with explicit server-side authorization helpers.
- [ ] Establish a consistent server timestamp strategy and “soft delete” conventions where needed.

## Phase 2: Data Model (Convex Schema + Indexes)
Create `convex/schema.ts` and define tables and indexes aligned to current use:
- [x] `users`
  - fields: profile, games/roles, wallet balance, platform links (steam/faceit/psn), role flags or role enum, createdAt/updatedAt.
  - indexes: by email (if needed), by username, by role, by createdAt.
- [x] `teams` and `teamMembers`
  - indexes: by captainId, by memberId, by visibility, by createdAt.
- [x] `zones`, `zoneBranches`, `zoneResources`
  - indexes: by ownerId, by area, by status, by zoneId/branchId.
- [x] `matchrooms`
  - indexes: by status, by scheduledAt, by hostId, by zoneId, by teamId, by createdAt.
- [x] `chatrooms`, `chatMessages`
  - indexes: `chatMessages` by `chatroomId + createdAt` for pagination.
- [x] `teamMatchChallenges`, `teamMatchChats`, `teamMatchMessages`
  - indexes: by teamId(s), by status, by scheduledAt; messages paginated by `chatId + createdAt`.
- [x] `bookingRequests`, `bookingOffers`, `bookingIntents`
  - indexes: by status, by requestedByUserId, by zoneOwnerId, by createdAt.
- [x] `notifications`
  - indexes: by `toUserId + createdAt`, by `status`, by `type`.
- [x] `reports`
  - indexes: by status, by createdAt, by reportedUserId or matchroomId (as applicable).
- [x] Decide how to model “delete for me” in chat (per-user deletion markers vs per-message visibility records). Use per-message `deletedFor` uid list (matches current UI).

## Phase 3: Convex Functions (Queries/Mutations/Actions)
Implement backend logic in `convex/` by domain. Each mutation/action must enforce auth and roles.

### 3.1 Users
- [x] `getCurrentUser` query (derived from auth identity).
- [x] `updateProfile` mutation.
- [x] Games/roles mutations (add/remove game, update role preferences).
- [x] Friends system:
  - [x] Define friend request + accept/decline model (if kept).
  - [x] Queries for friend list and pending requests.
- [x] Wallet:
  - [x] `walletTopUpDev` mutation (gated by env flag or dev build check).
  - [x] Wallet transaction ledger write-on-change.

### 3.2 Teams
- [x] Create team.
- [x] Update team info.
- [x] Invite friend to team (creates notification).
- [x] Accept/decline invite.
- [x] Captain actions: remove member, transfer captain (if desired).
- [x] Team discover query (public listing + search).

### 3.3 Zones (Venue Admin)
- [x] Zone registration flow (draft -> submitted).
- [x] Branch CRUD.
- [x] Resource CRUD + status updates.
- [x] Pricing rules CRUD + “apply pricing” helper for booking computation.
- [x] Admin dashboards:
  - [x] Real-time booking queue query.
  - [x] Real-time matchrooms for zone query.
  - [x] Simple analytics queries (counts, revenue approximations if wallet-based).

### 3.4 Matchrooms
- [x] Create matchroom mutation (player and/or captain modes).
- [x] Join/leave mutation.
- [x] Slot reservation mutation with concurrency safety (no double-claim).
- [x] Invite players (notification fan-out).
- [x] Match lifecycle transitions (scheduled -> active -> completed).
  - [x] Results and votes:
  - [x] Define result submission and vote collection model.
  - [x] Enforce “who can submit” rules (captain/host/admin).

### 3.5 Chat
- [x] Create chatroom (or derive chatroom per matchroom/team-challenge).
- [x] Post message mutation.
- [x] Paginated messages query.
- [x] Seen receipts mutation.
- [x] Delete-for-me semantics (explicitly modeled).

### 3.6 Reverse Bidding / Booking
- [x] Create booking request (broadcast) mutation.
- [x] Zone owner creates offer mutation.
- [x] User accepts offer -> booking intent mutation.
- [x] Wallet pay mutation:
  - [x] Atomic check of balance + decrement + mark paid + append ledger entry.
- [x] Confirm booking -> create/attach matchroom.
- [x] Expiry/cancellation logic (scheduled jobs or timestamp-checked queries).

### 3.7 Notifications
- [x] Server-side notification creation helpers (called from other mutations/actions).
- [x] Inbox query (paginated).
- [x] Mark seen/read mutation.
- [x] Delete notification mutation.

### 3.8 Super-admin
- [x] Approve/deny zone registrations.
- [x] Assign roles (zoneAdmin/superAdmin) and revoke roles.
- [x] Moderate reports (close/resolve).

### 3.9 External Integrations (Steam/FACEIT/PSN)
- [x] Convex actions that call the existing Node services.
- [x] Cache results in Convex (per user/provider with TTL) to control costs.
- [x] Define data model for storing verification snapshots in `users` (or separate table).

## Phase 4: Expo App Migration (Incremental Slices)
Guideline: migrate one vertical slice at a time; remove Firebase usage in that slice fully before moving to the next.

### Slice A: Auth + Role-based Routing
- [x] Add Convex client/provider wiring in `app/_layout.tsx`.
- [x] Replace `src/context/AuthContext.tsx` usage with Convex Auth.
- [x] Update `app/index.tsx` routing gates (player vs zone admin vs super-admin) based on Convex user record roles.
- [x] Migrate `app/auth/*` screens:
  - [x] Register.
  - [x] Login.
  - [x] Google/Apple buttons.
  - [x] Decide what to do with `app/auth/forgot-password.tsx` for v1 (hide/remove or show “coming soon”).

### Slice B: Profile
- [ ] `app/(player)/(tabs)/profile.tsx` reads user via `useQuery`.
- [ ] `app/(player)/profile/edit.tsx` uses mutations to update profile fields.
- [ ] `app/(player)/profile/game-details.tsx` uses mutations for games/roles.
- [ ] Platform verification UX calls Convex actions (no direct HTTP to Node services).

### Slice C: Discover + Search
- [ ] Migrate `src/features/discover/*` lists to Convex queries:
  - [ ] Matchrooms.
  - [ ] Teams.
  - [ ] Zones.
  - [ ] Players.
- [ ] Implement Convex search indexes + UI wiring for search matchmaking.

### Slice D: Matchrooms + Chat
- [ ] Migrate `app/(player)/(tabs)/matchrooms.tsx`, `app/matchrooms/[id].tsx` to Convex queries/mutations.
- [ ] Migrate `app/matchrooms/chat/[id].tsx` to Convex chat model.
- [ ] Migrate `app/matchrooms/result.tsx` and `app/matchrooms/vote.tsx`.

### Slice E: Reverse Bid / Booking / Wallet
- [ ] Migrate `app/matchrooms/create/index.tsx` flow to Convex:
  - [ ] Area selection -> create booking request.
  - [ ] Real-time offers stream.
  - [ ] Accept offer -> booking intent.
- [ ] Migrate `app/matchrooms/book/*` and `app/(player)/wallet.tsx` to wallet-only pay and ledger.

### Slice F: Teams + Challenges
- [ ] Migrate team creation and detail routes: `app/(player)/(tabs)/teams.tsx`, `app/teams/*`.
- [ ] Migrate challenge flows: `app/teams/challenge*.tsx` and challenge chat.

### Slice G: Inbox/Notifications
- [ ] Replace Firestore-based inbox subscriptions with Convex queries.
- [ ] Remove/replace `src/components/InAppNotificationBridge.tsx` (or rewrite to observe Convex notifications).

### Slice H: Venue Admin + Super-admin
- [ ] Migrate `app/zone/(tabs)/*` and `app/zone/modules/*` to Convex.
- [ ] Migrate `app/super-admin/*` to Convex.

## Phase 5: Firestore -> Convex Data Migration (Core Entities)
Goal: migrate users/teams/zones/matchrooms/bookings/chats/notifications/reports (full history), no media.
- [ ] Write an explicit mapping spec:
  - Firestore collection/document path -> Convex table + fields.
  - Field transformations (timestamps, enums, nested arrays, legacy shapes).
  - ID strategy: store original Firestore IDs in Convex fields for traceability.
- [ ] Implement one-time migration tooling:
  - [ ] Firestore export reader (Admin SDK).
  - [ ] Convex import writer (Convex import format or controlled HTTP action).
- [ ] Migrate in dependency order:
  - [ ] Users.
  - [ ] Teams + members.
  - [ ] Zones + branches + resources.
  - [ ] Booking requests/offers/intents.
  - [ ] Matchrooms.
  - [ ] Chatrooms + messages.
  - [ ] Notifications.
  - [ ] Reports.
- [ ] Validate migration:
  - [ ] Document counts by table.
  - [ ] Referential integrity spot checks.
  - [ ] Sampling: open N matchrooms and verify chat history loads.

## Phase 6: Remove Firebase (Frontend) And Retire Legacy Backend Code
- [ ] Remove Firebase dependencies from the Expo app:
  - [ ] Remove `firebase` from `package.json`.
  - [ ] Remove `src/config/firebaseConfig.ts` and all imports.
  - [ ] Replace all Firestore `onSnapshot` usage with Convex reactive queries.
- [ ] Remove `firebase-firestore.d.ts` if it only exists for Firebase typing shims.
- [ ] Decide what to do with legacy Firebase server code:
  - [ ] Archive or delete `functions/` once Convex covers those behaviors.
  - [ ] Archive `firestore.rules` and `storage.rules` under `legacy/` (optional).

## Phase 7: QA And Acceptance (Feature Checklist)
- [ ] Auth:
  - [ ] Email login/register works.
  - [ ] Google sign-in works.
  - [ ] Apple sign-in works on iOS.
  - [ ] Role-based routing works (player/zone admin/super-admin).
- [ ] Discover:
  - [ ] Lists update in real time when underlying data changes.
  - [ ] Search returns expected results.
- [ ] Reverse bidding:
  - [ ] Create request -> offers stream -> accept -> booking intent.
  - [ ] Wallet pay -> matchroom created/linked.
- [ ] Matchroom lobby:
  - [ ] Join/leave.
  - [ ] Slot reservation concurrency (no double-claim).
- [ ] Chat:
  - [ ] Pagination.
  - [ ] Seen receipts.
  - [ ] Delete-for-me semantics match current UX.
- [ ] Teams:
  - [ ] Create.
  - [ ] Invite and accept/decline.
  - [ ] Captain permissions enforced server-side.
- [ ] Admin:
  - [ ] Booking queue real-time updates.
  - [ ] Resource status updates reflect immediately.
  - [ ] Pricing rules CRUD works.
- [ ] Super-admin:
  - [ ] Venue registration approvals change access immediately.
  - [ ] Reports moderation works.

## Suggested “Missing Flows” Backlog (Not In V1 By Decision)
- [ ] Password reset (there is a screen today, but v1 scope defers it).
- [ ] Email verification flows.
- [ ] Account deletion.
- [ ] Background push notifications (offers/requests while app is closed).
- [ ] Radius-based geo discovery (geohash/grid indexing).
- [ ] Real payment gateway (Stripe) and secure wallet funding.
