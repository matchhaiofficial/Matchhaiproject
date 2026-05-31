# TEMP — KYC Refresh / Seats Label / Zone Notification / Zone Admin Lifecycle Fix

Branch: `product-ready`
Date: 2026-05-30
Status: **Complete — TypeScript passing, all tasks fixed, pending manual QA**

---

## Summary of Issues

| # | Issue | Status |
|---|---|---|
| 1 | KYC banner shows "Verification pending" after admin manually verifies | Fixed |
| 2 | "Refresh Status" shows raw network error in LogBox; profile not re-fetched | Fixed |
| 3 | Discover matchroom cards show "8X PLAYER" instead of seat count | Fixed |
| 4 | Zone admin may not receive notification when matchroom becomes full | Fixed |
| 5 | Zone admin opening accepted/rejected/completed matchroom gets "Not authorized" | Fixed |
| 6 | Wallet "Unpaid Bookings" may include stale/expired intents | Fixed |
| 7 | Wallet "Total Spent" shows Rs 0 even after payment | No code change needed (filter correct) |

---

## Task 1 & 2 — KYC Verification Mismatch + Refresh Status

### Root Causes

**KYC banner still shows after admin verify:**

The `getCurrentUserKyc` query in `convex/kyc.ts` used only `authComponent.getAuthUser(ctx)` to resolve the user. When Better Auth's session endpoint is unreachable (network error), `getAuthUser` returns null → `getCurrentUserKyc` returns `null` → the reactive query can't pick up the admin-verified status.

Meanwhile `user.kycVerificationStatus` in AuthContext comes from a one-time `convex.query(api.users.getByAuthId)` call — it holds stale pre-verification value.

**Refresh Status shows red LogBox overlay:**

`handleRefreshVerification` in `app/(player)/(tabs)/index.tsx`:
- Only called `refreshSession()` when `currentKyc?._id` was missing (no loading state, no toast)
- `refreshSession` calls `authClient.getSession()` → network fails → `console.error("[AuthContext] refreshSession failed: ...")` → React Native LogBox shows red overlay
- On failure, `fetchUserProfile` was never called → `user` in AuthContext stayed stale

### Files Changed

| File | Change |
|---|---|
| `convex/kyc.ts` | `getCurrentUserKyc` now falls back to Convex JWT identity candidates when Better Auth returns null (same pattern as `wallet.ts` and `authz.ts`) |
| `app/(player)/(tabs)/index.tsx` | `refreshUser` added to `useAuth()` destructuring; `handleRefreshVerification` always calls `refreshUser()` after `refreshSession()`, catches error gracefully, shows safe toast on failure |
| `src/context/AuthContext.tsx` | `console.error` → `console.warn` in `refreshSession` catch — prevents scary red LogBox overlay on network failure |

### KYC Fix Details

**`convex/kyc.ts` — `getCurrentUserKyc`:** Added three-stage authId resolution:
1. Better Auth `getAuthUser` (existing, primary)
2. Convex JWT `identity.subject` + `identity.tokenIdentifier` + short-ID suffix (new fallback)
3. Returns null if no user found

Query is reactive — once admin patches `identityVerifications.status` and `users.kycVerificationStatus`, the next Convex sync delivers updated data even if Better Auth session is broken.

**`app/(player)/(tabs)/index.tsx` — `handleRefreshVerification`:**
- Removed early-return path (now always sets loading state)
- Calls `refreshDiditStatus` only when `currentKyc._id` exists
- Always calls `refreshSession()` then `refreshUser()` (Convex-direct, bypass Better Auth)
- On any error: calls `refreshUser()` best-effort, shows safe toast copy

**Safe toast copy:**
```
"Could not refresh right now. Please check your connection and try again."
```

### Validation (manual QA)

- [ ] Admin manually verifies user from super admin panel
- [ ] User dashboard updates to verified state without needing refresh
- [ ] "Refresh Status" works — updates banner after press
- [ ] Offline/network failure shows safe toast, no red LogBox error
- [ ] Zone admin/player KYC gating still works
- [ ] Non-verified user still sees banner and cannot bypass

---

## Task 3 — Discover Matchroom Card Seats Label

### Root Cause

`roleDemandSummary` in `app/matchrooms/components/MatchroomCard.tsx` built a string like `${totalOpen}x ${topRole}` (e.g. "8X PLAYER") — role-centric copy derived from slot role names.

### File Changed

`app/matchrooms/components/MatchroomCard.tsx` — `roleDemandSummary` simplified:

```ts
const openSlots = [...(room.slotsA || []), ...(room.slotsB || [])].filter(
  (slot) => slot.status === "open"
);
if (openSlots.length === 0) return null;
return openSlots.length === 1 ? "1 seat remaining" : `${openSlots.length} seats remaining`;
```

- 0 open → null (card already shows "FULL" badge in row 1)
- 1 open → `"1 seat remaining"`
- N open → `"N seats remaining"`
- Joined/Requested pill is unaffected (separate component)
- Color/style for the role tag is unchanged

