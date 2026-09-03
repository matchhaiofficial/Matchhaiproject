# MatchHai Notifications P0 Fixes

Branch: `product-ready`
Tracker: `TEMP_MATCHHAI_NOTIFICATIONS_P0_FIXES.md`
Scope: P0 notification launch blockers only. No P1/P2/P3 work, no deploy, no EAS build, no commit, no push.

## Summary

Implemented the three approved P0 notification fixes and the existing deterministic unit-test fix:

1. Push token registration is now bound to the authenticated Convex user.
2. Super Admin notification fan-out now uses one shared recipient resolver.
3. Legacy public Team Challenge lifecycle endpoints fail closed.
4. `matchroomLifecycle` open-room status test now passes the deterministic test clock.

No schema change was required. No Convex codegen was run.

## P0-1 Push Token Ownership

Files changed:

- `convex/pushNotifications.ts`
- `src/components/PushRegistrationBridge.tsx`
- `src/services/convex/authService.ts`

Behavior changed:

- `pushNotifications.upsertDevice` still accepts the existing `userId` arg for generated-API compatibility, but now calls `requireCurrentUser(ctx)` and rejects any mismatch.
- The stored `pushDevices.userId` is written from the authenticated actor, not from trusted client ownership.
- Device upsert/deactivate lookups are scoped through the authenticated user's device rows, not global `installationId` ownership.
- Reused Expo tokens on another account/device deactivate older token rows so a token is not active under multiple users.
- `deactivateDevice` now requires authentication and clears `expoPushToken` for the current user's installation.
- `PushRegistrationBridge` no longer tries unauthenticated deactivation after the user is already gone.
- `signOutUser` attempts authenticated push-device deactivation before clearing the session/signing out.

Compatibility:

- No API shape change was made, so generated Convex files did not need to change.
- Existing `syncPushRegistration({ userId })` and `PushRegistrationBridge` call shape remains compatible.

Residual risk:

- Account-switch cleanup still depends on the sign-out path running before session teardown and on token re-registration deactivating duplicate token rows.
- Full Expo receipt pruning remains P1, not part of this P0 pass.

## P0-2 Super Admin Notification Recipients

Files changed:

- `convex/superAdminAccess.ts`
- `convex/withdrawalNotifications.ts`
- `convex/kycNotifications.ts`
- `convex/reports.ts`
- `convex/support.ts`
- `convex/easypaisa.ts`
- `convex/zones.ts`
- `convex/matchrooms.ts`
- `convex/teamChallenges.ts`

Behavior changed:

- Added `listSuperAdminNotificationRecipients(ctx)` as the shared notification fan-out resolver.
- The resolver includes:
  - canonical DB role `super_admin`
  - legacy DB role `super-admin`
  - separate `accountType: "super_admin"` accounts
  - active env allowlist emails when a matching user record exists
- Notification producers for withdrawal review, KYC review, reports, support, payment anomalies/reconciliation, zone review, matchroom result/admin/payment alerts, and Team Challenge payment alerts now use the shared resolver.

No unrelated Super Admin onboarding UI or admin dashboard redesign was changed.

## P0-3 Legacy Team Challenge Lifecycle

File changed:

- `convex/teamChallenges.ts`

Behavior changed:

- Legacy public `teamChallenges.create` now throws `Deprecated Team Challenge lifecycle endpoint is disabled.`
- Legacy public `teamChallenges.complete` now throws the same error.
- Current app services already use the modern `createFull` flow; no frontend caller was found for the disabled endpoints.

This blocks the previous bypass where a client could create partial challenges without notifications/payment/venue state or mark a challenge completed without matchroom result verification.

## Existing Test Fix

File changed:

- `__tests__/unit/matchroomLifecycle.test.ts`

Behavior changed:

- The `open room shows open` assertion now passes the deterministic fixture clock to `getRoomDisplayStatus`.
- Production lifecycle logic was not weakened.

## Regression Coverage Added

File added:

- `__tests__/security/notificationP0Regression.test.ts`

Coverage:

- Push registration must call `requireCurrentUser`, reject mismatched client `userId`, and persist authenticated `user._id`.
- Super Admin recipient helper must include canonical role, legacy role, account type, and env-allowlist email lookup.
- Legacy Team Challenge `create` and `complete` endpoint bodies must remain disabled.

## Validation Results

Commands run:

- `npx tsc -p tsconfig.json --noEmit`
- `npm test -- --runInBand`
- `git status --porcelain`

Results:

- `npx tsc -p tsconfig.json --noEmit`: PASS.
- `npm test -- --runInBand`: PASS.
  - 29 test suites passed, 29 total.
  - 184 tests passed, 43 todo, 227 total.
- `git status --porcelain`:
  - Modified: `__tests__/unit/matchroomLifecycle.test.ts`
  - Modified: `convex/easypaisa.ts`
  - Modified: `convex/kycNotifications.ts`
  - Modified: `convex/matchrooms.ts`
  - Modified: `convex/pushNotifications.ts`
  - Modified: `convex/reports.ts`
  - Modified: `convex/superAdminAccess.ts`
  - Modified: `convex/support.ts`
  - Modified: `convex/teamChallenges.ts`
  - Modified: `convex/withdrawalNotifications.ts`
  - Modified: `convex/zones.ts`
  - Modified: `src/components/PushRegistrationBridge.tsx`
  - Modified: `src/services/convex/authService.ts`
  - Untracked: `TEMP_MATCHHAI_NOTIFICATIONS_FULL_SYSTEM_AUDIT.md`
  - Untracked: `TEMP_MATCHHAI_NOTIFICATIONS_P0_FIXES.md`
  - Untracked: `__tests__/security/notificationP0Regression.test.ts`

Note: `TEMP_MATCHHAI_NOTIFICATIONS_FULL_SYSTEM_AUDIT.md` was pre-existing from the audit turn and was not modified by this P0 implementation.

## Recommended Commit Message

`fix: harden notification p0 launch blockers`
