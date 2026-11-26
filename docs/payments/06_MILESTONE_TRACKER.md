# Milestone and PAY task tracker

Prepared November 26, 2026. **Application implementation has not started.** Completed planning/source inspection is evidence in this package, not a passed test or completed implementation. Administrative clone is complete; M00 baseline application testing remains unexecuted. This phase changes documentation only.

## Rules, effort and evidence

Allowed status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `TESTING`, `VERIFIED`, `COMPLETED`. Start IN_PROGRESS when real work starts; code written is IMPLEMENTED, executing checks TESTING, passing recorded acceptance VERIFIED, reviewed obligations closed COMPLETED. A failed integrity check remains TESTING or BLOCKED with the actual result; never VERIFIED. A parent cannot complete while required children/evidence are blocked.

Small = localized change/review; Medium = several functions or one flow; Large = cross-layer accounting/concurrency/regression; Conditional = missing provider/operational details prevent responsible estimation. These are relative engineering estimates, not numerical delivery promises. Engineering-day estimates need complete contracts and measured team velocity; external wait time excluded.

Rollback classes: A compatible code/UI revert; B disable new behavior while retaining expanded schema/readers/evidence; C stop initiation while preserving accepted-payment recovery; D separately authorized audited compensating recovery, never deletion/reversal of valid history.

Every record below carries the requested fields. Exact source paths/functions and proposed additions are in [inventory](02_DEPENDENCY_INVENTORY.md) and [plan](01_IMPLEMENTATION_PLAN.md); full requirements/tests are incorporated through [architecture](05_ARCHITECTURE.md), [security](03_SECURITY_FINDINGS.md) and [test inventory](07_TEST_INVENTORY.md). Associated SHA means an actual future implementation commit, not this documentation commit; record it in a subsequent update to avoid self-reference.

## PAY mapping

| Task ID | Primary milestone | Description | Current status |
| --- | --- | --- | --- |
| PAY-001 | M00 | Repository audit and implementation baseline validation | NOT_STARTED |
| PAY-002 | M04 | Provider capability and official contract closure | BLOCKED |
| PAY-003 | M02 | Provider-independent service and typed contracts | NOT_STARTED |
| PAY-004 | M02 | Incremental additive schema and compatibility | NOT_STARTED |
| PAY-005 | M01 | Financial hardening and processing extraction | NOT_STARTED |
| PAY-006 | M02 | Secure configuration and isolated migration QA | NOT_STARTED |
| PAY-007 | M03 | Native shared interface and mock integration | NOT_STARTED |
| PAY-008 | M02 | Verification, callback intake and atomic application | NOT_STARTED |
| PAY-009 | M03 | Wallet top-up vertical slice first | NOT_STARTED |
| PAY-010 | M05 | Matchroom seat and host-create payments | NOT_STARTED |
| PAY-011 | M05 | Team-side and authorized walk-in journeys | NOT_STARTED |
| PAY-012 | M04 | Raast RTP and QR umbrella | BLOCKED |
| PAY-012A | M04 | Verify RTP contract and availability | BLOCKED |
| PAY-012B | M04 | Verify QR contract and availability | BLOCKED |
| PAY-012C | M04 | Implement approved native RTP | BLOCKED |
| PAY-012D | M04 | Implement approved native QR | BLOCKED |
| PAY-012E | M07 | Validate Raast lifecycle and reconciliation | BLOCKED |
| PAY-013 | M04 | Native PayFast Easypaisa, JazzCash and bank methods | BLOCKED |
| PAY-014 | M06 | Refund, reversal, reconciliation and settlement operations | NOT_STARTED |
| PAY-015 | M05 | Zone finance and withdrawal compatibility | NOT_STARTED |
| PAY-016 | M06 | Super Admin financial investigation | NOT_STARTED |
| PAY-017 | M08 | Final complete direct Easypaisa retirement | NOT_STARTED |
| PAY-018 | M01 | Continuous security and financial integrity validation | NOT_STARTED |
| PAY-019 | M02 | Convex usage controls and measurement | NOT_STARTED |
| PAY-020 | M07 | Actual sandbox UAT and Test Order ID | BLOCKED |
| PAY-021 | M00 | Continuous app regression validation | NOT_STARTED |
| PAY-022 | M08 | Production migration and rollback readiness | NOT_STARTED |
| PAY-023 | M08 | Founder approval and release readiness | NOT_STARTED |

Cross-cutting PAY-018 starts M01, PAY-019 M02 and PAY-021 M00; each continues every changed milestone, consolidating M07. PAY-009 spans mock M03 and real sandbox M04. Method adapters depend on the completed mock slice, not an already-working real method: the first approved adapter plus PAY-009 jointly establishes real sandbox top-up, avoiding a dependency cycle. PAY-004 introduces later purpose/refund/settlement structures only when M05/M06 need them. PAY-015 starts compatibility M05 and operational evidence M06. PAY-017 replaces/disables earlier but finally retires in M08. PAY-022/023 prepare M08 and execute production only under M09 authorization. PAY-012 is an umbrella with five required child records. PAY-013 separately gates each method via method-specific tests.

## Milestone records

### M00 — Workspace setup and baseline validation

- Task ID: `M00` (milestone); mapped PAY tasks: PAY-001, PAY-021.
- Milestone: 00. Description: Workspace setup and baseline validation. Priority: P0.
- Dependencies: Explicit implementation-chat authorization.
- Required inputs: Pinned branch/source, guidance, safe test environment.
- Responsible role: Architect / QA.
- Estimated engineering effort: Medium.
- Affected files: AGENTS.md; package.json; .github/workflows/ci.yml; dependency/test inventory; full mapped task paths below.
- Implementation requirements: Revalidate branch/ancestry/status and safe baseline tests; administrative clone already done, not application baseline testing.
- Acceptance criteria: Actual baseline results recorded without provider/deployment side effects.
- Required tests: MIG-001; REG-*; PERF-001; exact scenarios in test inventory.
- Security considerations: No other workspace changes, secret dumps or implicit Convex deploy.
- Rollback strategy: A as defined above and in rollout runbook.
- Current status: `NOT_STARTED`.
- Blockers: Baseline testing deliberately deferred to new implementation chat.
- Completion evidence: None for implementation; planning/source inspection only. No application tests executed.
- Associated commit SHA: — (no implementation commit).

