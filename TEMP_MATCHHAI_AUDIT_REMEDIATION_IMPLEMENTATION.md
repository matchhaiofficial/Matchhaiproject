# MatchHai Audit Remediation Implementation

Started: 2026-05-28

## Pre-flight

- Branch: product-ready
- Audit reference: `TEMP_MATCHHAI_FULL_APP_DESIGN_SECURITY_FUNCTIONAL_AUDIT.md`
- Scope rules: no EAS build, no production deploy, no deletion of TEMP files, no provider credential changes.
- Convex guidelines read: `convex/_generated/ai/guidelines.md`

## Baseline Dirty Files

```text
 M TEMP_MATCHHAI_SKILL_RATING_AND_LIST_PERFORMANCE_AUDIT.md
 M app/(player)/friend-chat/[friendId].tsx
 M app/(player)/reports.tsx
 M app/(player)/schedule.tsx
 M app/(player)/wallet.tsx
 M app/matchrooms/chat/[id].tsx
 M app/super-admin/(tabs)/index.styles.ts
 M app/super-admin/(tabs)/index.tsx
 M app/super-admin/(tabs)/payments.tsx
 M app/super-admin/(tabs)/reports.tsx
 M app/super-admin/audit-logs.tsx
 M app/super-admin/identity-verifications.tsx
 M app/super-admin/matchrooms.tsx
 M app/super-admin/notifications.tsx
 M app/super-admin/report/[id].tsx
 M app/super-admin/support-tickets.tsx
 M app/super-admin/users.tsx
 M app/super-admin/withdrawals.tsx
 M app/super-admin/zones.tsx
 M app/teams/challenge-chat.tsx
 M app/zone/(tabs)/profile.styles.ts
 M app/zone/(tabs)/profile.tsx
 M app/zone/modules/audit.tsx
 M app/zone/modules/components/ZoneBookingsHistorySection.tsx
 M app/zone/modules/components/ZoneBookingsMatchroomsSection.tsx
 M app/zone/modules/components/ZoneBookingsRequestsSection.tsx
 M app/zone/modules/components/ZoneBookingsWalkinsSection.tsx
 M app/zone/modules/notifications.tsx
 M app/zone/modules/support.tsx
 M convex/_generated/api.d.ts
 M convex/admin.ts
 M convex/matchrooms.ts
 M convex/reports.ts
 M convex/schema.ts
 M convex/support.ts
 M convex/users.ts
 M convex/zoneAdminBooking.ts
 M convex/zoneWithdrawals.ts
 M src/services/convex/matchService.ts
 M src/services/convex/reportService.ts
 M src/services/convex/superAdminService.ts
 M src/services/skillRatingService.ts
?? TEMP_MATCHHAI_FULL_APP_DESIGN_SECURITY_FUNCTIONAL_AUDIT.md
?? TEMP_MATCHHAI_SCHEDULE_AND_LIST_PAGINATION_AUDIT.md
?? TEMP_MATCHHAI_SCHEDULE_AND_LIST_PAGINATION_IMPLEMENTATION.md
?? TEMP_MATCHHAI_SUPER_ADMIN_REPORTS_FINANCE_AUDIT_FIX.md
?? TEMP_MATCHHAI_SUPER_ADMIN_REPORT_ACTIONS_FIX.md
?? TEMP_MATCHHAI_ZONE_PROFILE_WITHDRAWALS_SUPERADMIN_FIX.md
?? convex/ratingEngine.ts
```

## Implementation Phases

1. Phase 1 — Critical Security / IDOR Remediation
2. Phase 2 — Wallet / Payments / Booking Intent Integrity
3. Phase 3 — Matchroom Lifecycle / Result Authorization
4. Phase 4 — Reports / Notifications / Support Privacy
5. Phase 5 — Super Admin + Zone Admin operational fixes
6. Phase 6 — Pagination / Performance critical paths
7. Phase 7 — UI/UX / Accessibility / Store-readiness essentials
8. Phase 8 — Final QA / Tracker / Validation

## Phase Log

### Phase 1 — Critical Security / IDOR Remediation

Status: In progress.
Files changed: TBD.
Issues targeted: `SEC-USERS-01`, `SEC-USERS-02`, `SEC-USERS-03`, `SEC-DASHBOARD-01`, `SEC-DISCOVER-01`, `SEC-NOTIF-01`, `SEC-REPORTS-01`.

### Phase 2 — Wallet / Payments / Booking Intent Integrity

Status: Pending.
Files changed: TBD.
Issues targeted: `SEC-WALLET-01`, `SEC-WALLET-02`, `SEC-BOOKINGS-01`, `SEC-BOOKINGS-02`, `PAY-IPN-01`, `PAY-IDEMP-01`.

### Phase 3 — Matchroom Lifecycle / Result Authorization

Status: Pending.
Files changed: TBD.
Issues targeted: `SEC-MATCHROOM-01`, `SEC-MATCHROOM-02`, `COPY-LOCK-01`.

## Codegen

- Not run yet. No schema/API/index generation target confirmed yet.

## Tests Run

- Pending.

## Risks / Deferred

- Repo was dirty before remediation; preserve existing work and avoid unrelated rewrites.
- Large requested scope may require deferring later phases after critical backend authorization is stabilized.

## Manual QA

- Pending final checklist.

