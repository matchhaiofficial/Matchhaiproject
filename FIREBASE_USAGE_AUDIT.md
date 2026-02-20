# Firebase Usage Audit (MatchHai)

Generated: 2026-02-19
Scope scanned: `app/`, `src/`, `scripts/`, `functions/`, Firebase config/rules files, and package manifests.

## Executive Summary

- Direct `firebase/firestore` usage files: **50**
- Direct `firebase/auth` usage files: **6**
- Direct `firebase/storage` usage files: **2**
- Direct `firebase-admin` / `firebase-functions` usage files: **4**
- Files importing shared Firebase client config (`src/config/firebaseConfig.ts`): **51**
- `useAuth` consumer files (indirectly coupled to Firebase auth state): **45**

This project is deeply coupled to Firebase across client auth, Firestore CRUD/realtime, Storage uploads, Firestore/Storage security rules, Cloud Functions, and admin scripts.

## 1) Firebase Core Configuration and Project Wiring

- `Matchhaiproject/src/config/firebaseConfig.ts`
  - Uses `firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/storage`
  - Initializes app, Auth (with RN AsyncStorage persistence), Firestore, Storage
  - Contains hardcoded Firebase web config values (`apiKey`, `authDomain`, `projectId`, etc.)
- `Matchhaiproject/firebase.json`
  - Firestore rules + Storage rules + Functions source + emulator config
- `Matchhaiproject/.firebaserc`
  - Firebase project alias (`matchhai-official`)
- `Matchhaiproject/firebase-firestore.d.ts`
  - Declares modules for `firebase/app`, `firebase/auth`, `firebase/firestore`

## 2) Firebase Dependencies in Package Manifests

- `Matchhaiproject/package.json`
  - Dependency: `firebase`
- `Matchhaiproject/functions/package.json`
  - Dependencies: `firebase-admin`, `firebase-functions`
  - Dev dependency: `firebase-functions-test`
  - Scripts use `firebase-tools` (`emulators:start`, `functions:shell`, `deploy`, `functions:log`)

## 3) Client Firebase Auth Usage (Direct SDK)

### Direct imports from `firebase/auth`

- `Matchhaiproject/src/config/firebaseConfig.ts`
- `Matchhaiproject/src/context/AuthContext.tsx`
- `Matchhaiproject/src/services/authService.ts`
- `Matchhaiproject/app/(player)/profile/edit.tsx`
- `Matchhaiproject/scripts/createSuperAdmin.ts`
- `Matchhaiproject/scripts/createSuperAdmin.mjs`

### Auth features used