### M01 — Existing financial security hardening

- Task ID: `M01` (milestone); mapped PAY tasks: PAY-005, PAY-018.
- Milestone: 01. Description: Existing financial security hardening. Priority: P0.
- Dependencies: M00.
- Required inputs: SF-01–09 and SF-13, valid current flows.
- Responsible role: Fintech / security / Convex.
- Estimated engineering effort: Large.
- Affected files: convex/wallet.ts; convex/zoneWithdrawals.ts; convex/zoneAdminBooking.ts; convex/matchrooms.ts; gateway/reset modules and tests; full mapped task paths below.
- Implementation requirements: Prioritize reference poisoning, direct KYC and walk-in source authority; numeric/original-operation/DTO defenses.
- Acceptance criteria: P0 write-boundary cases verified without business-policy drift.
- Required tests: SEC-*; FIN-*; WD-*; WALK-*; exact scenarios in test inventory.
- Security considerations: Failed integrity stops dependent work.
- Rollback strategy: B/D as defined above and in rollout runbook.
- Current status: `NOT_STARTED`.
- Blockers: All application fixes/tests unstarted.
- Completion evidence: None for implementation; planning/source inspection only. No application tests executed.
- Associated commit SHA: — (no implementation commit).

### M02 — Provider-independent payment infrastructure

- Task ID: `M02` (milestone); mapped PAY tasks: PAY-003, PAY-004, PAY-006, PAY-008, PAY-019.
- Milestone: 02. Description: Provider-independent payment infrastructure. Priority: P0.
- Dependencies: M01 foundations.
- Required inputs: Typed intents/receipts/invariants, isolated mock configuration.
- Responsible role: Architect / database / Convex / DevOps.
- Estimated engineering effort: Large.
- Affected files: convex/payments.ts; convex/paymentModel.ts; convex/paymentFinancials.ts; convex/paymentReconciliation.ts; convex/schema.ts; convex/payfastConfig.ts; full mapped task paths below.
- Implementation requirements: Core intent/receipt/event tables only, optional compatible attempt fields, safe mock/receipt application.
- Acceptance criteria: Atomic mock finances, old rows valid, bounded processing.
- Required tests: AUTH-*; FIN-*; VER-*; MIG-*; PERF-*; exact scenarios in test inventory.
- Security considerations: No undocumented provider transport.
- Rollback strategy: B as defined above and in rollout runbook.
- Current status: `NOT_STARTED`.
- Blockers: Connected child work conditional; core independent.
- Completion evidence: None for implementation; planning/source inspection only. No application tests executed.
- Associated commit SHA: — (no implementation commit).

### M03 — Native payment interfaces and mock integration

