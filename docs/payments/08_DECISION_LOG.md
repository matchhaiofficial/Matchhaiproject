# Decisions, assumptions and approval boundaries

Prepared November 26, 2026. This register replaces dependence on chat history. [README authority](00_README.md), [provider gaps](04_PROVIDER_CONTRACTS.md) and [handover](12_IMPLEMENTATION_HANDOVER.md) apply. No implementation started.

## Approved founder requirements

| ID | Decision | Evidence / consequence |
| --- | --- | --- |
| DEC-001 | Native Matchhai-owned payment interfaces and direct documented PayFast APIs | Founder approved architectural direction in principle; required issuer authentication may occur externally |
| DEC-002 | Convex remains backend; lightweight neutral payment service and adapter | Reuse correct financial engine; do not introduce unnecessary server/database/queue |
| DEC-003 | Raast RTP/QR, Easypaisa/JazzCash/banks conditional on official API availability and entitlement | Commercial method scope is not permission for every product |
| DEC-004 | No automatic hosted checkout fallback or disguised WebView | Any hosted/component exception returns to founder |
| DEC-005 | No v1 cards or recurring/stored payment instruments | Future activation is not guaranteed and requires new approval |
| DEC-006 | Preserve balances, history and actual provider identities | Never relabel Easypaisa as PayFast or delete financial records |
| DEC-007 | Preserve booking, challenge, cancellation/refund eligibility, commission, pilot, earnings and withdrawal policies | Enforcement defect fixes must not simplify/change commercial rules |
| DEC-008 | Security hardening before activation; additive migration | Close actual write-boundary defects; no destructive reset/backfill |
| DEC-009 | Incremental tables and wallet-first vertical slice | M02 core data; M03 mocked top-up; M04 real sandbox top-up; M05 remaining purposes; M06 refund/settlement tables |
| DEC-010 | Continuous testing, explicit mock/provider separation and pending-test tracking | Implementation alone is not completion |
| DEC-011 | Only migration branch/workspace; separate implementation chat | Current authorization covers clone/document/commit/push only; leave other workspaces untouched |
| DEC-012 | Final direct Easypaisa retirement in M08; production deployment in separately authorized M09 | Financial obligations and deployed clients constrain removal |
| DEC-013 | Routine safe implementation should continue across milestones once authorized in the new chat | Do not seek approval for every minor task; isolate external/policy/security/production blockers |

## Engineering defaults to implement within approved scope

| ID | Recommendation / rationale | Gate or limit |
| --- | --- | --- |
| REC-001 | Use existing `paymentTransactions` for provider attempts; separate intent/verified receipt/event lifecycle | Add only at needed milestone; not all tables up front |
| REC-002 | Preserve existing numeric ledger while new provider comparisons use checked minor units | No silent historical balance rounding; separate approval for actual corrections/full conversion |
| REC-003 | Durable receipt verification followed by atomic credit + eligible purpose application | Expected unavailability gives wallet-credit-only; system errors roll back/recover |
| REC-004 | Shared inquiry claim/cooldown/job identity and reactive UI | Exact provider timing awaits official contract |
| REC-005 | Separate initiation kill switch from reconciliation | Global old flag currently affects both; obligations must remain serviceable |
| REC-006 | Native new UI uses existing Montserrat/Inter tokens | Do not globally replace actual Martel body token |
| REC-007 | Safe legacy DTOs/routes until deployed-client review proves retirement safe | Do not silently dispatch old gateway requests to PayFast |
| REC-008 | Keep current zone clearing/rates/withdrawals; show bank settlement independently | Assess liquidity, never impose new settlement restriction automatically |
| REC-009 | Evidence-linked manual refund/reconciliation when automation unavailable | No arbitrary mark-paid/manual credit controls |

## Founder/provider decisions still required

| ID | Question / recommended default | Affected workstream |
| --- | --- | --- |
| OPEN-001 | Authorize application implementation in the separate chat; current direction approval alone is not execution | M00 onward |
| OPEN-002 | Per-method direct entitlements/complete contracts; enable only individually documented/tested methods | M04 / release |
| OPEN-003 | If only hosted/component support is available, present options and security/effort; no automatic fallback | Affected method only |
| OPEN-004 | OTP inside Matchhai only if official account-specific model permits; prefer issuer-managed authorization | Method-specific authorization |
| OPEN-005 | Maker/approver separation for manual financial correction/refund | Recommended safeguard; founder confirms roles/policy before active operations |
| OPEN-006 | Refund recovery when wallet funds spent, venue allocated or payout completed | No silent negative balances or zone clawback; obtain policy |
| OPEN-007 | Any settlement-based withdrawal restriction, liquidity reserve or payout timing change | Preserve existing rule absent approval |
| OPEN-008 | Final fees/taxes/surcharge/zone allocation | No hardcoded unverified charge or automatic customer/venue deduction |
| OPEN-009 | Hosted onboarding-only sandbox transaction if provider requires | Separate narrow approval; no architecture change |
| OPEN-010 | Actual sandbox transaction session authorization and provider UAT submission | Prepare safely; don't initiate/submit by assumption |
| OPEN-011 | Production configuration/deployment/restricted real-money tests | Separate M09 approval with concrete reviewed scope |
| OPEN-012 | Legal/provider/store classification and identity retention | No invented legal conclusion; website coordination |

## Assumptions and unresolved live state

The pinned source is the approved code baseline, not proof of deployed state. Production/QA environment values, active transactions, unresolved refunds/disputes, customer versions, actual fee schedule and merchant operational acceptance are unknown. No actual credentials were inspected or stored. Supplied sanitized correspondence records disclosure of wallets/venues/withdrawals; disclosure is not full product-model approval.

Historical audit documents contain previous test/deploy claims; preserve them as history without adopting them as tests executed in this migration. At documentation publication, all application tests remain unexecuted and implementation tasks unstarted/blocked as tracked.

## Change control

Append decision ID/date/authority/reason/source/affected tasks/tests and superseded decision. Do not erase an approved constraint or rewrite an unresolved capability as confirmed. Routine code choices within scope need no founder approval; financial/commercial policy, destructive data operations, real-money or production changes do. A failing financial/security gate cannot be waived silently by continuing another dependent milestone.