- Session observer: `onAuthStateChanged` (`AuthContext`)
- Sign up / sign in / sign out: `createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `signOut`
- Password reset: `sendPasswordResetEmail`
- Profile update: `updateProfile`
- Credential reauth + sensitive updates: `EmailAuthProvider`, `reauthenticateWithCredential`, `verifyBeforeUpdateEmail`, `updatePassword`, `reload`

### Indirect auth coupling (UI/business logic)

- `AuthContext` is provided at app root (`Matchhaiproject/app/_layout.tsx`)
- `useAuth` is consumed in **45 files** across routing, tabs, zone/admin sections, matchrooms, social, etc.
- Auth service callsites:
  - `signInWithEmail`: `Matchhaiproject/app/auth/login.tsx`
  - `signUpWithEmail`: `Matchhaiproject/app/auth/register-step4.tsx`, `Matchhaiproject/app/auth/zone-register-step4.tsx`
  - `sendPasswordReset`: `Matchhaiproject/app/auth/forgot-password.tsx`
  - `signOutUser`: `Matchhaiproject/app/home/index.tsx`, `Matchhaiproject/app/(player)/(tabs)/profile.tsx`, `Matchhaiproject/app/zone/(tabs)/index.tsx`, `Matchhaiproject/app/super-admin/(tabs)/index.tsx`, and extra calls in `Matchhaiproject/app/auth/login.tsx`

## 4) Client Firestore Usage (Direct SDK)

### Files importing `firebase/firestore` (50 files)

- `Matchhaiproject/app/(player)/(tabs)/index.tsx`
- `Matchhaiproject/app/(player)/(tabs)/matchrooms.tsx`
- `Matchhaiproject/app/(player)/(tabs)/profile.tsx`
- `Matchhaiproject/app/(player)/(tabs)/teams.tsx`
- `Matchhaiproject/app/(player)/inbox.tsx`
- `Matchhaiproject/app/(player)/my-teams.tsx`
- `Matchhaiproject/app/(player)/profile/[uid].tsx`
- `Matchhaiproject/app/(player)/profile/edit.tsx`
- `Matchhaiproject/app/(player)/profile/game-details.tsx`
- `Matchhaiproject/app/(player)/wallet.tsx`
- `Matchhaiproject/app/(player)/zones/[id].tsx`
- `Matchhaiproject/app/matchrooms/[id].tsx`
- `Matchhaiproject/app/matchrooms/book/pay/[intentId].tsx`
- `Matchhaiproject/app/matchrooms/book/status/[intentId].tsx`
- `Matchhaiproject/app/matchrooms/chat/[id].tsx`
- `Matchhaiproject/app/matchrooms/create/index.tsx`
- `Matchhaiproject/app/super-admin/request/[id].tsx`
- `Matchhaiproject/app/teams/[id].tsx`
- `Matchhaiproject/app/teams/challenge-chat.tsx`
- `Matchhaiproject/app/teams/challenge-create.tsx`
- `Matchhaiproject/app/teams/components/InviteFriendsSheet.tsx`
- `Matchhaiproject/app/zone/(tabs)/branches.tsx`
- `Matchhaiproject/app/zone/(tabs)/index.tsx`
- `Matchhaiproject/app/zone/modules/bookings.tsx`
- `Matchhaiproject/app/zone/modules/notifications.tsx`
- `Matchhaiproject/scripts/createSuperAdmin.mjs`
- `Matchhaiproject/scripts/createSuperAdmin.ts`
- `Matchhaiproject/scripts/fixTeamUids.ts`
- `Matchhaiproject/src/components/InAppNotificationBridge.tsx`
- `Matchhaiproject/src/config/firebaseConfig.ts`
- `Matchhaiproject/src/features/discover/components/DiscoverMatchroomList.tsx`
- `Matchhaiproject/src/features/discover/components/DiscoverPlayerList.tsx`
- `Matchhaiproject/src/features/discover/components/DiscoverTeamList.tsx`
- `Matchhaiproject/src/hooks/useZoneData.ts`
- `Matchhaiproject/src/services/authService.ts`
- `Matchhaiproject/src/services/bookingRequestService.ts`
- `Matchhaiproject/src/services/bookingService.ts`
- `Matchhaiproject/src/services/functions.ts`
- `Matchhaiproject/src/services/matchService.ts`
- `Matchhaiproject/src/services/pricingRuleService.ts`
- `Matchhaiproject/src/services/reportService.ts`
- `Matchhaiproject/src/services/skillRatingService.ts`
- `Matchhaiproject/src/services/superAdminService.ts`
- `Matchhaiproject/src/services/teamMatchService.ts`
- `Matchhaiproject/src/services/teamService.ts`
- `Matchhaiproject/src/services/userService.ts`
- `Matchhaiproject/src/services/zoneAdminBookingService.ts`
- `Matchhaiproject/src/services/zoneAdminResourceService.ts`
- `Matchhaiproject/src/services/zoneBranchMigrationService.ts`
- `Matchhaiproject/src/services/zoneService.ts`

### Firestore operation surface used

- Reads/listens: `getDoc`, `getDocs`, `onSnapshot`, `query`, `where`, `orderBy`, `limit`, `documentId`
- Writes: `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`
- Atomic ops: `runTransaction`, `writeBatch`, `increment`, `arrayUnion`, `arrayRemove`
- Timestamping: `serverTimestamp`, `Timestamp`

### Architectural note

- `Matchhaiproject/src/services/functions.ts` is a very large client-side service layer built on Firestore transactions/batches/realtime patterns and should be treated as a major migration hotspot.

## 5) Firebase Storage Usage

### Files importing `firebase/storage`

- `Matchhaiproject/src/config/firebaseConfig.ts`
- `Matchhaiproject/src/services/teamService.ts`

### Storage behaviors found

- Team logo upload flow in `Matchhaiproject/src/services/teamService.ts`
  - Creates path like `teams/{teamId}/logo_<timestamp>.jpg`
  - Uses `uploadBytes` + `getDownloadURL`

## 6) Firestore and Storage Security Rules

- `Matchhaiproject/firestore.rules`
  - Large rule set covering users, wallet transactions, friends, blocks, notifications, teams/members, matchrooms/chatrooms/messages, booking_intents/requests/offers, zones/branches/resources/pricing_rules, team_match_challenges/chats, zone_registrations
- `Matchhaiproject/storage.rules`
  - Storage access for team assets under `/teams/{teamId}/...`
  - Write permission depends on Firestore team captain ownership

Migration implication: rule logic must be re-implemented server-side in Convex functions (authz + role checks), since Convex does not use Firebase Security Rules.

## 7) Firebase Cloud Functions / Admin SDK Usage

### Source files

- `Matchhaiproject/functions/src/index.ts`
  - `admin.initializeApp()` and exports callable functions
- `Matchhaiproject/functions/src/teams.ts`
  - Firebase callable team operations (create team, join request flow, transfer captain, remove member)
  - Uses admin Firestore batches/transactions
- `Matchhaiproject/functions/src/social.ts`
  - Firebase callable social operations (friend request/respond/remove/block)
  - Uses admin Firestore batches/transactions

### Related compiled outputs (generated)

- `Matchhaiproject/functions/lib/index.js`
- `Matchhaiproject/functions/lib/teams.js`
- `Matchhaiproject/functions/lib/social.js`

## 8) Firebase-Dependent Scripts and Maintenance Utilities

- `Matchhaiproject/scripts/createSuperAdmin.ts`
- `Matchhaiproject/scripts/createSuperAdmin.mjs`
  - Create auth user + Firestore `users/{uid}` with super-admin role
- `Matchhaiproject/scripts/fixTeamUids.ts`
  - Firestore migration helper for `teams.memberUids`
- `Matchhaiproject/scripts/cleanup-users.js`
  - Uses `firebase-admin` to delete all users from Auth + Firestore users collection

## 9) Environment and Secret Footprint

- `Matchhaiproject/src/config/firebaseConfig.ts`
  - Contains Firebase web app config inline
- `Matchhaiproject/scripts/createSuperAdmin.ts`
- `Matchhaiproject/scripts/createSuperAdmin.mjs`
  - Duplicate Firebase web config inline
- `Matchhaiproject/matchhai-backend/.env`
  - Contains `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and a full `FIREBASE_PRIVATE_KEY` value