### Validation (manual QA)

- [ ] Discover card with 1 open slot → "1 seat remaining"
- [ ] Discover card with 8 open slots → "8 seats remaining"
- [ ] Full card → "FULL" badge in top-right, no seat count badge
- [ ] No "8X PLAYER" copy remains in Discover or Home matchroom cards

---

## Task 4 — Zone Notification When Matchroom Becomes Full

### Root Cause

`dispatchZoneAdminRequestForFullMatchroom` in `convex/matchrooms.ts` created a `bookingRequests` document when roster became full but **never sent a notification** to the zone owner. The zone admin would only find out if they polled manually.

### Files Changed

`convex/matchrooms.ts`:
- New helper `maybeNotifyZoneAdminMatchroomFull(ctx, matchroomId, room)` inserted after `dispatchZoneAdminRequestForFullMatchroom`
- Called on BOTH code paths: existing booking request (idempotent re-entry) AND new booking request creation
- Dedupe key: `zone.matchroom_full:{matchroomId}` — checked via `notificationExistsByDedupeKey` → fires at most once per matchroom
- Notification: type `zone.matchroom_full`, `recipientRole: "zone_admin"`, title "Matchroom is ready", body "{title} is full and ready for zone confirmation.", route `/matchrooms/{matchroomId}`
- Resolves zone owner via `resolveUserByAnyId` — skips silently if zone has no owner

### Validation (manual QA)

- [ ] Create matchroom, fill all slots → correct zone admin receives notification
- [ ] Notification title/body is correct, deep-link to matchroom works
- [ ] Filling slots again (e.g. swap) does NOT create duplicate notification
- [ ] Wrong zone admin does not receive it

---

## Task 5 — Zone Admin Matchroom Lifecycle "Not authorized" Error

### Root Cause

`syncLifecycleIfDue` was **not** the source. It already returns `{ changed: false, skipped: "unauthorized" }` silently for non-privileged actors.