### Codegen Target Confirmation

- Confirmed local Convex target from `.env.local`: `CONVEX_DEPLOYMENT=dev:ardent-lynx-28` (team `shakir-yasin`, project `matchhai-staging`).
- Reason for codegen: added `convex/authz.ts` and changed `wallet.addFunds` from public mutation to internal mutation, changing generated API references.

## Final Remediation Summary

Completed scope: Phases 1-3 minimum launch blockers, plus targeted Phase 4 privacy hardening for reports/notifications.

### Files changed in this remediation pass

- `convex/authz.ts` (new shared auth/actor helper)
- `convex/users.ts`
- `convex/dashboard.ts`
- `convex/discover.ts`
- `convex/reports.ts`
- `convex/notifications.ts`
- `convex/wallet.ts`
- `convex/bookings.ts`
- `convex/matchrooms.ts`
- `convex/easypaisa.ts`
- `convex/kycGate.ts`
- `convex/_generated/api.d.ts` (codegen)

### Issues fixed or materially mitigated

- `SEC-USERS-01`: user lookups now return self/private only for caller; public lookups return reduced public shape.
- `SEC-USERS-02`: `getPublicById` derives viewer from auth instead of trusting `viewerUserId`.
- `SEC-USERS-03`: shared auth helper prefers `identity.tokenIdentifier`, with backwards-compatible fallback candidates.
- `SEC-DASHBOARD-01`: player home summary derives the authenticated actor and ignores client `userId`.
- `SEC-DISCOVER-01`: discover viewer state derives from authenticated actor; friend/request flags no longer trust `viewerUserId`.
- `SEC-NOTIF-01`: notification reads/counts/actions are scoped to the authenticated recipient/sender; matchroom/team request reads now require relevant actor ownership.
- `SEC-REPORTS-01`: report reads are scoped to reporter/zone owner/super admin; report creation no longer falls back to client-supplied reporter identity.
- `SEC-WALLET-01`: wallet balance/history reads are authenticated self-scoped.
- `SEC-WALLET-02`: wallet user resolution no longer falls back to client `userId` for public mutations; `addFunds` is now internal-only.
- `SEC-BOOKINGS-01`: booking intent/request/offer reads are scoped to creator, matchroom actors, or zone owner.
- `SEC-BOOKINGS-02`: booking intent/request/offer mutations bind to authenticated actor; public payment-status marking as `paid` is rejected.
- `SEC-MATCHROOM-01`: lifecycle/status/start/cancel/remove/slot/kick/transfer/sync actions now require host/captain/zone/super-admin actor checks as applicable.
- `SEC-MATCHROOM-02`: captain reports and participant votes now require authenticated caller matching the submitted actor ID; super-admin result resolution uses shared super-admin gate.

### Codegen

- Target recorded before running: `.env.local` `CONVEX_DEPLOYMENT=dev:ardent-lynx-28` (team `shakir-yasin`, project `matchhai-staging`).
- `npx convex codegen` was run and passed after one corrective iteration.
- Note: Convex CLI output included “Uploading functions to Convex” against the dev deployment during codegen. No production deploy was run.

### Tests run

- `npx convex codegen`: PASS
- `npx tsc -p tsconfig.json --noEmit`: PASS
- `git diff --check`: PASS (line-ending warnings only)

### Deferred items

- Phase 5 Super Admin/Zone Admin UI operation polish: deferred; backend gates were prioritized.
- Phase 6 pagination/performance rollout: deferred except no new unbounded patterns added; sub-agent recommendations captured in chat.
- Phase 7 UI/accessibility/store-readiness: deferred; sub-agent recommendations captured in chat.
- Payment provider authenticity (`PAY-IPN-01`): partially mitigated by making wallet credit internal-only, but provider signature/replay validation still requires a dedicated Easypaisa pass.
- Full idempotency proof (`PAY-IDEMP-01`): existing reference checks retained; duplicate callback/capture/refund runtime QA still required.

### Known risks

- Public API contracts were preserved where possible, but several functions now ignore client-supplied actor IDs. Any unauthenticated or stale-auth UI path may now fail closed and needs runtime QA.
- `users.getById/getByAuthId` return type is intentionally `any` to preserve existing callsites while returning safe public data for non-self callers.
- `wallet.addFunds` moved to internal API; all server callsites were updated, but runtime payment top-up should be tested end-to-end.
- Matchroom lifecycle authorization is stricter and may expose existing UI paths that used host/captain IDs without a valid Convex auth session.

### Manual QA checklist

- Player A cannot read Player B wallet, notifications, private profile, dashboard, booking intents, or reports.
- Zone Admin A cannot read Zone Admin B zone reports/bookings/offers.
- Super Admin report/payment/withdrawal views still work through admin endpoints.
- Easypaisa wallet top-up credits exactly once and booking external payment still confirms seat.
- Wallet payment from matchroom creation/seat payment still works and cannot be manually forged.
- Host/captain can start/cancel/complete allowed matchroom flows; non-host/non-captain cannot.
- Captains can submit results only for their captain identity; participants can vote only for themselves.
- Notification inbox actions still work and cross-user notification IDs are rejected.
- OAuth, store links, accessibility, and pagination issues remain for subsequent phases.

### Recommended commit message

`fix(security): harden core actor-scoped APIs and lifecycle flows`
