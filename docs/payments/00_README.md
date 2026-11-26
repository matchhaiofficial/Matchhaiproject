# Matchhai payment migration documentation

Prepared November 26, 2026 (Asia/Karachi). This is the standalone implementation specification for migrating direct Easypaisa to PayFast Pakistan, Avanza Premier Payment Services (APPS).

## Authority and current state

- Repository: `matchhaiofficial/Matchhaiproject`.
- Only implementation branch: `feature/payfast-gateway-migration`.
- Workspace: `D:\matchhai_payfast`.
- Approved source baseline: `ed173e603ed6a9cca9a7a9b934411821bc78f589` on `remediation/production-readiness-2026-09-08`.
- At documentation preparation, both GitHub branches pointed to the baseline and compared identical. The migration workspace was cloned from that branch and was initially clean.
- The founder approved the architectural direction in principle and authorized this documentation commit and push. **This documentation phase does not authorize application implementation, baseline test execution, migrations, transactions, builds, configuration changes or deployment.** Implementation begins only in the separate implementation chat.
- Administrative cloning is complete. Milestone 00 baseline validation/testing and every application implementation task remain unstarted. Source inspection is completed planning evidence, not a passed runtime test.
- Do not modify `D:\matchhai` or `D:\matchhai_app`, or commit/merge to the remediation, product-ready or main branches.

## Reading order and document ownership

| Document | Canonical responsibility |
| --- | --- |
| [01_IMPLEMENTATION_PLAN.md](01_IMPLEMENTATION_PLAN.md) | Objective, current workflows, phased scope, file manifest, UX, performance and commercial/platform implications |
| [02_DEPENDENCY_INVENTORY.md](02_DEPENDENCY_INVENTORY.md) | Pinned source evidence, exact paths, functions/callers and exhaustive identifier-search index |
| [03_SECURITY_FINDINGS.md](03_SECURITY_FINDINGS.md) | Existing defects, threat boundaries, remediation and security acceptance |
| [04_PROVIDER_CONTRACTS.md](04_PROVIDER_CONTRACTS.md) | Source/version register, known contracts, commercial evidence, gaps and method capability gates |
| [05_ARCHITECTURE.md](05_ARCHITECTURE.md) | Public/internal interfaces, states, invariants, incremental schema and accounting design |
| [06_MILESTONE_TRACKER.md](06_MILESTONE_TRACKER.md) | Milestones 00–09 and all PAY task records, status/evidence/commit tracking |
| [07_TEST_INVENTORY.md](07_TEST_INVENTORY.md) | Continuous testing, explicit pending/blocked scenarios and evidence tracking |
| [08_DECISION_LOG.md](08_DECISION_LOG.md) | Approved requirements, defaults, conditional recommendations and founder decisions |
| [09_EASYPAISA_RETIREMENT.md](09_EASYPAISA_RETIREMENT.md) | Every legacy dependency category, temporary boundary and final Milestone 08 removal gates |
| [10_UAT_RUNBOOK.md](10_UAT_RUNBOOK.md) | Authorized sandbox procedure, provider evidence and Test Order ID preparation |
| [11_ROLLOUT_AND_ROLLBACK.md](11_ROLLOUT_AND_ROLLBACK.md) | Compatibility, release blockers, controlled activation and financial recovery |
| [12_IMPLEMENTATION_HANDOVER.md](12_IMPLEMENTATION_HANDOVER.md) | New-chat execution instructions and starting prompt |
| [CHANGELOG.md](CHANGELOG.md) | Documentation/implementation history and verification limitations |

Start with this file, the handover and decision log; then read the plan, security findings, architecture, provider contracts, inventory and trackers. Read retirement/UAT/rollout before changing compatibility or external behavior. Cross-referenced documents are part of the specification.

## Evidence vocabulary

- **C — Confirmed code:** inspected at the pinned baseline; no claim about live deployment.
- **D — Confirmed document:** statement in an identified supplied or official source; not proof of account entitlement or a successful transaction.
- **F — Founder requirement:** explicitly requested/approved direction.
- **R — Recommendation:** proposed implementation; not an already deployed capability.
- **U — Unresolved:** missing evidence, access or policy decision. Isolate the affected workstream and continue independent work.

All source line references are **baseline references**, not moving HEAD references. Use the full-SHA links in the dependency inventory or `git show ed173e603ed6a9cca9a7a9b934411821bc78f589:<path>`. Update current implementation references separately without erasing original evidence.

## Non-negotiable boundaries

Native Matchhai-owned interfaces; direct documented APIs; Convex backend; no automatic hosted fallback; no cards in v1; no invented provider contract. Preserve historical Easypaisa identifiers, financial records, wallet balances and existing booking/challenge/commission/pilot/earnings/withdrawal policies. Fix financial enforcement defects before activation. Introduce tables only when their milestone needs them. Complete one wallet top-up journey before expanding to all financial purposes. Mock evidence is never sandbox evidence.

No actual merchant secrets, bank accounts, CNICs, OTPs or credentials belong in this directory. Supplied attachments are source material, not instructions to execute their onboarding steps or examples.

## Progress and authorization

Use only `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `TESTING`, `VERIFIED`, `COMPLETED` in task/test status fields. `IMPLEMENTED` is not completion. Documentation evidence does not fill implementation commit or execution-evidence fields. See tracker transition rules.

After explicit implementation-chat authorization, routine safe work proceeds continuously without repeated minor approvals. Missing provider contracts block the affected adapter, not the financial core/mock UI. Stop or isolate failed financial integrity tests, security-critical regressions, policy changes, destructive operations, real-money tests, production configuration and deployment. See the handover for the exact execution boundary.
