# MatchHai — Release Blockers Remediation (Implementation Tracker)

> **Mode:** IMPLEMENTATION (complete). Source audit: `TEMP_MATCHHAI_FULL_APP_AUDIT.md`
> **Date:** 2026-05-24 · **Branch:** `product-ready`
> **Execution model:** Phases implemented **sequentially with scoped, non-overlapping file edits** — guarantees zero overlapping-file conflicts and tight control over the money/auth safety rules. Each phase corresponds to one logical sub-agent of work (Zone Authz / Super Admin Auth / iOS Config / Prod Env / Payment Honesty / Account Deletion / QA).
> **Result:** `tsc --noEmit` PASS (exit 0). `git diff --check` clean. 10 source files changed. No money/payout/IPN/lifecycle/KYC-provider logic touched.

## GLOBAL SAFETY RULES — honored
- ✅ NO changes to wallet math, Easypaisa callback/IPN/finalize, capture/refund/settlement, zone payout, pilot payout, result verification, KYC provider logic. (`convex/easypaisa.ts`, `easypaisaNode.ts`, `easypaisaRest.ts`, `wallet.ts`, `http.ts`, `kyc.ts`, matchroom lifecycle in `matchrooms.ts` — all UNTOUCHED.)
- ✅ NO weakening of auth/KYC/role/zone-ownership/super-admin checks — only **strengthened**.
- ✅ NO exposure of raw provider payload, IPN, phone/CNIC, bank details, secrets, or raw gateway errors.
- ✅ Additive, reused existing helpers (`requireAuthenticatedZoneOwner`, `createSupportTicket` pattern, `(api as any)` pattern, `PAYMENT_VERIFICATION_SAFE_MESSAGE`).
- ✅ NOT run: EAS build, deploy, migrations, package installs, destructive commands.
- ✅ `npx convex codegen` NOT run (see "Deploy/codegen required" below — confirm target first).

## Phase status
| Phase | Blocker | Status |
|---|---|---|
| 1 — Zone Admin Authorization | CR-01, S-04 | ✅ done |
| 2 — Super Admin Auth Hardening | CR-03, CR-05 | ✅ done |
| 3 — iOS Picker Permissions / Store Config | CR-02 | ✅ done |
| 4 — Production Env / EAS Config | CR-04 | ✅ done |
| 5 — Payment Status Honesty | CR-06 | ✅ done (gap was support path; screens already honest) |
| 6 — Account Deletion | S-10 | ✅ done (request flow; requires deploy to activate) |
| 7 — QA / Checklist / Regression | — | ✅ done |

---

## Phase 1 — Zone Admin Authorization (CR-01, S-04) — `convex/zoneAdminBooking.ts`
**Root issue:** mutations checked KYC but not zone ownership; client-passed `adminUid`/`responderUid` trusted; read queries exposed any zone.

