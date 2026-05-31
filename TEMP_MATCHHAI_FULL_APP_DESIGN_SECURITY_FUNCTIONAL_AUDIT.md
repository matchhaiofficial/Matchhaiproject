# MatchHai Full App Design, Security, Functional Audit

Audit date: 2026-05-28

Scope: **AUDIT ONLY**. No fixes implemented. No schema/index/indexes changes. No query changes. No UI refactors. No Convex codegen/dev/deploy. No EAS build. No package installs. No destructive commands.

Primary limitation: This audit is **static** (repo inspection + TypeScript checking if run) and must be supplemented by **manual runtime/device QA** to confirm several behaviors (navigation, deep links, push notifications, payment provider flows, edge-case state transitions, and performance on low-end devices).

Related references (existing TEMP/docs in repo):
- `MATCHHAI_CANONICAL_AUDIT_AND_FLOW_REFERENCE.md`
- `TEMP_MATCHHAI_SCHEDULE_AND_LIST_PAGINATION_AUDIT.md`

---

## 0. Baseline Repo State

### 0.1 Commands run (allowed, non-destructive)

- `git status --porcelain`
- `git diff --stat`
- `npx tsc -p tsconfig.json --noEmit`
- Read-only inspection (file reads, ripgrep/search)

### 0.2 Repo state at audit start

Repo was **already dirty** at audit start.

