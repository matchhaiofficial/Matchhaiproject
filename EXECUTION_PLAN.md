# MatchHai Production-Readiness Execution Plan

## Guardrails

- Work only on `remediation/production-readiness-2026-09-08` until QA approval.
- Do not merge into `product-ready`, deploy to production, submit store builds, or switch live callbacks.
- Do not modify the old `nautical-ibex-721` production deployment.
- Keep downloaded certificates, integration guides, credentials, and environment files out of Git.

## Workstream A — Start Immediately

### Repository and code safety

- [x] Record the current code, test, and environment baseline.
- [x] Reconcile the initial audit, subsequent findings, deferred items, and tester-reported issues.
- [x] Trace every removed, disabled, bypassed, or legacy endpoint through UI, service, script, backend, and Git-history callers.
- [ ] Verify authorization, validation, error handling, retries, fallbacks, empty states, and demo/static data.
- [x] Preserve public contracts unless removal is proven safe.

### Convex usage safety

- [x] Audit every cron, scheduled function, self-rescheduling action, polling loop, full-table scan, and unbounded query.
- [x] Make lifecycle processing event-driven, indexed, bounded, idempotent, and deduplicated.
- [x] Keep nonessential maintenance jobs disabled by default and protected by explicit circuit breakers.
- [x] Add scheduler, concurrency, retry, stale-data, and usage-regression tests.
- [x] Confirm idle deployments generate no recurring application workload.

### Fresh QA backend

- [x] Create a fresh `matchhai-qa` project under the `shakir-yasin` Convex team.
- [x] Configure unique QA authentication and internal signing secrets.
- [x] Reuse approved Didit, Veevotech, Resend, Steam, FACEIT, and support credentials. Firebase QA is explicitly deferred with push testing.
- [x] Disable PostHog and EasyPaisa in QA.
- [x] Disable demo bypasses and nonessential maintenance jobs.
- [x] Deploy and validate the backend only on QA.
- [x] Seed QA players, zone admins, a superadmin, teams, venues, branches, operating hours, resources, and matchrooms with Rs 5,000 player wallets.
- [x] Store seeded credentials securely outside Git.

### Local Expo Go QA

- [x] Create an ignored `.env.local` pointing exclusively to the QA Convex deployment.
- [x] Ensure React Native Firebase messaging is safely skipped in Expo Go.
- [ ] Start with `npx expo start --go --tunnel --clear`.
- [ ] Test all functionality except native Firebase push delivery and live EasyPaisa processing.

### EAS preparation

- [x] Link the repository to the transferred `@matchhai/matchhai` project (`cc63aac8-7e68-4dbc-9e95-c59e145fb7b4`).
- [x] Preserve Android/iOS identifier `com.ovaisto.matchhai`.
- [x] Prepare production plus an internal Android preview profile; keep Convex URLs in managed EAS environments.
- [x] Prepare, but do not apply, the production environment-variable inventory.
- [x] Do not generate or submit a store build.

## Workstream B — Automated and Manual QA

- [x] Run TypeScript, available unit/security/Convex tests, dependency audit, Expo Doctor, and Android production-bundle checks. (The repository has no lint script.)
- [ ] Test player and zone signup, OTP guidance/delivery/verification, login, logout, password reset, and session persistence.
- [ ] Test KYC gating, Didit start/return/webhook/rejection/expiry/retry, and prevention of self-approval.
- [ ] Test matchroom creation, operating hours, capacity, manual occupancy, counter-offers, booking, approval, lifecycle, cancellation, refund, dispute, and completion.
- [ ] Test teams, team challenges, discovery, acceptance, booking, cancellation, completion, and chat.
- [ ] Test chat identities, avatars, attachments, voice messages, and unread counts.
- [ ] Test reporting warnings, blocking, appeals, and prevention of reported players sharing a matchroom.
- [ ] Test zone hours, resources, availability, approvals, matchrooms, walk-ins, and withdrawals.
- [ ] Test superadmin user, KYC, payment, report, refund, venue, and support workflows.
- [ ] Run active and idle Convex usage soak tests; fix failures and repeat affected journeys.

## Workstream C — Transferred EAS Project

- [x] Receive the original project in the `matchhai` organization and relink the repository.
- [x] Locate the EAS-managed Android keystore; its SHA-1 exactly matches Play's upload certificate.
- [x] Inspect recent successful Android/iOS build and iOS submission history.
- [ ] Have Ovais authorize a fresh Apple credential check and confirm the current distribution profile/key.
- [ ] Configure FCM V1 and optional Google Play/App Store cloud-submission credentials.

## Workstream D — Waiting for EasyPaisa

