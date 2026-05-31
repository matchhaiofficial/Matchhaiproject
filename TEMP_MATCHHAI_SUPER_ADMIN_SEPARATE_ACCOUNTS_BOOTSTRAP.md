# Super Admin — Separate Accounts Bootstrap

Status: implemented on branch `product-ready`. Supersedes
`TEMP_MATCHHAI_SUPER_ADMIN_PARTNER_ONBOARDING.md` (that flow upgraded player
accounts / used a Forgot-Password reset link — both replaced).

## Account model decision

Super Admin accounts are **separate operational/admin accounts**, NOT upgraded
player accounts.

- New account type: `accountType: "super_admin"` (added to the schema union
  alongside `player` and `zone`).
- Admin markers on the user doc: `role: "super_admin"`, `isSystemAdminAccount:
  true`, `hiddenFromPublic: true`, plus `mustChangePassword: true` for forced
  first-login change.
- Backend authorization source of truth is still `role === "super_admin"`
  (`convex/superAdminAccess.ts` / `getAuthenticatedAdmin`). The account type and
  markers are for **separation + hiding**, not for authz.
- Admin accounts skip player onboarding/KYC/games/skill/wallet/teams/phone
  (`onboardingCompleted: true`, `onboardingStep: 4`, no game/wallet fields).

## Why player accounts are NOT upgraded

Players and Super Admins are different account types. Upgrading a player would
(a) expose an operational account across social surfaces and (b) entangle a real
person's player history with an admin identity. The bootstrap therefore creates
brand-new accounts and treats any pre-existing player account on a partner email
as a **conflict** (reported, never modified).

## Partner emails

Created/verified by the bootstrap:

- zeerak@matchhai.com
- junaid@matchhai.com
- saad@matchhai.com
- ehteshan@matchhai.com
- mubeen@matchhai.com

Never touched by the bootstrap (already provisioned + working):

- ovais@matchhai.com  (hard-guarded: skipped even if passed in `emails`)

## Bootstrap button behavior

- Location: Super Admin → Profile tab → **Access Management** card.
- Label: **“Create partner Super Admins”** (confirmation dialog before running).
- Only reachable inside the super-admin route group, which is gated by
  `isSuperAdminProfile` (client) and re-checked server-side on every call.
- Calls `admin.bootstrapPartnerSuperAdmins` (super-admin-gated mutation).
- The card also renders the live access overview (Ovais + partner status) and
  the per-email result of the last run.

Per-email statuses returned (with a safe message, never a password):

- `created` — new separate Super Admin account provisioned.
- `already_exists` — an admin account (by role / accountType / marker) exists; skipped.
- `conflict_existing_player_account` — a player/zone (or foreign auth) account
  owns this email; not created, not modified. Message: *“Player account exists
  with this email. Admin account not created.”*
- `missing_temp_password_env` — temp password env not configured; nothing created.
- `failed` — unexpected error for that email (coarse class only is audit-logged).
- `skipped_protected` — the primary super admin email (ovais) was skipped.

Every created / skipped / conflict / failed action is written to
`superAdminAuditLogs` via `insertSuperAdminAuditLog`.

## Password safety decision

- The temporary first-login password is read ONLY from the server-side env var
  **`SUPER_ADMIN_BOOTSTRAP_TEMP_PASSWORD`** (dev/staging convenience).
- If that env var is missing, NO accounts are created and the mutation returns a
  safe config error for every requested email.
- The product-requested value `Matchhai123!` is **not** hardcoded anywhere in
  code, frontend, tracker, logs, or Git — it lives only in the deployment env.
- The password is hashed via `better-auth/crypto` `hashPassword` before storage;
  the plaintext is never stored on the user doc, returned to the client, or
  logged (audit metadata records only `outcome`, never the secret).
- Created accounts are flagged `mustChangePassword: true`. The existing forced
  change-password gate (`app/super-admin/_layout.tsx` → `/auth/change-password`)
  forces a change before the Super Admin panel opens; the partner enters the
  temp password as “current password”. `users.completeForcedPasswordChange`
  clears the flag only after the auth password actually changes.

### Env variable required

```
SUPER_ADMIN_BOOTSTRAP_TEMP_PASSWORD=<set in Convex dev/staging deployment env only>
```

Do not commit the value. Set it on the `dev:ardent-lynx-28` (matchhai-staging)
deployment for QA.

## Conflict handling

- Existing super admin (role / accountType `super_admin` / `isSystemAdminAccount`)
  → `already_exists`, untouched.
- Existing player/zone account on the same email → `conflict_existing_player_account`,
  untouched (no silent merge / no upgrade).
- Existing Better Auth user with no profile on that email → treated as a conflict
  (cannot safely create a fresh credential), untouched.

## Hidden-from-public filters