#### `git status --porcelain` (2026-05-28)

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
?? TEMP_MATCHHAI_SCHEDULE_AND_LIST_PAGINATION_AUDIT.md
?? TEMP_MATCHHAI_SCHEDULE_AND_LIST_PAGINATION_IMPLEMENTATION.md
?? TEMP_MATCHHAI_SUPER_ADMIN_REPORTS_FINANCE_AUDIT_FIX.md
?? TEMP_MATCHHAI_SUPER_ADMIN_REPORT_ACTIONS_FIX.md
?? TEMP_MATCHHAI_ZONE_PROFILE_WITHDRAWALS_SUPERADMIN_FIX.md
?? convex/ratingEngine.ts
```

#### `git diff --stat` (2026-05-28)

```text
...HHAI_SKILL_RATING_AND_LIST_PERFORMANCE_AUDIT.md |  432 +++++++-
app/(player)/friend-chat/[friendId].tsx            |   64 ++
app/(player)/reports.tsx                           |   87 +-
app/(player)/schedule.tsx                          |  407 ++++----
app/(player)/wallet.tsx                            |  280 +++---
app/matchrooms/chat/[id].tsx                       |   64 ++
app/super-admin/(tabs)/index.styles.ts             |   24 +
app/super-admin/(tabs)/index.tsx                   |   25 +-
app/super-admin/(tabs)/payments.tsx                |  186 ++--
app/super-admin/(tabs)/reports.tsx                 |  153 ++-
app/super-admin/audit-logs.tsx                     |   42 +-
app/super-admin/identity-verifications.tsx         |   78 +-
app/super-admin/matchrooms.tsx                     |   94 +-
app/super-admin/notifications.tsx                  |   73 +-
app/super-admin/report/[id].tsx                    |  582 +++++++++--
app/super-admin/support-tickets.tsx                |   18 +-
app/super-admin/users.tsx                          |  122 ++-
app/super-admin/withdrawals.tsx                    |  201 +++-
app/super-admin/zones.tsx                          |   26 +-
app/teams/challenge-chat.tsx                       |   64 ++
app/zone/(tabs)/profile.styles.ts                  |   87 ++
app/zone/(tabs)/profile.tsx                        |  263 +++--
app/zone/modules/audit.tsx                         |   88 +-
.../components/ZoneBookingsHistorySection.tsx      |  133 ++-
.../components/ZoneBookingsMatchroomsSection.tsx   |   88 +-
.../components/ZoneBookingsRequestsSection.tsx     |  257 +++--
.../components/ZoneBookingsWalkinsSection.tsx      |   70 +-
app/zone/modules/notifications.tsx                 |   52 +-
app/zone/modules/support.tsx                       |  148 +--
convex/_generated/api.d.ts                         |    2 +
convex/admin.ts                                    | 1029 ++++++++++++++++++--
convex/matchrooms.ts                               |  838 ++++++++++++++--
convex/reports.ts                                  |  224 ++++-
convex/schema.ts                                   |  144 ++-
convex/support.ts                                  |   44 +-
convex/users.ts                                    |  209 ++--
convex/zoneAdminBooking.ts                         |   75 +-
convex/zoneWithdrawals.ts                          |   14 +-
src/services/convex/matchService.ts                |   48 +
src/services/convex/reportService.ts               |  106 +-
src/services/convex/superAdminService.ts           |  252 ++++-
src/services/skillRatingService.ts                 |  169 +---
42 files changed, 5604 insertions(+), 1758 deletions(-)
```

### 0.3 Audit boundaries and interpretation rules

- This audit reviews the **current working tree** as-is (including the uncommitted changes listed above). Findings should be re-validated against the intended target branch/commit before implementation.
- If a behavior cannot be verified statically (requires runtime, backend data, provider callbacks, device-only UI), it is labeled: **Needs manual runtime/device QA**.
- Convex review follows: `convex/_generated/ai/guidelines.md` (read before auditing Convex code).

### 0.4 TypeScript compile check

- `npx tsc -p tsconfig.json --noEmit`: **PASS** (2026-05-28)

### 0.5 End-of-audit validation (AUDIT ONLY)

- `npx tsc -p tsconfig.json --noEmit`: **PASS** (2026-05-28)
- `git status --porcelain`: repo remained dirty (pre-existing changes), plus this audit tracker was created/updated.
- `git diff --stat`: unchanged from baseline for source files; this audit only added/updated `TEMP_MATCHHAI_FULL_APP_DESIGN_SECURITY_FUNCTIONAL_AUDIT.md`.

---

## 1. Executive Summary

### 1.1 Overall readiness score (static)

> Scale: 1 (not ready) -> 10 (ready). Static-only estimate based on repo inspection; must be re-validated with runtime/device QA.

- Product completeness: **6/10** (broad surface area implemented: player/zone/super-admin + payments + KYC + chat + support)
- Design/system consistency: **5/10** (shared theme exists, but raw-color drift and component inconsistencies remain)
- Security/access control: **1/10** (**Critical** IDOR + unauthenticated mutation risks across multiple Convex modules)
- Payments/wallet/withdrawals safety: **1/10** (wallet + booking/matchroom state transitions are not server-authoritatively bound to actor; requires remediation before any launch)
- Performance/scalability: **4/10** (many bounded `.take()` exist, but still multiple unbounded `.collect()` and fanout patterns; needs pagination + counter strategy)
- Store/build readiness: **3/10** (app config exists, but production EAS env placeholders and policy/URL readiness not fully validated)

### 1.1.2 Issue totals (from this tracker)

> These counts refer to the issue tables in Sections 3–6 only (they do not count every “note” elsewhere in the doc).

- Critical issues: **13**
- High issues: **8**
- Medium issues: **7**
- Low issues: **5**
- Manual QA-only risks (issues whose Status is “Manual QA needed”): **8**
- Total issues (Sections 3–6): **33**

### 1.1.3 Blocker lists (IDs must exist in Sections 3–6 tables)

#### Top 10 launch blockers

1. `SEC-MATCHROOM-01`
2. `SEC-BOOKINGS-02`
3. `SEC-WALLET-02`
4. `SEC-WALLET-01`
5. `SEC-NOTIF-01`
6. `SEC-USERS-01`
7. `SEC-USERS-02`
8. `SEC-REPORTS-01`
9. `SEC-DISCOVER-01`
10. `BUILD-PROD-01`

#### Top 10 security blockers

1. `SEC-MATCHROOM-01`
2. `SEC-MATCHROOM-02`
3. `SEC-BOOKINGS-02`
4. `SEC-WALLET-02`
5. `SEC-WALLET-01`
6. `SEC-USERS-01`
7. `SEC-USERS-02`
8. `SEC-USERS-03`
9. `SEC-REPORTS-01`
10. `SEC-NOTIF-01`

#### Top 10 payment/finance blockers

1. `SEC-WALLET-02`
2. `SEC-BOOKINGS-02`
3. `SEC-MATCHROOM-01`
4. `SEC-MATCHROOM-02`
5. `SEC-BOOKINGS-01`
6. `PAY-IPN-01`
7. `PAY-IDEMP-01`
8. `PERF-COLLECT-01` (wallet/report/transaction scale impacts finance ops)
9. `BUILD-PROD-01` (production endpoints must be correct before money flows)
10. `STORE-URL-01` (policy/support/account deletion must be real for paid flows)

#### Top 10 UX/design blockers

1. `UI-KB-01`
2. `A11Y-TEXT-01`
3. `UI-STYLE-01`
4. `UX-OAUTH-01`
5. `UX-DL-01`
6. `STORE-POLICY-01` (signup UX + compliance)
7. `COPY-LOCK-01`
8. `SEC-KYC-01` (misconfig creates broken/unsafe UX gates)
9. `SEC-ROUTING-01` (misroutes can show admin surfaces incorrectly)
10. `A11Y-CONTRAST-01`

#### Top 10 performance/scalability blockers

1. `PERF-COLLECT-01`
2. `PERF-PAG-01`
3. `SEC-DASHBOARD-01` (fanout + cross-user access; fix requires redesign and caching)
4. `SEC-DISCOVER-01` (friendship/request fanout; must be actor-scoped and paginated)
5. `SEC-NOTIF-01` (notification counts/lists scale + privacy)
6. `SEC-BOOKINGS-01` (booking intent list scale + privacy)
7. `UX-OAUTH-01` (linking retries + suppressed logs increase operational load at scale)
8. `UI-KB-01` (form failures drive support volume)
9. `A11Y-TEXT-01` (accessibility issues increase churn/support)
10. `STORE-URL-01` (support/dispute flows must be clear under load)

#### Top 10 store/build blockers

1. `BUILD-PROD-01`
2. `STORE-POLICY-01`
3. `STORE-URL-01`
4. `BUILD-ANDROID-01`
5. `SEC-KYC-01` (release config risk)
6. `SEC-ROUTING-01` (admin allowlists shipped in public env increase review surface)
7. `OBS-LOG-01` (payment error suppression risks QA gaps)
8. `A11Y-TEXT-01` (accessibility compliance risk)
9. `PAY-IPN-01` (provider integrity questions during review/QA)
10. `PAY-IDEMP-01` (paid-flow correctness must be proven for review confidence)

### 1.1.1 Sub-agent note

The audit request asks for multiple sub-agents (UI/UX, role flows, backend/security, payments, notifications, performance, store readiness, QA). In this Codex CLI environment, no sub-agent spawning tool was available, so the initial pass is **single-agent** and relies on structured sections + static verification.

### 1.2 Biggest launch blockers (expected Critical/High)

- **Critical security/authorization gaps in Convex public APIs**: multiple modules expose sensitive data or allow cross-user access via client-supplied IDs (wallet, reports, users, dashboard, booking intents). (See: `SEC-WALLET-01/02`, `SEC-REPORTS-01`, `SEC-USERS-01`, `SEC-DASHBOARD-01`, `SEC-BOOKINGS-01`.)
- **Payments/finance correctness cannot be signed off without runtime QA**: Easypaisa callback configuration + idempotency/retry paths require device + provider validation. (**Needs manual runtime/device QA**.)
- **Matchroom + booking lifecycle integrity**: matchroom status/result mutations and booking intent mutations are not bound to authenticated actor and can trigger financial side-effects. (See: `SEC-MATCHROOM-01/02`, `SEC-BOOKINGS-02`.)

### 1.2.1 Top 10 launch blockers (static)

1. `SEC-MATCHROOM-01`: unauthenticated/unauthorized matchroom status transitions triggering capture/refund/payout.
2. `SEC-BOOKINGS-02`: booking intent creation/approval/payment status can be forged client-side.
3. `SEC-WALLET-02`: wallet mutations may be performed without strict auth binding (funds manipulation).
4. `SEC-WALLET-01`: wallet history/balances readable cross-user (financial privacy leak).
5. `SEC-NOTIF-01`: inbox/unread counts readable cross-user (privacy + social inference).
6. `SEC-USERS-01/02`: user doc reads + viewer spoof allow PII exposure and visibility bypass.
7. `SEC-REPORTS-01`: report documents readable cross-user (sensitive content leak).
8. `SEC-DISCOVER-01`: discover friend/request state can be probed for arbitrary users (social graph leak).
9. Production build env placeholders: `eas.json` "REPLACE_WITH_PRODUCTION_DEPLOYMENT" (store/build blocker).
10. Manual QA gaps for payment provider callbacks + push notifications + deep links (release confidence blocker).

### 1.2.2 Top 10 high-risk items (static)

- Actor identity mapping inconsistencies (`identity.subject` vs `tokenIdentifier`) can cause auth bypass/lockouts (see `SEC-USERS-03`).
- Admin routing hints shipped via public env variables (`SEC-ROUTING-01`) increase attack surface/confusion.
- Client-side KYC bypass flags risk production misconfig (`SEC-KYC-01`).
- Unbounded `.collect()` calls in hot paths (wallet/reports/notifications) risk cost spikes and timeouts.
- Dashboard fanout queries and lack of pagination for admin lists risk scaling failures.
- Deep-link OAuth callback shows raw IDs in UI (`UX-DL-01`) and has encoding artifacts.
- Error suppression for Easypaisa actions reduces diagnosability (`OBS-LOG-01`).
- Accessibility text scaling disabled in core components (`A11Y-TEXT-01`).
- Keyboard avoidance not consistently safe on small devices (`UI-KB-01`).
- Store compliance artifacts (policy URLs, data safety answers, UGC moderation flows) not fully codified in repo.

### 1.3 Biggest UX/design issues (expected Medium/High)

- Token consistency gaps (raw colors, inconsistent surfaces), accessibility scaling risks, and keyboard avoidance risks. (See: `UI-STYLE-01`, `A11Y-TEXT-01`, `UI-KB-01`.)

### 1.4 Biggest security risks (expected Critical/High)

- IDOR risks across core Convex queries/mutations that trust client `userId`/`reportId`/`status`/etc without binding to authenticated actor.

### 1.5 Biggest payment/finance risks (expected Critical/High)

- Wallet integrity + privacy risks if the wallet APIs are reachable from client code paths without strict actor binding. (See: `SEC-WALLET-01/02`.)

### 1.6 Biggest performance/scalability risks (expected High/Medium)

- Multiple `.collect()` calls on potentially unbounded datasets (wallet history, reports lists, booking intents) without cursor pagination, plus dashboard aggregation fanout. (**Needs deeper pass + manual perf QA**.)

### 1.7 Recommended implementation order (phased)

- Phase 1 (Critical security + funds integrity): Lock down all public Convex entrypoints that read/write wallet, bookings, matchrooms status/results, reports, notifications, user PII (`SEC-MATCHROOM-*`, `SEC-BOOKINGS-*`, `SEC-WALLET-*`, `SEC-USERS-*`, `SEC-REPORTS-*`, `SEC-NOTIF-*`, `SEC-DASHBOARD-*`, `SEC-DISCOVER-*`).
- Phase 2 (Payments correctness + idempotency): Make Easypaisa flows end-to-end safe (intent creation, provider callback reconciliation, retries, unknown states UI), and add reconciliation tooling for admins (`PAY-*`, `WAL-*`, `MRP-*`, `BUILD-PROD-01`).
- Phase 3 (Core lifecycle correctness): Normalize matchroom lifecycle transitions, counter-offers, replacements, results + disputes, and ensure UI and backend state machines match (`MR-*`, `TEAM-*`, `ELO-*`).
- Phase 4 (Admin operational completeness): Ensure Zone Admin and Super Admin can complete all required actions with audit logging and safe guardrails (reports triage, withdrawals review, identity verification, support workflows) (`ADM-*`, `ZAD-*`, `SAD-*`).
- Phase 5 (Pagination + scalability): Remove unbounded `.collect()` from hot lists, add cursor pagination, server-side filtering, and FlatList tuning; prevent “filter over partial data” correctness bugs (`PERF-COLLECT-01`, `PAG-*`).
- Phase 6 (UI/UX systemization + accessibility): Consolidate tokens, unify primitives, fix keyboard/safe-area issues, remove `allowFontScaling={false}` where feasible, and standardize empty/loading/error states (`UI-STYLE-01`, `UI-KB-01`, `A11Y-TEXT-01`).
- Phase 7 (Store/build readiness): Replace production env placeholders, confirm permissions strings and policy URLs, add account deletion/support URLs, and complete Play/App Store compliance artifacts (`STORE-POLICY-01`, `BUILD-PROD-01`).
- Phase 8 (Monitoring + anti-abuse): Add audit logs, anomaly flags for payments/withdrawals, rate limiting, crash/analytics instrumentation, and on-call runbooks for launch monitoring.

---

## 2. Full Flow Map

> Source basis: `MATCHHAI_CANONICAL_AUDIT_AND_FLOW_REFERENCE.md` plus additional inspection in this audit. This section will be finalized after per-surface reviews.

### 2.1 Player/User

#### Routes (Expo Router)

- Entry + routing:
  - `app/index.tsx` (launch gate + redirect)
  - `src/utils/accountRouting.ts` (default route selection)
  - `src/context/AuthContext.tsx` + `src/providers/AuthenticatedConvexProvider.tsx` (auth + Convex session bridge)
- Tabs (custom tab bar):
  - `app/(player)/(tabs)/_layout.tsx`
  - Home: `app/(player)/(tabs)/index.tsx`
  - Discover: `app/(player)/(tabs)/discover.tsx`
  - Profile: `app/(player)/(tabs)/profile.tsx`
  - (Hidden tab routes): `app/(player)/(tabs)/matchrooms.tsx`, `app/(player)/(tabs)/teams.tsx`
- Player secondary screens:
  - Schedule: `app/(player)/schedule.tsx`
  - Wallet: `app/(player)/wallet.tsx`
  - Inbox: `app/(player)/inbox.tsx`
  - Friends: `app/(player)/friends.tsx`
  - Chatrooms: `app/(player)/chatrooms.tsx`
  - Friend DM: `app/(player)/friend-chat/[friendId].tsx`
  - My Teams: `app/(player)/my-teams.tsx`
  - Reports list + detail: `app/(player)/reports.tsx`, `app/(player)/report/[id].tsx`
  - Profile edit + public profile:
    - `app/(player)/profile/edit.tsx`
    - `app/(player)/profile/game-details.tsx`
    - `app/(player)/profile/[uid].tsx`
  - Zone detail: `app/(player)/zones/[id].tsx`
  - Support: `app/(player)/support.tsx`

#### Primary backend modules touched (Convex)

- Auth + user profile: `convex/auth.ts`, `convex/users.ts`
- Discover/search: `convex/discover.ts`
- Matchrooms: `convex/matchrooms.ts`, `convex/matchroomBroadcast.ts`, `convex/timing.ts`
- Booking intents/requests: `convex/bookings.ts`, `convex/zoneAdminBooking.ts`
- Wallet/payments: `convex/wallet.ts`, `convex/easypaisa.ts`
- Notifications: `convex/notifications.ts`, `convex/pushNotifications.ts`
- Chat: `convex/chat.ts`, `convex/friendChat.ts`, `convex/chatAuth.ts`
- Reports/support: `convex/reports.ts`, `convex/support.ts`, `convex/supportKnowledge.ts`
- Teams/challenges: `convex/teams.ts`, `convex/teamChallenges.ts`, `convex/teamChallengeChat.ts`
- Rating/ELO: `convex/ratingEngine.ts`

### 2.2 Zone Admin

#### Routes (Expo Router)

- Zone shell:
  - `app/zone/_layout.tsx`
  - Tabs: `app/zone/(tabs)/_layout.tsx`
  - Dashboard: `app/zone/(tabs)/index.tsx`
  - Branches list + detail/new: `app/zone/(tabs)/branches.tsx`, `app/zone/branch/[id].tsx`, `app/zone/branch/new.tsx`
  - Profile: `app/zone/(tabs)/profile.tsx`
- Zone modules:
  - Modules layout: `app/zone/modules/_layout.tsx`
  - Bookings: `app/zone/modules/bookings.tsx` (+ sections + hooks under `app/zone/modules/components/*` and `app/zone/modules/hooks/*`)
  - Pricing: `app/zone/modules/pricing.tsx`
  - Resources: `app/zone/modules/resources.tsx`
  - Notifications: `app/zone/modules/notifications.tsx`
  - Support: `app/zone/modules/support.tsx`
  - AI support: `app/zone/modules/ai-support.tsx`
  - Audit: `app/zone/modules/audit.tsx`
  - Insights: `app/zone/modules/insights.tsx`
  - Settings: `app/zone/modules/settings.tsx`
  - Migration tools: `app/zone/modules/migration-tools.tsx`
- Zone profile edit + report detail:
  - `app/zone/profile/edit.tsx`
  - `app/zone/report/[id].tsx`

#### Primary backend modules touched (Convex)

- Zone entity + branches/resources: `convex/zones.ts`, `convex/zoneAdminResources.ts`, `convex/zoneBranchMigration.ts`
- Zone bookings/requests/counter-offers: `convex/zoneAdminBooking.ts`, `convex/bookings.ts`, `convex/matchrooms.ts`
- Withdrawals: `convex/zoneWithdrawals.ts`, `convex/wallet.ts`, `convex/withdrawalNotifications.ts`
- Notifications: `convex/notifications.ts`, `convex/pushNotifications.ts`
- Support/tickets: `convex/support.ts`, `convex/supportEmail.ts`, `convex/supportKnowledge.ts`
- Reports: `convex/reports.ts`

### 2.3 Super Admin

#### Routes (Expo Router)

- Super admin shell:
  - `app/super-admin/_layout.tsx`
  - Tabs: `app/super-admin/(tabs)/_layout.tsx`
  - Dashboard: `app/super-admin/(tabs)/index.tsx`
  - Payments list: `app/super-admin/(tabs)/payments.tsx`
  - Reports list: `app/super-admin/(tabs)/reports.tsx`
  - Withdrawals list: `app/super-admin/withdrawals.tsx`
  - Users list: `app/super-admin/users.tsx`
  - Zones list: `app/super-admin/zones.tsx`
  - Profile: `app/super-admin/(tabs)/profile.tsx`
- Super admin secondary screens:
  - Report detail: `app/super-admin/report/[id].tsx`
  - Payment detail: `app/super-admin/payment/[orderRefNum].tsx`
  - Matchroom detail: `app/super-admin/matchroom/[id].tsx`
  - Support tickets list + detail: `app/super-admin/support-tickets.tsx`, `app/super-admin/support-ticket/[id].tsx`
  - Identity verifications: `app/super-admin/identity-verifications.tsx`
  - Audit logs: `app/super-admin/audit-logs.tsx`
  - Notifications: `app/super-admin/notifications.tsx`
  - Matchrooms list: `app/super-admin/matchrooms.tsx`
  - Easypaisa tools: `app/super-admin/easypaisa.tsx`
  - Support (admin): `app/super-admin/support.tsx`
  - Generic request detail: `app/super-admin/request/[id].tsx`

#### Primary backend modules touched (Convex)

- Super admin authorization + tooling: `convex/admin.ts`
- Payments gateway: `convex/easypaisa.ts`, `convex/easypaisaRest.ts`, `convex/easypaisaNode.ts`
- Withdrawals: `convex/wallet.ts`, `convex/zoneWithdrawals.ts`, `convex/withdrawalNotifications.ts`
- Reports/moderation: `convex/reports.ts`, `convex/support.ts`
- KYC: `convex/kyc.ts`, `convex/kycGate.ts`, `convex/kycNotifications.ts`
- Notifications/push: `convex/notifications.ts`, `convex/pushNotifications.ts`
- Matchrooms operations: `convex/matchrooms.ts`

### 2.4 Backend systems (Convex)

- Auth & role checks
- Users/zones/matchrooms/bookings/wallet/payments/withdrawals
- Chat/support/reports/notifications
- Skill rating / ELO logic
- Cron/scheduling jobs (if present)

### 2.5 External integrations

- Easypaisa payments (top-up + matchroom booking)
- Expo push notifications
- KYC provider (Didit?) (if present)
- External game accounts (Steam / FACEIT / PSN) (if present)
- Support chatbot/AI worker (if present)

---

## 3. Critical Issues

> Populated after full audit pass. Each row links to deep details in sections 7–25 where relevant.

| Issue ID | Severity | Category | Role | Screen/Flow | Affected files | Current behavior | Expected behavior | Repro steps | Impact | Recommended fix | Impl risk | Suggested test cases | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SEC-WALLET-01 | Critical | Security / Data Privacy | Player | Wallet balance + history | `convex/wallet.ts` | Public queries accept `userId` and return wallet balances/transactions without verifying the caller owns that `userId` (`getBalance`, `getSummary`, `listTransactions`, `listHistory`). | Wallet data must be scoped to the authenticated actor (or super admin with explicit permission); never allow arbitrary userId reads. | Needs manual runtime/device QA: from a non-admin account, call wallet queries for another userId (or test via app/services if exposed). | IDOR / financial privacy leak: any user could read other users' wallet balances and full payment-linked history/support metadata. | Enforce auth in each query: derive actor from identity/session; ignore client `userId` except for super admin tooling; add server-side role gates. | Medium-High (touches API contracts across UI/services). | Security tests: cannot read another user's wallet; super admin can read via admin API only; ensure current wallet UI still works. | Confirmed bug (static) |
| SEC-WALLET-02 | Critical | Security / Funds Integrity | Player / Zone Admin | Wallet mutations (top-up, withdrawals) | `convex/wallet.ts` | Public mutations can resolve a wallet user record from a client-provided `userId` when no auth session exists (`getWalletUserRecord` fallback), enabling unauthorized mutations like `addFunds` and `createZoneWithdrawalTransaction` against arbitrary user docs. | Wallet mutations must require authentication and must bind the actor to the wallet owner; never allow unauthenticated or cross-user wallet writes. | Needs manual runtime/device QA: attempt wallet mutations while unauthenticated or as a different user; verify if Convex auth prevents calls in practice. | Funds manipulation / fraud risk: attackers can credit balances, trigger withdrawals, and spam admin notifications. | Remove `userId` fallback path for public mutations; require `authComponent.getAuthUser` and resolve profile from identity; validate ownership for every write. | High (touches payments and withdrawal flows). | Security tests: unauthenticated cannot mutate wallet; user cannot mutate another user; withdrawal request requires owner + KYC. | Confirmed bug (static) |
| SEC-REPORTS-01 | Critical | Security / Privacy | All | Reports read APIs | `convex/reports.ts` | Several public queries expose report documents system-wide without adequate auth gating (`getById`, `listByReporter`, `listByStatus`, `listPending`). | Reports must be visible only to: reporter (their own), relevant zone owner (zone-scoped subset), and super admin (moderation). | Needs manual runtime/device QA: from a player account call queries for other users/status. | Sensitive data exposure (report reasons/descriptions, targets, chat message context) + potential harassment/privacy leaks; super admin operations may be undermined. | Split report read APIs by role and enforce server-side gates; remove/lock down system-wide list endpoints; add pagination + filtering. | High (touches multiple UI surfaces and moderation workflows). | Security tests: player only sees own reports; zone admin sees only reports for their zone; super admin sees all. | Confirmed bug (static) |
| SEC-USERS-01 | Critical | Security / Privacy | All | User profile APIs | `convex/users.ts` | Public queries return full user documents by ID/email/phone without verifying caller authorization (`getById`, `getByEmail`, `getByPhone`, etc.). | User profile reads must be scoped: self-read for private fields; public-read only for safe profile fields; admin reads behind super admin gates. | Needs manual runtime/device QA: attempt to fetch another user's doc. | PII exposure risk (phone, KYC status/IDs, wallet balances, authId linkage, account status) + account enumeration via email/phone. | Separate "public profile" shape from "private profile"; enforce auth; remove/lock down direct lookup endpoints; add rate limits for any public search. | High. | Security tests for PII masking; enumeration prevention; ensure profile screens still load. | Confirmed bug (static) |
| SEC-BOOKINGS-01 | Critical | Security / Payments Privacy | Player | Booking intents listing | `convex/bookings.ts` | Public booking intent queries accept `userId` / `matchroomId` and return booking intent data without verifying actor ownership (`listIntentsByUser`, `listActiveIntentsByUser`, `listIntentsForMatchroom`, `getIntentById`). | Booking/payment intent data must be visible only to the creator, relevant zone owner, and super admin. | Needs manual runtime/device QA: call booking intent list for another user or arbitrary matchroom. | Payment privacy leak (amounts, statuses, timing) + competitive/privacy issues. | Bind reads to authenticated actor or zone owner; add role gates; add pagination. | High. | Payment intent access-control tests; ensure booking screens still work. | Confirmed bug (static) |
| SEC-BOOKINGS-02 | Critical | Security / Funds + Integrity | Player / Zone Admin | Booking intent mutations | `convex/bookings.ts` | High-impact mutations trust client-supplied actor fields and allow arbitrary state changes without auth binding (e.g. `createIntent` trusts `createdByUid`; `updateIntentApproval`/`updateIntentPaymentStatus` allow changing approvals/payment status). | Only authenticated, authorized actors should create/approve/pay intents; payment status must be driven by the payment gateway server flow, not client calls. | Needs manual runtime/device QA: call these mutations for another user's intent. | Fraud + integrity risk: fake "paid" intents, forced approvals/rejections, unauthorized bookings. | Derive actor from identity; validate ownership/role; restrict payment status changes to internal server mutations invoked by Easypaisa workflow; add audit logging. | High. | Booking intent auth tests; payment-driven state tests; ensure UI still functions. | Confirmed bug (static) |
| SEC-DASHBOARD-01 | Critical | Security / Privacy | Player | Player dashboard summary | `convex/dashboard.ts` | Dashboard summary query accepts `userId` and aggregates friendships, booking intents, requests, memberships, and matchrooms without verifying caller owns that `userId`. | Dashboard summary must be scoped to the authenticated actor only. | Needs manual runtime/device QA: request summary for another userId. | Leaks social graph, spending estimates, activity history, and match participation. | Derive actor from identity; ignore client userId; return only for self (or admin tooling). | Medium-High. | Dashboard access-control tests; ensure home screen still loads. | Confirmed bug (static) |
| SEC-USERS-02 | Critical | Security / Authorization | Player | "Public profile" access control | `convex/users.ts` | `getPublicById` accepts a client-supplied `viewerUserId` and uses it to decide visibility, instead of deriving viewer identity from the authenticated session. | Viewer identity must be derived server-side (from `ctx.auth.getUserIdentity()` / Better Auth), not from client parameters. | Needs manual runtime/device QA: call `getPublicById` passing a privileged `viewerUserId` while authenticated as another user. | IDOR: can impersonate another viewer to bypass "hidden from discovery / public visibility" rules. | Remove `viewerUserId` arg and compute viewer from auth; only allow "viewerUserId" for internal/admin tools with strict gating. | High (API contract change). | Tests: hidden users not visible; self always visible; admin visibility consistent. | Confirmed bug (static) |
| SEC-USERS-03 | Critical | Security / Auth Identity | All | Auth-to-user linking | `convex/users.ts`, `convex/_generated/ai/guidelines.md` | `requireProfileOwner` resolves the caller via `identity.subject` when matching `users.authId`; Convex guideline recommends `identity.tokenIdentifier` as stable canonical identifier for auth-linked lookups/ownership checks. | Use `identity.tokenIdentifier` (and a single canonical mapping) to prevent identity mismatch and ownership bypass/lockouts across auth providers. | Needs manual runtime/device QA: sign-in with provider flows; ensure tokenIdentifier/subject values in your auth setup. | Risk of incorrect ownership checks (false deny/allow), especially if `subject` changes format or collides across providers. | Standardize auth mapping: store canonical tokenIdentifier in `users.authId` (or a dedicated field) and use it for all ownership checks. | High (migration + identity mapping). | Auth regression tests across providers; verify no user gets locked out; verify actor binding stable. | Risk (static) |
| SEC-DISCOVER-01 | Critical | Security / Privacy | Player | Discover players (friends + requests) | `convex/discover.ts` | `listDiscoverPlayers` requires a client-supplied `viewerUserId` and uses it to fetch friendships + outgoing request notifications; no auth binding is enforced for `viewerUserId`. | Discover should derive viewer identity server-side; never allow arbitrary `viewerUserId` to query someone else's friendships/requests. | Needs manual runtime/device QA: call discover for another viewerUserId and observe `isFriend` / `hasPendingRequest` flags. | Social graph leak + request/target inference; users can probe relationships and outgoing requests of any user. | Bind viewer to authenticated actor; remove `viewerUserId` param for public API; add pagination and server-side search. | High. | Security tests: cannot query someone else's friend/request state; discover results stable. | Confirmed bug (static) |
| SEC-NOTIF-01 | Critical | Security / Privacy | Player | Inbox + notification listing/counts | `convex/notifications.ts` | Multiple notification read APIs accept a client-supplied `userId`/`fromUid` and return another user's inbox, unread counts, and outgoing join requests without auth binding (e.g. `listForUser`, `listUnreadForUser`, `listInboxPage`, `countUnreadFast`, `countPendingFast`, `listOutgoingMatchroomJoinRequests`, `listByFromUidAndType`). | Notification reads must be scoped to the authenticated actor (or strict admin tooling); never allow arbitrary userId reads. | Needs manual runtime/device QA: from one account call notification list/count for another userId. | IDOR + privacy leak: exposes participation, join requests, support/report updates, and operational notifications. | Remove `userId` args from public read APIs; derive actor from identity; keep admin reads in `convex/admin.ts` behind super admin gates. | High. | Security tests for inbox isolation; verify notification UI still works. | Confirmed bug (static) |
| SEC-MATCHROOM-01 | Critical | Security / Funds + Integrity | Player | Matchroom status transitions | `convex/matchrooms.ts` | High-impact mutations accept client-passed identifiers and perform state transitions with **no auth/role/ownership checks** (e.g. `updateStatus`, `startMatch`). These transitions trigger fund capture/payout/refund logic. | Only authorized actors should change matchroom lifecycle (host/captains for certain transitions; zone owner for zone approvals; super admin for cancellations/overrides). All actor identity must be derived server-side. | Needs manual runtime/device QA: attempt to call these mutations from a non-owner account; verify if any client path exposes them. | Catastrophic abuse risk: attackers can complete/cancel matches, capture/refund held funds, and cause payouts, corrupting financial + rating state. | Add strict server-side auth checks for every lifecycle mutation; remove client-passed actor IDs; centralize lifecycle transitions behind a single validated state machine. | High. | Security tests for each transition; ensure only permitted roles can call; verify payment side-effects. | Confirmed bug (static) |
| SEC-MATCHROOM-02 | Critical | Security / Data Integrity | Player | Result submission + verification | `convex/matchrooms.ts` | Result-related mutations accept client-passed `captainUid`/winner and do not bind the caller to the captain identity (`submitCaptainReport` pattern). | Only the authenticated captain (derived from session identity) can submit their report; mismatch must be rejected. | Needs manual runtime/device QA: call result submission with another player's captainUid. | ELO/rating manipulation + fraud; disputes become untrustworthy; reputational damage. | Bind actor from identity; validate actor is captain; add idempotency and audit logs. | High. | Result submission auth tests; ensure non-captains blocked; ensure audit log created. | Confirmed bug (static) |

---

## 4. High Issues

| Issue ID | Severity | Category | Role | Screen/Flow | Affected files | Current behavior | Expected behavior | Repro steps | Impact | Recommended fix | Impl risk | Suggested test cases | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BUILD-PROD-01 | High | Build / Deployment | All | Production configuration | `eas.json` | Production build env uses placeholder Convex URLs (`REPLACE_WITH_PRODUCTION_DEPLOYMENT`). | Production env must point to real production Convex deployments with correct secrets/URLs. | Static check: open `eas.json`. | Production build will fail or ship unusable app; store submission blocked. | Create prod Convex deployment; set `EXPO_PUBLIC_CONVEX_URL` + `EXPO_PUBLIC_CONVEX_SITE_URL` to real values; verify staging/prod separation. | Medium. | Build config checklist; smoke test on TestFlight/internal track. | Confirmed bug (static) |
| STORE-POLICY-01 | High | Store Compliance | Player | Terms/Privacy agreements | `app/auth/register-step4.tsx` | Terms/Privacy are presented as styled text but not actionable links; no URLs are surfaced. | Provide tappable links to real policy URLs; record consent versioning if required. | Manual QA: tap Terms/Privacy in signup. | App Store/Play review risk; legal/compliance risk. | Add Pressable/Link to open URLs; add policy URL fields in config; add versioning to user profile if needed. | Low-Medium. | Signup compliance test; link opens browser; offline behavior. | Confirmed bug (static) |
| PERF-COLLECT-01 | High | Performance / Scalability | All | Large lists | `convex/wallet.ts`, `convex/reports.ts`, `convex/notifications.ts`, `convex/admin.ts` | Multiple endpoints use `.collect()` on potentially unbounded tables and then filter/sort in memory. | Use cursor pagination (`paginate`) and summary/counter docs. | Static: search `.collect()` usage; manual perf QA on large datasets. | Slow queries, high read costs, timeouts as data grows. | Implement pagination + counters; add indexes and server-side filters. | Medium-High. | Perf test: 1k/10k rows; ensure bounded reads. | Risk (static) |
| UX-OAUTH-01 | High | UX / Auth Linking | Player | Social account linking | `app/_layout.tsx` + social link screens | OAuth callback UX is toast-only and includes raw IDs; no robust “link state refreshed” flow is visible. | OAuth callback should refresh linked account state and show safe, user-friendly confirmation. | Manual QA: complete FACEIT/Steam linking end-to-end. | Confusing onboarding and support load; potential privacy leak. | After callback, refetch profile, update UI, and show non-sensitive toast; add error handling/retry. | Medium. | OAuth linking test matrix per provider. | Manual QA needed |
| PAY-IPN-01 | High | Payments / Provider Integrity | Player | Easypaisa IPN/finalize reconciliation | `convex/easypaisa.ts`, `convex/http.ts`, `convex/easypaisaNode.ts`, `convex/easypaisaRest.ts` | IPN handler accepts either a direct payload or an `ipnUrl` fetch; no explicit cryptographic signature verification is visible at the HTTP boundary (relies on allowed host checks + payload fields). | Payment reconciliation must verify provider authenticity (signature/hash) and be replay-safe; reject unsigned or malformed callbacks; record correlation IDs. | Needs manual runtime/device QA: replay IPN with modified payload; verify it does not mark transactions paid. | Fraud risk if callback origin/payload can be spoofed; integrity risk for wallet top-ups and booking payments. | Enforce provider signature verification at IPN/finalize; add replay protection and strict schema validation; ensure idempotent apply/update. | High. | Payment callback tests: spoofed callback rejected; replay no-op; genuine callback updates exactly once. | Risk (static) |
| PAY-IDEMP-01 | High | Payments / Idempotency | Player / Zone Admin | Payment + wallet side-effects | `convex/easypaisa.ts`, `convex/wallet.ts`, `convex/bookings.ts`, `convex/matchrooms.ts` | Multiple paths can update “paid/held/captured/released” state across booking intents, wallet holds, and matchroom settlement; idempotency markers exist in places but need systematic verification for double-run safety. | Any money-moving mutation must be idempotent under retries, duplicate callbacks, and concurrent operations; side-effects must be exactly-once. | Needs manual runtime/device QA: simulate duplicate finalize/IPN, app retry, and concurrent calls. | Duplicate credit/debit/capture/refund risk; accounting mismatch; support burden. | Add explicit idempotency keys + “already processed” guards per transition; centralize payment state transitions in internal-only mutations; audit logs. | High. | Double-callback tests; concurrent finalize tests; wallet ledger invariants tests. | Manual QA needed |
| PERF-PAG-01 | High | Performance / Correctness | All | List correctness under filters | `convex/discover.ts`, `convex/matchrooms.ts`, `convex/reports.ts`, `convex/notifications.ts`, `convex/admin.ts`, `app/(player)/**`, `app/zone/**`, `app/super-admin/**` | Several lists take the “first N then filter client-side” or `.collect()` then filter approach; can produce false-empty and correctness bugs as data grows. | Lists must be server-filtered and cursor-paginated; client filters must not operate on partial datasets without telling the user. | Manual QA: seed >N rows, apply filters, observe missing results. | Incorrect data shown; admins miss important items; users cannot find matchrooms/notifications; scale failures. | Implement cursor pagination; move filters server-side; add required indexes; ensure stable ordering keys. | Medium-High. | Pagination boundary tests; filter correctness tests with large datasets. | Risk (static) |
| STORE-URL-01 | High | Store Compliance / Legal | All | Policy URLs + support URLs | `app/auth/register-step4.tsx`, `app.json`, `app/(player)/profile/edit.tsx` | Terms/Privacy links are not guaranteed to be real URLs at signup (and may not be tappable); support and account deletion discoverability must be validated for store compliance. | App must expose working policy/support URLs and an in-app account deletion path; disclosures must be consistent with actual behavior. | Needs manual runtime/device QA: validate links open; validate account deletion request flow. | Store rejection risk; legal/compliance risk; user trust issues. | Add real URLs in config; ensure tappable links; add “Account deletion” and “Support” links in settings; confirm UGC moderation disclosures. | Medium. | Store checklist tests; link open tests; account deletion request tests. | Manual QA needed |

---

## 5. Medium Issues

| Issue ID | Severity | Category | Role | Screen/Flow | Affected files | Current behavior | Expected behavior | Repro steps | Impact | Recommended fix | Impl risk | Suggested test cases | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SEC-ROUTING-01 | Medium | Security / Authorization | Super Admin | Role routing / surface selection | `src/utils/accountRouting.ts` | Client-side routing to `/super-admin` can be influenced by `EXPO_PUBLIC_SUPER_ADMIN_EMAIL*` env vars (even though code comments note server-side gating is authoritative). | Super admin surface routing should not depend on public env allowlists; client should treat role coming from server as authoritative and avoid shipping admin allowlists in public config. | Needs manual runtime/device QA: attempt to set public env and observe routing; verify server blocks data anyway. | Risk of confusing/unsafe UI routing, accidental exposure of admin-only UI to non-admins, and increased security review surface (even if backend gates correctly). | Remove public allowlist from client routing; rely on server-derived `user.role` only; keep any allowlist exclusively server-side in Convex. | Medium (touches auth routing; must ensure legacy admins still route correctly). | Auth routing tests; ensure non-admin cannot reach super admin screens; ensure super admin still routes correctly. | Risk (static) |
| SEC-KYC-01 | Medium | Security / Feature Gating | Player / Zone Admin | KYC gating | `src/utils/verificationGate.ts`, `app/(player)/(tabs)/_layout.tsx`, `app/zone/(tabs)/_layout.tsx` | Client-side KYC gating can be bypassed when `EXPO_PUBLIC_SKIP_KYC_VERIFICATION` / `EXPO_PUBLIC_SKIP_PHONE_OTP` is set, potentially exposing gated UI in production builds if env is misconfigured. | KYC bypass should be server-only and limited to dev/staging; production builds should not include a bypass path. | Needs manual runtime/device QA: confirm production config; confirm Convex still enforces KYC in mutations/actions. | Misconfiguration risk: users may access screens they should not; increases compliance/review risk for identity-gated features. | Ensure these env vars are never present in production; consider compile-time stripping or runtime guard by `__DEV__`/release channel; keep authoritative gating server-side. | Low. | Build-time config test; "KYC required" test: user without verified KYC should be blocked server-side even if UI shows screen. | Risk (static) |
| UX-DL-01 | Medium | UX / Privacy | Player | OAuth callback handling | `app/_layout.tsx` | OAuth deep link handler shows toasts containing `nickname`, `faceitId`, `steamId`, and renders mojibake (`Ã‚Â·`) in message composition; no visible "link complete" UI state. | OAuth callback should confirm success without exposing sensitive identifiers in UI; show stable UX completion (linked account card updated) and handle unknown providers gracefully. | Needs manual runtime/device QA: trigger `matchhai://oauth?...` deep link callbacks. | Leaks identifiers on-screen and creates confusing UX for account linking; potential screenshot/logging privacy exposure. | Redact IDs in toast; update UI to refresh/link state; fix encoding artifacts in strings. | Low-Medium. | Social link flow tests; deep-link parsing tests; ensure toast content safe. | Likely bug / improvement |
| OBS-LOG-01 | Medium | Observability / Payments | Player | Global error suppression | `app/_layout.tsx` | Convex action errors for Easypaisa (`[CONVEX A(easypaisa:startCheckout)]`, `[CONVEX A(easypaisa:syncTransactionStatus)]`) are suppressed from LogBox and `console.error`, potentially hiding real failures in dev/QA. | Payment errors should be visible in logs (with safe redaction) while still being user-friendly; suppression should be narrow and never hide actionable debugging info. | Needs manual runtime/device QA: simulate Easypaisa failures, check logs. | Payment flow defects may go undiagnosed; QA misses provider errors until production. | Replace broad suppression with redacted logging + rate-limited warnings; keep user-facing toasts but retain developer diagnostics. | Low. | Payment failure test cases; confirm logs present with redaction. | Risk / improvement |
| UI-STYLE-01 | Medium | Design / Consistency | All | Global styling tokens | Multiple (examples: `src/theme.ts`, `src/ui/toastConfig.tsx`, `app/**.tsx`, `app/**.styles.ts`) | Widespread use of raw hex colors (`#fff`, `#1e2a38`, `#757575`, etc.) alongside theme tokens, increasing inconsistency risk across screens and surfaces. | Prefer a single tokenized theme system (COLORS/SPACING/RADII/TEXT_SIZES/STATUS_TONES) with minimal raw colors; allow exceptions only for provider brand colors. | Static: `rg \"#[0-9a-fA-F]{3,8}\" app src`. Manual QA: visually compare player/zone/super-admin surfaces. | Higher QA burden, inconsistent brand, harder dark-theme tuning, accessibility contrast issues. | Create/extend tokens for common cases (placeholder, muted borders, warning backgrounds) and migrate gradually; add lint/search checks to prevent new raw colors. | Medium (touches many files if fixed). | Visual regression checklist; contrast checks; snapshot tests where possible. | Improvement / manual QA needed |
| UI-KB-01 | Medium | UX / Responsiveness | All | Forms + keyboard avoidance | `src/components/Screen.tsx` | `KeyboardAvoidingView` is used without an explicit `keyboardVerticalOffset`; on iOS especially, some inputs/buttons in long forms or sheets may still be obscured depending on headers/safe areas. | Keyboard avoidance should be consistent and verified per screen type (tabs vs stack vs modal), with offsets calibrated for headers, status bar, and bottom tabs. | Needs manual runtime/device QA on iPhone SE + small Android: auth screens, profile edit, matchroom create, zone pricing/resources forms. | Users may be blocked from completing forms; support burden increases. | Introduce a consistent offset strategy and per-screen variants (stack/tab/modal) with safe-area aware offsets; validate worst-case forms. | Medium. | "Keyboard doesn't cover primary CTA" tests across key forms. | Manual QA needed |
| A11Y-TEXT-01 | Medium | Accessibility | All | Global text scaling | `src/components/AppHeader.tsx`, `src/components/SegmentedTabs.tsx`, `src/components/AppModalPrimitives.tsx` | Some core UI components set `allowFontScaling={false}` (and use `adjustsFontSizeToFit`), which can override user accessibility settings for large text. | Respect system text scaling for accessibility; only disable scaling in rare cases with alternate accessible layouts. | Needs manual runtime/device QA: enable large accessibility font sizes and review headers/tabs/modals for clipping and layout breakage. | Accessibility compliance risk; poor experience for users relying on larger text sizes; potential store review/QA issues. | Remove `allowFontScaling={false}` where possible; instead constrain layout with multi-line titles, flexible rows, and safe truncation. | Medium. | Accessibility text scaling test matrix; ensure no clipped critical labels/CTAs. | Improvement / manual QA needed |

---

## 6. Low Issues / Polish

| Issue ID | Severity | Category | Role | Screen/Flow | Affected files | Current behavior | Expected behavior | Repro steps | Impact | Recommended fix | Impl risk | Suggested test cases | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| UI-TOAST-01 | Low | Design / Token Consistency | All | Toast success icon | `src/ui/toastConfig.tsx` | Success toast icon color is hard-coded (`#81C784`) instead of using theme tokens. | Toast styling should use theme tokens to keep brand/contrast consistent. | Static: inspect `toastConfig.tsx`. | Minor brand drift; harder to theme consistently (dark/light or future rebrand). | Replace hard-coded color with a theme token (e.g., `STATUS_TONES.success.*`). | Low. | Visual check: success toast matches theme; contrast remains accessible. | Improvement (static) |
| BUILD-ANDROID-01 | Low | Build / Config Hygiene | All | Android permissions list | `app.json` | Android permissions include both Expo short name (`RECORD_AUDIO`) and fully-qualified permission (`android.permission.RECORD_AUDIO`). | Prefer a single canonical declaration to reduce confusion and policy review surface. | Static: inspect `app.json` Android permissions. | Small risk of misconfiguration/confusion during store review; not typically fatal. | Normalize permission declaration; verify voice chat still works and permission prompts correct. | Low. | Install on Android; verify microphone permission prompt + voice message feature. | Improvement (static) |
| COPY-LOCK-01 | Low | UX / Copy Consistency | Player | Matchroom status banners | `app/(player)/schedule.tsx`, `app/matchrooms/*`, `convex/matchrooms.ts` | Multiple status labels exist (waiting/full/locked/payment pending) and are likely to diverge across screens as rules evolve. | Status copy should be centralized and derived from a single status mapping to avoid contradictions. | Needs manual runtime/device QA: compare Schedule cards vs Matchroom detail banners across statuses. | Minor confusion that can increase support tickets and reduce trust. | Create a shared status-to-copy mapping and use it across list rows and detail screens. | Medium (touches multiple screens). | Matrix test: each status renders identical label + color across list and detail. | Manual QA needed |
| A11Y-CONTRAST-01 | Low | Accessibility / Visual | All | Muted text on dark surfaces | Multiple (`app/**`, `src/**`) | Some muted/secondary text uses raw grays that may fall below contrast guidelines on dark backgrounds. | Use tested token values for secondary text with minimum contrast targets. | Needs manual runtime/device QA: contrast check on common devices; review in low brightness. | Accessibility/legibility polish issue; more noticeable on low-end displays. | Replace raw grays with contrast-checked tokens; add a small contrast checklist to design QA. | Medium. | A11Y check: key labels and CTAs remain readable at low brightness and large text. | Manual QA needed |
| OBS-LOG-02 | Low | Observability | All | Dev logging filters | `app/_layout.tsx` | LogBox ignore patterns may mask or normalize actionable errors if patterns become too broad over time. | Logging filters should be narrow and documented, with redaction instead of blanket suppression for payment errors. | Needs manual runtime/device QA: simulate Easypaisa failures and confirm logs remain actionable. | Slower debugging, higher QA cycle time. | Replace broad ignores with scoped redaction and rate-limited logs; document patterns. | Low. | Payment failure tests: error visible with redaction; user gets friendly message. | Risk / improvement |

---

## 7. UI/UX + Design Consistency Audit

### 7.1 Style system inventory (to verify)

#### Theme tokens (static, present)

- Theme source: `src/theme.ts`
  - Colors: `COLORS`, `SURFACES`, `STATUS_TONES`
  - Typography: `FONTS`
  - Spacing: `SPACING`
  - Radius: `RADII`
  - Shadows: `SHADOWS`
  - CTA presets: `CTA`
- Icon system: `src/components/AppIcon.tsx` + `src/theme/icons/*` (centralized names + tone system).

#### Core UI primitives (static, present)

- Screen wrapper: `src/components/Screen.tsx` (variants: `tabs|stack|fullscreen`, safe-area + padding strategy, perf marks)
- Header: `src/components/AppHeader.tsx`
- Buttons/cards/pills: `src/components/AppPrimitives.tsx` (+ `src/components/AppPrimitives.styles.ts`)
- Modals/sheets/drawers: `src/components/AppModalPrimitives.tsx` (+ `.styles.ts`)
- Tabs component: `src/components/SegmentedTabs.tsx`
- Toast UI: `src/ui/toastConfig.tsx`, `src/ui/toastStyles.ts` (note: one-off raw color `#81C784` in success icon)

#### Consistency gaps found (static)

- **Raw color drift** across `app/**` and `src/**` (`#fff`, `#757575`, `#1e2a38`, etc.) -> inconsistent contrast and brand rendering (`UI-STYLE-01`).
- **Text scaling overrides** in core components (`allowFontScaling={false}`) -> accessibility risk (`A11Y-TEXT-01`).
- **Tab bar parity**:
  - Player and Zone tab bars use an "overlay/transparent background" outer wrap.
  - Super admin tab bar outer wrap sets `backgroundColor: COLORS.backgroundDark` and uses stronger shadow/elevation; may visually diverge from Player/Zone surfaces. (`app/(player)/(tabs)/_layout.tsx`, `app/zone/(tabs)/_layout.tsx`, `app/super-admin/(tabs)/_layout.tsx`).
- **Keyboard avoidance strategy** is split between `Screen` and `AppModalPrimitives` (bottom sheets support `keyboardVerticalOffset`, but `Screen` uses a simpler default) -> requires device QA matrix (`UI-KB-01`).

### 7.2 Cross-surface consistency checks (Player vs Zone Admin vs Super Admin)

#### What is consistent (static)

- Common dark theme baseline using `COLORS.backgroundDark` and `COLORS.cardDark`.
- Shared icon set (`AppIcon`) and shared primitives used in multiple places.

#### What appears inconsistent / at-risk (static)

- Typography usage is mixed across screens (some screens use `FONTS.*`, others use inline fontWeight/colors).
- Empty/loading/error states are not fully standardized (some screens use custom cards; others inline `ActivityIndicator` + raw colors).
- Destructive action styling is not consistently tokenized (some use red borders/tints; others use generic buttons).
- Screen padding differs by variant and route wrapper; tabs route uses `sceneStyle.paddingBottom` plus `Screen` adds its own padding strategy -> potential double-padding/overlap edge cases (**Needs manual runtime/device QA**).

### 7.3 UI/UX screen-level audit checklist (static -> manual QA)

This is a launch-focused checklist to ensure every key screen has consistent states and safe layout. “Issue IDs” point to Sections 3–6. Anything marked “Needs manual QA” must be verified on iPhone SE + small Android.

| Screen | Visual consistency | States (empty/loading/error) | Keyboard/safe area | Small screen risk | Notable issue IDs |
|---|---|---|---|---|---|
| Player Profile | Medium | Medium | Medium | Medium | `A11Y-TEXT-01`, `UI-KB-01`, `SEC-USERS-01/02` |
| Player Wallet | Medium | Medium | Medium | Medium | `SEC-WALLET-01/02`, `PERF-COLLECT-01`, `PERF-PAG-01` |
| Player Schedule | Medium | Medium | Medium | Medium | `PERF-PAG-01`, `UI-KB-01`, `COPY-LOCK-01` |
| Player Discover | Medium-Low | Medium | Low | Medium-High | `SEC-DISCOVER-01`, `PERF-PAG-01`, `UI-STYLE-01` |
| Player Inbox | Medium | Medium | Medium | Medium | `SEC-NOTIF-01`, `PERF-COLLECT-01` |
| Matchroom Create | Medium | Medium | Low | High | `UI-KB-01`, `SEC-MATCHROOM-01` |
| Matchroom Detail/Status | Medium | Medium | Medium | Medium | `SEC-MATCHROOM-01/02`, `SEC-BOOKINGS-02`, `COPY-LOCK-01` |
| Matchroom Pay/Review | Medium | Medium | Medium | Medium | `SEC-BOOKINGS-02`, `PAY-IDEMP-01`, `PAY-IPN-01` |
| Zone Profile | Medium | Medium | Medium | Medium | `SEC-KYC-01`, `UI-STYLE-01` |
| Zone Bookings (queue/requests) | Medium | Medium | Medium | Medium | `PERF-PAG-01` |
| Zone Pricing/Resources | Medium | Medium | Medium | Medium | `UI-KB-01`, `PERF-PAG-01` |
| Zone Withdrawals | Medium | Medium | Medium | Medium | `SEC-WALLET-02`, `PAY-IDEMP-01` |
| Zone Support | Medium | Medium | Medium | Medium | `STORE-URL-01` |
| Super Admin Dashboard | Medium | Medium | Medium | Medium | `BUILD-PROD-01`, `PERF-PAG-01` |
| Super Admin Reports (list) | Medium | Medium | Medium | Medium | `SEC-REPORTS-01`, `PERF-PAG-01` |
| Super Admin Report detail | Medium | Medium | Medium | Medium | `SEC-REPORTS-01`, `SEC-USERS-01` |
| Super Admin Withdrawals | Medium | Medium | Medium | Medium | `PAY-IDEMP-01`, `STORE-URL-01` |
| Super Admin Payments | Medium | Medium | Medium | Medium | `PAY-IPN-01`, `PAY-IDEMP-01`, `BUILD-PROD-01` |
| Super Admin Users/Zones | Medium | Medium | Medium | Medium | `SEC-USERS-01`, `SEC-ROUTING-01`, `PERF-PAG-01` |
| Super Admin Support/Identity | Medium | Medium | Medium | Medium | `STORE-URL-01`, `SEC-USERS-01` |

---

## 8. Responsiveness / Device Audit

> Static review + "Needs manual runtime/device QA" where appropriate.

### 8.1 Known responsive strategies (static)

- Tab bars use screen-width heuristics (`<360`, `>=428`) to adjust height/padding/icon sizes:
  - Player: `app/(player)/(tabs)/_layout.tsx`
  - Zone: `app/zone/(tabs)/_layout.tsx`
  - Super admin: `app/super-admin/(tabs)/_layout.tsx`
- `Screen` uses `useScreenPadding` and variant presets to control top/bottom padding (`src/components/Screen.tsx`).
- Bottom sheets clamp max height to `min(windowHeight*0.82, windowHeight - topInset - bottomInset - SPACING.xl)` (`src/components/AppModalPrimitives.tsx`).

### 8.2 High-risk responsive areas (static -> needs device QA)

- **Small Android (Samsung A32-class)**:
  - Dense tab bars + small label sizes may reduce readability/tap targets.
  - Long forms in Zone modules (pricing/resources) likely to stress keyboard avoidance and scroll containers.
- **iPhone SE-class**:
  - Header + segmented tabs + list filters may clip; `allowFontScaling={false}` can mask issues but harms accessibility.
  - Bottom sheets: verify handle/header/footer remain visible with keyboard.
- **iPhone Pro Max-class**:
  - Excess whitespace risk (padding + clearance) and alignment consistency.
- **Tablets**:
  - `app.json` sets `ios.supportsTablet=true`; verify layout scales (cards widths, maxWidth usage in dialogs, drawer widths).

### 8.3 Specific checks to run (manual runtime/device QA required)

- Keyboard does not cover primary CTA on:
  - Auth flows (`app/auth/*`)
  - Player profile edit (`app/(player)/profile/edit.tsx`)
  - Matchroom create (`app/matchrooms/create/*`)
  - Zone pricing/resources (`app/zone/modules/pricing.tsx`, `app/zone/modules/resources.tsx`)
- Bottom tab overlap: ensure lists/sheets do not hide last row behind pill tab bar (Player/Zone).
- Modal scroll: ensure long content in `AppBottomSheet` scrolls without trapping focus, especially on Android.
- Text truncation: long usernames, venue names, match titles; ensure ellipsis/line wrapping doesn't hide critical info.
- Touch targets: icon-only actions meet minimum ~44dp effective size (especially in tab bar and headers).

---

## 9. Player/User Flow Audit

> To be filled with per-flow issues and test cases.

### 9.1 Auth / onboarding (static)

- Routes: `app/auth/*` + `app/index.tsx` gate.
- Agreements: present (terms/privacy/consent) but policy links are not actionable (`STORE-POLICY-01`).
- External linking: OAuth callback handled at root via deep link parse (`app/_layout.tsx`) — currently toast-only (`UX-DL-01`, `UX-OAUTH-01`).
- Needs manual runtime/device QA:
  - Session persistence across cold start/offline (`src/context/AuthContext.tsx`, `src/providers/AuthenticatedConvexProvider.tsx`)
  - Role routing correctness (player vs zone vs super admin).

### 9.2 Profile / settings / deletion (static)

- Profile tab: `app/(player)/(tabs)/profile.tsx`; edit/settings: `app/(player)/profile/edit.tsx`; public profile: `app/(player)/profile/[uid].tsx`.
- Account deletion request UI exists in edit screen (Danger Zone) and calls backend request flow (see store section). **Needs manual runtime/device QA** end-to-end.
- Major risk: user profile reads are currently unsafe at backend (`SEC-USERS-01/02`) — must be remediated before claiming privacy correctness.

### 9.3 Discover (static)

- Discover screen: `app/(player)/(tabs)/discover.tsx` + `convex/discover.ts`.
- Major risk: discover can leak friend/request state via client-supplied `viewerUserId` (`SEC-DISCOVER-01`).
- Performance: "take candidate list then filter" approach can miss results beyond the cap and harms relevance; requires server-side search/pagination.

### 9.4 Schedule (static)

- Schedule screen: `app/(player)/schedule.tsx`
- Existing deep audit: `TEMP_MATCHHAI_SCHEDULE_AND_LIST_PAGINATION_AUDIT.md` (schedule semantics + pagination correctness + false-empty risks).

### 9.5 Matchrooms (create/join/detail/chat/results) (static)

- Routes: `app/matchrooms/*`, `app/matchrooms/chat/[id].tsx`, `app/matchrooms/result.tsx`, `app/matchrooms/vote.tsx`.
- Major risk: matchroom lifecycle + result mutations are not bound to authenticated actor (`SEC-MATCHROOM-01/02`).
- Needs manual runtime/device QA for:
  - create/join slot selection
  - locking rules (24h lock, full roster rules)
  - payment/booking status UX
  - deep links from notifications.

### 9.6 Booking/payment/status (static)

- Routes: `app/matchrooms/book/*`; backend: `convex/easypaisa.ts`, `convex/bookings.ts`, `convex/wallet.ts`.
- Major risk: booking intent mutations can be forged (`SEC-BOOKINGS-02`) and wallet state is not protected (`SEC-WALLET-01/02`).
- Needs manual runtime/device QA:
  - Easypaisa hosted flow + callbacks (token/finalize/ipn)
  - retry/idempotency and offline interruptions.

### 9.7 Wallet (static)

- Route: `app/(player)/wallet.tsx`; backend: `convex/wallet.ts`.
- Major risk: wallet reads are cross-user and wallet mutations are unsafe (`SEC-WALLET-01/02`).

### 9.8 Teams + challenges (static)

- Routes: `app/teams/*`; backend: `convex/teams.ts`, `convex/teamChallenges.ts`, `convex/teamChallengeChat.ts`.
- Needs manual runtime/device QA:
  - captain permissions, invite/join, challenge acceptance, and challenge chat.

### 9.9 Chat (static)

- Friend chat: `app/(player)/friend-chat/[friendId].tsx` + `convex/friendChat.ts`
- Matchroom chat: `app/matchrooms/chat/[id].tsx` + `convex/chat.ts`
- Team challenge chat: `app/teams/challenge-chat.tsx` + `convex/teamChallengeChat.ts`
- Needs manual runtime/device QA:
  - attachments, message ordering, load older behavior, and moderation/report actions.

### 9.10 Support + reports + notifications (static)

- Support: `app/(player)/support.tsx` + `convex/support.ts`
- Reports list/detail: `app/(player)/reports.tsx`, `app/(player)/report/[id].tsx` + `convex/reports.ts`
- Notifications/inbox: `app/(player)/inbox.tsx` + `convex/notifications.ts`
- Major risks:
  - report read exposure (`SEC-REPORTS-01`)
  - inbox read exposure (`SEC-NOTIF-01`)
- Needs manual runtime/device QA:
  - deep link routing from notification to target screen
  - report creation flows from chats/matchrooms.

---

## 10. Zone Admin Flow Audit

### 10.1 Zone registration + KYC/profile (static)

- Zone register flow exists in `app/auth/zone-register*` routes (see canonical doc).
- KYC gating used for some tab/module access (`app/zone/(tabs)/_layout.tsx`, `src/utils/verificationGate.ts`).
- Needs manual runtime/device QA:
  - zone registration data correctness, required fields, and super admin review gating.

### 10.2 Branches/resources/pricing (static)

- Branches: `app/zone/(tabs)/branches.tsx`, `app/zone/branch/*`
- Resources: `app/zone/modules/resources.tsx`
- Pricing: `app/zone/modules/pricing.tsx`
- Performance risk: these are dense forms/lists; verify keyboard avoidance and scroll behaviors on small devices.

### 10.3 Bookings / counter-offers / lifecycle (static)

- Bookings module: `app/zone/modules/bookings.tsx` + view-model hooks and section components.
- Backend: `convex/zoneAdminBooking.ts` includes explicit zone-owner authz commentary; must be verified against all endpoints used.
- Needs manual runtime/device QA:
  - accept/reject/counter-offer transitions reflect in player booking status screens.

### 10.4 Walk-ins + history (static)

- Implemented as booking sections and/or matchroom flows; requires runtime QA with real data.

### 10.5 Withdrawals (static)

- Route/UI: `app/zone/(tabs)/profile.tsx`, `app/zone/profile/edit.tsx` and/or modules; backend: `convex/zoneWithdrawals.ts`, `convex/wallet.ts`.
- Major risk: wallet mutation safety (`SEC-WALLET-02`) must be fixed to trust withdrawals.
- Needs manual runtime/device QA: withdrawal request, admin review, balance updates, notification/email delivery.

### 10.6 Reports/support/notifications (static)

- Zone support: `app/zone/modules/support.tsx`, `app/zone/modules/ai-support.tsx`
- Zone notifications: `app/zone/modules/notifications.tsx`
- Zone reports: `app/zone/report/[id].tsx` and report reads in `convex/reports.ts` (must be access-controlled).

### 10.7 Access control (static)

- Zone ownership checks exist in some server modules, but global IDOR risks elsewhere mean zone admin boundaries cannot be assumed safe until remediation.

---

## 11. Super Admin Flow Audit

### 11.1 Super admin surface inventory (static)

- Tabs: `app/super-admin/(tabs)/*`
- Lists + detail: users/zones/payments/reports/withdrawals/support tickets/identity verifications/audit logs/notifications/matchrooms.
- Backend: super admin gates intended in `convex/admin.ts`, but the client routing hints use public env values (`SEC-ROUTING-01`) and many non-admin modules are currently unsafe.

### 11.2 Operations coverage (static)

- Reports: list + detail page exist (`app/super-admin/(tabs)/reports.tsx`, `app/super-admin/report/[id].tsx`).
- Payments: list + detail exist (`app/super-admin/(tabs)/payments.tsx`, `app/super-admin/payment/[orderRefNum].tsx`).
- Withdrawals: list exists (`app/super-admin/withdrawals.tsx`).
- KYC: identity verifications screen exists (`app/super-admin/identity-verifications.tsx`).
- Audit logs: screen exists (`app/super-admin/audit-logs.tsx`).

### 11.3 Key risks (static)

- Admin lists likely use pagination caps and client-side filters; requires deep pagination audit (see section 18/21).
- Super admin effectiveness depends on backend correctness; currently core IDOR risks must be fixed before using admin surfaces in production.

### 11.4 Needs manual runtime/device QA

- Verify each admin action enforces server-side gate and writes audit logs.
- Verify payment reconciliation tools and report actions behave correctly with real data.

### 11.5 Super Admin operations gap matrix (static)

Goal: ensure launch operations are possible and safe. “Backend support” refers to `convex/admin.ts` presence; “audit log” refers to `recordSuperAdminAudit` + log listing.

| Module/screen | Actions available (observed) | Actions missing / unclear | Backend support | Audit log | Notifications | Danger level | Priority |
|---|---|---|---|---|---|---|---|
| Dashboard | summary counters + lists | drilldowns + anomaly alerts unclear | Yes (`getDashboardSummary`) | Partial | Unclear | Medium | P1 |
| Users | list users; suspend/reactivate (mutations exist) | account deletion request processing workflow unclear | Yes (`listUsers`, `setUserSuspension`, `reactivateReportedUser`, `setUserRole`) | Yes | Unclear | High | P0 |
| Zones | list zones; set zone status | zone finance drilldowns limited | Yes (`listZones`, `setZoneStatus`) | Yes | Unclear | High | P0 |
| Payments | list payments; payment detail by orderRef | reconciliation tools (manual correction, refund workflows) unclear | Yes (`listPaymentsV2`, `getPaymentDetailByOrderRefNum`) | Yes/Partial | Unclear | Critical | P0 |
| Withdrawals | list withdrawal requests; approve/reject | payout reconciliation + bank verification audit unclear | Yes (`listZoneWithdrawalRequests`, `approveZoneWithdrawal`, `rejectZoneWithdrawal`) | Yes | Likely | Critical | P0 |
| Reports list | list + filter by status | batch actions + SLA tooling unclear | Yes (`listReports`, `setReportStatus`) | Yes | Likely | High | P0 |
| Report detail | moderation notes; warn/suspend/reactivate user; flag/suspend/reactivate zone; cancel matchroom | consistent UX guardrails (confirmations, reversible actions) need QA | Yes (multiple mutations) | Yes | Likely | Critical | P0 |
| Support tickets | list tickets; reply to user; assign; internal notes; resolve | separation vs moderation reports must be enforced | Yes (`listSupportTickets`, `replyToSupportTicketUser`, `assignSupportTicket`, `resolveSupportTicket`) | Yes | Likely | High | P0 |
| Identity verifications | list verifications; manually verify | full KYC appeal/review workflows unclear | Yes (`listIdentityVerifications`, `manuallyVerifyIdentityVerification`) | Yes | Likely | High | P0 |
| Audit logs | list audit logs | export/download tools unclear | Yes (`listSuperAdminAuditLogs`) | Yes | N/A | Medium | P1 |
| Notifications | list my notifications; mark read; archive | cross-role scoping must be verified | Yes (`listMyNotifications`, `markMyNotificationRead`, `archiveMyNotification`) | Partial | N/A | Medium | P1 |
| Matchrooms (admin) | list matchrooms; cancel matchroom; mark for review | safe cancellation criteria and refund side-effects must be proven | Yes (`listSuperAdminMatchrooms`, `cancelReportedMatchroom`) | Yes | Likely | Critical | P0 |
| Zone finance | list summaries | reconciliation with paymentTransactions + wallet ledger unclear | Yes (`listZoneFinanceSummaries`) | Partial | Unclear | High | P0 |

---

## 12. Matchroom Lifecycle Audit

### 12.1 Lifecycle states observed (static)

- Status tokens: `open`, `locked`, `in-progress`, `completed`, `expired`, `cancelled` (see `convex/matchrooms.ts`).
- Locking semantics: "locked because starts within 24 hours or confirmed by zone" message exists; expiry logic and roster completeness checks exist.

### 12.2 Critical integrity risk (static)

- Lifecycle transitions and result submission are not auth-bound (`SEC-MATCHROOM-01/02`). This must be fixed before trusting any lifecycle semantics or payments/rating outcomes.

### 12.4 Matchroom Lifecycle State Machine (static)

This state machine is inferred from `convex/schema.ts` + `convex/matchrooms.ts` (and related booking intent/payment flows). It is designed for security + correctness remediation planning.

#### Primary state fields

- `matchrooms.status`: `open` | `locked` | `in-progress` | `completed` | `expired` | `cancelled`
- `matchrooms.broadcastRequestStatus`: `idle` | `waiting_for_fill` | `waiting_for_zones` | `zone_confirmed` | `failed` | `expired` | `cancelled`
- `bookingIntents.status`: `pending_approvals` -> `approved` -> `approved_pending_payment` -> `confirmed` (+ `rejected/expired/cancelled`)
- `bookingIntents.paymentStatus`: `unpaid` | `paid`

#### State map (intended) with side-effects + risks

| Matchroom state | Allowed transitions | Who should trigger | Backend mutation(s) (examples) | Payment side-effect | Notification side-effect | ELO side-effect | Primary risks / gaps |
|---|---|---|---|---|---|---|---|
| `open` | `locked`, `cancelled`, `expired` | Host/captain; server sweeps | `create`, `updateStatus`, `syncLifecycleIfDue`, `runLifecycleSweep` | create booking intents; holds should not occur yet | join/invite/request notifications | none | `SEC-MATCHROOM-01` if status changes are not actor-bound |
| `locked` | `in-progress`, `cancelled`, `expired` | Host/zone/admin; server time rules | `updateStatus`, `startMatch`, `adminCancel`, sweeps | holds/capture scheduling may begin; must be internal-only | reminders/lock banners | none | full vs locked confusion; leave restrictions; replacement logic correctness |
| `in-progress` | `completed`, `cancelled` | Host/captains/admin | `startMatch`, `updateStatus` | no new holds; captures should be controlled | live notifications minimal | none | unauthorized start/cancel risk (`SEC-MATCHROOM-01`) |
| `completed` | final -> immutable (or `admin_review`) | Captains/admin | `submitCaptainReport`, `submitParticipantVote`, `resolveMatchroomResultByAdmin` | capture held funds / payout; refunds must not double-run | result notifications | apply rating once | `SEC-MATCHROOM-02` result auth; idempotency for capture + rating |
| `cancelled` | terminal | Host/admin; server rules | `adminCancel`, `updateStatus`, sweeps | release/refund held funds | cancellation notifications | none | double refund or capture/refund ordering |
| `expired` | terminal | server sweeps | `checkExpiration`, `runLifecycleSweep` | release/refund held funds | expiration notifications | none | false-expire if time-zone logic wrong; idempotency |

#### Special lifecycle cases that must be validated

- Full vs locked: “full capacity” is not necessarily “locked”; ensure UI and backend separate “no slots” from “locked by time/venue confirmation”. (**Needs manual runtime/device QA**.)
- Leave before/after lock: ensure leave rules are consistent and enforced server-side (not only UI).
- Replacement notifications: only for urgent window; must not spam; must not leak private matchroom info.
- Counter-offer: accepted counter-offer time/date must update matchroom schedule and invalidate old reminders.
- Result submission/verification: only captains can submit; participants vote; admin review must exist for disputes (`SEC-MATCHROOM-02`).

### 12.3 Functional correctness areas to validate (manual runtime/device QA)

- Create:
  - slot initialization correctness (roles/teams), default schedule parsing
- Waiting/full/locked:
  - "full but not locked" vs "locked" UI states
  - 24h lock rule consistency with "1 hour before match" or similar copy (if any)
- Payment:
  - booking intent creation, hold/capture/release/refund behavior across statuses
- Zone approval/counter-offer:
  - time updates propagate to player schedule/status
- Join/invite:
  - join request notifications dedupe and expiration
- Leave/replacement:
  - replacement notifications only trigger when a seat opens and match is within urgent window
- Result + verification + disputes:
  - captains resolved correctly, result verification gates correct, admin review path works
- Completion/cancellation/expiry:
  - idempotency (no double payout), proper release/refund paths, notifications archived/expired.

---

## 13. Team / Team Challenge Audit

### 13.1 Surface inventory (static)

- Player UI: `app/teams/create.tsx`, `app/teams/[id].tsx`, `app/teams/challenges.tsx`, `app/teams/challenge*.tsx`
- Backend: `convex/teams.ts`, `convex/teamChallenges.ts`, `convex/teamChallengeChat.ts`

### 13.2 Integrity + permissions risks (static)

- Needs deep access-control verification similar to matchrooms/bookings:
  - Ensure captain-only actions are server-bound to actor identity.
  - Ensure team membership mutations can't be performed cross-team/user.
- Current audit did not fully enumerate these endpoints; treat as **high priority** after resolving global IDOR patterns.

### 13.3 Manual QA requirements

- Team creation + invite flow (accept/reject, duplicate prevention)
- Captain transfer behavior + permissions after transfer
- Challenge create/accept/reject, status transitions
- Challenge chat membership isolation
- Reporting/moderation for team content.

---

## 14. Payments / Wallet / Withdrawals Audit

### 14.1 Architecture (static)

- Gateway: `convex/easypaisa.ts` registered via `convex/http.ts`.
- Persistence: `paymentTransactions`, `walletTransactions`, `bookingIntents`, user wallet fields in `users`.
- UI surfaces: player wallet + booking status screens; super admin payment screens; zone admin withdrawal request.

### 14.2 Critical blockers (static)

- Wallet reads/writes not actor-bound (`SEC-WALLET-01/02`).
- Booking intent/payment status is mutable without proper gate (`SEC-BOOKINGS-02`).
- Matchroom status transitions trigger capture/refund/payout without auth gate (`SEC-MATCHROOM-01`).

### 14.3 Manual runtime/device QA required (even after remediation)

- Easypaisa top-up:
  - start -> redirect -> token -> finalize/ipn -> wallet credit
- Booking payment:
  - hold funds -> capture on completion -> release/refund on cancel/expire
- Retry/idempotency:
  - multiple callbacks, refresh/resume flows, offline mid-payment
- Unknown/pending:
  - payment stuck pending past expiry; ensure UI and admin attention flags are correct
- Withdrawals:
  - request (KYC required) -> admin review -> wallet debit/settlement record
- Reconciliation:
  - admin tools to locate orders by orderRef/provider ref; anomaly flag handling.

### 14.4 Payment / Wallet / Booking State Machine (static)

This is the canonical “money movement graph” implied by schema + Convex modules. It is written to support systematic remediation and QA, not to describe UX.

#### Entities + key status fields (source-of-truth)

- `paymentTransactions` (`convex/schema.ts`, `convex/easypaisa.ts`)
  - `kind`: `booking_intent` | `wallet_topup`
  - `status`: `created` -> `redirected` -> `token_received` -> `pending` -> (`paid` | `failed` | `expired` | `cancelled`)
  - Authority: server reconciliation (`convex/easypaisa.ts` HTTP handlers + internal mutations).
- `bookingIntents` (`convex/schema.ts`, `convex/bookings.ts`, `convex/matchrooms.ts`, `convex/easypaisa.ts`)
  - `status`: `pending_approvals` -> `approved` -> `approved_pending_payment` -> `confirmed` (plus `rejected`/`expired`/`cancelled`)
  - `paymentStatus`: `unpaid` | `paid`
  - `heldStatus`: `none` | `held` | `captured` | `released` | `refunded`
  - Authority: should be server-only for payment transitions; currently has public mutation risks (`SEC-BOOKINGS-02`).
- Wallet fields on `users` (`walletBalance`, `walletHeldBalance`) and `walletTransactions` (`convex/schema.ts`, `convex/wallet.ts`)
  - Wallet ledger is split between “current balances” on user doc + transaction history.
  - Authority: should be server-only; currently has public mutation risks (`SEC-WALLET-02`).
- Matchroom settlement (matchroom fields + settlement helpers in `convex/matchrooms.ts`)
  - Authority: should be server-only; currently has public mutation risks (`SEC-MATCHROOM-01/02`).

#### State transitions (intended) and what can currently trigger them

1) Wallet top-up (Easypaisa)
- Create `paymentTransactions(kind=wallet_topup,status=created)` -> redirect -> finalize/IPN -> mark `paid`.
- On `paid`: credit wallet (append `walletTransactions` + update `users.walletBalance`).
- **Red flags**:
  - Any public mutation that can call wallet credit directly (`SEC-WALLET-02`).
  - Any callback path without strong authenticity + replay protection (`PAY-IPN-01`).
- Idempotency: must guarantee exactly-once wallet credit under duplicates (`PAY-IDEMP-01`).

2) Booking intent (matchroom seat payment)
- Create `bookingIntents(status=pending_approvals,paymentStatus=unpaid,heldStatus=none)`.
- Approvals: captain + zone approve -> `approved_pending_payment`.
- Payment: either wallet hold/capture or external payment transaction -> `paymentStatus=paid` then `confirmed`.
- **Red flags**:
  - Public mutation can mark `paymentStatus=paid` or force approval transitions (`SEC-BOOKINGS-02`).
  - Matchroom seat “pay intent” path must not be client-authoritative for external payment reference (`SEC-MATCHROOM-01`).
- Idempotency: hold/capture must be exactly-once; repeated “confirm” must not duplicate membership/charges (`PAY-IDEMP-01`).

3) Wallet hold -> capture/release/refund
- Hold: internal wallet mutation should move `walletBalance` -> `walletHeldBalance` and set `bookingIntents.heldStatus=held`.
- Capture: internal mutation moves held -> spent/settlement record; `heldStatus=captured`.
- Release/refund: internal mutation returns held to available or creates refund transaction; `heldStatus=released/refunded`.
- **Red flags**:
  - Any public mutation that can create holds/captures/releases (`SEC-WALLET-02`).
  - Any path where matchroom status changes automatically trigger capture/refund without strong actor gating (`SEC-MATCHROOM-01`).

4) Zone payout -> withdrawal -> admin reconciliation
- Zone earnings should be computed server-side from confirmed/captured booking intents.
- Withdrawal request: `convex/zoneWithdrawals.ts` (action) should create a withdrawal request record and/or wallet transaction.
- Admin review: `convex/admin.ts` approve/reject should finalize wallet debits and mark request status.
- **Red flags**:
  - PII leakage in emails/notes (account numbers) (see Section 20.3 note).
  - Missing anomaly flags for mismatched sums and repeated approvals (`PAY-IDEMP-01`).

#### Required tests (minimum)

- Callback authenticity: spoofed/replayed IPN does not mark `paid` or credit wallet (`PAY-IPN-01`).
- Exactly-once invariants: top-up credit occurs once even with duplicate finalize/IPN (`PAY-IDEMP-01`).
- Booking invariants: cannot mark `paid` client-side; intent cannot become `confirmed` without payment reconciliation (`SEC-BOOKINGS-02`).
- Settlement invariants: capture/refund cannot be triggered by unauthorized status updates (`SEC-MATCHROOM-01`).

---

## 15. ELO / Rating / Leaderboard Audit

### 15.1 Implementation present (static)

- Rating engine module exists: `convex/ratingEngine.ts`.
- User schema includes `skillScores.*.elo` as optional server-authoritative field; `rating` (0–100) remains UI projection (`convex/schema.ts`).

### 15.2 Critical integrity dependency (static)

- Rating correctness depends on secure match result submission/verification. Current result submission paths are unsafe (`SEC-MATCHROOM-02`), therefore ELO integrity is currently **not trustworthy**.

### 15.2.1 ELO implementation review (static, based on `convex/ratingEngine.ts`)

- Internal scale: 1000-based ELO, classic divisor `ELO_DIVISOR=400`, defaults `DEFAULT_ELO=1000`, floor/ceiling `ELO_FLOOR=100`, `ELO_CEILING=3000`.
- Legacy display rating mapping:
  - Seed: rating 0–100 maps to ELO 500–1500 (`seedEloFromLegacyRating`).
  - Project: ELO maps back to rating 0–100 (`projectLegacyRatingFromElo`).
- Expected score: classic ELO expectation `1 / (1 + 10^((opp - team)/400))`.
- Category configuration (base K + max abs delta cap):
  - `competitive`: baseK 32, cap ±40
  - `normal`: baseK 24, cap ±40
  - `casual`: baseK 16, cap ±20
  - `walkin`: baseK 12, cap ±20
  - `admin`: baseK 14, cap ±40
  - `bot_short`: baseK 10, cap ±12
- Experience adjustment: `<10 matches` +25% K, `>50 matches` -15% K.
- Personalization multipliers:
  - `individualAdjustment`: relative to own team average, clamped [0.85, 1.15].
  - `matchroomAdjustment`: relative to matchroom average, clamped [0.9, 1.1].
- Minimum meaningful change: decisive (non-draw) results enforce at least ±1 delta (draw may be 0).
- Team ELO: separate `computeTeamEloDelta` with constant `TEAM_ELO_K=20` and cap ±30.

### 15.2.2 ELO persistence + triggers (static)

- Schema indicates user-level storage in `users.skillScores.*.elo` (server-authoritative).
- Matchroom completion should trigger rating application; the audit previously flagged “ratingApplied markers” in `convex/matchrooms.ts` but this must be verified end-to-end and made idempotent.
- Security dependency: if results can be spoofed (`SEC-MATCHROOM-02`), then any rating history or leaderboards become untrustworthy.

### 15.3 Fairness/abuse risks (static -> manual QA)

- Ensure ratings cannot be re-assessed to overwrite match-earned ELO (users.ts tries to preserve `elo` in sanitize logic).
- Ensure idempotency: a completed match should apply rating exactly once (check "ratingApplied" markers in matchrooms module; needs deeper review).
- Ensure team ELO (if implemented) follows similar integrity rules.

### 15.4 Manual QA requirements

- Verified match completion triggers rating update exactly once.
- Dispute flow prevents rating application until resolved.
- Profile display uses the correct source (`elo` vs `rating`) and updates after completion.

### 15.5 Required tests (add to QA + staging)

- Weak beats strong (competitive and normal categories): underdog gains more; favorite loses more.
- Strong beats weak: expected small delta; no extreme swings beyond cap.
- Duplicate finalized result: rating changes exactly once (idempotency).
- Cancelled/expired match: no rating applied.
- Admin-review/disputed match: rating deferred until resolution.
- Walk-in/bot categories: lower caps apply; ensure bots do not distort real rankings.
- Team-vs-team ELO: roster-change abuse resistance; delta within ±30; idempotent application.

---

## 16. Notifications Audit

### 16.1 Architecture (static)

- Canonical notification builder + dedupe policies: `convex/notifications.ts`
- Push runtime: `convex/pushNotifications.ts`, `convex/pushNotificationsActions.ts`
- Client bridges: `src/components/NotificationRuntimeBridge`, `src/components/PushRegistrationBridge`

### 16.2 Critical privacy blocker (static)

- Notification reads are cross-user (`SEC-NOTIF-01`).

### 16.3 Dedupe/unread correctness (static)

- Dedupe keys and "collapse duplicates" helpers exist for match join requests; counts currently use `.collect()` which can become expensive.

### 16.4 Manual QA requirements

- Push permission prompts, token registration, delivery on iOS/Android.
- Deep links from notification route into correct stack/tab screen.
- Unread counts update correctly after open/mark-read and after dedupe collapse.
- Role scoping: player vs zone admin vs super admin notifications should not cross surfaces.

---

## 17. Chat / Support / Reports / Moderation Audit

### 17.1 Chat surfaces (static)

- Matchroom chat: `convex/chat.ts` has participant checks against matchroom participant list (positive pattern).
- Friend chat: `convex/friendChat.ts` (not fully audited here; must verify participant checks on all queries/mutations).
- Team challenge chat: `convex/teamChallengeChat.ts` (needs verification).

### 17.2 Support + AI agent (static)

- Support tickets and conversations: `convex/support.ts`
- Support agent tools endpoint: `convex/support.ts` + `convex/http.ts` route `/support/agentTools`
- Worker policy: `workers/support-ai-worker.ts` includes explicit prohibitions for high-stakes actions (good), but enforcement depends on server-side auth.

### 17.3 Reports + moderation (static)

- Reports module exists with multiple report types, including chat message reports.
- Critical blocker: report reads exposed cross-user (`SEC-REPORTS-01`).
- Manual QA needed:
  - Confirm support tickets are not incorrectly shown in Reports list, and only explicit moderation reports appear.

### 17.4 Privacy requirements (manual QA)

- Verify attachments are stored and fetched safely (signed URLs; no cross-user access).
- Verify support transcripts are redacted where required and admin-only access is enforced.

---

## 18. Filters / Search / Pagination / Lists Audit

### 18.1 Summary (static)

- See dedicated deep audit: `TEMP_MATCHHAI_SCHEDULE_AND_LIST_PAGINATION_AUDIT.md` (schedule semantics + list correctness + pagination phases).

### 18.2 Key platform-wide pagination risks (static)

- Many list endpoints take "first N rows" then filter in memory (discover, admin lists, reports listMine, wallet listHistory).
- Client-side filters applied to capped datasets can create **false empty** and incorrect filter options (especially in super admin screens).

### 18.3 Backend query patterns (static)

- `.take()` is used in many places (good), but `.collect()` remains common and must be replaced with pagination for growth.
- Index coverage: schema has many indexes; however, filter patterns should always align with indexes to avoid table scans.

### 18.4 UI list rendering (manual QA)

- Verify FlatList usage and stable keys on list-heavy screens (discover lists, inbox, schedule, admin lists).
- Validate "load more" behavior (if present) and ensure no duplicates at page boundaries.

### 18.5 List / Pagination implementation matrix (static)

This matrix is meant to drive a systematic pagination rollout. It combines: screen -> backend query -> list rendering -> filter correctness risk -> recommended fix. It also explicitly calls out “filter over partial data” (false-empty) risk.

| Screen | Role | Backend query/mutation (primary) | Backend pattern | Frontend render | Filters/search | False-empty risk | Recommended fix | Required index (likely) | Priority |
|---|---|---|---|---|---|---|---|---|---|
| Discover Players | Player | `convex/discover.ts:listDiscoverPlayers` | `.take()` then enrich | FlatList (`app/(player)/(tabs)/discover.tsx`) | client-side filters + search | High (viewer-based enrich + cap) | server-side filter + cursor pagination; actor-bound viewer identity | user/game indexes; search index if needed | P0 |
| Discover Matchrooms | Player | `convex/matchrooms.ts:listOpen` / `listOpen` variants | take/collect mixed | FlatList | timeline + filters | High (cap + filtering) | paginated listOpen with server-side filter | by_status+time | P0 |
| Player Schedule | Player | `convex/matchrooms.ts:listForUserSchedule` (via `src/services/convex/matchService.ts`) | likely bounded, verify | FlatList (`app/(player)/schedule.tsx`) | multi-filter modal | Medium | ensure server returns all needed rows; paginate history; stable ordering by start time | by_playerUid+startAt | P0 |
| My Matchrooms | Player | `convex/matchrooms.ts:getUserMatchrooms` | bounded but may grow | FlatList | status tabs | Medium | cursor pagination by status/time; server-side tabs | by_uid+status+time | P1 |
| Wallet History | Player | `convex/wallet.ts:listHistory` | `.collect()` (risk) | FlatList (`app/(player)/wallet.tsx`) | time/status filters | High | paginate by userId+createdAt; precompute running balance | `walletTransactions.by_userId_and_createdAt` | P0 |
| Inbox / Notifications | Player | `convex/notifications.ts:listMyNotifications`, unread count | `.collect()` in places | FlatList (`app/(player)/inbox.tsx`) | tabs + types | High | cursor pagination; server-side type filters; cheaper unread counters | by_userId+createdAt | P0 |
| Reports list (player) | Player | `convex/reports.ts:listByReporter` / listMine | likely take/collect | FlatList (`app/(player)/reports.tsx`) | status filters | Medium | paginate; server-side status filter | by_reporter+status+updatedAt | P1 |
| Friend Chat messages | Player | `convex/friendChat.ts:*` message list | likely paginate needed | FlatList (chat screen) | none | Medium | cursor pagination by conversation+createdAt | by_conversationId+createdAt | P1 |
| Matchroom Chat messages | Player | `convex/chat.ts:*` message list | likely paginate needed | FlatList (chat screen) | none | Medium | cursor pagination; message index | by_chatroomId+createdAt | P1 |
| Team Challenge Chat | Player | `convex/teamChallengeChat.ts:*` | likely paginate needed | FlatList | none | Medium | cursor pagination | by_challengeId+createdAt | P2 |
| Zone bookings queue | Zone Admin | `convex/zoneAdminBooking.ts:listBookingQueueForZone` | server list | FlatList (section component) | search + tabs | Medium | paginate by updatedAt; server-side status filters | by_zoneId+status+updatedAt | P1 |
| Zone booking history | Zone Admin | `convex/zoneAdminBooking.ts:listBookingHistoryForZone` | server list | FlatList | date range | Medium | paginate; indexed range queries | by_zoneId+createdAt | P1 |
| Zone matchrooms | Zone Admin | `convex/zoneAdminBooking.ts:listMatchroomsForZone` | server list | FlatList | status | Medium | paginate; stable ordering | by_zoneId+startAt | P1 |
| Zone walk-ins | Zone Admin | `convex/zoneAdminBooking.ts:createWalkInMatchroom` + list | list may grow | FlatList | date | Medium | paginate | by_zoneId+createdAt | P2 |
| Super Admin users | Super Admin | `convex/admin.ts:listUsers` | likely `.take()` | FlatList (`app/super-admin/users.tsx`) | search | High (cap + filter) | server-side search + cursor pagination; stable sort | by_createdAt, by_username | P0 |
| Super Admin zones | Super Admin | `convex/admin.ts:listZones` | bounded? | FlatList (`app/super-admin/zones.tsx`) | search | Medium | paginate; server-side filters | by_createdAt | P1 |
| Super Admin payments | Super Admin | `convex/admin.ts:listPaymentsV2` | list | FlatList (`app/super-admin/(tabs)/payments.tsx`) | status/date filters | High | cursor pagination + date range indexes | by_status+createdAt | P0 |
| Super Admin withdrawals | Super Admin | `convex/admin.ts:listZoneWithdrawalRequests` | list | FlatList (`app/super-admin/withdrawals.tsx`) | status filters | Medium | paginate by updatedAt | by_status+updatedAt | P0 |
| Super Admin reports | Super Admin | `convex/admin.ts:listReports` | list | FlatList (`app/super-admin/(tabs)/reports.tsx`) | status/type filters | High | cursor pagination; server-side filters | by_status+updatedAt | P0 |
| Super Admin support tickets | Super Admin | `convex/admin.ts:listSupportTickets` | list | FlatList (`app/super-admin/support-tickets.tsx`) | status filters | Medium | paginate | by_status+updatedAt | P1 |
| Super Admin identity verifications | Super Admin | `convex/admin.ts:listIdentityVerifications` | list | FlatList (`app/super-admin/identity-verifications.tsx`) | status filters | Medium | paginate | by_status+createdAt | P1 |
| Super Admin audit logs | Super Admin | `convex/admin.ts:listSuperAdminAuditLogs` | list | FlatList (`app/super-admin/audit-logs.tsx`) | date range | Medium | paginate by createdAt; server-side range | by_createdAt | P2 |

### 18.6 Standalone summary of schedule/list audit (from `TEMP_MATCHHAI_SCHEDULE_AND_LIST_PAGINATION_AUDIT.md`)

- Primary risk: false-empty filters when lists are capped before filtering; unbounded `.collect()` on transaction-like tables; heavy fanout for “summary” endpoints.
- Priority fix shape: cursor pagination + stable ordering; server-side filtering aligned with indexes; explicit “search results are partial” UX only if truly necessary.

---

## 19. Backend / Convex / Database Audit

### 19.1 Schema snapshot (static)

- Schema file: `convex/schema.ts`
- Observed scope: large multi-surface schema including:
  - Core: `users`, `zones`, `matchrooms`, `teams`, `teamChallenges`
  - Operational: `notifications`, `reports`, `supportTickets/supportConversations/supportMessages`
  - Payments: `paymentTransactions`, `walletTransactions`, `bookingIntents`, `bookingRequests`
  - KYC: `identityVerifications`
  - Chat: `chatrooms`, `chatMessages`, `chatroomMembers`, friend/team challenge chat tables
  - Admin/audit: `superAdminAuditLogs`, support agent audit + rate limit tables, knowledge docs/chunks (vector index)
- Indexes: present extensively, including multi-field indexes and at least one vector index (`supportKnowledgeChunks.by_embedding`).

### 19.2 Public vs internal boundaries (static)

- Many modules correctly use `internalQuery/internalMutation/internalAction` for sensitive operations (e.g., several KYC internals).
- However, multiple high-impact operations are exported as **public** `query/mutation/action` without robust auth binding (see Critical issues table). This is the primary architectural risk.

### 19.3 Auth/session checks (static)

- Two patterns exist:
  1. `ctx.auth.getUserIdentity()` based identity (Convex identity object).
  2. Better Auth bridge via `authComponent.getAuthUser(ctx)` mapping into `users.authId`.
- Current codebase shows inconsistent usage and some reliance on `identity.subject` where guidelines prefer `tokenIdentifier` (`SEC-USERS-03`).

### 19.4 Role checks + ownership checks (static)

- Super admin gating appears centralized in `convex/admin.ts` (allowlist + role strings), but **client routing** still references public env allowlists (`SEC-ROUTING-01`).
- Zone ownership checks exist in some areas (e.g. `convex/zoneAdminBooking.ts` has explicit comments about zone owner authz), but **other core modules** accept client-supplied IDs without ownership enforcement (wallet/notifications/reports/bookings/dashboard/users/discover/matchrooms).

### 19.5 Idempotency + correctness (static)

- Payments: `convex/easypaisa.ts` includes retry windows, attempt caps, dedupe keys, and attention flags, but the **trust boundary** must be enforced (payment state transitions must be server-driven only).
- Matchrooms: multiple lifecycle sweeps and helpers exist (expiry, lock logic, notifications), but status transitions are currently unsafe (`SEC-MATCHROOM-01/02`).
- Withdrawals: withdrawal request path exists (`convex/zoneWithdrawals.ts` -> `convex/wallet.ts`), includes masking and admin emails, but must be protected by strict actor binding (`SEC-WALLET-02`).

### 19.6 Cron/jobs (static)

- Cron entrypoint exists: `convex/crons.ts` (not audited in depth here; **Needs manual runtime/device QA** to confirm schedules match desired lifecycle expectations).

### 19.7 Staging/prod separation (static)

- `eas.json` production profile contains placeholders for Convex URLs; staging/preview points to a concrete Convex deployment.
- Recommendation: enforce explicit staging vs production Convex deployments and env var sets; never ship placeholder values.

---

## 20. Security / Privacy Audit

### 20.1 Threat model summary (static)

- Primary risk class is **IDOR / client-trusted identifiers** in public Convex functions.
- Secondary risk class is **funds/rating integrity** (matchroom/booking/wallet state transitions) due to missing actor binding.
- Tertiary risk class is **PII leakage + enumeration** (users by email/phone, reports, notifications).

### 20.2 Confirmed Critical security findings (static)

- Wallet privacy + integrity (`SEC-WALLET-01/02`)
- Notifications inbox privacy (`SEC-NOTIF-01`)
- User doc privacy + visibility bypass (`SEC-USERS-01/02`)
- Reports privacy (`SEC-REPORTS-01`)
- Dashboard privacy (`SEC-DASHBOARD-01`)
- Discover social graph leak (`SEC-DISCOVER-01`)
- Booking intent integrity (`SEC-BOOKINGS-02`)
- Matchroom lifecycle + result integrity + financial side-effects (`SEC-MATCHROOM-01/02`)

### 20.3 KYC + sensitive-data handling (static)

- KYC gating exists (`convex/kycGate.ts`, `convex/kyc.ts`) and attempts to enforce suspension checks and access control.
- Client-side bypass flags exist (`src/utils/verificationGate.ts`) -> production misconfig risk (`SEC-KYC-01`).
- Bank account masking exists in withdrawal flow (`convex/zoneWithdrawals.ts`) but email includes raw account number in the admin email text -> privacy/ops risk (**Needs manual runtime/device QA**; confirm intended).

### 20.4 External tokens + env var hygiene (static)

- Sensitive keys appear server-side (`RESEND_API_KEY`, Easypaisa hash/store keys, Didit API keys).
- Public env usage exists for routing hints and operational settings (e.g., `EXPO_PUBLIC_SUPER_ADMIN_EMAIL` in `eas.json` preview) -> should be avoided for admin identity data.

### 20.5 Recommended remediation phases (audit-only)

Phase S1 — **Stop the bleeding (Critical IDOR + funds integrity)**
- Lock down public Convex APIs for wallet/bookings/matchrooms/notifications/reports/users/dashboard/discover.
- Remove all client-passed actor IDs; derive actor from identity/session.
- Ensure payment and wallet state transitions are internal-only and driven by server workflows.

Phase S2 — **Identity canonicalization**
- Standardize auth identity mapping (`tokenIdentifier`) and ensure `users.authId` semantics are consistent.

Phase S3 — **PII minimization**
- Split "public profile" shape vs "private profile" shape; mask/omit sensitive fields; add audit logs for admin reads.

Phase S4 — **Abuse/rate limits**
- Add rate limiting for enumeration-like endpoints (username/email/phone search, report creation, support creation).

Phase S5 — **Security regression suite**
- Add Convex function tests (convex-test) for access control and high-risk workflows; add e2e smoke tests for payments/withdrawals in staging.

---

### 20.6 Public Convex API Security Matrix (static)

Scope: exported `query`/`mutation`/`action` and their `internal*` counterparts in key modules. This is a heuristic static matrix: it flags likely missing actor binding and client-supplied sensitive IDs, but must be confirmed with runtime QA and real auth sessions.

Legend: auth check and ownership check are pattern-detected (not formally proven). Risk is heuristic: public + no auth signals -> Critical; public + sensitive actor IDs -> High/Critical.

#### convex/users.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/users.ts; name=getById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=160}.name) (L160) | query | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=getPublicById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId,viewerUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=168}.name) (L168) | query | public | No/unclear | none_detected | unknown | userId,viewerUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=getByEmail; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=email; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=187}.name) (L187) | query | public | No/unclear | none_detected | unknown | email | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=getByUsername; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=198}.name) (L198) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=getByPhone; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=phone; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=211}.name) (L211) | query | public | No/unclear | none_detected | unknown | phone | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=getBySteamId; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=steamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=223}.name) (L223) | query | public | No/unclear | none_detected | unknown | steamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=getByPsnAccountId; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=234}.name) (L234) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=getByAuthId; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=authId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=245}.name) (L245) | query | public | No/unclear | none_detected | unknown | authId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=isUsernameAvailable; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=excludeUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=259}.name) (L259) | query | public | No/unclear | none_detected | unknown | excludeUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=isEmailAvailable; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=email,excludeUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=276}.name) (L276) | query | public | No/unclear | none_detected | unknown | email,excludeUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=isPhoneAvailable; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=phone,excludeUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=293}.name) (L293) | query | public | No/unclear | none_detected | unknown | phone,excludeUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=validateRegistrationIdentity; kind=action; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=email,phone; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=310}.name) (L310) | action | public | No/unclear | none_detected | unknown | email,phone | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=isSteamIdAvailable; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=steamId,excludeUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=416}.name) (L416) | query | public | No/unclear | none_detected | unknown | steamId,excludeUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=isPsnAccountIdAvailable; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=excludeUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=432}.name) (L432) | query | public | No/unclear | none_detected | unknown | excludeUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=isFaceitIdAvailable; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=excludeUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=448}.name) (L448) | query | public | No/unclear | none_detected | unknown | excludeUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=isEaIdAvailable; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=excludeUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=464}.name) (L464) | query | public | No/unclear | none_detected | unknown | excludeUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=isXboxGamertagAvailable; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=excludeUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=480}.name) (L480) | query | public | No/unclear | none_detected | unknown | excludeUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=getSkillScores; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userIds; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=497}.name) (L497) | query | public | No/unclear | none_detected | unknown | userIds | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=getMany; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userIds; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=532}.name) (L532) | query | public | No/unclear | none_detected | unknown | userIds | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=create; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=authId,email,phone,phoneValidated,phoneValidationProvider,phoneValidationCheckedAt,phoneOtpVerified,phoneOtpVerifiedAt,phoneNumberMasked,phoneNumberHash; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=559}.name) (L559) | mutation | public | No/unclear | none_detected | unknown | authId,email,phone,phoneValidated,phoneValidationProvider,phoneValidationCheckedAt,phoneOtpVerified,phoneOtpVerifiedAt,phoneNumberMasked,phoneNumberHash | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=updateProfile; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=645}.name) (L645) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=updatePlatformLinks; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId,steamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=692}.name) (L692) | mutation | public | No/unclear | none_detected | unknown | userId,steamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=refreshExternalStats; kind=action; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=744}.name) (L744) | action | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=updateSkillScores; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=855}.name) (L855) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=completeOnboarding; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=913}.name) (L913) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=updateOnlineStatus; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=926}.name) (L926) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=touchPresence; kind=mutation; scope=public; actorRequired=Yes; authSignals=ctx_auth_identity; ownership=unknown; sensitive=; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=940}.name) (L940) | mutation | public | Yes | ctx_auth_identity | unknown | — | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=goOffline; kind=mutation; scope=public; actorRequired=Yes; authSignals=ctx_auth_identity; ownership=unknown; sensitive=; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=955}.name) (L955) | mutation | public | Yes | ctx_auth_identity | unknown | — | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=saveOnboardingStep2; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=970}.name) (L970) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=saveOnboardingStep3; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1050}.name) (L1050) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=listPlayers; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1109}.name) (L1109) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=updateGamePreferences; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1128}.name) (L1128) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=updateFullProfile; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1155}.name) (L1155) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/users.ts; name=internalGetByAuthId; kind=internalQuery; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=authId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=1181}.name) (L1181) | internalQuery | internal | Yes (internal) | none_detected | unknown | authId | Medium | Ensure only internal callers; keep idempotency; validate invariants |

#### convex/wallet.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/wallet.ts; name=getBalance; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=44}.name) (L44) | query | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/wallet.ts; name=getSummary; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=52}.name) (L52) | query | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/wallet.ts; name=listTransactions; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=64}.name) (L64) | query | public | No/unclear | none_detected | arg_scoped_query_only | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/wallet.ts; name=listHistory; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=75}.name) (L75) | query | public | No/unclear | none_detected | arg_scoped_query_only | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/wallet.ts; name=createZoneWithdrawalTransaction; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId,zoneId,ownerEmail; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=179}.name) (L179) | mutation | public | No/unclear | none_detected | unknown | userId,zoneId,ownerEmail | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/wallet.ts; name=addFunds; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=246}.name) (L246) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/wallet.ts; name=holdFunds; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=293}.name) (L293) | internalMutation | internal | Yes (internal) | none_detected | unknown | userId | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/wallet.ts; name=releaseHeldFunds; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=349}.name) (L349) | internalMutation | internal | Yes (internal) | none_detected | unknown | userId | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/wallet.ts; name=captureHeldFunds; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=409}.name) (L409) | internalMutation | internal | Yes (internal) | none_detected | unknown | userId | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/wallet.ts; name=refundFunds; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=468}.name) (L468) | internalMutation | internal | Yes (internal) | none_detected | unknown | userId | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/wallet.ts; name=deductFunds; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=519}.name) (L519) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/bookings.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/bookings.ts; name=getIntentById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=intentId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=156}.name) (L156) | query | public | No/unclear | none_detected | unknown | intentId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=listIntentsForMatchroom; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=164}.name) (L164) | query | public | No/unclear | none_detected | unknown | matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=listIntentsByUser; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=177}.name) (L177) | query | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=listActiveIntentsByUser; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=189}.name) (L189) | query | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=listActiveIntentsByUserForMatchroom; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId,matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=209}.name) (L209) | query | public | No/unclear | none_detected | unknown | userId,matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=createIntent; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,createdByUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=234}.name) (L234) | mutation | public | No/unclear | none_detected | unknown | matchroomId,createdByUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=updateIntentApproval; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=intentId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=295}.name) (L295) | mutation | public | No/unclear | none_detected | unknown | intentId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=updateIntentPaymentStatus; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=intentId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=342}.name) (L342) | mutation | public | No/unclear | none_detected | unknown | intentId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=cancelIntent; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=intentId,userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=356}.name) (L356) | mutation | public | No/unclear | none_detected | unknown | intentId,userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=getRequestById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=394}.name) (L394) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=listRequestsByUser; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=402}.name) (L402) | query | public | No/unclear | none_detected | arg_scoped_query_only | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=listRequestsByZone; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=zoneId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=415}.name) (L415) | query | public | No/unclear | none_detected | unknown | zoneId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=listOpenRequestsByGame; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=428}.name) (L428) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=createRequest; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=userId,zoneId,teamId,matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=441}.name) (L441) | mutation | public | No/unclear | none_detected | arg_scoped_query_only | userId,zoneId,teamId,matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=updateRequestStatus; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=555}.name) (L555) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=getOfferById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=580}.name) (L580) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=listOffersForRequest; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=588}.name) (L588) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=listOffersByZone; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=zoneId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=601}.name) (L601) | query | public | No/unclear | none_detected | unknown | zoneId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=listOffersForUser; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=613}.name) (L613) | query | public | No/unclear | none_detected | arg_scoped_query_only | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=createOffer; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=zoneId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=639}.name) (L639) | mutation | public | No/unclear | none_detected | unknown | zoneId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/bookings.ts; name=updateOfferStatus; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=668}.name) (L668) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/matchrooms.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/matchrooms.ts; name=getById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1998}.name) (L1998) | query | public | No/unclear | none_detected | unknown | matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=getByMatchCode; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2015}.name) (L2015) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=list; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2030}.name) (L2030) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=listOpen; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2064}.name) (L2064) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=listByHost; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=hostUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2087}.name) (L2087) | query | public | No/unclear | none_detected | unknown | hostUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=listForUserSchedule; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=uid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2277}.name) (L2277) | query | public | No/unclear | none_detected | unknown | uid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=backfillMatchroomMembers; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=2333}.name) (L2333) | internalMutation | internal | Yes (internal) | none_detected | unknown | — | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/matchrooms.ts; name=listByPlayer; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=playerUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2345}.name) (L2345) | query | public | No/unclear | none_detected | unknown | playerUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=getUserMatchrooms; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=uid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2358}.name) (L2358) | query | public | No/unclear | none_detected | unknown | uid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=listByZone; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=zoneId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2384}.name) (L2384) | query | public | No/unclear | none_detected | unknown | zoneId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=checkTimeConflict; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=uid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2400}.name) (L2400) | query | public | No/unclear | none_detected | unknown | uid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=checkCreateAvailability; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=zoneId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2437}.name) (L2437) | query | public | No/unclear | none_detected | unknown | zoneId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=create; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=hostUid,playerUids,zoneId,zoneOwnerUid,captainUidA,captainUidB,teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2485}.name) (L2485) | mutation | public | No/unclear | none_detected | unknown | hostUid,playerUids,zoneId,zoneOwnerUid,captainUidA,captainUidB,teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=getSettlementSummary; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2688}.name) (L2688) | query | public | No/unclear | none_detected | unknown | matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=join; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,uid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2710}.name) (L2710) | mutation | public | No/unclear | none_detected | unknown | matchroomId,uid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=leave; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,uid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2851}.name) (L2851) | mutation | public | No/unclear | none_detected | unknown | matchroomId,uid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=updateStatus; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2907}.name) (L2907) | mutation | public | No/unclear | none_detected | unknown | matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=startMatch; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,hostUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2980}.name) (L2980) | mutation | public | No/unclear | none_detected | unknown | matchroomId,hostUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=submitCaptainReport; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,captainUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3015}.name) (L3015) | mutation | public | No/unclear | none_detected | unknown | matchroomId,captainUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=submitParticipantVote; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,participantUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3111}.name) (L3111) | mutation | public | No/unclear | none_detected | unknown | matchroomId,participantUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=resolveMatchroomResultByAdmin; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_user; ownership=unknown; sensitive=matchroomId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3203}.name) (L3203) | mutation | public | Yes | auth_user | unknown | matchroomId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=getPendingResultForUser; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3241}.name) (L3241) | query | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=adminCancel; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,adminUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3356}.name) (L3356) | mutation | public | No/unclear | none_detected | unknown | matchroomId,adminUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=remove; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3369}.name) (L3369) | mutation | public | No/unclear | none_detected | unknown | matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=updateSlots; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3378}.name) (L3378) | mutation | public | No/unclear | none_detected | unknown | matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=inviteToMatchroom; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,fromUid,toUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3415}.name) (L3415) | mutation | public | No/unclear | none_detected | unknown | matchroomId,fromUid,toUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=syncLifecycleIfDue; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3481}.name) (L3481) | mutation | public | No/unclear | none_detected | unknown | matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=requestToJoinMatchroom; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,fromUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3589}.name) (L3589) | mutation | public | No/unclear | none_detected | unknown | matchroomId,fromUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=respondToMatchroomInvite; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3752}.name) (L3752) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=respondToMatchroomJoinRequest; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=hostUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3889}.name) (L3889) | mutation | public | No/unclear | none_detected | unknown | hostUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=payMatchroomSeatIntent; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=intentId,userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=4129}.name) (L4129) | mutation | public | No/unclear | none_detected | unknown | intentId,userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=kickFromMatchroom; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=matchroomId,callerUid,playerUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=4359}.name) (L4359) | mutation | public | No/unclear | none_detected | arg_scoped_query_only | matchroomId,callerUid,playerUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=transferMatchroomCaptain; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,callerUid,newCaptainUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=4466}.name) (L4466) | mutation | public | No/unclear | none_detected | unknown | matchroomId,callerUid,newCaptainUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=cancelUserPendingMatchroomRequests; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=4559}.name) (L4559) | mutation | public | No/unclear | none_detected | unknown | userUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/matchrooms.ts; name=checkExpiration; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=4585}.name) (L4585) | internalMutation | internal | Yes (internal) | none_detected | unknown | matchroomId | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/matchrooms.ts; name=runLifecycleSweep; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=4596}.name) (L4596) | internalMutation | internal | Yes (internal) | none_detected | unknown | — | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/matchrooms.ts; name=captureBookingIntentHold; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=intentId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=4722}.name) (L4722) | internalMutation | internal | Yes (internal) | none_detected | unknown | intentId | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/matchrooms.ts; name=releaseBookingIntentHoldForReason; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=intentId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=4768}.name) (L4768) | internalMutation | internal | Yes (internal) | none_detected | unknown | intentId | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/matchrooms.ts; name=releaseHoldsForMatchroom; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=4779}.name) (L4779) | internalMutation | internal | Yes (internal) | none_detected | unknown | matchroomId | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/matchrooms.ts; name=refundCapturedHoldsForMatchroom; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=4789}.name) (L4789) | internalMutation | internal | Yes (internal) | none_detected | unknown | matchroomId | Medium | Ensure only internal callers; keep idempotency; validate invariants |

#### convex/reports.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/reports.ts; name=getById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=586}.name) (L586) | query | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=getMineById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=593}.name) (L593) | query | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=getForMyZoneById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=605}.name) (L605) | query | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=listByReporter; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reporterUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=613}.name) (L613) | query | public | No/unclear | none_detected | unknown | reporterUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=listMine; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=626}.name) (L626) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=listByStatus; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=640}.name) (L640) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=listPending; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=653}.name) (L653) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=listForMyZone; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=664}.name) (L664) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=createMatchroomComplaint; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,reporterUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=683}.name) (L683) | mutation | public | No/unclear | none_detected | unknown | matchroomId,reporterUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=createUserReport; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportedUserId,reporterUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=695}.name) (L695) | mutation | public | No/unclear | none_detected | unknown | reportedUserId,reporterUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=createZoneComplaint; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=zoneId,reporterUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=707}.name) (L707) | mutation | public | No/unclear | none_detected | unknown | zoneId,reporterUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=createFriendChatMessageReport; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=chatMessageId,reporterUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=721}.name) (L721) | mutation | public | No/unclear | none_detected | unknown | chatMessageId,reporterUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=createMatchroomChatMessageReport; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=chatMessageId,reporterUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=741}.name) (L741) | mutation | public | No/unclear | none_detected | unknown | chatMessageId,reporterUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=createTeamChallengeChatMessageReport; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=messageId,reporterUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=761}.name) (L761) | mutation | public | No/unclear | none_detected | unknown | messageId,reporterUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=create; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,reportedUserId,zoneId,reporterUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=774}.name) (L774) | mutation | public | No/unclear | none_detected | unknown | matchroomId,reportedUserId,zoneId,reporterUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=updateStatus; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=823}.name) (L823) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=markZoneReportReviewed; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=853}.name) (L853) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/reports.ts; name=remove; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=906}.name) (L906) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/notifications.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/notifications.ts; name=resolveCanonicalRoute; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=641}.name) (L641) | query | public | No/unclear | none_detected | unknown | matchroomId,teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=getById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=661}.name) (L661) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=listForUser; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=666}.name) (L666) | query | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=listUnreadForUser; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=678}.name) (L678) | query | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=listInboxPage; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=693}.name) (L693) | query | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=countPendingFast; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=724}.name) (L724) | query | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=countUnreadFast; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=741}.name) (L741) | query | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=checkExists; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=760}.name) (L760) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=listByFromUidAndType; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=fromUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=765}.name) (L765) | query | public | No/unclear | none_detected | unknown | fromUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=listOutgoingMatchroomJoinRequests; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=fromUid,matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=796}.name) (L796) | query | public | No/unclear | none_detected | unknown | fromUid,matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=listByFromUid; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=fromUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=824}.name) (L824) | query | public | No/unclear | none_detected | unknown | fromUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=checkPendingFriendRequest; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=fromUid,toUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=855}.name) (L855) | query | public | No/unclear | none_detected | unknown | fromUid,toUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=listMatchroomRequests; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=870}.name) (L870) | query | public | No/unclear | none_detected | unknown | matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=listMatchroomJoinRequests; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=895}.name) (L895) | query | public | No/unclear | none_detected | unknown | matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=listTeamJoinRequests; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=captainUid,teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=927}.name) (L927) | query | public | No/unclear | none_detected | unknown | captainUid,teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=checkPendingTeamJoinRequest; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=952}.name) (L952) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=createCanonical; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=toUid,fromUid,teamId,matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=960}.name) (L960) | mutation | public | No/unclear | none_detected | unknown | toUid,fromUid,teamId,matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=createCanonicalFromServer; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=toUid,fromUid,teamId,matchroomId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=988}.name) (L988) | internalMutation | internal | Yes (internal) | none_detected | unknown | toUid,fromUid,teamId,matchroomId | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/notifications.ts; name=create; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=toUid,fromUid,teamId,matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1015}.name) (L1015) | mutation | public | No/unclear | none_detected | unknown | toUid,fromUid,teamId,matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=updateStatus; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1040}.name) (L1040) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=markAsRead; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1057}.name) (L1057) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=markManyAsRead; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1070}.name) (L1070) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=markAllAsReadFast; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1089}.name) (L1089) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=archive; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1115}.name) (L1115) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=archiveMany; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1120}.name) (L1120) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=remove; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1134}.name) (L1134) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=removeMany; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1142}.name) (L1142) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=removeAllForUserFast; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1156}.name) (L1156) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/notifications.ts; name=markPushState; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=1176}.name) (L1176) | internalMutation | internal | Yes (internal) | none_detected | unknown | — | Medium | Ensure only internal callers; keep idempotency; validate invariants |

#### convex/dashboard.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/dashboard.ts; name=getPlayerHomeSummary; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=108}.name) (L108) | query | public | No/unclear | none_detected | arg_scoped_query_only | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/discover.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/discover.ts; name=listDiscoverPlayers; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=viewerUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=335}.name) (L335) | query | public | No/unclear | none_detected | arg_scoped_query_only | viewerUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/discover.ts; name=listDiscoverMatchrooms; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=viewerUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=441}.name) (L441) | query | public | No/unclear | none_detected | unknown | viewerUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/discover.ts; name=listDiscoverTeams; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=viewerUserId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=533}.name) (L533) | query | public | No/unclear | none_detected | arg_scoped_query_only | viewerUserId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/discover.ts; name=listDiscoverZones; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=672}.name) (L672) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/teams.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/teams.ts; name=getById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=150}.name) (L150) | query | public | No/unclear | none_detected | unknown | teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=getWithMembers; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=159}.name) (L159) | query | public | No/unclear | none_detected | unknown | teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=listByCaptain; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=captainUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=175}.name) (L175) | query | public | No/unclear | none_detected | unknown | captainUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=listByMember; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=188}.name) (L188) | query | public | No/unclear | none_detected | arg_scoped_query_only | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=listByGame; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=207}.name) (L207) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=searchByName; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=220}.name) (L220) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=getUserTeams; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=uid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=236}.name) (L236) | query | public | No/unclear | none_detected | unknown | uid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=getUserTeamsForGame; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=uid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=249}.name) (L249) | query | public | No/unclear | none_detected | unknown | uid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=getByIdString; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=262}.name) (L262) | query | public | No/unclear | none_detected | unknown | teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=create; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=captainUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=284}.name) (L284) | mutation | public | No/unclear | none_detected | unknown | captainUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=update; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=348}.name) (L348) | mutation | public | No/unclear | none_detected | unknown | teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=addMember; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId,userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=381}.name) (L381) | mutation | public | No/unclear | none_detected | unknown | teamId,userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=removeMember; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId,userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=439}.name) (L439) | mutation | public | No/unclear | none_detected | unknown | teamId,userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=transferCaptain; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId,newCaptainUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=507}.name) (L507) | mutation | public | No/unclear | none_detected | unknown | teamId,newCaptainUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=updateStats; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=606}.name) (L606) | mutation | public | No/unclear | none_detected | unknown | teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=remove; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=636}.name) (L636) | mutation | public | No/unclear | none_detected | unknown | teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=checkUserTeamLimit; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=uid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=711}.name) (L711) | query | public | No/unclear | none_detected | unknown | uid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=isNameAvailable; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=728}.name) (L728) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=inviteToTeam; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=teamId,fromUid,toUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=740}.name) (L740) | mutation | public | No/unclear | none_detected | arg_scoped_query_only | teamId,fromUid,toUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=respondToTeamInvite; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=832}.name) (L832) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=respondToJoinRequest; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=captainUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=975}.name) (L975) | mutation | public | No/unclear | none_detected | unknown | captainUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=leaveTeam; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId,userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1092}.name) (L1092) | mutation | public | No/unclear | none_detected | unknown | teamId,userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teams.ts; name=requestToJoinTeam; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId,fromUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1135}.name) (L1135) | mutation | public | No/unclear | none_detected | unknown | teamId,fromUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/teamChallenges.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/teamChallenges.ts; name=getById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=challengeId,actorUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=257}.name) (L257) | query | public | No/unclear | none_detected | unknown | challengeId,actorUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=getWithTeams; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=challengeId,actorUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=271}.name) (L271) | query | public | No/unclear | none_detected | unknown | challengeId,actorUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=listByChallengerTeam; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=289}.name) (L289) | query | public | No/unclear | none_detected | unknown | teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=listByOpponentTeam; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=303}.name) (L303) | query | public | No/unclear | none_detected | unknown | teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=listForTeam; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=317}.name) (L317) | query | public | No/unclear | none_detected | unknown | teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=listPendingForTeam; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=teamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=337}.name) (L337) | query | public | No/unclear | none_detected | unknown | teamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=getPendingForOpponentByCaptain; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=opponentTeamId,actorUid,challengerTeamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=353}.name) (L353) | query | public | No/unclear | none_detected | unknown | opponentTeamId,actorUid,challengerTeamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=create; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=challengerTeamId,opponentTeamId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=394}.name) (L394) | mutation | public | No/unclear | none_detected | unknown | challengerTeamId,opponentTeamId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=respond; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=challengeId,actorUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=434}.name) (L434) | mutation | public | No/unclear | none_detected | unknown | challengeId,actorUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=repairRejectedRefundsForCaptain; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=actorUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=512}.name) (L512) | mutation | public | No/unclear | none_detected | unknown | actorUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=proposeVenue; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=challengeId,zoneId,actorUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=546}.name) (L546) | mutation | public | No/unclear | none_detected | unknown | challengeId,zoneId,actorUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=confirmVenue; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=challengeId,actorUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=623}.name) (L623) | mutation | public | No/unclear | none_detected | unknown | challengeId,actorUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=complete; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=challengeId,actorUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=641}.name) (L641) | mutation | public | No/unclear | none_detected | unknown | challengeId,actorUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=cancel; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=challengeId,actorUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=663}.name) (L663) | mutation | public | No/unclear | none_detected | unknown | challengeId,actorUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=createFull; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=challengerTeamId,opponentTeamId,captainAUid,captainBUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=675}.name) (L675) | mutation | public | No/unclear | none_detected | unknown | challengerTeamId,opponentTeamId,captainAUid,captainBUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=update; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=challengeId,zoneId,matchroomId,actorUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=841}.name) (L841) | mutation | public | No/unclear | none_detected | unknown | challengeId,zoneId,matchroomId,actorUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallenges.ts; name=listForCaptain; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=captainUid; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=883}.name) (L883) | query | public | No/unclear | none_detected | unknown | captainUid | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/chat.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/chat.ts; name=getByMatchroom; kind=query; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=matchroomId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=252}.name) (L252) | query | public | Yes | auth_guard | unknown | matchroomId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=getMatchroomAccess; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=268}.name) (L268) | query | public | No/unclear | none_detected | unknown | matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=getOrCreateForMatchroom; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,participantUids,zoneId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=290}.name) (L290) | mutation | public | No/unclear | none_detected | unknown | matchroomId,participantUids,zoneId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=listMessages; kind=query; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=303}.name) (L303) | query | public | Yes | auth_guard | unknown | — | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=listForUser; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=331}.name) (L331) | query | public | No/unclear | none_detected | arg_scoped_query_only | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=listMessagesForMatchroom; kind=query; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=matchroomId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=365}.name) (L365) | query | public | Yes | auth_guard | unknown | matchroomId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=generateChatUploadUrl; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=matchroomId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=400}.name) (L400) | mutation | public | Yes | auth_guard | unknown | matchroomId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=sendMessage; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=clientMessageId,messageId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=414}.name) (L414) | mutation | public | Yes | auth_guard | unknown | clientMessageId,messageId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=sendMessageToMatchroom; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId,clientMessageId,messageId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=506}.name) (L506) | mutation | public | No/unclear | none_detected | unknown | matchroomId,clientMessageId,messageId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=deleteForMe; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=messageId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=598}.name) (L598) | mutation | public | Yes | auth_guard | unknown | messageId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=markRead; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=617}.name) (L617) | mutation | public | Yes | auth_guard | unknown | — | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=toggleReaction; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=messageId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=640}.name) (L640) | mutation | public | Yes | auth_guard | unknown | messageId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=setTyping; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=669}.name) (L669) | mutation | public | No/unclear | none_detected | arg_scoped_query_only | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=getTypers; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=697}.name) (L697) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=editMessage; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=messageId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=722}.name) (L722) | mutation | public | Yes | auth_guard | unknown | messageId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=pinMessage; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=messageId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=758}.name) (L758) | mutation | public | Yes | auth_guard | unknown | messageId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=unpinMessage; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=messageId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=781}.name) (L781) | mutation | public | Yes | auth_guard | unknown | messageId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/chat.ts; name=deleteMessage; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=messageId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=800}.name) (L800) | mutation | public | No/unclear | none_detected | unknown | messageId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/friendChat.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/friendChat.ts; name=getOrCreateDM; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=109}.name) (L109) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/friendChat.ts; name=getDMAccess; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=151}.name) (L151) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/friendChat.ts; name=getChatroom; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=178}.name) (L178) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/friendChat.ts; name=listMessages; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=192}.name) (L192) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/friendChat.ts; name=sendMessage; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=clientMessageId,messageId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=222}.name) (L222) | mutation | public | No/unclear | none_detected | unknown | clientMessageId,messageId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/friendChat.ts; name=markRead; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=318}.name) (L318) | mutation | public | No/unclear | none_detected | arg_scoped_query_only | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/friendChat.ts; name=listForUser; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=345}.name) (L345) | query | public | No/unclear | none_detected | arg_scoped_query_only | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/friendChat.ts; name=getUnreadCounts; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=389}.name) (L389) | query | public | No/unclear | none_detected | arg_scoped_query_only | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/friendChat.ts; name=generateUploadUrl; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=419}.name) (L419) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/friendChat.ts; name=deleteForMe; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=messageId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=435}.name) (L435) | mutation | public | No/unclear | none_detected | unknown | messageId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/friendChat.ts; name=toggleReaction; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=messageId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=461}.name) (L461) | mutation | public | No/unclear | none_detected | unknown | messageId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/friendChat.ts; name=editMessage; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=messageId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=497}.name) (L497) | mutation | public | No/unclear | none_detected | unknown | messageId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/teamChallengeChat.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/teamChallengeChat.ts; name=getChat; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=164}.name) (L164) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallengeChat.ts; name=getAccess; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=172}.name) (L172) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallengeChat.ts; name=listForMe; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=188}.name) (L188) | query | public | No/unclear | none_detected | arg_scoped_query_only | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallengeChat.ts; name=listMessages; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=224}.name) (L224) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallengeChat.ts; name=generateChatUploadUrl; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=247}.name) (L247) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallengeChat.ts; name=sendMessage; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=clientMessageId,messageId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=255}.name) (L255) | mutation | public | No/unclear | none_detected | unknown | clientMessageId,messageId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallengeChat.ts; name=markRead; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=365}.name) (L365) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallengeChat.ts; name=toggleReaction; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=messageId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=389}.name) (L389) | mutation | public | No/unclear | none_detected | unknown | messageId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallengeChat.ts; name=editMessage; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=messageId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=416}.name) (L416) | mutation | public | No/unclear | none_detected | unknown | messageId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallengeChat.ts; name=pinMessage; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=messageId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=452}.name) (L452) | mutation | public | No/unclear | none_detected | unknown | messageId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/teamChallengeChat.ts; name=unpinMessage; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=messageId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=486}.name) (L486) | mutation | public | No/unclear | none_detected | unknown | messageId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/zoneAdminBooking.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/zoneAdminBooking.ts; name=listBookingQueueForZone; kind=query; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=zoneId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=672}.name) (L672) | query | public | Yes | auth_guard | unknown | zoneId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/zoneAdminBooking.ts; name=listBookingHistoryForZone; kind=query; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=zoneId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=738}.name) (L738) | query | public | Yes | auth_guard | unknown | zoneId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/zoneAdminBooking.ts; name=listMatchroomsForZone; kind=query; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=zoneId,ownerUid; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=919}.name) (L919) | query | public | Yes | auth_guard | unknown | zoneId,ownerUid | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/zoneAdminBooking.ts; name=acceptBookingRequest; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=adminUid,zoneId,requestOwnerUid,hostUid,playerUids,teamId; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=962}.name) (L962) | mutation | public | Yes | auth_guard | unknown | adminUid,zoneId,requestOwnerUid,hostUid,playerUids,teamId | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/zoneAdminBooking.ts; name=rejectBookingRequest; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=adminUid,zoneId,requestOwnerUid; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1294}.name) (L1294) | mutation | public | Yes | auth_guard | unknown | adminUid,zoneId,requestOwnerUid | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/zoneAdminBooking.ts; name=sendCounterOffer; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=requestOwnerUid,zoneId,zoneOwnerUid,adminUid; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1407}.name) (L1407) | mutation | public | Yes | auth_guard | unknown | requestOwnerUid,zoneId,zoneOwnerUid,adminUid | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/zoneAdminBooking.ts; name=respondToCounterOffer; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=responderUid; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1628}.name) (L1628) | mutation | public | Yes | auth_guard | unknown | responderUid | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/zoneAdminBooking.ts; name=createWalkInMatchroom; kind=mutation; scope=public; actorRequired=Yes; authSignals=auth_guard; ownership=unknown; sensitive=zoneId,zoneOwnerUid,adminUid,uid,captainUidA,captainUidB,playerUids; risk=High; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1916}.name) (L1916) | mutation | public | Yes | auth_guard | unknown | zoneId,zoneOwnerUid,adminUid,uid,captainUidA,captainUidB,playerUids | High | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/zoneWithdrawals.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/zoneWithdrawals.ts; name=requestZoneWithdrawal; kind=action; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId,zoneId,ownerEmail; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=59}.name) (L59) | action | public | No/unclear | none_detected | unknown | userId,zoneId,ownerEmail | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/admin.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/admin.ts; name=getDashboardSummary; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=726}.name) (L726) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=getSuperAdminAllowlistConfig; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=870}.name) (L870) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=recordSuperAdminAudit; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=884}.name) (L884) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listSuperAdminAuditLogs; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=superAdminEmail; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=924}.name) (L924) | query | public | No/unclear | none_detected | unknown | superAdminEmail | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listIdentityVerifications; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=968}.name) (L968) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=manuallyVerifyIdentityVerification; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1022}.name) (L1022) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listSuperAdminMatchrooms; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1172}.name) (L1172) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=getSuperAdminMatchroomById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=matchroomId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1185}.name) (L1185) | query | public | No/unclear | none_detected | unknown | matchroomId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listEasypaisaTransactions; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=orderRefNum; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1215}.name) (L1215) | query | public | No/unclear | none_detected | unknown | orderRefNum | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=getPaymentDetailByOrderRefNum; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=orderRefNum; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1294}.name) (L1294) | query | public | No/unclear | none_detected | unknown | orderRefNum | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listPaymentsV2; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1447}.name) (L1447) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listZones; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1589}.name) (L1589) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=getZoneById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=zoneId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1623}.name) (L1623) | query | public | No/unclear | none_detected | unknown | zoneId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listUsers; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1639}.name) (L1639) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listReports; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1665}.name) (L1665) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=getReportById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1689}.name) (L1689) | query | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listSupportTickets; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1706}.name) (L1706) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listZoneWithdrawalRequests; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1730}.name) (L1730) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listZoneFinanceSummaries; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1760}.name) (L1760) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=listMyNotifications; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1897}.name) (L1897) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=countMyUnreadNotifications; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1921}.name) (L1921) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=markMyNotificationRead; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1933}.name) (L1933) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=archiveMyNotification; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1952}.name) (L1952) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=getSupportTicketById; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1970}.name) (L1970) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=approveZoneWithdrawal; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1984}.name) (L1984) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=rejectZoneWithdrawal; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2065}.name) (L2065) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=setZoneStatus; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=zoneId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2139}.name) (L2139) | mutation | public | No/unclear | none_detected | unknown | zoneId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=retryZoneMigration; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=zoneId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2318}.name) (L2318) | mutation | public | No/unclear | none_detected | unknown | zoneId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=setReportStatus; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2382}.name) (L2382) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=addReportModerationNote; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2570}.name) (L2570) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=warnReportedUser; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2603}.name) (L2603) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=warnReportedZoneAdmin; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2659}.name) (L2659) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=suspendReportedUser; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2723}.name) (L2723) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=reactivateReportedUser; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2771}.name) (L2771) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=flagReportedZone; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2802}.name) (L2802) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=suspendReportedZone; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2864}.name) (L2864) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=reactivateReportedZone; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2932}.name) (L2932) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=markReportedMatchroomForReview; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=2993}.name) (L2993) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=cancelReportedMatchroom; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=reportId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3033}.name) (L3033) | mutation | public | No/unclear | none_detected | unknown | reportId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=updateSupportTicketStatus; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3085}.name) (L3085) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=addSupportTicketInternalNote; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3120}.name) (L3120) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=replyToSupportTicketUser; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3155}.name) (L3155) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=assignSupportTicket; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3232}.name) (L3232) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=linkSupportTicketEntities; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=relatedMatchroomId,relatedTeamId,relatedZoneId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3261}.name) (L3261) | mutation | public | No/unclear | none_detected | unknown | relatedMatchroomId,relatedTeamId,relatedZoneId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=resolveSupportTicket; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3299}.name) (L3299) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=setUserRole; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=explicit_compare; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3336}.name) (L3336) | mutation | public | No/unclear | none_detected | explicit_compare | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=setUserSuspension; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3488}.name) (L3488) | mutation | public | No/unclear | none_detected | unknown | userId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/admin.ts; name=bootstrapInitialSuperAdmin; kind=mutation; scope=public; actorRequired=Yes; authSignals=super_admin_gate; ownership=unknown; sensitive=phone; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=3508}.name) (L3508) | mutation | public | Yes | super_admin_gate | unknown | phone | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/support.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/support.ts; name=getRecentUserPayments; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=381}.name) (L381) | query | public | No/unclear | none_detected | arg_scoped_query_only | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/support.ts; name=getRecentUserMatchrooms; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=413}.name) (L413) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/support.ts; name=getMySupportContext; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=457}.name) (L457) | query | public | No/unclear | none_detected | arg_scoped_query_only | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/support.ts; name=getAuthenticatedSupportIdentity; kind=internalQuery; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=507}.name) (L507) | internalQuery | internal | Yes (internal) | none_detected | unknown | — | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/support.ts; name=issueWorkerToken; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=conversationId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=518}.name) (L518) | mutation | public | No/unclear | none_detected | unknown | conversationId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/support.ts; name=getOrCreateConversation; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=549}.name) (L549) | mutation | public | No/unclear | none_detected | arg_scoped_query_only | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/support.ts; name=listConversationMessages; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=conversationId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=613}.name) (L613) | query | public | No/unclear | none_detected | unknown | conversationId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/support.ts; name=appendUserMessage; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=conversationId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=637}.name) (L637) | mutation | public | No/unclear | none_detected | unknown | conversationId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/support.ts; name=appendAssistantMessage; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=conversationId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=669}.name) (L669) | mutation | public | No/unclear | none_detected | arg_scoped_query_only | conversationId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/support.ts; name=executeAgentToolGateway; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=1218}.name) (L1218) | internalMutation | internal | Yes (internal) | none_detected | unknown | — | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/support.ts; name=createSupportTicket; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=conversationId; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1499}.name) (L1499) | mutation | public | No/unclear | none_detected | unknown | conversationId | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/support.ts; name=requestAccountDeletion; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1568}.name) (L1568) | mutation | public | No/unclear | none_detected | arg_scoped_query_only | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/support.ts; name=getSupportTicketEmailPayload; kind=query; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1636}.name) (L1636) | query | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/support.ts; name=markSupportTicketEmailStatus; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=emailStatus; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1661}.name) (L1661) | mutation | public | No/unclear | none_detected | unknown | emailStatus | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |

#### convex/kyc.ts

| Function | Type | Scope | Actor required | Current auth check (detected) | Ownership check (detected) | Sensitive args | Risk | Recommended action |
|---|---|---|---|---|---|---|---|---|
| $(@{file=convex/kyc.ts; name=getCurrentUserKyc; kind=query; scope=public; actorRequired=Yes; authSignals=auth_user; ownership=unknown; sensitive=; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=449}.name) (L449) | query | public | Yes | auth_user | unknown | — | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/kyc.ts; name=startDiditKycSession; kind=action; scope=public; actorRequired=Yes; authSignals=auth_user; ownership=unknown; sensitive=; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=468}.name) (L468) | action | public | Yes | auth_user | unknown | — | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/kyc.ts; name=createDiditKycStartIntent; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=arg_scoped_query_only; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=545}.name) (L545) | mutation | public | No/unclear | none_detected | arg_scoped_query_only | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/kyc.ts; name=startDiditKycSessionFromIntent; kind=action; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=621}.name) (L621) | action | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/kyc.ts; name=refreshDiditVerificationStatus; kind=action; scope=public; actorRequired=Yes; authSignals=auth_user; ownership=unknown; sensitive=; risk=Medium; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=686}.name) (L686) | action | public | Yes | auth_user | unknown | — | Medium | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/kyc.ts; name=createOrReuseKycVerification; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=788}.name) (L788) | internalMutation | internal | Yes (internal) | none_detected | unknown | userId | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/kyc.ts; name=markKycSessionCreated; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=833}.name) (L833) | internalMutation | internal | Yes (internal) | none_detected | unknown | — | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/kyc.ts; name=findVerificationFromDiditPayload; kind=internalQuery; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=864}.name) (L864) | internalQuery | internal | Yes (internal) | none_detected | unknown | — | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/kyc.ts; name=getVerificationForRefresh; kind=internalQuery; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=887}.name) (L887) | internalQuery | internal | Yes (internal) | none_detected | unknown | — | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/kyc.ts; name=getVerificationForStartIntent; kind=internalQuery; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=894}.name) (L894) | internalQuery | internal | Yes (internal) | none_detected | unknown | — | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/kyc.ts; name=applyDiditStatusUpdate; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=emailVerificationStatus; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=901}.name) (L901) | internalMutation | internal | Yes (internal) | none_detected | unknown | emailVerificationStatus | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/kyc.ts; name=recordKycAuditEvent; kind=internalMutation; scope=internal; actorRequired=Yes (internal); authSignals=none_detected; ownership=unknown; sensitive=userId; risk=Medium; recommended=Ensure only internal callers; keep idempotency; validate invariants; line=1032}.name) (L1032) | internalMutation | internal | Yes (internal) | none_detected | unknown | userId | Medium | Ensure only internal callers; keep idempotency; validate invariants |
| $(@{file=convex/kyc.ts; name=markProfileImage; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1065}.name) (L1065) | mutation | public | No/unclear | none_detected | unknown | — | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/kyc.ts; name=requestEmailChange; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=email; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1098}.name) (L1098) | mutation | public | No/unclear | none_detected | unknown | email | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |
| $(@{file=convex/kyc.ts; name=requestPhoneChange; kind=mutation; scope=public; actorRequired=No/unclear; authSignals=none_detected; ownership=unknown; sensitive=phoneE164,phoneMasked,phoneHash; risk=Critical; recommended=Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed; line=1118}.name) (L1118) | mutation | public | No/unclear | none_detected | unknown | phoneE164,phoneMasked,phoneHash | Critical | Bind actor server-side; add role+ownership checks; remove client actor IDs; paginate where needed |


## 21. Performance / Scalability Audit

### 21.1 High-risk backend patterns (static)

- Use of `.collect()` on potentially unbounded tables in user-facing endpoints:
  - Wallet history/transactions: `convex/wallet.ts` (`listTransactions`, `listHistory`)
  - Notifications counts: `convex/notifications.ts` (`countUnreadFast`, `countPendingFast`)
  - Reports list flows: `convex/reports.ts` (`listMine`, `listForMyZone`) use `.collect()` then filter in memory
  - Admin dashboards aggregate multiple `.collect()` (e.g. `convex/admin.ts`)
- Fanout: dashboard summary aggregates multiple tables + then fetches many friend docs (`convex/dashboard.ts`) — must be paginated/cached and actor-scoped.

### 21.2 Client/UI list risks (static)

- Multiple list-heavy screens exist across Player/Zone/Super Admin; correctness and performance depends on pagination, memoization, and stable keys.
- Existing schedule/list pagination audit exists and should be folded into implementation roadmap (`TEMP_MATCHHAI_SCHEDULE_AND_LIST_PAGINATION_AUDIT.md`).

### 21.3 Recommended performance strategy (audit-only)

- Replace unbounded `.collect()` with cursor pagination (Convex `paginate`) for all lists.
- For counters/badges: use summary docs/counters rather than scanning large tables.
- For "discover" lists: server-side search/filter + paginated results, avoid fetching 300 candidates then filtering client-side.
- For chat: "load older" pagination + per-chat digest rows for chatroom lists; avoid fetching entire message histories.

---

## 22. External Integrations Audit

### 22.1 Easypaisa

- Integration module: `convex/easypaisa.ts` (+ `convex/easypaisaRest.ts`, `convex/easypaisaNode.ts`)
- HTTP endpoints: registered in `convex/http.ts`:
  - `/payments/easypaisa/checkout` (GET)
  - `/payments/easypaisa/token` (GET)
  - `/payments/easypaisa/finalize` (GET/POST)
  - `/payments/easypaisa/ipn` (GET)
- Static risks (**needs deeper review + runtime QA**):
  - Token flows use query params; ensure tokens are single-use/short TTL and never logged unsafely.
  - Ensure IPN handler validates source (host allowlist and signature validation) and is idempotent.
  - Ensure payment state transitions cannot be triggered from client (ties back to `SEC-BOOKINGS-02`, `SEC-MATCHROOM-01`, `SEC-WALLET-02`).

### 22.2 Expo Push

- Modules: `convex/pushNotifications.ts`, `convex/pushNotificationsActions.ts`, client bridges `src/components/PushRegistrationBridge` + `src/components/NotificationRuntimeBridge` (not audited in-depth here).
- Needs manual runtime/device QA:
  - APNs/FCM credentials, push permission prompts, token registration, deep links.

### 22.3 KYC provider (Didit)

- Modules: `convex/kyc.ts`, `convex/kycGate.ts`, webhook in `convex/http.ts` (`/kyc/didit/webhook`).
- Static positive: signature verification helpers exist; status updates are internal mutations.
- Needs manual runtime/device QA:
  - End-to-end verification session creation, webhook delivery, and app unlock/lock on status changes.

### 22.4 External game APIs

- PSN: schema contains PSN token cache (`psnTokenCache`) and PSN stats fields; modules include `convex/externalApis.ts`, `convex/psnTokenCache.ts` (not fully audited here).
- FACEIT/Steam: visible in user schema fields + OAuth callback handler in `app/_layout.tsx`; needs runtime QA to validate linking and refresh behavior.

### 22.5 Support chatbot/AI worker

- Worker: `workers/support-ai-worker.ts` (policy includes prohibitions for high-stakes actions).
- Server tool endpoint: `/support/agentTools` in `convex/http.ts`.
- Needs manual runtime/device QA:
  - Ensure the agent cannot access or mutate sensitive data without explicit server-side authorization.

---

## 23. App Store / Play Store Readiness

### 23.1 App config + permission strings (static)

- `app.json` includes iOS Info.plist usage strings for photo library, camera, microphone; encryption flag is set (`ITSAppUsesNonExemptEncryption=false`).
- Android permissions list includes audio permissions (duplicated) — verify whether notifications, storage/media permissions are needed for attachments.

### 23.2 Privacy policy + terms (static)

- Signup UI shows "Terms of Service" and "Privacy Policy" text but does not open URLs in the current code path (`app/auth/register-step4.tsx`).
- No in-repo hosted policy URLs were found (static). Recommendation: add real, accessible links (web URLs) and include them in store metadata.

### 23.3 Account deletion (static)

- Account deletion request flow exists in codebase (`convex/support.ts` + player profile settings UI at `app/(player)/profile/edit.tsx`). **Needs manual runtime/device QA** end-to-end (requires backend deployed and admin review path confirmed).

### 23.4 UGC moderation + reporting (static)

- Reporting surfaces exist (reports table, chat message report types), but current access control flaws (`SEC-REPORTS-01`) must be remediated before claiming compliance.
- Support tickets vs moderation reports separation is implemented in schema and modules, but must be validated in UI lists (manual QA).

### 23.5 Store submission checklist (manual)

- Verify and prepare:
  - Public privacy policy URL, terms URL, support URL
  - Data safety forms (Play) + privacy nutrition labels (Apple)
  - UGC reporting + moderation policy statements
  - Age rating + content disclosures
  - Screenshots for required device classes (iPhone + Android + iPad if enabled)

### 23.6 Store-readiness exact checklist (static + manual QA gates)

| Item | Present in repo? | Status | Notes / files |
|---|---:|---|---|
| Privacy Policy URL (tappable) | No | Blocker | Signup screen text not linked (`app/auth/register-step4.tsx`) (`STORE-POLICY-01`, `STORE-URL-01`) |
| Terms URL (tappable) | No | Blocker | Same as above |
| Support URL (public, store metadata + in-app) | Unclear | Manual QA | In-app support tickets exist (`convex/support.ts`, `app/(player)/support.tsx`), but explicit external support URL must be validated (`STORE-URL-01`) |
| Account deletion in app | Yes | Manual QA | Request flow exists (`app/(player)/profile/edit.tsx`, `convex/support.ts:requestAccountDeletion`) |
| UGC reporting (users/matchrooms/chat) | Yes | Manual QA | Reports module exists; must fix access control before claiming compliance (`SEC-REPORTS-01`) |
| Blocking users | Partial | Manual QA | Backend blocklist exists (`convex/social.ts` + `src/services/convex/socialService.ts`), UI discoverability must be confirmed |
| Moderation actions path | Yes (admin) | Manual QA | Super admin report actions exist in `convex/admin.ts` + report detail UI; must validate audit logs and safety guardrails |
| Permission strings present (iOS) | Yes | Manual QA | `app.json` InfoPlist strings present; verify accuracy vs features |
| Android permissions minimal | No (dup) | Improve | Duplicated audio permission declarations (`BUILD-ANDROID-01`) |
| Android 13 notification permission | Unclear | Manual QA | Verify `POST_NOTIFICATIONS` behavior + prompt timing in release build |
| Real-money/wallet wording risk | Yes | Manual QA | Wallet/withdrawals + provider flows require clear copy and policy disclosure |
| iOS tablet support risk | Yes | Manual QA | `ios.supportsTablet=true` -> must QA tablet layouts |
| Production env placeholders | Yes | Blocker | `eas.json` prod placeholders (`BUILD-PROD-01`) |
| Deep links / associated domains | Partial | Manual QA | Scheme `matchhai` exists; verify routes + OAuth callback and notification links |
| Push credentials | Unclear | Manual QA | Must set APNs/FCM credentials in EAS and validate delivery |
| TestFlight/internal testing readiness | Partial | Manual QA | Config exists but prod env placeholders must be replaced |

---

## 24. Xcode / Android / EAS Build Readiness

### 24.1 `app.json` (static)

- App scheme: `matchhai` (deep links use `matchhai://...`).
- iOS bundle ID: `com.ovaisto.matchhai`
- Android package: `com.ovaisto.matchhai`
- `ios.supportsTablet=true` (tablet QA required).

### 24.2 `eas.json` (static)

- Preview env points to a concrete Convex deployment:
  - `EXPO_PUBLIC_CONVEX_URL=https://quick-panda-920.convex.cloud`
  - `EXPO_PUBLIC_CONVEX_SITE_URL=https://quick-panda-920.convex.site`
- Production env contains placeholders:
  - `EXPO_PUBLIC_CONVEX_URL=https://REPLACE_WITH_PRODUCTION_DEPLOYMENT.convex.cloud`
  - `EXPO_PUBLIC_CONVEX_SITE_URL=https://REPLACE_WITH_PRODUCTION_DEPLOYMENT.convex.site`
  - This is a **release blocker** until replaced with real production deployments.
- Preview env includes `EXPO_PUBLIC_SUPER_ADMIN_EMAIL` which should not be shipped as public config for admin identity (ties to `SEC-ROUTING-01`).

### 24.3 Push/deep links (static)

- Deep link parsing exists in `app/_layout.tsx` for OAuth callback paths; requires runtime QA for scheme routing.
- Push notifications require credentials setup in EAS + Expo; ensure APNs/FCM keys are configured and validated in staging.

### 24.4 Recommended build readiness steps (manual)

- Replace production Convex URLs with real prod deployments and ensure staging/prod separation.
- Validate `expo-notifications` permission prompts and Android 13+ notification permission handling.
- Confirm Play Console / App Store Connect metadata, screenshots, and policy URLs.

---

## 25. QA Test Case Library

Target: 300+ test cases across modules/roles.

### 25.1 Auth / Onboarding (40)

| Test ID | Module | Role | Preconditions | Steps | Expected result | Priority | Automation candidate |
|---|---|---|---|---|---|---|---|
| AUTH-001 | Auth/Onboarding | Player | No account | Open app; Register; complete steps 1-4; submit | Account created; routed to Player Home; session persists | P0 | N |
| AUTH-002 | Auth/Onboarding | Player | Existing account | Login with valid credentials | Login succeeds; routed to Player Home | P0 | Y |
| AUTH-003 | Auth/Onboarding | Player | Existing account | Login with wrong password | Error shown; no session created | P0 | Y |
| AUTH-004 | Auth/Onboarding | Player | Existing account | Forgot password; reset; login | Reset works; new password accepted; old rejected | P0 | N |
| AUTH-005 | Auth/Onboarding | Player | New signup | Leave required field blank and attempt submit | Validation blocks progress; clear helper text shown | P1 | Y |
| AUTH-006 | Auth/Onboarding | Player | New signup | Use already-taken username and submit | Availability error shown; cannot proceed | P0 | N |
| AUTH-007 | Auth/Onboarding | Player | New signup | Do not accept Terms/Privacy; attempt submit | Submit disabled or blocked with message | P0 | Y |
| AUTH-008 | Auth/Onboarding | Player | New signup | Tap Terms of Service link | Opens Terms URL; no crash | P0 | N |
| AUTH-009 | Auth/Onboarding | Player | New signup | Tap Privacy Policy link | Opens Privacy URL; no crash | P0 | N |
| AUTH-010 | Auth/Onboarding | All | Signed in | Kill app; cold start | Session restored; correct surface routed; no sensitive flicker | P0 | N |
| AUTH-011 | Auth/Onboarding | All | Signed in | Go offline; open app; navigate key screens | Offline UI shown; no infinite spinners | P1 | N |
| AUTH-012 | Auth/Onboarding | All | Signed in | Logout; reopen app | Routed to login; private data cleared | P0 | Y |
| AUTH-013 | Auth/Onboarding | Zone Admin | No zone admin account | Zone register; complete required steps; submit | Zone admin created; routed to Zone surface | P0 | N |
| AUTH-014 | Auth/Onboarding | Zone Admin | Zone admin signed in | Cold start app | Routed to Zone surface (not Player) | P0 | N |
| AUTH-015 | Auth/Onboarding | Super Admin | Super admin signed in | Cold start app | Routed to Super Admin surface | P0 | N |
| AUTH-016 | Auth/Onboarding | All | Signed in | Background app; return active | Session remains valid; no unexpected logout | P1 | N |
| AUTH-017 | Auth/Onboarding | Player | New signup | Use invalid email format | Validation error shown; cannot submit | P1 | Y |
| AUTH-018 | Auth/Onboarding | Player | Signed in | Trigger OAuth callback deep link for Steam | Safe confirmation shown; no raw identifiers exposed; account link reflects in profile | P1 | N |
| AUTH-019 | Auth/Onboarding | Player | Signed in | Trigger OAuth callback deep link with error | Error shown; no partial link applied | P1 | N |
| AUTH-020 | Auth/Onboarding | All | Signed out | Attempt to open protected route directly | Redirected to login; no sensitive data shown | P0 | N |
| AUTH-021 | Auth/Onboarding | All | Signed in as Player | Attempt to open Zone or Super Admin routes | Server blocks privileged data; UI fails safe | P0 | N |
| AUTH-022 | Auth/Onboarding | Player | Signed in; phone OTP enabled | Request OTP; enter wrong code | Error shown; rate limiting applied; not verified | P1 | N |
| AUTH-023 | Auth/Onboarding | Player | Signed in; phone OTP enabled | Request OTP; enter correct code | Phone marked verified; verified state persists | P1 | N |
| AUTH-024 | Auth/Onboarding | All | Signed in | Increase system font size; reopen key screens | No clipped critical CTAs; layout remains usable | P2 | N |
| AUTH-025 | Auth/Onboarding | All | Signed in | Force a Convex error in dev; observe handling | User sees friendly error; dev logs retain actionable info | P2 | N |
| AUTH-026 | Auth/Onboarding | All | Dev build available | Toggle KYC bypass flag; verify behavior | Bypass works only in dev; release build ignores; server still enforces gates | P0 | N |
| AUTH-027 | Auth/Onboarding | Player | New signup | Rapidly toggle agreement checkboxes; submit | State stable; submit only enabled when all required accepted | P2 | Y |
| AUTH-028 | Auth/Onboarding | All | Signed out | Attempt duplicate registration with existing email | Duplicate prevented; clear error message | P0 | N |
| AUTH-029 | Auth/Onboarding | All | Signed in; offline | Attempt logout while offline; reopen | No stuck state; returns to signed-out state once network returns | P2 | N |
| AUTH-030 | Auth/Onboarding | Player | Signed in; profile incomplete | Reopen app; verify required onboarding gates applied | Routed to required steps; cannot access protected tabs until complete | P0 | N |
| AUTH-031 | Auth/Onboarding | All | Two accounts with different roles | Sign out and sign into other role | Role routing correct; caches cleared; no cross-role leakage | P1 | N |
| AUTH-032 | Auth/Onboarding | All | Signed in | Attempt account deletion flow (if present) | Deletion confirmed; data removed or deactivated; session revoked | P0 | N |
| AUTH-033 | Auth/Onboarding | All | Signed in | Simulate session expiry; reopen app | Prompt re-login; no crash; no stale private data shown | P1 | N |
| AUTH-034 | Auth/Onboarding | All | Signed in; slow network | Login or open home under slow network | Loading state visible; eventual success or clear error | P1 | N |
| AUTH-035 | Auth/Onboarding | All | Signed out; small device | Open login; focus fields; open keyboard | Primary CTA remains reachable; screen scrolls as needed | P1 | N |
| AUTH-036 | Auth/Onboarding | All | Existing account | Login with leading or trailing spaces in email | Input normalized; login works when credentials correct | P2 | Y |
| AUTH-037 | Auth/Onboarding | All | New signup | Register with weak password below requirements | Validation shown; cannot proceed | P1 | Y |
| AUTH-038 | Auth/Onboarding | All | New signup | Register with mismatched confirm password (if present) | Validation shown; cannot proceed | P2 | Y |
| AUTH-039 | Auth/Onboarding | All | Signed out | Open a deep link to a player screen | Redirects to login then returns to target after auth | P1 | N |
| AUTH-040 | Auth/Onboarding | All | If localization supported | Change locale; revisit auth screens | No layout break; strings remain readable; truncation safe | P3 | N |

### 25.2 Player/User Core Flows (60)

| Test ID | Module | Role | Preconditions | Steps | Expected result | Priority | Automation candidate |
|---|---|---|---|---|---|---|---|
| PLY-001 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P0 | N |
| PLY-002 | Player Core | Player | Signed in as player | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| PLY-003 | Player Core | Player | Signed in as player | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | Y |
| PLY-004 | Player Core | Player | Signed in as player | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| PLY-005 | Player Core | Player | Signed in as player | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| PLY-006 | Player Core | Player | Signed in as player | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | Y |
| PLY-007 | Player Core | Player | Signed in as player | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| PLY-008 | Player Core | Player | Signed in as player | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| PLY-009 | Player Core | Player | Signed in as player | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | Y |
| PLY-010 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P0 | N |
| PLY-011 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P0 | N |
| PLY-012 | Player Core | Player | Signed in as player | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | Y |
| PLY-013 | Player Core | Player | Signed in as player | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| PLY-014 | Player Core | Player | Signed in as player | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| PLY-015 | Player Core | Player | Signed in as player | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | Y |
| PLY-016 | Player Core | Player | Signed in as player | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| PLY-017 | Player Core | Player | Signed in as player | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| PLY-018 | Player Core | Player | Signed in as player | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | Y |
| PLY-019 | Player Core | Player | Signed in as player | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| PLY-020 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P0 | N |
| PLY-021 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P0 | Y |
| PLY-022 | Player Core | Player | Signed in as player | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| PLY-023 | Player Core | Player | Signed in as player | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| PLY-024 | Player Core | Player | Signed in as player | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| PLY-025 | Player Core | Player | Signed in as player | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| PLY-026 | Player Core | Player | Signed in as player | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| PLY-027 | Player Core | Player | Signed in as player | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| PLY-028 | Player Core | Player | Signed in as player | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| PLY-029 | Player Core | Player | Signed in as player | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| PLY-030 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P1 | N |
| PLY-031 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P1 | N |
| PLY-032 | Player Core | Player | Signed in as player | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| PLY-033 | Player Core | Player | Signed in as player | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| PLY-034 | Player Core | Player | Signed in as player | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| PLY-035 | Player Core | Player | Signed in as player | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| PLY-036 | Player Core | Player | Signed in as player | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| PLY-037 | Player Core | Player | Signed in as player | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| PLY-038 | Player Core | Player | Signed in as player | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| PLY-039 | Player Core | Player | Signed in as player | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| PLY-040 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P1 | N |
| PLY-041 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P1 | N |
| PLY-042 | Player Core | Player | Signed in as player | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| PLY-043 | Player Core | Player | Signed in as player | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| PLY-044 | Player Core | Player | Signed in as player | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| PLY-045 | Player Core | Player | Signed in as player | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| PLY-046 | Player Core | Player | Signed in as player | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| PLY-047 | Player Core | Player | Signed in as player | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| PLY-048 | Player Core | Player | Signed in as player | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| PLY-049 | Player Core | Player | Signed in as player | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| PLY-050 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P2 | N |
| PLY-051 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P2 | N |
| PLY-052 | Player Core | Player | Signed in as player | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| PLY-053 | Player Core | Player | Signed in as player | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| PLY-054 | Player Core | Player | Signed in as player | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| PLY-055 | Player Core | Player | Signed in as player | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| PLY-056 | Player Core | Player | Signed in as player | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| PLY-057 | Player Core | Player | Signed in as player | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| PLY-058 | Player Core | Player | Signed in as player | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| PLY-059 | Player Core | Player | Signed in as player | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| PLY-060 | Player Core | Player | Signed in as player | Open module; complete primary action; verify navigation | Action succeeds; correct routing; consistent feedback | P2 | N |

### 25.3 Matchrooms + Payments (80)

| Test ID | Module | Role | Preconditions | Steps | Expected result | Priority | Automation candidate |
|---|---|---|---|---|---|---|---|
| MRP-001 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P0 | N |
| MRP-002 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| MRP-003 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | Y |
| MRP-004 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| MRP-005 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| MRP-006 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | Y |
| MRP-007 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| MRP-008 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| MRP-009 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | Y |
| MRP-010 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P0 | N |
| MRP-011 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P0 | N |
| MRP-012 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | Y |
| MRP-013 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| MRP-014 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| MRP-015 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | Y |
| MRP-016 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| MRP-017 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| MRP-018 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | Y |
| MRP-019 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| MRP-020 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P0 | N |
| MRP-021 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P0 | Y |
| MRP-022 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| MRP-023 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| MRP-024 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | Y |
| MRP-025 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| MRP-026 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| MRP-027 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Rotate device during load | No crash; state preserved; layout stable | P2 | Y |
| MRP-028 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| MRP-029 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| MRP-030 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P1 | N |
| MRP-031 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P1 | N |
| MRP-032 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| MRP-033 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| MRP-034 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| MRP-035 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| MRP-036 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| MRP-037 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| MRP-038 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| MRP-039 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| MRP-040 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P1 | N |
| MRP-041 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P1 | N |
| MRP-042 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| MRP-043 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| MRP-044 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| MRP-045 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| MRP-046 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| MRP-047 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| MRP-048 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| MRP-049 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| MRP-050 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P1 | N |
| MRP-051 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P1 | N |
| MRP-052 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| MRP-053 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| MRP-054 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| MRP-055 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| MRP-056 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| MRP-057 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| MRP-058 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| MRP-059 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| MRP-060 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P2 | N |
| MRP-061 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P2 | N |
| MRP-062 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| MRP-063 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| MRP-064 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| MRP-065 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| MRP-066 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| MRP-067 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| MRP-068 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| MRP-069 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| MRP-070 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P2 | N |
| MRP-071 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P2 | N |
| MRP-072 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| MRP-073 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| MRP-074 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| MRP-075 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| MRP-076 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| MRP-077 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| MRP-078 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| MRP-079 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| MRP-080 | Matchrooms and Payments | Player | Signed in; seeded matchrooms exist | Create or join matchroom; proceed through booking and payment states | Correct status transitions; no stuck pending; intents consistent | P2 | N |

### 25.4 Wallet + Withdrawals (40)

| Test ID | Module | Role | Preconditions | Steps | Expected result | Priority | Automation candidate |
|---|---|---|---|---|---|---|---|
| WAL-001 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Open wallet; view balance and history; perform top-up if enabled | Balance correct; history accurate; privacy preserved | P0 | N |
| WAL-002 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| WAL-003 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | Y |
| WAL-004 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| WAL-005 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| WAL-006 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | Y |
| WAL-007 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| WAL-008 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| WAL-009 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | Y |
| WAL-010 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Open wallet; view balance and history; perform top-up if enabled | Balance correct; history accurate; privacy preserved | P0 | N |
| WAL-011 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Open wallet; view balance and history; perform top-up if enabled | Balance correct; history accurate; privacy preserved | P0 | N |
| WAL-012 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | Y |
| WAL-013 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| WAL-014 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| WAL-015 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| WAL-016 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| WAL-017 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| WAL-018 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| WAL-019 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| WAL-020 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Open wallet; view balance and history; perform top-up if enabled | Balance correct; history accurate; privacy preserved | P1 | N |
| WAL-021 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Open wallet; view balance and history; perform top-up if enabled | Balance correct; history accurate; privacy preserved | P1 | N |
| WAL-022 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| WAL-023 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| WAL-024 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| WAL-025 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| WAL-026 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| WAL-027 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| WAL-028 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| WAL-029 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| WAL-030 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Open wallet; view balance and history; perform top-up if enabled | Balance correct; history accurate; privacy preserved | P2 | N |
| WAL-031 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Open wallet; view balance and history; perform top-up if enabled | Balance correct; history accurate; privacy preserved | P2 | N |
| WAL-032 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| WAL-033 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| WAL-034 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| WAL-035 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| WAL-036 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| WAL-037 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| WAL-038 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| WAL-039 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| WAL-040 | Wallet and Withdrawals | Player | Signed in; wallet enabled | Open wallet; view balance and history; perform top-up if enabled | Balance correct; history accurate; privacy preserved | P2 | N |

### 25.5 Teams + Challenges + Chat (50)

| Test ID | Module | Role | Preconditions | Steps | Expected result | Priority | Automation candidate |
|---|---|---|---|---|---|---|---|
| TEAM-001 | Teams, Challenges, Chat | Player | Signed in; another user exists | Create team or challenge; invite member; use chat; verify lifecycle | Lifecycle correct; permissions enforced; chat order stable | P0 | N |
| TEAM-002 | Teams, Challenges, Chat | Player | Signed in; another user exists | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| TEAM-003 | Teams, Challenges, Chat | Player | Signed in; another user exists | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | Y |
| TEAM-004 | Teams, Challenges, Chat | Player | Signed in; another user exists | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| TEAM-005 | Teams, Challenges, Chat | Player | Signed in; another user exists | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| TEAM-006 | Teams, Challenges, Chat | Player | Signed in; another user exists | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | Y |
| TEAM-007 | Teams, Challenges, Chat | Player | Signed in; another user exists | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| TEAM-008 | Teams, Challenges, Chat | Player | Signed in; another user exists | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| TEAM-009 | Teams, Challenges, Chat | Player | Signed in; another user exists | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | Y |
| TEAM-010 | Teams, Challenges, Chat | Player | Signed in; another user exists | Create team or challenge; invite member; use chat; verify lifecycle | Lifecycle correct; permissions enforced; chat order stable | P0 | N |
| TEAM-011 | Teams, Challenges, Chat | Player | Signed in; another user exists | Create team or challenge; invite member; use chat; verify lifecycle | Lifecycle correct; permissions enforced; chat order stable | P0 | N |
| TEAM-012 | Teams, Challenges, Chat | Player | Signed in; another user exists | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | Y |
| TEAM-013 | Teams, Challenges, Chat | Player | Signed in; another user exists | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| TEAM-014 | Teams, Challenges, Chat | Player | Signed in; another user exists | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| TEAM-015 | Teams, Challenges, Chat | Player | Signed in; another user exists | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | Y |
| TEAM-016 | Teams, Challenges, Chat | Player | Signed in; another user exists | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| TEAM-017 | Teams, Challenges, Chat | Player | Signed in; another user exists | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| TEAM-018 | Teams, Challenges, Chat | Player | Signed in; another user exists | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | Y |
| TEAM-019 | Teams, Challenges, Chat | Player | Signed in; another user exists | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| TEAM-020 | Teams, Challenges, Chat | Player | Signed in; another user exists | Create team or challenge; invite member; use chat; verify lifecycle | Lifecycle correct; permissions enforced; chat order stable | P1 | N |
| TEAM-021 | Teams, Challenges, Chat | Player | Signed in; another user exists | Create team or challenge; invite member; use chat; verify lifecycle | Lifecycle correct; permissions enforced; chat order stable | P1 | N |
| TEAM-022 | Teams, Challenges, Chat | Player | Signed in; another user exists | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| TEAM-023 | Teams, Challenges, Chat | Player | Signed in; another user exists | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| TEAM-024 | Teams, Challenges, Chat | Player | Signed in; another user exists | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| TEAM-025 | Teams, Challenges, Chat | Player | Signed in; another user exists | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| TEAM-026 | Teams, Challenges, Chat | Player | Signed in; another user exists | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| TEAM-027 | Teams, Challenges, Chat | Player | Signed in; another user exists | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| TEAM-028 | Teams, Challenges, Chat | Player | Signed in; another user exists | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| TEAM-029 | Teams, Challenges, Chat | Player | Signed in; another user exists | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| TEAM-030 | Teams, Challenges, Chat | Player | Signed in; another user exists | Create team or challenge; invite member; use chat; verify lifecycle | Lifecycle correct; permissions enforced; chat order stable | P1 | N |
| TEAM-031 | Teams, Challenges, Chat | Player | Signed in; another user exists | Create team or challenge; invite member; use chat; verify lifecycle | Lifecycle correct; permissions enforced; chat order stable | P1 | N |
| TEAM-032 | Teams, Challenges, Chat | Player | Signed in; another user exists | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| TEAM-033 | Teams, Challenges, Chat | Player | Signed in; another user exists | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| TEAM-034 | Teams, Challenges, Chat | Player | Signed in; another user exists | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| TEAM-035 | Teams, Challenges, Chat | Player | Signed in; another user exists | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| TEAM-036 | Teams, Challenges, Chat | Player | Signed in; another user exists | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| TEAM-037 | Teams, Challenges, Chat | Player | Signed in; another user exists | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| TEAM-038 | Teams, Challenges, Chat | Player | Signed in; another user exists | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| TEAM-039 | Teams, Challenges, Chat | Player | Signed in; another user exists | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| TEAM-040 | Teams, Challenges, Chat | Player | Signed in; another user exists | Create team or challenge; invite member; use chat; verify lifecycle | Lifecycle correct; permissions enforced; chat order stable | P2 | N |
| TEAM-041 | Teams, Challenges, Chat | Player | Signed in; another user exists | Create team or challenge; invite member; use chat; verify lifecycle | Lifecycle correct; permissions enforced; chat order stable | P2 | N |
| TEAM-042 | Teams, Challenges, Chat | Player | Signed in; another user exists | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| TEAM-043 | Teams, Challenges, Chat | Player | Signed in; another user exists | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| TEAM-044 | Teams, Challenges, Chat | Player | Signed in; another user exists | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| TEAM-045 | Teams, Challenges, Chat | Player | Signed in; another user exists | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| TEAM-046 | Teams, Challenges, Chat | Player | Signed in; another user exists | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| TEAM-047 | Teams, Challenges, Chat | Player | Signed in; another user exists | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| TEAM-048 | Teams, Challenges, Chat | Player | Signed in; another user exists | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| TEAM-049 | Teams, Challenges, Chat | Player | Signed in; another user exists | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| TEAM-050 | Teams, Challenges, Chat | Player | Signed in; another user exists | Create team or challenge; invite member; use chat; verify lifecycle | Lifecycle correct; permissions enforced; chat order stable | P2 | N |

### 25.6 Zone Admin (50)

| Test ID | Module | Role | Preconditions | Steps | Expected result | Priority | Automation candidate |
|---|---|---|---|---|---|---|---|
| ZAD-001 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Open module; perform primary admin action; verify updates | Admin action succeeds; only own zone affected; feedback shown | P0 | N |
| ZAD-002 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| ZAD-003 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | Y |
| ZAD-004 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| ZAD-005 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| ZAD-006 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | Y |
| ZAD-007 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| ZAD-008 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| ZAD-009 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | Y |
| ZAD-010 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Open module; perform primary admin action; verify updates | Admin action succeeds; only own zone affected; feedback shown | P0 | N |
| ZAD-011 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Open module; perform primary admin action; verify updates | Admin action succeeds; only own zone affected; feedback shown | P0 | N |
| ZAD-012 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | Y |
| ZAD-013 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| ZAD-014 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| ZAD-015 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | Y |
| ZAD-016 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| ZAD-017 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| ZAD-018 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | Y |
| ZAD-019 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| ZAD-020 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Open module; perform primary admin action; verify updates | Admin action succeeds; only own zone affected; feedback shown | P1 | N |
| ZAD-021 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Open module; perform primary admin action; verify updates | Admin action succeeds; only own zone affected; feedback shown | P1 | N |
| ZAD-022 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| ZAD-023 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| ZAD-024 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| ZAD-025 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| ZAD-026 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| ZAD-027 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| ZAD-028 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| ZAD-029 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| ZAD-030 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Open module; perform primary admin action; verify updates | Admin action succeeds; only own zone affected; feedback shown | P1 | N |
| ZAD-031 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Open module; perform primary admin action; verify updates | Admin action succeeds; only own zone affected; feedback shown | P1 | N |
| ZAD-032 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| ZAD-033 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| ZAD-034 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| ZAD-035 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| ZAD-036 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| ZAD-037 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| ZAD-038 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| ZAD-039 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| ZAD-040 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Open module; perform primary admin action; verify updates | Admin action succeeds; only own zone affected; feedback shown | P2 | N |
| ZAD-041 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Open module; perform primary admin action; verify updates | Admin action succeeds; only own zone affected; feedback shown | P2 | N |
| ZAD-042 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| ZAD-043 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| ZAD-044 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| ZAD-045 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| ZAD-046 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| ZAD-047 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| ZAD-048 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| ZAD-049 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| ZAD-050 | Zone Admin | Zone Admin | Signed in as zone admin; zone configured | Open module; perform primary admin action; verify updates | Admin action succeeds; only own zone affected; feedback shown | P2 | N |

### 25.7 Super Admin (50)

| Test ID | Module | Role | Preconditions | Steps | Expected result | Priority | Automation candidate |
|---|---|---|---|---|---|---|---|
| SAD-001 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Open list; filter; open detail; perform safe action | Authorization correct; pagination stable; actions logged | P0 | N |
| SAD-002 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| SAD-003 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | Y |
| SAD-004 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| SAD-005 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| SAD-006 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | Y |
| SAD-007 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| SAD-008 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| SAD-009 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | Y |
| SAD-010 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Open list; filter; open detail; perform safe action | Authorization correct; pagination stable; actions logged | P0 | N |
| SAD-011 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Open list; filter; open detail; perform safe action | Authorization correct; pagination stable; actions logged | P0 | N |
| SAD-012 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | Y |
| SAD-013 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| SAD-014 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| SAD-015 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | Y |
| SAD-016 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| SAD-017 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| SAD-018 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | Y |
| SAD-019 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| SAD-020 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Open list; filter; open detail; perform safe action | Authorization correct; pagination stable; actions logged | P1 | N |
| SAD-021 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Open list; filter; open detail; perform safe action | Authorization correct; pagination stable; actions logged | P1 | N |
| SAD-022 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| SAD-023 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| SAD-024 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| SAD-025 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| SAD-026 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| SAD-027 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| SAD-028 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| SAD-029 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| SAD-030 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Open list; filter; open detail; perform safe action | Authorization correct; pagination stable; actions logged | P1 | N |
| SAD-031 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Open list; filter; open detail; perform safe action | Authorization correct; pagination stable; actions logged | P1 | N |
| SAD-032 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| SAD-033 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| SAD-034 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| SAD-035 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| SAD-036 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| SAD-037 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| SAD-038 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| SAD-039 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| SAD-040 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Open list; filter; open detail; perform safe action | Authorization correct; pagination stable; actions logged | P2 | N |
| SAD-041 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Open list; filter; open detail; perform safe action | Authorization correct; pagination stable; actions logged | P2 | N |
| SAD-042 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| SAD-043 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| SAD-044 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| SAD-045 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| SAD-046 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| SAD-047 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| SAD-048 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| SAD-049 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| SAD-050 | Super Admin | Super Admin | Signed in as super admin; seeded datasets | Open list; filter; open detail; perform safe action | Authorization correct; pagination stable; actions logged | P2 | N |

### 25.8 Security / Perf / Store (40)

| Test ID | Module | Role | Preconditions | Steps | Expected result | Priority | Automation candidate |
|---|---|---|---|---|---|---|---|
| SPF-001 | Security, Performance, Store | All | Test environment available | Run security/perf/store scenario; verify app response | No data leaks; performance acceptable; store compliance artifacts present | P0 | N |
| SPF-002 | Security, Performance, Store | All | Test environment available | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| SPF-003 | Security, Performance, Store | All | Test environment available | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | Y |
| SPF-004 | Security, Performance, Store | All | Test environment available | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| SPF-005 | Security, Performance, Store | All | Test environment available | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| SPF-006 | Security, Performance, Store | All | Test environment available | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | Y |
| SPF-007 | Security, Performance, Store | All | Test environment available | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| SPF-008 | Security, Performance, Store | All | Test environment available | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| SPF-009 | Security, Performance, Store | All | Test environment available | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | Y |
| SPF-010 | Security, Performance, Store | All | Test environment available | Run security/perf/store scenario; verify app response | No data leaks; performance acceptable; store compliance artifacts present | P0 | N |
| SPF-011 | Security, Performance, Store | All | Test environment available | Run security/perf/store scenario; verify app response | No data leaks; performance acceptable; store compliance artifacts present | P0 | N |
| SPF-012 | Security, Performance, Store | All | Test environment available | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | Y |
| SPF-013 | Security, Performance, Store | All | Test environment available | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| SPF-014 | Security, Performance, Store | All | Test environment available | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| SPF-015 | Security, Performance, Store | All | Test environment available | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| SPF-016 | Security, Performance, Store | All | Test environment available | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| SPF-017 | Security, Performance, Store | All | Test environment available | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| SPF-018 | Security, Performance, Store | All | Test environment available | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| SPF-019 | Security, Performance, Store | All | Test environment available | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| SPF-020 | Security, Performance, Store | All | Test environment available | Run security/perf/store scenario; verify app response | No data leaks; performance acceptable; store compliance artifacts present | P1 | N |
| SPF-021 | Security, Performance, Store | All | Test environment available | Run security/perf/store scenario; verify app response | No data leaks; performance acceptable; store compliance artifacts present | P1 | N |
| SPF-022 | Security, Performance, Store | All | Test environment available | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| SPF-023 | Security, Performance, Store | All | Test environment available | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| SPF-024 | Security, Performance, Store | All | Test environment available | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| SPF-025 | Security, Performance, Store | All | Test environment available | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| SPF-026 | Security, Performance, Store | All | Test environment available | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| SPF-027 | Security, Performance, Store | All | Test environment available | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| SPF-028 | Security, Performance, Store | All | Test environment available | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| SPF-029 | Security, Performance, Store | All | Test environment available | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| SPF-030 | Security, Performance, Store | All | Test environment available | Run security/perf/store scenario; verify app response | No data leaks; performance acceptable; store compliance artifacts present | P2 | N |
| SPF-031 | Security, Performance, Store | All | Test environment available | Run security/perf/store scenario; verify app response | No data leaks; performance acceptable; store compliance artifacts present | P2 | N |
| SPF-032 | Security, Performance, Store | All | Test environment available | Use slow network; repeat action | Loading state shown; no duplicate request; user can retry | P1 | N |
| SPF-033 | Security, Performance, Store | All | Test environment available | Use offline mode; open screen | Offline banner or empty state; retry action available; no crash | P1 | N |
| SPF-034 | Security, Performance, Store | All | Test environment available | Trigger server error for this flow | Friendly error; no data corruption; action can be retried safely | P1 | N |
| SPF-035 | Security, Performance, Store | All | Test environment available | Attempt unauthorized access by editing a route parameter | Server denies; UI fails safe; no sensitive data shown | P0 | N |
| SPF-036 | Security, Performance, Store | All | Test environment available | Perform action twice rapidly | Idempotent behavior; no duplicates; clear feedback | P0 | N |
| SPF-037 | Security, Performance, Store | All | Test environment available | Rotate device during load | No crash; state preserved; layout stable | P2 | N |
| SPF-038 | Security, Performance, Store | All | Test environment available | Enable large text; revisit screen | No clipped critical labels or CTAs; truncation graceful | P2 | N |
| SPF-039 | Security, Performance, Store | All | Test environment available | Background app and return while in this flow | Resumes correctly; no stuck spinners | P2 | N |
| SPF-040 | Security, Performance, Store | All | Test environment available | Run security/perf/store scenario; verify app response | No data leaks; performance acceptable; store compliance artifacts present | P2 | N |


### 25.9 QA Library summary (generated from this tracker)

- Total test cases: **410**
- By module: **AUTH 40**, **PLY 60**, **MRP 80**, **WAL 40**, **TEAM 50**, **ZAD 50**, **SAD 50**, **SPF 40**
- Priority counts: **P0 118**, **P1 151**, **P2 140**, **P3 1**
- Automation candidates (“Y”): **52**
- Manual-only (non-automation candidates): **358**

---

## 26. Recommended Implementation Roadmap

### Phase 1: Critical release blockers

- **Goal**: Prevent data leaks, fraud, and unauthorized lifecycle transitions.
- **Issues included**: `SEC-MATCHROOM-01/02`, `SEC-BOOKINGS-01/02`, `SEC-WALLET-01/02`, `SEC-USERS-01/02/03`, `SEC-REPORTS-01`, `SEC-NOTIF-01`, `SEC-DASHBOARD-01`, `SEC-DISCOVER-01`.
- **Files likely involved**: `convex/matchrooms.ts`, `convex/bookings.ts`, `convex/wallet.ts`, `convex/users.ts`, `convex/reports.ts`, `convex/notifications.ts`, `convex/dashboard.ts`, `convex/discover.ts`, plus any calling services in `src/services/convex/*`.
- **Implementation risk**: High (API contract changes; must keep UI working; requires careful migration strategy).
- **Recommended tests**: Run all `SPF-*` “IDOR prevention” cases; add targeted manual checks for each role surface; verify no unauthorized reads/writes across userId/matchroomId/reportId.

### Phase 2: High-impact flow fixes

- **Goal**: Make core Player flows reliable end-to-end (auth, schedule, matchrooms, wallet) with correct feedback.
- **Issues included**: Payment pending/unknown UX, matchroom “full vs locked” correctness, missing retry/undo for destructive actions, inconsistent error/loading states, schedule/list correctness risks.
- **Files likely involved**: Player routes `app/(player)/**`, matchroom routes `app/matchrooms/**`, shared primitives in `src/components/**`, service layer `src/services/**`.
- **Implementation risk**: Medium (mostly UI and controlled backend changes after Phase 1 gates).
- **Recommended tests**: `PLY-*`, `MRP-*`, `WAL-*` P0/P1; manual device QA for iPhone SE + small Android.

### Phase 3: Super Admin operations

- **Goal**: Ensure Super Admin can safely run the business (payments, withdrawals, reports, identity verifications, support, audit logs).
- **Issues included**: Missing filters/pagination correctness, unsafe bulk actions, missing audit trails, unclear status definitions, insufficient masking of PII in admin UIs.
- **Files likely involved**: `app/super-admin/**`, `convex/admin.ts`, `src/services/convex/superAdminService.ts`.
- **Implementation risk**: Medium-High (touches sensitive workflows; requires role gating and audit logging).
- **Recommended tests**: `SAD-*` P0/P1; `SPF-*` admin gating; verify that support tickets remain separate from moderation reports.

### Phase 4: UI/UX consistency

- **Goal**: Standardize look-and-feel and reduce QA surface area.
- **Issues included**: `UI-STYLE-01`, `UI-KB-01`, `A11Y-TEXT-01`, inconsistent tab shells, inconsistent cards/buttons, inconsistent empty/loading/error/success states.
- **Files likely involved**: `src/theme.ts`, `src/components/**`, `app/**.styles.ts`, tab shells `app/(player)/(tabs)/_layout.tsx`, `app/zone/(tabs)/_layout.tsx`, `app/super-admin/(tabs)/*`.
- **Implementation risk**: Medium (broad changes; coordinate with design review).
- **Recommended tests**: Visual regression checklist + manual A11Y font scaling sweep + keyboard overlap sweep on key forms.

### Phase 5: Pagination/performance

- **Goal**: Avoid timeouts, cost spikes, and “false empty” list bugs at scale.
- **Issues included**: `PERF-COLLECT-01`, client-side filtering over partial datasets, dashboard fanout, chat list performance, storage URL fetch patterns.
- **Files likely involved**: List queries in `convex/**`, list UIs in `app/**`, common list components (if any), pagination utilities.
- **Implementation risk**: Medium (requires back-and-forth between query shape and UI list behavior).
- **Recommended tests**: `SPF-*` perf scenarios; `PLY-*` and `SAD-*` list tests with seeded large datasets; profile memory and scroll perf on low-end Android.

### Phase 6: Security hardening

- **Goal**: Reduce abuse risk and tighten privacy beyond minimum gating.
- **Issues included**: Rate limiting, audit logging, redaction/masking standards, least-privilege admin permissions, secure env var handling, removal of client-visible allowlists.
- **Files likely involved**: `convex/**` auth helpers, `src/utils/**` env gating, any “public” service wrappers, notification routing.
- **Implementation risk**: Medium (policy + patterns more than feature work).
- **Recommended tests**: Security regression suite: unauthorized reads/writes, enumeration attempts (email/phone), report privacy, wallet privacy.

### Phase 7: Store readiness

- **Goal**: Eliminate store rejection risks and ensure build pipeline targets production correctly.
- **Issues included**: `BUILD-PROD-01`, `STORE-POLICY-01`, permission strings review, privacy policy/terms/support URLs, account deletion discoverability, UGC moderation disclosures.
- **Files likely involved**: `app.json` / `app.config.*`, `eas.json`, auth agreement screen(s), any settings/account deletion UI.
- **Implementation risk**: Low-Medium (mostly configuration and copy, but must be exact).
- **Recommended tests**: Install and smoke test release build; verify push permission prompts; verify policy links open; verify account deletion flow exists and works.

### Phase 8: Post-launch monitoring

- **Goal**: Detect and respond quickly to fraud, outages, and UX blockers after launch.
- **Includes**: Payment anomaly alerts, withdrawal anomaly alerts, audit trails, crash analytics, performance monitoring, support escalation processes, feature flags for rollback.
- **Implementation risk**: Low-Medium (tooling/instrumentation choices).
- **Recommended tests**: Monitoring sanity (events emitted, redaction), alert routing tests, incident runbook rehearsal.

---

## 27. Final Launch Readiness Checklist

### Must fix before launch

- Close all **Critical** security issues listed in Section 3 (wallet, bookings, matchrooms, users, reports, notifications, discover, dashboard).
- Replace all production env placeholders (Convex deployment URL, push config, EAS profiles) and produce a signed release build.
- Payment flow must pass end-to-end manual QA: top-up, booking payment, pending/failed/unknown, retry/idempotency, reconciliation.
- Role gating must be validated: Player cannot read admin data; Zone Admin cannot read other zones; Super Admin only via explicit role.

### Should fix before launch

- Remove/limit unbounded `.collect()` in hot lists; introduce pagination for admin lists and wallet history where applicable.
- Standardize empty/loading/error/success feedback across key flows; ensure primary CTAs never hidden by keyboard.
- Ensure policy links are real and accessible (Terms, Privacy, Support, Account deletion).

### Can wait

- Full design token migration (raw colors -> tokens) after core flows stabilized.
- Advanced analytics dashboards, leaderboards, and non-critical animations/polish.
- Deep perf optimizations beyond pagination and obvious hotspots.

### Manual device QA required

- iPhone SE-class and small Android (Samsung A32-class): auth forms, matchroom create, payment webview/redirects, long lists, chat.
- Deep links: OAuth callbacks and notification routes.
- Push notifications: permission prompts, delivery, tapping opens correct screen, dedupe behavior.
- Payment provider callbacks and “unknown” states (provider-dependent).

### Staging QA required

- Seed large datasets (reports, notifications, wallet tx history, matchrooms) and validate list correctness + pagination.
- Simulate concurrency: multiple join requests, two captains submit result, rapid status changes, withdrawal request storms.

### Production deployment QA required

- Verify production Convex URL points to correct deployment and uses production secrets (no debug bypass flags).
- Verify remote config / env vars are correct in release channel builds.
- Verify data retention and deletion semantics (account deletion, report data, support ticket data) align with policy.

### Store submission QA required

- Verify app metadata URLs: Privacy Policy, Terms, Support, Account deletion instructions.
- Verify permission strings are accurate and non-misleading (camera, photos, notifications, microphone).
- Verify UGC moderation/reporting exists and is discoverable in-app.

---

## 28. Go / No-Go Recommendation (launch)

### Current recommendation (based on this static audit)

- **Public launch**: **NO-GO** until all **Critical** issues (Section 3) are fixed and re-audited.
- **Staging/pilot (non-paying)**: **Conditional GO** only after the Phase 1 security gates are implemented and validated via the security regression suite + manual device QA.
- **Paid transactions (wallet top-up / bookings / withdrawals)**: **NO-GO** until `SEC-WALLET-02`, `SEC-BOOKINGS-02`, `SEC-MATCHROOM-01/02`, `PAY-IPN-01`, and `PAY-IDEMP-01` are resolved and verified with provider callback tests.

### Must fix before any public launch

- All Section 3 Critical issues (wallet/bookings/matchrooms/users/reports/notifications/discover/dashboard).
- Production build configuration (`BUILD-PROD-01`) and store policy URLs (`STORE-POLICY-01`, `STORE-URL-01`).
- Core list scaling plan (at minimum: wallet history, super admin reports/payments/withdrawals) (`PERF-COLLECT-01`, `PERF-PAG-01`).

### Must fix before App Store/TestFlight external testing

- Remove production env placeholders and prove a release build installs and boots against the correct backend.
- Ensure tappable Terms/Privacy and a support contact path exists in-app and in store metadata.
- Ensure A11Y text scaling and keyboard overlap do not block critical flows (`A11Y-TEXT-01`, `UI-KB-01`).

### Can wait until post-launch (after safety gates)

- Full token migration and broad UI polish beyond the core surfaces.
- Advanced analytics dashboards and non-critical feature depth.

### Manual QA gates (required to sign off)

- Payment provider end-to-end: start -> redirect -> finalize/IPN -> reconciliation, including duplicate callbacks and offline/resume.
- Push notifications: permission prompts, delivery, deep link routing, dedupe, unread counts.
- Low-end device performance: long lists + chat; memory/stutter checks.

### Production deployment gates

- Production Convex deployment URL + secrets set; no debug bypass flags in release channels.
- Basic monitoring/anomaly visibility for payments and withdrawals (even if minimal at launch).