- [ ] Obtain staging Store ID, API credentials, account number, test accounts, IPN configuration, and whitelist requirements.
- [ ] Enable EasyPaisa only after staging configuration is complete.
- [ ] Test success, failure, expiry, cancellation, reversal, inquiry, callback authentication, and idempotency.

Until then, QA must expose an explicit “EasyPaisa unavailable in QA” state without attempting provider calls.

## Workstream E — Conditional Store Credentials

### Android

- [x] Reuse the recovered matching Play upload key; no reset is required.
- [ ] Configure Play submission and Firebase FCM V1 service accounts.
- [ ] Verify the final `.aab` signature against the registered upload certificate.

### Apple

- [ ] Reuse recovered credentials; otherwise have Ovais authorize EAS against the existing Apple Developer team.
- [ ] Validate or create the distribution certificate, production provisioning profile, push key, App Store Connect API key, and existing App Store application ID.
- [ ] Never revoke existing Apple credentials without explicit review and approval.

## Workstream F — Release Gate

Proceed only after QA, usage testing, and explicit approval:

- [ ] Create/configure the clean production Convex deployment under `ovais-mukati-2dae3`.
- [ ] Deploy the exact approved commit with production-only secrets and no bypasses/demo data.
- [ ] Configure production PostHog and switch Didit/EasyPaisa live callbacks.
- [ ] Run restricted production smoke tests.
- [ ] Merge the remediation PR into `product-ready`.
- [ ] Generate, verify, and submit Android and iOS production builds.
- [ ] Monitor authentication, KYC, payments, errors, scheduler calls, Database I/O, and compute; retain rollback artifacts.

## Explicitly Deferred

- Firebase push-notification QA
- EAS Update and OTA channels
- Production deployment, live callback switching, and store submission

## Execution Evidence — 2026-09-14

- QA deployment: `shakir-yasin:matchhai-qa / striped-dog-623`; no production deployment was accessed or changed during execution.
- QA data: 335 users, 64 zones, 3,260 resources, 8 teams, and 8 capacity-valid seeded matchrooms. The realistic 250-player dataset has Rs 5,000 wallets.
- Usage state after seeding: zero cron jobs; eight pending one-shot `processScheduledLifecycle` jobs, exactly one per seeded matchroom; demo seeding, maintenance crons, EasyPaisa, and PostHog remain disabled.
- Automated verification: TypeScript passed; 78 Jest suites with 411 passing tests; 4 Convex test files with 6 passing tests; Android Expo export and Expo Doctor (18/18) succeeded.
- Dependency audit: no critical advisories after updating the test-only Vitest toolchain; 13 high and 21 moderate transitive advisories remain for review because proposed bulk fixes include breaking Expo upgrades.
- Reconciliation details: `docs/ISSUE_RECONCILIATION.md`. Production variable inventory: `docs/EAS_PRODUCTION_CONFIG.md`.
- Runtime follow-up found and fixed two additional usage risks: push actions now require an explicit environment flag plus an active recipient device, and EasyPaisa self-scheduled retries stop after six retries. Matchroom deadline changes now cancel superseded jobs in both scheduling entry points.
- QA idle observation: over a formal five-minute window the scheduler table stayed at 197 historical rows with exactly 8 legitimate future matchroom jobs pending and zero overdue jobs; function calls increased by 4 (the snapshot checks) and Database I/O did not increase. Full active-journey usage testing is still open.
- Added a fixed-target, read-only `npm run qa:convex:usage` tripwire and deployed the backward-compatible zone booking-history pagination endpoint only to QA. Current UI uses the paginated endpoint; the legacy array endpoint remains available.
- Added Convex integration coverage for report/block/join denial, retry-safe matchroom creation, challenge captain authorization, idempotent wallet holds/releases, team-chat unread/access behavior, and KYC status propagation. Android and web exports both pass; Expo Doctor remains 18/18.
- Still open: manual end-to-end journeys, active usage soak measurement, counter-table/true-pagination work for the exact and legacy queries identified in `docs/CONVEX_RUNTIME_AUDIT.md`, external EasyPaisa staging, transferred store signing credentials, and all production actions.

## Execution Evidence — 2026-09-18

- The transferred EAS project is now `@matchhai/matchhai` / `cc63aac8-7e68-4dbc-9e95-c59e145fb7b4`.
- The Android EAS keystore matches the Play Console upload SHA-1; the last store build used version code 27.
- An internal Android preview profile was added for remote QA against `striped-dog-623`; it does not enable PostHog, EasyPaisa, or QA bypasses.
- EAS internal Android build `c0721021-9502-4c69-8c96-4d2f1c545416` finished successfully as version code 29; the hosted APK expires on 2026-10-01.
- TypeScript and Expo Doctor (18/18) pass before the preview build.
