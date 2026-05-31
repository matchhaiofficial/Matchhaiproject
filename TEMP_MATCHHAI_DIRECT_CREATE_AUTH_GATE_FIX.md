# TEMP — Direct/Wallet-Paid Matchroom Create Auth Gate Fix

Branch: `product-ready`
Date: 2026-05-30
Status: **Fixed, TypeScript passing, pending manual QA**

---

## Root Cause

When a user creates a matchroom using the wallet/direct-paid flow, the backend
mutation `matchrooms:create` calls `deductWalletFunds` → `getWalletUserRecord`.

`getWalletUserRecord` in `convex/wallet.ts` attempted user lookup **only** via
`authComponent.getAuthUser(ctx).userId` (Better Auth session). For the affected
user, Better Auth's `getAuthUser` returned `null` (no active Better Auth session
token in the request), so the lookup was skipped entirely and the function threw:

```
Authentication required.
```

Meanwhile, the Convex JWT identity **was** present and valid:

| Field | Value |
|---|---|
| `identity.tokenIdentifier` | `https://ardent-lynx-28.convex.site\|k572cb9t31ndw63yp3142n4115871ety` |
| `identity.subject` | `k572cb9t31ndw63yp3142n4115871ety` |
| `users.authId` (stored in DB) | `k572cb9t31ndw63yp3142n4115871ety` |

The `requireCurrentUser` helper in `authz.ts` **does** include `identity.subject`
in its candidate list, so the upstream auth gate logged and passed. But
`getWalletUserRecord` had no Convex identity fallback at all, causing the
second auth check — inside the wallet deduction — to fail.

The `AUTH_SESSION_ERROR_MARKER` regex in `userFacingErrors.ts` mapped
"Authentication required." to "Your session has expired. Please log in again.",
which was a misleading message since the session was valid.

---

## Auth Identity Values Found in Logs

```
authId (logged):  "https://ardent-lynx-28.convex.site|k572cb9t31ndw63yp3142n4115871ety"
expectedUid:      "m17eq47wks4fbjgn3mw1p4zwxs870k0z"   ← DB user._id
expectedAuthId:   "k572cb9t31ndw63yp3142n4115871ety"   ← DB users.authId (short form)
```

`authId` in the log = `actor.authUser?.userId ?? actor.identity?.tokenIdentifier`
— the fact that tokenIdentifier was used confirms `authUser.userId` was null.

---

## Files Inspected

- `convex/authz.ts` — `getCurrentUser`, `requireCurrentUser`, `requireVerifiedActor`
- `convex/matchrooms.ts` — `create`, `createMatchroomFromValidatedArgs`, `requireVerifiedActor`
- `convex/wallet.ts` — `getWalletUserRecord`, `deductWalletFunds`
- `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts` — submit flow
- `src/services/convex/matchService.ts` — `createMatchroom`, `isAuthSessionError`
- `src/utils/userFacingErrors.ts` — `getUserFacingErrorMessage`, error markers

---

## Files Changed

| File | Change |
|---|---|
| `convex/wallet.ts` | **PRIMARY FIX** — `getWalletUserRecord` now falls back to Convex JWT identity with normalized candidates when Better Auth returns null |
| `convex/authz.ts` | **DEFENSE** — `getCurrentUser` now also extracts the short-ID suffix from `tokenIdentifier`/`subject` (`"https://issuer\|shortId"` → also tries `"shortId"`) |
| `src/utils/userFacingErrors.ts` | **UX** — Split `AUTH_SESSION_ERROR_MARKER` into `SESSION_EXPIRED_MARKER` and `AUTH_REQUIRED_MARKER`; "Authentication required." now maps to "We could not verify your session. Please refresh and try again." instead of "Your session has expired." |

---

## Shared Auth Helper Changes (`convex/wallet.ts`)

`getWalletUserRecord` now has three resolution stages:

1. **Better Auth** — `authComponent.getAuthUser(ctx).userId` looked up via `by_authId` index *(existing)*
2. **Convex JWT identity fallback** — `identity.subject` and `identity.tokenIdentifier`, plus suffix after `|` for full-URL format, each tried via `by_authId` *(new)*
3. **Internal server call** — direct `ctx.db.get(userId)` only when `allowInternalUserId: true` and caller has already verified the actor *(existing)*

The fix preserves all security properties:
- User identity is always derived server-side via `ctx.auth.getUserIdentity()`.
- Client-supplied `userId` is only accepted for internal mutations (`internalMutation`) where it is already server-verified.
- No client-supplied identifiers bypass the DB lookup.

---

## Direct Create Validation

Flow: user logs in → Convex token present → creates matchroom via wallet/direct-paid →
`matchrooms:create` → `createMatchroomFromValidatedArgs` → `requireVerifiedActor` passes →
`deductWalletFunds` → `getWalletUserRecord` → **now finds user via identity.subject** →
wallet deducted → matchroom created.

---

## Provider / Bundle Flow Regression Notes

The Easypaisa/IPN flow goes through `finalizePaidCreateFromProvider` (internal mutation),
which uses `allowInternalUserId: true` and does not call `deductWalletFunds` through
the public path. This flow was not touched. No changes to:
- Easypaisa checkout / IPN / reconciliation logic
- `sourcePaymentOrderRefNum` idempotency check
- Payment math / payout formula

---

## TypeScript Result

```
npx tsc -p tsconfig.json --noEmit   →   exit 0, no errors
```

---

## git diff --check Result

```
warning: in the working copy of 'convex/authz.ts', LF will be replaced by CRLF
warning: in the working copy of 'convex/wallet.ts', LF will be replaced by CRLF
```

Harmless Windows line-ending normalization. No actual whitespace errors.

---

## Codegen

Not needed. No schema changes, no new public API functions, no index changes.

---

## Known Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Multiple Convex identity candidates → multiple DB queries | Low | Bounded set (≤4 candidates), each is an indexed point-read |
| A user whose DB `authId` was accidentally set to a full URL | Very Low | Both full URL and suffix are tried; first match wins |
| Better Auth lookup intermittently fails | Low | Existing try/catch — falls through to Convex identity which is always present for authenticated requests |

---

## Manual QA Checklist

1. [ ] Friend user logs in
2. [ ] Confirm session exists and Convex token is fetched
3. [ ] Create Valorant matchroom using wallet/direct paid → succeeds
4. [ ] No false "Authentication required." error
5. [ ] No false "session expired" error; if identity verification fails, shows "We could not verify your session. Please refresh and try again."
6. [ ] Create matchroom using bundle/Easypaisa flow → still works
7. [ ] User A cannot create as User B (hostUid mismatch still rejected by `requireVerifiedActor`)
8. [ ] User A cannot pass another hostUid to bypass auth
9. [ ] CS2 / Tekken create with wallet balance works if applicable
10. [ ] Existing dashboard / profile / wallet / report actor-scoped APIs still work

---

## Recommended Commit Message

```
fix(auth): normalize Convex identity for actor-scoped create flows

getWalletUserRecord in wallet.ts only resolved users via Better Auth
session (getAuthUser). When that returns null — which happens when the
Convex token is present but no Better Auth session is active — the
wallet deduction inside matchrooms:create threw "Authentication required."
even though the user was authenticated.

Fix: add a Convex JWT identity fallback that tries identity.subject,
identity.tokenIdentifier, and the short-ID suffix after "|" against
the by_authId index. Also add suffix normalization to getCurrentUser in
authz.ts as defense in depth.

UX: split the client-side auth error marker so "Authentication required"
shows "We could not verify your session. Please refresh and try again."
instead of the misleading "Your session has expired." message.

No schema changes. No codegen needed. TypeScript passes clean.
```
