# Super Admin Partner Onboarding

Companion to `TEMP_MATCHHAI_SUPER_ADMIN_ACCESS_MANAGEMENT_FIX.md`. No passwords appear in this file. No production deploy, no EAS build, no push.

---

## Why we are NOT hardcoding a shared password

- A shared/hardcoded password (e.g. one value for all five partners) is a single point of compromise and cannot be attributed to one person.
- Hardcoding any password in the repo/frontend/tracker leaks it permanently in git history.
- Instead: each provisioned account gets a **unique, cryptographically-random** temp password that **no one ever sees**, and the partner sets their **own** password via the existing reset link. The `mustChangePassword` flag + in-app gate enforce the first-login change.

## Chosen secure onboarding method

**Preferred (no creation):** partner self-registers (sets their own password) → existing Super Admin grants the role. Use `admin.grantSuperAdmin` (built last phase) or `admin.bootstrapPartnerSuperAdmins` (default mode upgrades existing + reports missing).

**Provisioning (when partners haven't registered):** `admin.bootstrapPartnerSuperAdmins({ createMissing: true })` creates each missing user with a random unknown temp password, sets `role = super_admin` + `mustChangePassword = true`, then the partner uses **Forgot Password** to set their own password. The auth provider (Better Auth) already supports reset links via Resend (`sendResetPassword`), and `forgot-password.tsx` / `reset-password.tsx` already exist.

## Partner emails (target)

- zeerak@matchhai.com
- junaid@matchhai.com
- saad@matchhai.com
- ehteshan@matchhai.com
- mubeen@matchhai.com

Existing working Super Admin: ovais@matchhai.com — **unchanged**; the gate/flag do not touch accounts that aren't flagged.

## State of each partner (checked on dev — safe public query)

Checked via `users.getByEmail` (returns only email/accountType/accountStatus — no role, hashes, or tokens). Role/`super_admin` confirmation requires the authenticated `getSuperAdminAccessOverview` (a signed-in Super Admin session, not available from the headless CLI — not bypassed).

| Email | Account exists? | accountType | DB `super_admin` role | Recommended next action |
|---|---|---|---|---|
| ovais@matchhai.com | **Yes** (`m176ejrvbss5a8bwksjg91sefn86mw6f`) | player | Active Super Admin (functionally; confirm role via authenticated overview) | None — leave untouched |
| zeerak@matchhai.com | **No** | — | — | Partner registers normally, then grant `super_admin` |
| junaid@matchhai.com | **No** | — | — | Partner registers normally, then grant `super_admin` |
| saad@matchhai.com | **No** | — | — | Partner registers normally, then grant `super_admin` |
| ehteshan@matchhai.com | **No** | — | — | Partner registers normally, then grant `super_admin` |
| mubeen@matchhai.com | **No** | — | — | Partner registers normally, then grant `super_admin` |

**Summary:** Ovais exists and is the active Super Admin. **None** of the five partners exist yet → all must **register first**, then an existing Super Admin grants the role (`grantSuperAdmin` / `bootstrapPartnerSuperAdmins` default mode). `createMissing: true` was intentionally **not** run (Resend/email readiness not yet confirmed).

## Task 4 — Forced password-change gate QA (code-reviewed)

| # | Check | Result |
|---|---|---|
| 1 | Existing Super Admin reaches panel | PASS — `_layout` allows when `isSuperAdmin`; Ovais not flagged, no gate. |
| 2 | Non-Super Admin blocked (UI + backend) | PASS — `_layout` redirects to `/auth/login`; backend `getAuthenticatedAdmin`/`requireSuperAdmin` throw. |
| 3 | Flagged user redirected to `/auth/change-password` | PASS — `_layout`: `if (user.mustChangePassword === true) return <Redirect href="/auth/change-password" />` after auth + super-admin checks. |
| 4 | Cannot skip change screen | PASS — screen has no cancel/back; only auto-redirects out when NOT flagged; submit requires valid form. |
| 5 | Flag clears after change | PASS — `changePassword` → `users.completeForcedPasswordChange` (sets `mustChangePassword=false`, `passwordChangedAt`) → `refreshUser`. |
| 6 | Backend APIs still require real Super Admin | PASS — unchanged; every admin function calls `getAuthenticatedAdmin`. |
| 7 | No passwords/secrets logged | PASS — screen maps raw auth errors to friendly text; no password logging. |

**Manual runtime QA remaining (needs device/emulator + a flagged account):** sign in as a flagged partner and verify the live redirect, that the screen truly cannot be dismissed, that the flag clears after a real change, and that the partner then reaches the panel.

## Task 1 — Auth/password capability findings

| Capability | Finding |
|---|---|
| Auth provider | Better Auth (`@convex-dev/better-auth`) + Expo + phone plugin. `emailAndPassword.enabled = true`. |
| Backend user creation | Yes — `components.betterAuth.adapter.create` (user + credential account). Proven by `bootstrapInitialSuperAdmin`. |
| Password reset/setup links | Yes — `sendResetPassword` wired to Resend; `forgot-password.tsx` + `reset-password.tsx` screens exist; `authService.sendPasswordReset` / `resetPasswordWithToken`. Depends on Resend domain verification for delivery. |
| In-app change password | Yes — `authClient.changePassword({ currentPassword, newPassword })`, already used in player/zone profile edit screens. |
| `mustChangePassword` field | **Did not exist** → added to `users` schema. |
| Force-change-on-login flow | **Did not exist** → added (super-admin layout gate + forced screen). |
| Change-password screen | In-profile only; **new** dedicated forced screen added at `app/auth/change-password.tsx`. |

## Task 2 — First-login forced password change (implemented)

- Schema: `mustChangePassword`, `passwordChangedAt`, `passwordResetRequestedAt`, `createdBySuperAdmin` on `users`.
- Gate: `app/super-admin/_layout.tsx` redirects to `/auth/change-password` when `user.mustChangePassword === true` (after auth + super-admin checks). Targeted — does **not** affect non-flagged users. Backend authz unchanged.
- Screen: `app/auth/change-password.tsx` — current + new + confirm; validates min length, upper/lower/number/special, confirm match, and **new ≠ current**; cannot be skipped (auto-redirects out only when not flagged). On success: `authClient.changePassword` → `users.completeForcedPasswordChange` (clears flag, sets `passwordChangedAt`) → `refreshUser` → route home. Raw auth errors are mapped to friendly messages.

## Task 3 — Secure partner onboarding method (implemented)

`admin.bootstrapPartnerSuperAdmins({ sessionToken, emails?, createMissing?, reason? })`:
- **Super-admin-gated** (`getAuthenticatedAdmin`); never callable by normal users; actor never from client input.
- Default emails = the five partners; per email:
  - profile + `super_admin` already → `already_super_admin`.
  - profile exists, other/no role → patch `super_admin` → `granted`.
  - Better Auth user exists, no profile → create linked profile w/ `super_admin` → `linked`.
  - nothing + `createMissing` → create auth user + credential account w/ **random temp password** + profile `super_admin` + `mustChangePassword=true` + `createdBySuperAdmin` → `created`.
  - nothing + not `createMissing` → `must_register` (reported, not created).
- Audit-logs every action (`bootstrap_partner_super_admin`, module `access`, target user + outcome). No password in audit/return.
- Returns `passwordSetupMethod: "forgot_password_reset_link"` + per-email status. **No password is ever returned, printed, logged or stored in plaintext.**

## Task 4 — Access overview (updated)

`admin.listSuperAdminAccess` now also returns `mustChangePassword` and `passwordChangedAt` per DB-role admin (plus existing role/source/status). Still no hashes/tokens.

## Password safety summary

- No `Matchhai123!` or any literal password in code/frontend/tracker.
- Per-user **unique** random temp password via `crypto.getRandomValues` (4 char classes guaranteed + shuffle); never returned/printed/stored in plaintext (only Better Auth's hash persists).
- `mustChangePassword=true`, `passwordChangedAt=null`, `createdBySuperAdmin=<actor>` on provisioned accounts.
- Forced change on first login; flag cleared only after the auth password actually changes.

## How to safely add the five partners

1. Sign in as an existing Super Admin (e.g. ovais@matchhai.com).
2. Either have each partner self-register first, then call `bootstrapPartnerSuperAdmins()` (default) — upgrades existing, reports any not yet registered; **or** call `bootstrapPartnerSuperAdmins({ createMissing: true })` to provision missing accounts.
3. Each provisioned/created partner uses **Forgot Password** (enter their email) to receive a reset link and set their own password.
4. Partner signs in → routed to Super Admin → forced change-password gate (if flagged) → sets new password → access granted.
5. Confirm with `listSuperAdminAccess` (`getSuperAdminAccessOverview`).
6. Every Super Admin API call remains backend-verified by `role = super_admin` / centralized helper.

## Validation results

- `npx tsc -p tsconfig.json --noEmit`: **no errors in any file changed/added this phase.** Two pre-existing errors remain in untouched files (`app/zone/wallet.tsx:143`, `src/features/zoneAdmin/modules.ts:72`).
- `git diff --check`: clean (only LF→CRLF notices).
- `npx convex codegen`: ran against the **dev** deployment (`dev:` target) after schema + API changes; regenerated `convex/_generated/`. No production deploy, no EAS build, no push.

## Known risks / notes

- Reset-link delivery depends on Resend domain verification for `matchhai.com`; if unverified, partners can't receive the email until it's verified. Provisioned accounts are still safely created (random unknown password) and can be reset once email works.
- A partner who sets their password via the reset link will still see the forced change once (flag set at creation) — acceptable, enforces a deliberate in-app change; clears thereafter.
- No admin UI screen was added (kept low-risk); onboarding runs via `superAdminService.bootstrapPartnerSuperAdmins` / direct mutation.
- `completeForcedPasswordChange` is a UX/policy gate, not an auth boundary — provisioned accounts already require a self-set password to log in at all, so the flag is defense-in-depth.

## Manual QA checklist (run against dev)

1. [ ] Ovais Super Admin still works (not flagged, no gate).
2. [ ] Partner with `super_admin` can log in.
3. [ ] Flagged partner is forced to change password on first login.
4. [ ] Forced change-password screen cannot be skipped.
5. [ ] After changing password, partner reaches Super Admin.
6. [ ] Non-Super Admin cannot access Super Admin.
7. [ ] Revoked partner loses access.
8. [ ] `listSuperAdminAccess` shows Ovais + partners with correct `source` + `mustChangePassword`.
9. [ ] No password is committed, returned, or printed in logs.
10. [ ] Audit logs show `bootstrap_partner_super_admin` + role/password-change actions.

## Recommended commit message

```
fix(admin): add secure partner super admin onboarding
```