## 10) Firebase-Specific Collections/Paths Observed (Rules + Services)

Primary entities and subcollections coupled to Firebase data model:

- `users`
- `users/{uid}/wallet_transactions`
- `users/{uid}/friends`
- `users/{uid}/blocks`
- `notifications`
- `teams`
- `teams/{teamId}/members`
- `matchrooms`
- `chatrooms`
- `chatrooms/{chatId}/messages`
- `booking_intents`
- `booking_requests`
- `booking_offers`
- `zones`
- `zones/{zoneId}/pricing_rules`
- `zones/{zoneId}/branches`
- `zones/{zoneId}/branches/{branchId}/resources`
- `team_match_challenges`
- `team_match_chats`
- `team_match_chats/{chatId}/messages`
- `zone_registrations`
- Storage path: `teams/{teamId}/...`

## 11) Migration Hotspots (Highest Effort)

- `Matchhaiproject/src/services/functions.ts` (large Firestore-heavy domain logic)
- `Matchhaiproject/src/services/teamMatchService.ts`
- `Matchhaiproject/src/services/matchService.ts`
- `Matchhaiproject/src/services/bookingService.ts`
- `Matchhaiproject/src/services/zoneService.ts`
- `Matchhaiproject/app/matchrooms/chat/[id].tsx` (realtime chat)
- `Matchhaiproject/app/(player)/inbox.tsx` and `Matchhaiproject/src/components/InAppNotificationBridge.tsx` (realtime notifications)
- `Matchhaiproject/src/context/AuthContext.tsx` + all `useAuth` consumers

## 12) Existing Convex Planning Artifact

- `Matchhaiproject/CONVEX_MIGRATION_PLAN.md` already exists and references many of the above surfaces.

---

## Practical Next Step

Start replacement in this order to keep UI mostly unchanged:

1. Replace `src/config/firebaseConfig.ts` with a backend-agnostic client wrapper (Convex client + auth adapter).
2. Replace `src/context/AuthContext.tsx` contract first (preserve `useAuth()` shape).
3. Migrate service layer files under `src/services/` to Convex queries/mutations/actions while keeping UI call signatures stable.
4. Migrate realtime listeners (`onSnapshot`) to Convex reactive queries.
5. Remove Firebase rules/functions/scripts only after feature parity is reached.