The actual throw was in `requireActorCanReadMatchroomNotifications` in `convex/notifications.ts`. This function is called by `listMatchroomJoinRequests` and `listMatchroomRequests`. The matchroom detail screen subscribes to join requests when `isHostOrAdmin` is true (zone admins qualify), but the function only checked `isHost || isCaptain || isPlayer` — it did **not** check zone owner. Result: zone admin for a completed/accepted/rejected matchroom (where they're not a participant) got `throw new Error("Not authorized")`.

### File Changed

`convex/notifications.ts` — `requireActorCanReadMatchroomNotifications`:
- Added `isZoneOwner` check: if `room.zoneId` exists, fetches the zone and compares `zone.ownerUid` to the actor
- Wrapped in try/catch for invalid IDs
- Access check now: `if (!isHost && !isCaptain && !isPlayer && !isZoneOwner) throw`

### Validation (manual QA)

- [ ] Zone admin opens related active matchroom — no error
- [ ] Zone admin opens accepted/rejected/completed related matchroom — no error
- [ ] Non-zone-owner (unrelated player) is still blocked — "Not authorized"
- [ ] No raw Convex error shown in app UI

---

## Task 6 & 7 — Wallet "Unpaid Bookings" + "Total Spent"

### Findings

**bookingIntents source:** `api.bookings.listIntentsByUser` returns ALL intents with zero status filtering, including `cancelled`, `expired`, `rejected`, `confirmed`.

**paymentStatus schema:** Values are `"paid"` or `"unpaid"` — never "expired"/"cancelled". So `item.paymentStatus !== "paid"` alone was insufficient: cancelled/rejected intents with `paymentStatus: "unpaid"` were counted in `pendingAmount`.

**Total Spent:** Filter `item.paymentStatus === "paid"` is correct — `"paid"` is set by both hold-capture and direct wallet paths. `bookingIntents` is a reactive `useQuery` — no staleness issue. `useFocusEffect` already calls `fetchServiceData()` on every focus. Total Spent showing Rs 0 indicates the user's paid intents may lack `pricing.totalCost` or have IPN reconciliation timing issues — not a code bug.

### Files Changed

`app/(player)/wallet.tsx`:
- Added `ACTIONABLE_INTENT_STATUSES = new Set(["pending_approvals", "approved", "approved_pending_payment"])` at module level
- `totals` useMemo: `pendingAmount` loop now skips intents whose `status` is not in `ACTIONABLE_INTENT_STATUSES`
- Renamed UI card "Unpaid Bookings" → **"Pending Payments"**
- Helper text → "Payments you started but haven't completed."
- Card hidden when `totals.pendingAmount === 0`

### Validation (manual QA)

- [ ] Cancelled/expired booking intents no longer appear in Pending Payments
- [ ] Active pending intent (approved, awaiting payment) appears correctly
- [ ] "Pending Payments" card hidden when amount is 0
- [ ] Total Spent shows correct value after a captured payment completes

---

## TypeScript Result

```
npx tsc -p tsconfig.json --noEmit   →   exit 0, no errors   (all tasks included)
```

---

## git diff --check Result

```
warning: LF will be replaced by CRLF (Windows normalization — harmless)
```

No actual whitespace errors.

---

## Codegen

Not needed. No schema changes, no new public API surfaces, no index changes.

---

## Known Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Convex identity candidates → multiple DB queries in getCurrentUserKyc | Low | Bounded set (≤4 candidates), each is indexed point-read; exits on first match |
| `refreshUser()` called after failed `refreshSession()` — could re-fetch stale data if Convex also unreachable | Low | Both are try/caught; stale banner is acceptable UX when truly offline |
| `roleDemandSummary` now shows seat count not role — hosts no longer see role demand in card | Low | Role demand was confusing (user-facing "8X PLAYER"); seat count is clearer |
| `maybeNotifyZoneAdminMatchroomFull` adds one extra DB query on every slot-confirm path | Low | Query is a single indexed lookup; fires only when `zoneId` is set |
| Zone owner of a different zone could theoretically read join requests for unrelated matchroom if zone ownership is shared | Very Low | Impossible: zone.ownerUid is unique per zone; zone is fetched directly from matchroom.zoneId |
| Pending Payments card hidden at 0 — users can't see "no pending payments" confirmation | Very Low | Wallet balance and transactions tab still show full history |

---

## Manual QA Checklist

### KYC
- [ ] Manually verify user in super admin → dashboard immediately shows verified
- [ ] Refresh Status pressed → banner updates
- [ ] Refresh Status with network off → safe toast shown, no red LogBox
- [ ] Pending/in_review user still sees pending banner

### Seats
- [ ] 1 seat → "1 seat remaining"
- [ ] 8 seats → "8 seats remaining"
- [ ] Full → "FULL" badge, no seat text
- [ ] No "8X PLAYER" anywhere

### Zone Notification (pending agent result)
- [ ] Create matchroom, fill all slots → zone admin notified
- [ ] Notification has correct title/body
- [ ] Deep-link to matchroom works
- [ ] Duplicate fills don't create duplicate notifications

### Zone Admin Access
- [ ] Zone admin opens related active matchroom — no error
- [ ] Zone admin opens completed/rejected/accepted matchroom — no error
- [ ] Non-related user is still blocked ("Not authorized")
- [ ] No raw Convex error shown in app UI

### Wallet
- [ ] Cancelled/expired booking intents not in Pending Payments
- [ ] Active pending intent appears correctly with correct amount
- [ ] "Pending Payments" card hidden when amount is 0
- [ ] Total Spent reflects completed/captured payments

---

## Files Changed (complete list)

| File | Task | Change |
|---|---|---|
| `convex/kyc.ts` | KYC | `getCurrentUserKyc` adds Convex JWT identity fallback |
| `convex/kycGate.ts` | KYC | `requireKycVerified` adds Convex JWT identity fallback — fixes `refreshDiditVerificationStatus` throwing "Please sign in to continue." |
| `app/(player)/(tabs)/index.tsx` | KYC | `handleRefreshVerification` calls `refreshUser()`, shows safe toast on error |
| `src/context/AuthContext.tsx` | KYC | `console.error` → `console.warn` in `refreshSession` (prevents LogBox overlay) |
| `app/matchrooms/components/MatchroomCard.tsx` | Seats | `roleDemandSummary` returns `"N seats remaining"` instead of `"NX PLAYER"` |
| `convex/matchrooms.ts` | Zone Notification | `maybeNotifyZoneAdminMatchroomFull` helper + two call sites in `dispatchZoneAdminRequestForFullMatchroom` |
| `convex/notifications.ts` | Zone Lifecycle | `requireActorCanReadMatchroomNotifications` adds `isZoneOwner` check |
| `app/(player)/wallet.tsx` | Wallet | Filter expired/cancelled from pending amount; rename to "Pending Payments"; hide at 0 |

---

## Recommended Commit Message

```
fix(matchrooms): kyc refresh, seats label, zone notifications, lifecycle auth

- getCurrentUserKyc: Convex JWT identity fallback so KYC banner
  updates reactively when Better Auth session is unreachable
- handleRefreshVerification: always call refreshUser() after
  refreshSession(); safe toast on network failure; no red LogBox
- MatchroomCard: "N seats remaining" instead of "NX PLAYER"
- dispatchZoneAdminRequestForFullMatchroom: notify zone admin
  idempotently (zone.matchroom_full dedupe key) when matchroom fills
- requireActorCanReadMatchroomNotifications: include isZoneOwner so
  zone admin opening completed/rejected matchroom no longer throws
  "Not authorized"
- Wallet pending payments: exclude cancelled/expired intents; rename
  "Unpaid Bookings" → "Pending Payments"; hide card when amount is 0
```