- Task ID: `M03` (milestone); mapped PAY tasks: PAY-007, PAY-009 mock slice.
- Milestone: 03. Description: Native payment interfaces and mock integration. Priority: P0.
- Dependencies: M02.
- Required inputs: Theme tokens and safe mock core.
- Responsible role: React Native / UX / Convex / QA.
- Estimated engineering effort: Large.
- Affected files: app/payments/[paymentIntentId].tsx; src/features/payments/*; app/(player)/wallet.tsx; full mapped task paths below.
- Implementation requirements: Complete mock top-up, status/history/reopen before full domain expansion.
- Acceptance criteria: Honest accessible native states, once-only mock deposit, no production mock.
- Required tests: UI-*; FIN-001–002; NATIVE recovery cases; exact scenarios in test inventory.
- Security considerations: No cards, hosted fallback or client paid authority.
- Rollback strategy: A/B as defined above and in rollout runbook.
- Current status: `NOT_STARTED`.
- Blockers: Build/device execution separately scoped.
- Completion evidence: None for implementation; planning/source inspection only. No application tests executed.
- Associated commit SHA: — (no implementation commit).

### M04 — Verified PayFast direct API implementation

- Task ID: `M04` (milestone); mapped PAY tasks: PAY-002, PAY-009 sandbox slice, PAY-012/A/B/C/D, PAY-013.
- Milestone: 04. Description: Verified PayFast direct API implementation. Priority: P0.
- Dependencies: M03; official contract and entitlement.
- Required inputs: Bases/signing/fields/inquiry/callbacks and official test scenarios.
- Responsible role: Integration / mobile / security / QA.
- Estimated engineering effort: Conditional.
- Affected files: convex/payfast.ts; convex/payfastContracts.ts; convex/payfastHttp.ts; convex/http.ts; native method components; full mapped task paths below.
- Implementation requirements: One real approved sandbox top-up first; per-method independent implementation gates.
- Acceptance criteria: Official receipt-bound sandbox slice; unsupported methods disabled.
- Required tests: METHOD-*; VER-*; CB-*; UAT-*; exact scenarios in test inventory.
- Security considerations: No live tests or credential artifacts.
- Rollback strategy: C as defined above and in rollout runbook.
- Current status: `BLOCKED`.
- Blockers: Incomplete account-specific contracts/permissions and transaction authorization.
- Completion evidence: None for implementation; planning/source inspection only. No application tests executed.
- Associated commit SHA: — (no implementation commit).

### M05 — Complete financial journey integration

- Task ID: `M05` (milestone); mapped PAY tasks: PAY-010, PAY-011, PAY-015.
- Milestone: 05. Description: Complete financial journey integration. Priority: P0.
- Dependencies: Core/mock wallet slice; M04 for connected evidence.
- Required inputs: Current booking/challenge/walk-in/pilot/commission rules.
- Responsible role: Domain / fintech / mobile / QA.
- Estimated engineering effort: Large.
- Affected files: convex/matchrooms.ts; convex/teamChallenges.ts; convex/zoneAdminBooking.ts; convex/zoneWallet.ts; native domain screens/services; full mapped task paths below.
- Implementation requirements: Purpose-by-purpose verified integration; existing holds/earnings/rules; incremental purpose structures.
- Acceptance criteria: No duplicate hold/create/fulfillment, no overbooking or policy drift.
- Required tests: BOOK-*; CHAL-*; WALK-*; SET-*; WD-*; REG-*; exact scenarios in test inventory.
- Security considerations: Independent mock tests safe while real methods blocked.
- Rollback strategy: B/D as defined above and in rollout runbook.
- Current status: `NOT_STARTED`.
- Blockers: Actual provider acceptance depends on M04.
- Completion evidence: None for implementation; planning/source inspection only. No application tests executed.
- Associated commit SHA: — (no implementation commit).

### M06 — Refunds, reconciliation and administrative operations

- Task ID: `M06` (milestone); mapped PAY tasks: PAY-014, PAY-016; PAY-015 evidence views.
- Milestone: 06. Description: Refunds, reconciliation and administrative operations. Priority: P0.
- Dependencies: Receipt core and relevant M05 purposes.
- Required inputs: Approved refund recovery/roles and provider statement/automation contracts.
- Responsible role: Fintech / operations / admin / security.
- Estimated engineering effort: Large.
- Affected files: convex/paymentRefunds.ts; convex/paymentSettlements.ts; convex/schema.ts; convex/admin.ts; admin payment/withdrawal views; full mapped task paths below.
- Implementation requirements: Add refund/settlement tables when used; manual evidence workflow and bank matching.
- Acceptance criteria: No overrefund/fabricated settlement; role-limited audited operations.
- Required tests: REF-*; SET-*; WD-*; SEC-*; PERF-*; exact scenarios in test inventory.
- Security considerations: No unapproved clawback/payout timing/fee changes.
- Rollback strategy: C/D as defined above and in rollout runbook.
- Current status: `NOT_STARTED`.
- Blockers: Automated contracts/formats and spent-fund/manual approval policies unresolved.
- Completion evidence: None for implementation; planning/source inspection only. No application tests executed.
- Associated commit SHA: — (no implementation commit).

### M07 — Comprehensive testing, UAT and Convex usage verification

- Task ID: `M07` (milestone); mapped PAY tasks: PAY-012E, PAY-018/019/020/021 consolidation.
- Milestone: 07. Description: Comprehensive testing, UAT and Convex usage verification. Priority: P0.
- Dependencies: Required changed slices; approved sandbox/devices.
- Required inputs: Continuous prior results and provider UAT criteria.
- Responsible role: QA / security / mobile / integration / DevOps.
- Estimated engineering effort: Large; UAT Conditional.
- Affected files: Behavioral/native suites; scripts/convex-qa-usage-snapshot.mjs; test inventory/UAT runbook; full mapped task paths below.
- Implementation requirements: Consolidate rather than postpone testing; compare matched usage and backlog.
- Acceptance criteria: Required CI/native/method/UAT evidence, bounded usage, explicit gaps.
- Required tests: All required inventory cases; exact scenarios in test inventory.
- Security considerations: No production load or mock-as-sandbox claims.
- Rollback strategy: B/C as defined above and in rollout runbook.
- Current status: `NOT_STARTED`.
- Blockers: Actual provider, device and build prerequisites not satisfied.
- Completion evidence: None for implementation; planning/source inspection only. No application tests executed.
- Associated commit SHA: — (no implementation commit).

### M08 — Complete direct Easypaisa retirement and production readiness

- Task ID: `M08` (milestone); mapped PAY tasks: PAY-017, PAY-022, PAY-023.
- Milestone: 08. Description: Complete direct Easypaisa retirement and production readiness. Priority: P0.
- Dependencies: Required M01–07 gates and actual legacy/client evidence.
- Required inputs: Late/refund windows, obligation inventory, deployed versions and release decisions.
- Responsible role: Integration / operations / DevOps / founder.
- Estimated engineering effort: Large.
- Affected files: All direct dependency/retirement paths; rollout and evidence docs; full mapped task paths below.
- Implementation requirements: Final drain/remove active gateway, retain historical compatibility; isolated readiness/rollback rehearsal.
- Acceptance criteria: No remaining gateway-dependent liability/active transport/credentials/jobs; client compatibility proven.
- Required tests: MIG-*; LIFE-*; PERF-*; old/new-client regression/rehearsal; exact scenarios in test inventory.
- Security considerations: Never erase obligations or perform unapproved production operations.
- Rollback strategy: C/D as defined above and in rollout runbook.
- Current status: `NOT_STARTED`.
- Blockers: Final retirement conditional on actual obligations and deployed clients.
- Completion evidence: None for implementation; planning/source inspection only. No application tests executed.
- Associated commit SHA: — (no implementation commit).

### M09 — Separately authorized production deployment

- Task ID: `M09` (milestone); mapped PAY tasks: PAY-022/023 production execution gate.
- Milestone: 09. Description: Separately authorized production deployment. Priority: P0.
- Dependencies: M08 readiness and explicit production authorization.
- Required inputs: Final reviewed SHA, merchant approval, actual callback/config and smoke scope.
- Responsible role: Founder / release lead / DevOps / fintech.
- Estimated engineering effort: Conditional.
- Affected files: Only reviewed production release/configuration/migration/app artifacts; full mapped task paths below.
- Implementation requirements: Authorized additive rollout, restricted smoke, method/cohort monitoring.
- Acceptance criteria: Reconciled production evidence with no financial anomalies.
- Required tests: Separately authorized production smoke; no load tests; exact scenarios in test inventory.
- Security considerations: No production authorization granted by this package.
- Rollback strategy: B/C/D as defined above and in rollout runbook.
- Current status: `BLOCKED`.
- Blockers: Production configuration/deployment/real-money approval absent.
- Completion evidence: None for implementation; planning/source inspection only. No application tests executed.
- Associated commit SHA: — (no implementation commit).

## Detailed PAY records

### PAY-001 — Repository audit and implementation baseline validation

- Task ID: `PAY-001`.
- Milestone: M00; cross-milestone obligations described above.
- Description: Repository audit and implementation baseline validation.
- Priority: P0.
- Dependencies: New-chat authorization.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Architect / QA / security.
- Estimated engineering effort: Medium.
- Affected files: AGENTS.md; package.json; docs/payments/02_DEPENDENCY_INVENTORY.md.
- Implementation requirements: Recheck branch/ancestry/status/current callers; establish safe application baseline in new chat.
- Acceptance criteria: Recorded current diff and actual safe baseline results; planning distinguished from execution.
- Required tests: MIG-001; REG-*; PERF-001; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No other workspace/secret access or implicit deploy.
- Rollback strategy: A as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Implementation authorization; baseline tests deliberately not run.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-002 — Provider capability and official contract closure

- Task ID: `PAY-002`.
- Milestone: M04; cross-milestone obligations described above.
- Description: Provider capability and official contract closure.
- Priority: P0.
- Dependencies: PAY-001; provider access.
- Required inputs: current pinned/current source and approved scope; complete official per-method contract, account entitlement and approved sandbox scenarios. See listed blockers.
- Responsible role: Integration lead / founder liaison.
- Estimated engineering effort: Conditional.
- Affected files: docs/payments/04_PROVIDER_CONTRACTS.md; convex/payfastContracts.ts (future).
- Implementation requirements: Obtain full versioned contracts/bases/signing/evidence/permissions/scenarios per method.
- Acceptance criteria: Official vectors, entitlement and sandbox matrix; no commercial-to-API inference.
- Required tests: AUTH-004–010; VER-009; METHOD-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Never persist actual credentials or send correspondence without authorization.
- Rollback strategy: B as defined above; retain records and no duplicate financial recovery.
- Current status: `BLOCKED`.
- Blockers: Missing account-specific specifications, entitlements and scenarios.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-003 — Provider-independent service and typed contracts

- Task ID: `PAY-003`.
- Milestone: M02; cross-milestone obligations described above.
- Description: Provider-independent service and typed contracts.
- Priority: P0.
- Dependencies: PAY-001; PAY-005.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Architect / Convex.
- Estimated engineering effort: Medium.
- Affected files: convex/payments.ts; convex/paymentModel.ts; src/services/convex/paymentService.ts; src/features/payments/types.ts.
- Implementation requirements: Owned intent, quote, attempt, capabilities/status/cancel/history and adapter contract.
- Acceptance criteria: Safe DTOs and compatible legacy calls; no client funding authority.
- Required tests: AUTH-*; SEC-005–009; LIFE-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Centralized actor/KYC and explicit environment.
- Rollback strategy: A/B as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Independent core can proceed after implementation authorization.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-004 — Incremental additive schema and compatibility

- Task ID: `PAY-004`.
- Milestone: M02; cross-milestone obligations described above.
- Description: Incremental additive schema and compatibility.
- Priority: P0.
- Dependencies: PAY-003; PAY-005.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Database / Convex.
- Estimated engineering effort: Large.
- Affected files: convex/schema.ts; convex/paymentMigrations.ts; convex/accountDeletion.ts; convex/wallet.ts.
- Implementation requirements: Only core intent/receipt/event tables now; optional fields/indexes; domain/refund/settlement structures later.
- Acceptance criteria: Old rows valid; resumable derivable-only backfill; unchanged balances and history.
- Required tests: MIG-*; FIN-009–011; PERF-004; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Retention; no destructive import or false evidence backfill.
- Rollback strategy: B as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Historical runtime inventory and actual migration execution pending.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-005 — Financial hardening and processing extraction

- Task ID: `PAY-005`.
- Milestone: M01; cross-milestone obligations described above.
- Description: Financial hardening and processing extraction.
- Priority: P0.
- Dependencies: PAY-001.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Fintech / security / Convex.
- Estimated engineering effort: Large.
- Affected files: convex/wallet.ts; convex/zoneWithdrawals.ts; convex/zoneAdminBooking.ts; convex/matchrooms.ts; convex/easypaisa.ts; reset modules.
- Implementation requirements: First fix reference poisoning, direct mutation KYC and walk-in source authority; numeric/hold/DTO invariants; later neutral reuse.
- Acceptance criteria: Forged authority/collisions rejected; exact retry valid; existing policy and legitimate flows preserved.
- Required tests: SEC-*; FIN-*; WD-*; WALK-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Actual money-write enforcement; preserve historical operation identities.
- Rollback strategy: B/D as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: No independent blocker after new-chat authorization; all fixes/tests unstarted.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-006 — Secure configuration and isolated migration QA

- Task ID: `PAY-006`.
- Milestone: M02; cross-milestone obligations described above.
- Description: Secure configuration and isolated migration QA.
- Priority: P0.
- Dependencies: PAY-001; PAY-003; actual transport PAY-002.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: DevOps / security / Convex.
- Estimated engineering effort: Medium.
- Affected files: convex/payfastConfig.ts; env/convex.env.example; env/app.env.example; scripts/convex-qa-usage-snapshot.mjs.
- Implementation requirements: Mock default, environment/merchant version, capabilities, allowlists/redaction; actual secrets only under authorized scope.
- Acceptance criteria: Wrong env/host/disabled method fails closed; no live credentials in migration QA.
- Required tests: AUTH-004–010; SEC-005–008; PERF-001; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No EXPO_PUBLIC secrets or silent reuse of historic live-enabled QA.
- Rollback strategy: B/C as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Actual environment/credentials configuration requires explicit nonproduction scope.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-007 — Native shared interface and mock integration

- Task ID: `PAY-007`.
- Milestone: M03; cross-milestone obligations described above.
- Description: Native shared interface and mock integration.
- Priority: P0.
- Dependencies: PAY-003–006.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: React Native / Expo / UX.
- Estimated engineering effort: Large.
- Affected files: app/payments/[paymentIntentId].tsx; src/features/payments/*; existing payment screens/shared styles.
- Implementation requirements: Native methods/instructions/QR/status/recovery; preserve gaming tokens; complete mock top-up first.
- Acceptance criteria: Honest accessible UI and reopen/history; no card/hosted fallback or production mock.
- Required tests: UI-*; NATIVE-*; FIN-001–002; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No client success authority, secret persistence or mock activation.
- Rollback strategy: A/B as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Native build/device execution separately scoped; mock/component work independent.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-008 — Verification, callback intake and atomic application

- Task ID: `PAY-008`.
- Milestone: M02; cross-milestone obligations described above.
- Description: Verification, callback intake and atomic application.
- Priority: P0.
- Dependencies: PAY-004–006; connected ingress PAY-002.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Fintech / security / Convex.
- Estimated engineering effort: Large; connected stage Conditional.
- Affected files: convex/paymentFinancials.ts; convex/paymentReconciliation.ts; convex/payfastHttp.ts; convex/http.ts.
- Implementation requirements: Mock-tested durable receipt/application first; approved M04 callback/inquiry; indexed uniqueness/claims.
- Acceptance criteria: No missing/unsigned/substituted financial fact credits; race-safe recovery.
- Required tests: VER-*; CB-*; FIN-*; LIFE-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Complete environment/merchant/amount/currency/receipt binding.
- Rollback strategy: B/C/D as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Connected parsers/auth blocked until complete official contract; core work independent.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-009 — Wallet top-up vertical slice first

- Task ID: `PAY-009`.
- Milestone: M03; cross-milestone obligations described above.
- Description: Wallet top-up vertical slice first.
- Priority: P0.
- Dependencies: PAY-007; PAY-008; real provider PAY-002/006.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Convex / fintech / mobile.
- Estimated engineering effort: Medium.
- Affected files: app/(player)/wallet.tsx; convex/payments.ts; convex/paymentFinancials.ts; convex/wallet.ts.
- Implementation requirements: M03 complete mock slice, M04 one complete approved real sandbox slice before domain expansion.
- Acceptance criteria: One correct deposit/delta/history/reopen; replay/races safe; distinct mock/sandbox evidence.
- Required tests: FIN-001–002,006; LIFE-*; UI-001,007,011; UAT-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No unverified success or production mock.
- Rollback strategy: B/C as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Actual sandbox slice awaits contracts, entitlement and test authorization.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-010 — Matchroom seat and host-create payments

- Task ID: `PAY-010`.
- Milestone: M05; cross-milestone obligations described above.
- Description: Matchroom seat and host-create payments.
- Priority: P0.
- Dependencies: PAY-005; PAY-008; PAY-009 complete slice.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Booking domain / fintech / mobile.
- Estimated engineering effort: Large.
- Affected files: convex/matchrooms.ts; convex/matchroomPricing.ts; convex/bookingConflicts.ts; booking pay/status screens; shared create hook.
- Implementation requirements: Typed purpose/receipt to existing hold/create engine; revalidate price, expiry and capacity.
- Acceptance criteria: Once-only hold/create/debit, no overbooking or resurrected expired booking; wallet-credit-only outcome.
- Required tests: BOOK-*; FIN-003–008; REG-005,013; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Owner/server price/internal funding authority.
- Rollback strategy: B/D as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Actual provider acceptance depends on connected slice; domain mock tests independent.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-011 — Team-side and authorized walk-in journeys

- Task ID: `PAY-011`.
- Milestone: M05; cross-milestone obligations described above.
- Description: Team-side and authorized walk-in journeys.
- Priority: P0.
- Dependencies: PAY-005; PAY-008; PAY-009 complete slice.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Team/zone domain / fintech / mobile.
- Estimated engineering effort: Large.
- Affected files: convex/teamChallenges.ts; convex/zoneAdminBooking.ts; app/teams/challenge-create.tsx; app/teams/challenge.tsx; team/zone services.
- Implementation requirements: Typed side/captain/walk-in purposes; preserve lineup, Team B, venue/counter-offer and historic refunds.
- Acceptance criteria: Once-only hold/release/capture; forged source rejected; legitimate free/venue-pay behavior unchanged.
- Required tests: CHAL-*; WALK-*; FIN-003–008; REG-007; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: KYC/owner/captain enforced at write.
- Rollback strategy: B/D as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Actual provider acceptance conditional; independent domain tests can proceed.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-012 — Raast RTP and QR umbrella

- Task ID: `PAY-012`.
- Milestone: M04; cross-milestone obligations described above.
- Description: Raast RTP and QR umbrella.
- Priority: P0.
- Dependencies: PAY-012A–E; PAY-008.
- Required inputs: current pinned/current source and approved scope; complete official per-method contract, account entitlement and approved sandbox scenarios. See listed blockers.
- Responsible role: Integration / mobile / QA.
- Estimated engineering effort: Conditional.
- Affected files: convex/payfast.ts; convex/payfastContracts.ts; native method components/tests.
- Implementation requirements: Separate each method contract/implementation gate; no hosted substitution.
- Acceptance criteria: All required children independently verified; unavailable method remains disabled.
- Required tests: METHOD-RTP-*; METHOD-QR-*; VER-*; CB-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Commercial method offer is not direct API authority.
- Rollback strategy: C as defined above; retain records and no duplicate financial recovery.
- Current status: `BLOCKED`.
- Blockers: Dedicated Raast contracts/merchant permissions/scenarios missing.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-012A — Verify RTP contract and availability

- Task ID: `PAY-012A`.
- Milestone: M04; cross-milestone obligations described above.
- Description: Verify RTP contract and availability.
- Priority: P0.
- Dependencies: PAY-002.
- Required inputs: current pinned/current source and approved scope; complete official per-method contract, account entitlement and approved sandbox scenarios. See listed blockers.
- Responsible role: Integration lead.
- Estimated engineering effort: Conditional.
- Affected files: docs/payments/04_PROVIDER_CONTRACTS.md; convex/payfastContracts.ts (future).
- Implementation requirements: Resolve payer identifier/routing/auth/reference/amount/currency/expiry/reject/cancel/callback/inquiry.
- Acceptance criteria: Complete official version and vectors; merchant entitlement recorded.
- Required tests: METHOD-RTP-001; VER-009; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No inferred phone/Raast ID/IBAN sufficiency.
- Rollback strategy: B as defined above; retain records and no duplicate financial recovery.
- Current status: `BLOCKED`.
- Blockers: Dedicated official RTP contract/entitlement absent.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-012B — Verify QR contract and availability

- Task ID: `PAY-012B`.
- Milestone: M04; cross-milestone obligations described above.
- Description: Verify QR contract and availability.
- Priority: P0.
- Dependencies: PAY-002.
- Required inputs: current pinned/current source and approved scope; complete official per-method contract, account entitlement and approved sandbox scenarios. See listed blockers.
- Responsible role: Integration / mobile lead.
- Estimated engineering effort: Conditional.
- Affected files: docs/payments/04_PROVIDER_CONTRACTS.md; convex/payfastContracts.ts (future).
- Implementation requirements: Resolve dynamic/static payload/amount/reference/expiry/completion/duplicates and same-device mechanisms.
- Acceptance criteria: Official binding and bank/device support matrix established.
- Required tests: METHOD-QR-001,008; NATIVE-007–008; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No invented QR format or import capability.
- Rollback strategy: B as defined above; retain records and no duplicate financial recovery.
- Current status: `BLOCKED`.
- Blockers: Dedicated QR API and bank/device support evidence absent.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-012C — Implement approved native RTP

- Task ID: `PAY-012C`.
- Milestone: M04; cross-milestone obligations described above.
- Description: Implement approved native RTP.
- Priority: P0.
- Dependencies: PAY-012A; PAY-008; PAY-009 completed mock foundation (real method adapter supplies sandbox extension).
- Required inputs: current pinned/current source and approved scope; complete official per-method contract, account entitlement and approved sandbox scenarios. See listed blockers.
- Responsible role: Fintech / mobile.
- Estimated engineering effort: Conditional.
- Affected files: convex/payfast.ts; convex/payfastContracts.ts; src/features/payments/PaymentInstructions.tsx.
- Implementation requirements: Approved request, issuer authorization, instructions and shared verified application.
- Acceptance criteria: Native workflow only when entitled; independent receipt and safe recovery.
- Required tests: METHOD-RTP-*; LIFE-*; CB-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No sensitive payer authorization persistence.
- Rollback strategy: C as defined above; retain records and no duplicate financial recovery.
- Current status: `BLOCKED`.
- Blockers: Depends on RTP contract and actual sandbox authorization.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-012D — Implement approved native QR

- Task ID: `PAY-012D`.
- Milestone: M04; cross-milestone obligations described above.
- Description: Implement approved native QR.
- Priority: P0.
- Dependencies: PAY-012B; PAY-008; PAY-009 completed mock foundation (real method adapter supplies sandbox extension).
- Required inputs: current pinned/current source and approved scope; complete official per-method contract, account entitlement and approved sandbox scenarios. See listed blockers.
- Responsible role: Fintech / mobile.
- Estimated engineering effort: Conditional.
- Affected files: convex/payfast.ts; convex/payfastContracts.ts; src/features/payments/PaymentInstructions.tsx.
- Implementation requirements: Approved dynamic QR using existing SVG package; incorrect/duplicate amounts explicit.
- Acceptance criteria: Bound QR and verified receipt; supported same-device alternative; no fabricated payload.
- Required tests: METHOD-QR-*; NATIVE-007–008; VER-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Exact supported payload and no client paid authority.
- Rollback strategy: C as defined above; retain records and no duplicate financial recovery.
- Current status: `BLOCKED`.
- Blockers: Depends on QR contract and actual sandbox authorization.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-012E — Validate Raast lifecycle and reconciliation

- Task ID: `PAY-012E`.
- Milestone: M07; cross-milestone obligations described above.
- Description: Validate Raast lifecycle and reconciliation.
- Priority: P0.
- Dependencies: PAY-012C/D; approved scenarios.
- Required inputs: current pinned/current source and approved scope; complete official per-method contract, account entitlement and approved sandbox scenarios. See listed blockers.
- Responsible role: QA / integration / security.
- Estimated engineering effort: Conditional.
- Affected files: Raast method/device tests; docs/payments/07_TEST_INVENTORY.md; docs/payments/10_UAT_RUNBOOK.md.
- Implementation requirements: Separate official success/failure/expiry/replay/late/recovery/usage cases.
- Acceptance criteria: Sanitized actual provider/device evidence; explicit blocked exclusions.
- Required tests: METHOD-RTP-*; METHOD-QR-*; UAT-*; PERF-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Never represent mocks as sandbox; no real-money tests.
- Rollback strategy: C/D as defined above; retain records and no duplicate financial recovery.
- Current status: `BLOCKED`.
- Blockers: Connected Raast methods/scenarios/test authorization absent.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-013 — Native PayFast Easypaisa, JazzCash and bank methods

- Task ID: `PAY-013`.
- Milestone: M04; cross-milestone obligations described above.
- Description: Native PayFast Easypaisa, JazzCash and bank methods.
- Priority: P0.
- Dependencies: PAY-002; PAY-008; PAY-009 completed mock slice.
- Required inputs: current pinned/current source and approved scope; complete official per-method contract, account entitlement and approved sandbox scenarios. See listed blockers.
- Responsible role: Integration / mobile / QA.
- Estimated engineering effort: Conditional.
- Affected files: convex/payfast.ts; convex/payfastContracts.ts; convex/payfastConfig.ts; native method components.
- Implementation requirements: Independently confirm discovery/fields/auth/IP/expiry/inquiry/refund and implement each method.
- Acceptance criteria: Each enabled method has its own contract and sandbox/native evidence.
- Required tests: METHOD-EASYPAISA-*; METHOD-JAZZCASH-*; METHOD-BANK-*; NATIVE-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No old credentials or assumed wallet parity; never passwords/PIN/CVV.
- Rollback strategy: C as defined above; retain records and no duplicate financial recovery.
- Current status: `BLOCKED`.
- Blockers: Full account-specific wallet/bank contracts/permissions/evidence/scenarios missing.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-014 — Refund, reversal, reconciliation and settlement operations

- Task ID: `PAY-014`.
- Milestone: M06; cross-milestone obligations described above.
- Description: Refund, reversal, reconciliation and settlement operations.
- Priority: P0.
- Dependencies: PAY-004/008; recovery/approval policy decisions.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Fintech / operations / Convex.
- Estimated engineering effort: Large; automation Conditional.
- Affected files: convex/paymentRefunds.ts; convex/paymentSettlements.ts; convex/paymentReconciliation.ts; schema/admin evidence UI.
- Implementation requirements: Add refund/settlement tables now; remainder reservation, confirmation, safe manual cases and bank matching.
- Acceptance criteria: No double return/overrefund or false completion; actual fees/taxes/net/bank evidence.
- Required tests: REF-*; SET-*; VER-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No generic credit/paid override or silent negative balance/clawback.
- Rollback strategy: C/D as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Automated APIs/statement formats and spent-fund/manual-approval policies unresolved.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-015 — Zone finance and withdrawal compatibility

- Task ID: `PAY-015`.
- Milestone: M05; cross-milestone obligations described above.
- Description: Zone finance and withdrawal compatibility.
- Priority: P0 compatibility / P1 reporting.
- Dependencies: PAY-005; PAY-010/011; settlement views PAY-014.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Convex / mobile / fintech.
- Estimated engineering effort: Medium.
- Affected files: convex/zoneWallet.ts; convex/zoneWithdrawals.ts; convex/wallet.ts; convex/admin.ts; zone wallet/admin withdrawals.
- Implementation requirements: Preserve rates/pilot/clearing/branch/reservation; separate bank settlement/transfer evidence.
- Acceptance criteria: Existing eligibility/rounding unchanged; no false settlement/payout claim.
- Required tests: SET-*; WD-*; REG-010,014; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No settlement restriction/fee allocation change without founder.
- Rollback strategy: B/D as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Actual settlement views need provider evidence; compatibility work independent.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-016 — Super Admin financial investigation

- Task ID: `PAY-016`.
- Milestone: M06; cross-milestone obligations described above.
- Description: Super Admin financial investigation.
- Priority: P0.
- Dependencies: PAY-008; PAY-014/015.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Admin UI / Convex / security.
- Estimated engineering effort: Large.
- Affected files: convex/admin.ts; src/services/convex/superAdminService.ts; admin Payments/detail screens.
- Implementation requirements: Provider/method/verification filters, safe timeline/links, discrepancy queues and bounded evidence commands.
- Acceptance criteria: Role-protected DTO/audit; no unrestricted mark-paid/manual-credit control.
- Required tests: SEC-*; REF-*; CB-*; PERF-004; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Privileged evidence access audited and minimized.
- Rollback strategy: A/B as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Active refund/intervention policy/permissions unresolved; safe views independent.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-017 — Final complete direct Easypaisa retirement

- Task ID: `PAY-017`.
- Milestone: M08; cross-milestone obligations described above.
- Description: Final complete direct Easypaisa retirement.
- Priority: P0.
- Dependencies: PAY-009–016; PAY-018–022; legacy obligation/client evidence.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Integration / operations / DevOps.
- Estimated engineering effort: Large.
- Affected files: Every exact dependency/variable/route/job in 02_DEPENDENCY_INVENTORY.md and 09_EASYPAISA_RETIREMENT.md.
- Implementation requirements: Disable initiation earlier; final reconcile/drain/remove transport/routes/jobs/credentials/UI; preserve history.
- Acceptance criteria: No active direct gateway after verified obligations and client compatibility; remaining strings classified.
- Required tests: MIG-*; LIFE-010–012; REG-*; PERF-001,005; NATIVE-011; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Never cut late callbacks/erase obligations to claim completion.
- Rollback strategy: C/D as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Outstanding live financial obligations and deployed-client compatibility not yet inventoried.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-018 — Continuous security and financial integrity validation

- Task ID: `PAY-018`.
- Milestone: M01; cross-milestone obligations described above.
- Description: Continuous security and financial integrity validation.
- Priority: P0.
- Dependencies: PAY-001 and each changed slice.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Security / fintech QA.
- Estimated engineering effort: Large.
- Affected files: Behavioral security/Convex suites; docs/payments/03_SECURITY_FINDINGS.md; docs/payments/07_TEST_INVENTORY.md.
- Implementation requirements: Test write/callback/receipt/admin boundaries every milestone; consolidate M07.
- Acceptance criteria: Required P0 checks verified at exact commit; no unresolved integrity regression.
- Required tests: SEC-*; FIN-*; VER-*; CB-*; BOOK-*; CHAL-*; WALK-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Static findings distinct from executed evidence.
- Rollback strategy: B/C/D as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Tests unexecuted; affected failures stop dependent work.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-019 — Convex usage controls and measurement

- Task ID: `PAY-019`.
- Milestone: M02; cross-milestone obligations described above.
- Description: Convex usage controls and measurement.
- Priority: P0.
- Dependencies: PAY-001 baseline; evolving flows.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Convex / DevOps.
- Estimated engineering effort: Medium.
- Affected files: payment reconciliation/crons/wallet/admin/zone modules; native status hooks; usage script.
- Implementation requirements: Shared claim, focused subscription, indexed pages, bounded jobs/payload/retry/circuit breaker; measure M07.
- Acceptance criteria: No idle provider calls, duplicate jobs or terminal churn; complete history and matched usage evidence.
- Required tests: PERF-*; LIFE-007–012; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No truncated-search correctness or copied PayFast retry assumptions.
- Rollback strategy: B/C as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Measured baseline and provider policy not yet established.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-020 — Actual sandbox UAT and Test Order ID

- Task ID: `PAY-020`.
- Milestone: M07; cross-milestone obligations described above.
- Description: Actual sandbox UAT and Test Order ID.
- Priority: P0.
- Dependencies: PAY-002; selected methods; P0 gates; explicit sandbox authorization.
- Required inputs: current pinned/current source and approved scope; complete official per-method contract, account entitlement and approved sandbox scenarios. See listed blockers.
- Responsible role: QA / integration / founder liaison.
- Estimated engineering effort: Conditional.
- Affected files: docs/payments/10_UAT_RUNBOOK.md; docs/payments/07_TEST_INVENTORY.md; method evidence.
- Implementation requirements: Execute official controlled cases, prepare sanitized package; submit only if authorized.
- Acceptance criteria: Receipt-bound once-only native/provider evidence and UAT acceptance; correct Test Order ID.
- Required tests: UAT-*; METHOD-*; NATIVE-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No secrets or mock-as-provider claims.
- Rollback strategy: C/D as defined above; retain records and no duplicate financial recovery.
- Current status: `BLOCKED`.
- Blockers: Full specs/entitlement/scenarios and transaction/submission authorization absent.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-021 — Continuous app regression validation

- Task ID: `PAY-021`.
- Milestone: M00; cross-milestone obligations described above.
- Description: Continuous app regression validation.
- Priority: P0.
- Dependencies: PAY-001 and every changed slice.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: QA / mobile / domain owners.
- Estimated engineering effort: Large.
- Affected files: Existing Jest/Vitest/convex-test/Maestro; new payment suites; test inventory.
- Implementation requirements: Baseline M00, focused per milestone, broad M07/M08; preserve all critical journeys.
- Acceptance criteria: Recorded executed results/current SHA; device/provider blockers retained; no historic pass substitution.
- Required tests: REG-*; UI-*; NATIVE-*; MIG-*; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: No production data/load or hidden live endpoints.
- Rollback strategy: A/B/C as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Baseline/runtime/device tests not executed; native builds separately authorized.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-022 — Production migration and rollback readiness

- Task ID: `PAY-022`.
- Milestone: M08; cross-milestone obligations described above.
- Description: Production migration and rollback readiness.
- Priority: P0.
- Dependencies: PAY-004; PAY-017–021; final provider/commercial/classification decisions.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: DevOps / fintech / release lead.
- Estimated engineering effort: Medium.
- Affected files: docs/payments/11_ROLLOUT_AND_ROLLBACK.md; compatibility/config code.
- Implementation requirements: Prepare expand-first sequence, cohort/method kill switches, monitor and isolated rollback rehearsal.
- Acceptance criteria: No schema-breaking rollback, lost in-flight receipt or duplicate refund; explicit release owners/gates.
- Required tests: MIG-*; LIFE-*; PERF-*; old/new-client rehearsal; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Production operations separately authorized M09.
- Rollback strategy: B/C/D as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Actual deployed versions/obligations, approvals and rehearsal evidence missing.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

### PAY-023 — Founder approval and release readiness

- Task ID: `PAY-023`.
- Milestone: M08; cross-milestone obligations described above.
- Description: Founder approval and release readiness.
- Priority: P0.
- Dependencies: Required task evidence and open decisions.
- Required inputs: current pinned/current source and approved scope; applicable architecture/security/domain rules and representative historical/synthetic fixtures. See listed blockers.
- Responsible role: Founder / release owner.
- Estimated engineering effort: Small review; external waiting excluded.
- Affected files: Milestone/test trackers; decision log; rollout runbook.
- Implementation requirements: Record new-chat implementation authorization first; independent production approval later.
- Acceptance criteria: P0 evidence verified, method scope excludes unverified capabilities, separate M09 authorization.
- Required tests: Review all required evidence and exact SHA; cases/evidence in `07_TEST_INVENTORY.md`.
- Security considerations: Direction approval is not transaction/production permission.
- Rollback strategy: B/C as defined above; retain records and no duplicate financial recovery.
- Current status: `NOT_STARTED`.
- Blockers: Implementation and later production scope approvals belong to their separate phases.
- Completion evidence: None for implementation. Existing planning/source evidence is in this package; no runtime pass claimed.
- Associated commit SHA: — (no implementation commit).

## Reporting and completion

Before each phase: problem/current behavior/root cause/proposed solution/expected behavior/files/regressions/required tests. After: actual changes/additions/removals/preserved behavior/reasons/challenges/security/performance, commands/results/not-run reasons, remaining risks/dependencies, branch/full SHA/deployment/next action. Keep test inventory, decision log and changelog current.

Provider nonresponse isolates only dependent work. Failed financial/security checks block dependent changes. Commercial-policy/destructive/real-money/production actions require their own decisions. Documentation or written code alone never completes an implementation task. No application source, baseline test, schema migration, transaction, build or deployment occurred in documentation establishment.