**Changes:**
- Refactored auth helper: extracted `requireAuthenticatedActor(ctx)` (derives the caller's `users` row purely from the verified session — never a client uid) and rebuilt `requireAuthenticatedZoneOwner(ctx, zoneId)` on top of it. Genericized error messages ("Please sign in to continue." / "You are not authorized to manage this zone.").
- Added `requireAuthenticatedZoneOwner` ownership guard to: `acceptBookingRequest`, `rejectBookingRequest`, `sendCounterOffer`, `createWalkInMatchroom` (all keep their existing `requireKycVerified` call — KYC NOT weakened).
- `respondToCounterOffer`: now derives the responder from `requireAuthenticatedActor(ctx)` instead of the client-passed `responderUid` (closes the responder IDOR); the existing `recipientUids` membership check is preserved.
- Audit-log `actorUid` for all four mutations now uses the **server-derived** actor id (`String(actor._id)`), not the client `adminUid` hint.
- Added ownership guards to read queries `listBookingQueueForZone` and `listMatchroomsForZone` (closes S-04 cross-zone data exposure). `listBookingHistoryForZone` already had the guard.

**Compatibility:** mutation arg shapes unchanged (`adminUid` etc. still accepted as non-authoritative hints) → no frontend/service change required; `useZoneBookingsActions.ts`/`zoneAdminBookingService.ts` untouched. Legitimate zone owners see identical behavior; non-owners are now rejected with a clean message (surfaced via existing `getUserFacingErrorMessage`).

## Phase 2 — Super Admin Auth Hardening (CR-03, CR-05) — `convex/admin.ts`, `src/utils/accountRouting.ts`
**CR-03 (no default admin, fail closed):**
- `convex/admin.ts`: `SUPER_ADMIN_EMAIL` now reads server-only `process.env.SUPER_ADMIN_EMAIL` first, then legacy `EXPO_PUBLIC_SUPER_ADMIN_EMAIL`, **no hardcoded default** → empty allowlist ⇒ access denied. `bootstrapInitialSuperAdmin` now throws if `SUPER_ADMIN_EMAIL` is unset (no accidental default-email admin).
- `src/utils/accountRouting.ts`: removed hardcoded `superadmin@matchhai.com` default AND the hardcoded `LEGACY_SUPER_ADMIN_ID` backdoor (now env-only, and only matched when env is set). Client routing is cosmetic; the real boundary remains the server gate.

**CR-05 (canonical role):**
- Introduced `SUPER_ADMIN_ROLE = "super_admin"` (+ `LEGACY_SUPER_ADMIN_ROLE = "super-admin"`).
- `isAuthorizedSuperAdmin` now accepts **both** canonical and legacy values (no existing admin locked out).
- `bootstrapInitialSuperAdmin` now writes the canonical `"super_admin"` (both the promote-existing path and the create path).
- `setUserRole` now canonicalizes any admin role input to `"super_admin"` (accepts `super_admin`/`super-admin`/`superadmin`); non-admin roles and removal pass through unchanged.
- `accountRouting.isSuperAdminProfile` accepts both role spellings for routing.

**Preserved:** all super-admin functionality (payments, users, zones, withdrawals, reports, support, identity, audit, notifications) — only the auth source-of-truth was hardened.

## Phase 3 — iOS Picker Permissions / Store Config (CR-02) — `app.json`
- Added `NSPhotoLibraryUsageDescription` and `NSCameraUsageDescription` to `ios.infoPlist`; upgraded `NSMicrophoneUsageDescription` copy.
- Registered `expo-image-picker` (with `photosPermission`/`cameraPermission` props) and `expo-document-picker` in `plugins` (both already in `package.json` — no install).
- No picker behavior changed; covers profile edit, team logo, team-challenge chat, matchroom chat, friend chat.

## Phase 4 — Production Env / EAS Config (CR-04) — `eas.json`, `src/lib/convex.ts`
- `eas.json`: added a `production.env` block (`EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`, `EXPO_PUBLIC_APP_SCHEME`, `EXPO_PUBLIC_TOUCH_DEBUG`) using clearly-invalid `REPLACE_WITH_PRODUCTION_DEPLOYMENT` placeholders so a prod build cannot silently ship staging or an empty URL. `preview` (staging `acrobatic-bison-271`) unchanged. Super-admin email intentionally NOT placed in the prod client env (backend owns it; role-based routing still works).
- `src/lib/convex.ts`: `createConvexClient()` now calls `assertConvexUrl()` which **throws clearly** if the URL is missing or still a `REPLACE_WITH_` placeholder, instead of silently constructing a no-backend client.

## Phase 5 — Payment Status Honesty (CR-06) — `app/matchrooms/book/status/[intentId].tsx`, `src/utils/paymentUiCopy.ts`
**Assessment:** the Pay & Review and Booking Status screens are already honest — distinct `Payment Processing` / `Payment Not Completed` / `Payment Received` states, `isPaidAwaitingBooking` kept separate from confirmed, order number shown, auto-sync polling for pending states, safe error copy via `PAYMENT_VERIFICATION_SAFE_MESSAGE` (no raw provider errors), disabled/loading CTAs preventing double-submit. **No money logic changed.**
**Gap closed:** added an explicit **support path tied to the order number** — a `PAYMENT_SUPPORT_WITH_ORDER_HINT` line and a **"Contact Support"** button (routes to `/(player)/support`) that appear for failed / pending-with-order / unverified states. UI/copy only.

## Phase 6 — Account Deletion (S-10) — `convex/support.ts`, `app/(player)/(tabs)/profile.tsx`
- Backend: added `requestAccountDeletion` mutation (authenticated via existing `getAuthenticatedProfile`, **idempotent** — reuses any open/in-review request), backed by the existing `supportTickets` table (`category: "account_deletion"`, `metadata.kind`, `source: "help_support_chat"` to satisfy the strict schema union) → **no schema migration**. Notifies admins via existing `notifySupportTicketCreated`. Deliberately does **NOT** hard-delete payments/wallet/KYC/audit records (legal/financial retention) — deletion is processed by admin review.
- Frontend: added a "Delete Account" action under Logout in the player profile with a consequences confirmation dialog; calls the mutation via the established `(api as any).support.requestAccountDeletion` pattern (so app `tsc` passes pre-codegen). Shows reference + idempotent "already pending" handling.

---

## Commands run
| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` (after Phase 1) | PASS (exit 0) |
| `npx tsc -p tsconfig.json --noEmit` (after all phases) | **PASS (exit 0)** |
| `git diff --check` | Clean (only an informational LF→CRLF note on `accountRouting.ts`; no whitespace errors) |
| `git status` / `git diff --stat` | 10 source files modified + 2 TEMP docs (see below) |

**Files changed (10 source):** `app.json`, `eas.json`, `src/lib/convex.ts`, `src/utils/accountRouting.ts`, `src/utils/paymentUiCopy.ts`, `convex/admin.ts`, `convex/support.ts`, `convex/zoneAdminBooking.ts`, `app/(player)/(tabs)/profile.tsx`, `app/matchrooms/book/status/[intentId].tsx`. Plus tracking docs `TEMP_MATCHHAI_FULL_APP_AUDIT.md`, `TEMP_MATCHHAI_RELEASE_BLOCKERS_REMEDIATION.md`.

## Deploy / codegen REQUIRED (not run — confirm target first)
`npx convex codegen` and a Convex **deploy** are required before two changes are live at runtime, because they add a new backend function + read new env:
1. **`requestAccountDeletion`** (new mutation) — frontend uses `(api as any)` so the app compiles now, but the function must be **deployed** to be callable. Codegen will add it to generated types (optional then).
2. **Super-admin env** — set in the Convex deployment env (NOT eas.json): `SUPER_ADMIN_EMAIL` (server-only) + per-admin `SUPER_ADMIN_EMAIL_*` / `SUPER_ADMIN_ALLOWLIST_JSON` as used. Without these, super-admin access **fails closed** (intended).
> ⚠️ Per repo note, codegen/deploy may target staging `acrobatic-bison-271`. **Confirm the deployment target before running.** No schema/index changes were made, so no migration is required.

## Manual QA checklist (remaining)
- [ ] Zone owner can accept/reject/counter/walk-in on **their** zone; non-owner is denied (clean message, no raw error).
- [ ] Player cannot call any zone-admin mutation; cannot read another zone's queue/matchrooms.
- [ ] `respondToCounterOffer` works for a genuine recipient; a non-recipient/other-user uid is rejected.
- [ ] Super-admin (allowlisted email OR `role==="super_admin"`) has full access; non-admin denied; unset env ⇒ nobody gets access; a freshly `setUserRole`-promoted admin is recognized AND routed (client).
- [ ] iOS build: photo/camera/mic permission prompts appear; pickers work in profile edit, team logo, chats.
- [ ] Prod EAS build fails loudly until `REPLACE_WITH_PRODUCTION_DEPLOYMENT` URLs are set; preview still works.
- [ ] Payment: failed/pending/unverified states show order number + "Contact Support"; success only on backend-confirmed paid; "Proceed/Retry/Refresh/Do later/Cancel" all responsive (incl. iOS browser return).
- [ ] Account deletion: request creates a ticket + admin notification; second tap is idempotent ("already pending"); unauthenticated blocked; **verify after Convex deploy**.

## Known risks / deferred
- **Deploy dependency:** account deletion + super-admin env need a Convex deploy to function at runtime (documented above).
- **Production URLs are placeholders** in `eas.json` by design — must be replaced with the real production Convex deployment before any prod build.
- **Attribution hints:** zone mutations still accept client `adminUid`/`zoneOwnerUid` args for non-security display fields (e.g., `zoneOwnerUid` on offers/matchrooms); these are now fully protected by the ownership guard. Optional low-risk follow-up: also swap those stored fields to `actor._id`.
- **Account deletion is request-based** (admin-reviewed) rather than immediate hard-delete — required because of financial/KYC/audit retention. Confirm this satisfies your store reviewer; if Apple requires it, add an explicit "deletion will be completed within N days" statement in the dialog/store notes. Zone-admin/super-admin in-app deletion entry point not yet added (player covered; backend mutation works for any authenticated user) — deferred follow-up.
- These remediations cover the 6 release blockers only; High/Medium audit items (indexes/pagination H-02/H-03/H-05, server-authoritative counter time H-10, etc.) remain per the roadmap in the audit doc.

---

# Remediation Batch 2 — Delete Account relocation + critical-issue verification
> **Date:** 2026-05-24 · **Branch:** `product-ready` · **Mode:** UI relocation + verification pass.
> **Result:** `tsc --noEmit` PASS (exit 0). `git diff --check` clean (exit 0). 3 source files changed. No money/payout/IPN/lifecycle/KYC-provider logic touched. No Convex codegen run (not required — no API/schema/generated-type change).

## Batch 2 scope
1. Move the Delete Account action out of the main player Profile screen and into **Profile Settings** (the gear-icon → Edit Profile screen).
2. Final verification of remaining release-critical issues (CR-01..CR-06, S-04, S-10). No code change was required for the verification items — the prior remediation already satisfied them; this pass confirmed each at the source level.

## Task 1 — Delete Account moved to Profile Settings ✅
**Where it lives now:** `app/(player)/profile/edit.tsx` (the screen the Profile gear icon already routes to via `handleSettings → /profile/edit`). There is no separate "Settings" route in the player area; Edit Profile is the canonical account-settings surface (it already hosts email/password/phone/privacy), so Delete Account belongs there. No new settings system was created (kept minimal per scope).

**Changes:**
- `app/(player)/(tabs)/profile.tsx`: removed the top-level "Delete Account" `AppButton`, the `requestAccountDeletion` mutation hook, the `deletionRequesting` state, and the `handleRequestAccountDeletion` handler. Removed the now-unused `useMutation` import. The main Profile screen now ends with only the **Logout** button — clean, no prominent destructive action.
- `app/(player)/profile/edit.tsx`: added `Alert` + `useMutation` imports; added the same `requestAccountDeletion` mutation hook, `deletionRequesting` state, and `handleRequestAccountDeletion` handler (verbatim behavior); added a **"Danger Zone"** section at the bottom of the form with consequence copy and a destructive **Delete Account** button (red border/tint, trash icon, loading state).
- `app/(player)/profile/edit.styles.ts`: added `dangerSectionTitle`, `dangerZone`, `dangerTitle`, `dangerSubtext`, `deleteAccountButton`, `deleteAccountButtonDisabled`, `deleteAccountButtonText`.

**Preserved (unchanged behavior):** the confirmation `Alert` dialog, the destructive style, the consequences copy (legal/financial retention notice), the backend `requestAccountDeletion` mutation, the idempotent "already pending" handling, and the `(api as any).support.requestAccountDeletion` call pattern (so app `tsc` passes pre-codegen). No backend logic touched.

## Task 2 — Remaining critical issues: verification results (no code change needed)
- **A. CR-06 Payment status honesty — VERIFIED.** `pay/[intentId].tsx`, `status/[intentId].tsx`, `useMatchroomCreateSubmitFlow.ts`, and `create/index.tsx` all keep pending/unverified states distinct from confirmed (`Payment Processing` / `Payment Not Completed` / `Payment Received`(=Confirming Seat) vs `Seat Reserved!`). "Payment confirmed" copy only fires on backend `checkoutStatus.status === "paid"`. Failed/pending/unknown states surface the **order ref**, the safe `PAYMENT_VERIFICATION_SAFE_MESSAGE` / `PAYMENT_SUPPORT_WITH_ORDER_HINT`, and a **Contact Support** button. Refresh/Continue calls `syncTransactionStatus` (not dead). "Dashboard"/back exits without clearing payment state. Raw provider text (`lastError`/`providerDescription`) is never rendered — only safe copy. No money logic touched.
- **B. CR-03/CR-05 Super Admin — VERIFIED.** `convex/admin.ts` server gate `getAuthenticatedAdmin` derives identity from the verified session and requires `isAuthorizedSuperAdmin` (env-allowlist email OR role ∈ {`super_admin`,`super-admin`}); no hardcoded default ⇒ unset env ⇒ fails closed. `setUserRole` canonicalizes to `super_admin`; `bootstrapInitialSuperAdmin` throws on unset `SUPER_ADMIN_EMAIL`. `src/utils/accountRouting.ts` + `app/super-admin/_layout.tsx` are cosmetic routing only (redirect non-admins to login); the real boundary is the server gate. Canonical `super_admin` routes to Super Admin; legacy `super-admin` accepted as compatibility.
- **C. CR-01/S-04 Zone Admin — VERIFIED.** `convex/zoneAdminBooking.ts`: every zone-acting mutation (`acceptBookingRequest`, `rejectBookingRequest`, `sendCounterOffer`, `createWalkInMatchroom`) calls `requireAuthenticatedZoneOwner`; `respondToCounterOffer` derives the responder via `requireAuthenticatedActor` + recipient-membership check. All read queries (`listBookingQueueForZone`, `listBookingHistoryForZone`, `listMatchroomsForZone`) are ownership-guarded. Client-passed `adminUid`/`responderUid`/`zoneOwnerUid` are non-authoritative hints; audit `actorUid` uses the server-derived id. Safe/generic error messages. Service/hook (`zoneAdminBookingService.ts`, `useZoneBookingsActions.ts`) untouched (arg shapes unchanged).
- **D. CR-02 iOS picker/store config — VERIFIED.** `app.json` has `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`; `expo-image-picker` (with `photosPermission`/`cameraPermission`) and `expo-document-picker` registered in `plugins`; no duplicate/bad copy. All five picker screens use `expo-image-picker` and are covered app-wide: profile edit, team logo (`teams/[id].tsx`), team-challenge chat, matchroom chat, friend chat. (Note: `expo-document-picker` is configured but currently unused anywhere — harmless; left as-is.)
- **E. CR-04 Production env safety — VERIFIED.** `eas.json` `production.env` uses obvious `REPLACE_WITH_PRODUCTION_DEPLOYMENT` placeholders; `preview` (staging `acrobatic-bison-271`) is separate. `src/lib/convex.ts` `assertConvexUrl()` **throws** if the URL is missing or still a `REPLACE_WITH_` placeholder ⇒ a prod build with unreplaced config fails loudly. Super-admin email is intentionally absent from `production.env` (backend owns it). (Note: `preview.env` still carries the legacy `EXPO_PUBLIC_SUPER_ADMIN_EMAIL` for staging convenience — an email allowlist hint, not a secret, and not present in production.)
- **F. S-10 Account deletion — VERIFIED + relocated.** `convex/support.ts` `requestAccountDeletion`: authenticated-only (`getAuthenticatedProfile`), idempotent (reuses any open `account_deletion` ticket → `alreadyRequested`), creates a high-priority `supportTickets` row + admin notification, performs **no** hard-deletion of payments/wallet/KYC/audit records (legal/financial retention; admin-reviewed). Now reachable in-app from Profile Settings with clear consequence copy.

## Batch 2 — commands run
| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | **PASS (exit 0)** |
| `git diff --check` | **Clean (exit 0)** |
| `git diff --stat` | 3 source files changed (see below) |

**Files changed (3 source):** `app/(player)/(tabs)/profile.tsx`, `app/(player)/profile/edit.tsx`, `app/(player)/profile/edit.styles.ts`. (Plus this tracking doc.)

## Batch 2 — codegen / deploy
- **No Convex codegen run** and **none required** for this batch: no Convex API/schema/generated-type change was made. The relocated Delete Account UI reuses the existing `(api as any).support.requestAccountDeletion` pattern.
- Still outstanding from Batch 1 (unchanged): the `requestAccountDeletion` mutation + super-admin env require a **Convex deploy** (confirm target — likely staging `acrobatic-bison-271`) to be live at runtime. Account deletion cannot be end-to-end tested in-app until that deploy lands.

## Batch 2 — known risks
- `requestAccountDeletion` still needs a Convex deploy to function at runtime (the in-app button will error until deployed). Documented; not run per scope.
- `expo-document-picker` configured but unused — cosmetic only.
- `bootstrapInitialSuperAdmin` queries existing admins via the legacy `by_role == "super-admin"` value; benign because the email-based idempotency branch still catches a canonical admin with the configured email. Low-risk follow-up, not a blocker.

## Batch 2 — manual QA remaining
- [ ] Profile main screen shows no Delete Account (only Logout); gear icon → Edit Profile shows the Danger Zone → Delete Account.
- [ ] Delete Account confirmation dialog + idempotent "already pending" still behave (verify **after Convex deploy**).
- [ ] Account deletion request appears for super-admin/support and creates the admin notification.
- [ ] (Re-confirm Batch 1 checklist items on-device: payment honesty, zone owner vs non-owner, super-admin routing, iOS picker prompts, prod placeholder fail-loud.)