Central authority: `convex/userVisibility.ts` `isUserHiddenFromPublic()` now hides
an account when ANY of these is true: role super_admin/super-admin,
`accountType === "super_admin"`, `isSystemAdminAccount`, `hiddenFromPublic`, or
`isHiddenFromDiscovery`. `canViewerAccessPublicUser()` lets only the account
itself or a Super Admin viewer through.

Surfaces covered:

- **Discover** — `convex/discover.ts` queries `accountType == "player"` AND filters
  `isUserHiddenFromPublic` (super admins are a different accountType, so excluded twice over).
- **Player list** — `users.listPlayers` (accountType player + hidden filter).
- **Public profile by id** — `users.getPublicById` (`canViewerAccessPublicUser`).
- **Public profile by username** — `users.getByUsername` now returns null for hidden accounts.
- **Friends** — `social.sendFriendRequest` rejects hidden targets.
- **Teams** — `teams.inviteToTeam` requires existing friendship (friend requests to
  hidden accounts are blocked), so admins can’t be team-invited.
- **Matchroom invites** — `matchrooms.inviteToMatchroom` rejects hidden targets.
- **Leaderboards** — no separate leaderboard user query exists today
  (`ratingEngine.ts` only maps ELO tiers); player-derived surfaces already exclude
  by accountType.
- **Zone admin user views / player search** — these read player-typed users; the new
  accountType + central filter keep admins out.

Super Admin panel still sees admin accounts (dashboard counts via role,
`listSuperAdminAccess`).

## Access overview changes (Task 5)

`admin.listSuperAdminAccess` now additionally returns, per DB-role admin:
`isSystemAdminAccount`, `hiddenFromPublic`, `isSeparateAccount` (alongside the
existing fullName, email, role, accountType, accountStatus, createdAt,
lastActiveAt, source, mustChangePassword, passwordChangedAt). No
passwords/hashes/tokens are exposed. The client type
`SuperAdminDbRoleAccount` was extended to match.

## Files changed

- `convex/schema.ts` — accountType union + `super_admin`; `isSystemAdminAccount`,
  `hiddenFromPublic`, `isHiddenFromDiscovery` optional fields.
- `convex/userVisibility.ts` — central hidden-from-public authority widened.
- `convex/admin.ts` — bootstrap rewritten to create SEPARATE accounts using the
  env temp password, conflict reporting, no player upgrade; `listSuperAdminAccess`
  extended.
- `convex/users.ts` — `getByUsername` hides admin/hidden accounts.
- `convex/social.ts` — `sendFriendRequest` rejects hidden targets.
- `convex/matchrooms.ts` — `inviteToMatchroom` rejects hidden targets.
- `src/utils/accountRouting.ts` — `super_admin` accountType routing hint.
- `src/services/convex/superAdminService.ts` — bootstrap result types/status,
  removed `createMissing`, access-overview type fields.
- `app/super-admin/(tabs)/profile.tsx` — Access Management card + “Create partner
  Super Admins” button + live overview + last-run results.

## Tests run

- `npx convex codegen` — target `dev:ardent-lynx-28` (matchhai-staging). Completed
  (bundled, generated TS bindings). No production deploy, no EAS build.
- `npx tsc -p tsconfig.json --noEmit` — exit 0 (no type errors).
- `git diff --check` — exit 0 (only benign LF→CRLF warnings).

## Known risks

- Schema change is additive/backward-compatible (new optional fields + widened
  union), so existing docs remain valid; no data migration needed.
- Bootstrap depends on `SUPER_ADMIN_BOOTSTRAP_TEMP_PASSWORD` being set in the
  target deployment env; if unset the button safely no-ops with a config error.
- Username for a created admin is derived from the email local-part with a
  collision-avoiding suffix; admins are hidden from username lookup anyway.
- `grantSuperAdmin` (separate, explicit single-user action) can still elevate an
  existing account — by design, not part of the bootstrap path.
- Created accounts are `emailVerified: true` in Better Auth so the partner can log
  in with the temp password immediately; first-login forced change still applies.

## Manual QA checklist

1. Ovais can access the Super Admin panel.
2. “Create partner Super Admins” appears only inside the Super Admin Profile tab
   (route group is super-admin-gated).
3. With `SUPER_ADMIN_BOOTSTRAP_TEMP_PASSWORD` unset → button reports
   “Temporary bootstrap password is not configured.” and creates nothing.
4. With the env set in dev → button creates the missing partner accounts (`created`).
5. Re-running skips existing admin accounts (`already_exists`).
6. An email already used by a player account reports `conflict_existing_player_account`.
7. No password is shown in UI / logs / tracker / audit metadata.
8. A created partner can log in with the temp password.
9. The partner is forced to `/auth/change-password` and cannot skip it.
10. After changing the password, the partner reaches the Super Admin panel.
11. The partner admin account is NOT visible in Discover / Friends / Teams /
    Matchroom invites / public profile / player search / zone-admin user views.
12. A non-Super-Admin cannot call `admin.bootstrapPartnerSuperAdmins`
    (server throws “Super admin access required”).
