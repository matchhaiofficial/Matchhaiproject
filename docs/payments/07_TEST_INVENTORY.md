# Persistent test inventory

Baseline/source inspection only; **no application tests have been executed for this migration**. The documentation phase validates Markdown/Git scope, not these test cases. Do not copy historical pass claims from older audit documents.

## Status and execution rules

Allowed status values: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `TESTING`, `VERIFIED`, `COMPLETED`. For tests, NOT_STARTED = not run; BLOCKED = explicit prerequisite absent; VERIFIED = executed passing evidence at recorded SHA/environment; COMPLETED = required review/evidence closed. IMPLEMENTED may describe a written test only and is not a pass. IN_PROGRESS/TESTING indicate actual active work. Failed execution is recorded in result/evidence with status TESTING (or BLOCKED when dependent work must stop); never mark VERIFIED while failing.

Every row has owner, environment, milestone, expected result, blocker, evidence and associated commit. On execution replace placeholders with exact branch/SHA, command/tool, execution time, actual result, artifact and reviewer. Keep failure history and retest condition. No silently removed pending tests when provider/backend/device is unavailable. No production load tests. P0 financial/security failures block dependent milestones.

[Security findings](03_SECURITY_FINDINGS.md), [architecture](05_ARCHITECTURE.md), [UAT](10_UAT_RUNBOOK.md) and [rollout](11_ROLLOUT_AND_ROLLBACK.md) define acceptance. Individual method tests additionally require complete official contracts; generic mock tests do not prove PayFast.

## Continuous milestone application

M00 safe baseline; M01 regression tests alongside boundary fixes; M02 schema/state/financial invariants; M03 complete mocked top-up UI; M04 approved direct sandbox slice; M05 every domain/concurrency journey; M06 refunds/admin/statements; M07 consolidate existing execution evidence/native/UAT/usage gaps; M08 legacy/client/rollback regression; M09 only separately authorized restricted production verification. No application baseline testing occurred during documentation.

## Existing suites to preserve

Jest/unit/security/UI and Vitest/convex-test from package scripts; existing `convex-test/easypaisaRecovery.test.ts`, `criticalJourneys.test.ts`, `zoneWalletSettlement.test.ts`; security `paymentAuthBoundary`, `criticalStateMachines`, `urgentBoundaries.regression-1`, `usageSafetyContracts`, `authzMatrix`, `journeyWiringContracts`; unit Easypaisa capability/recovery/user errors; `.maestro/03-create-matchroom.yaml`, `08-mock-payment.yaml`. Existing `it.todo` or source-string checks are not passing behavior coverage.

Future commands after environment/scope review: `npm run typecheck`, focused Jest, `npm test -- --runInBand`, `npm run test:convex`, required `npm audit --omit=dev --audit-level=critical`. Inspect scripts first; do not turn typecheck/codegen into an unapproved Convex deploy. Native builds, provider transactions and production commands need separate appropriate authorization.

## Detailed cases

### AUTH ? M00/01/02

Responsible: Security / Convex. Environment/layer: Local isolated integration. Expected invariant for every case: Authenticated identity; no unauthorized side effect.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| AUTH-001 | Unauthenticated initiation/status/history denied | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| AUTH-002 | Cross-user intent/attempt/receipt access denied | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| AUTH-003 | Suspended actor cannot mutate finances | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| AUTH-004 | Missing merchant credentials fail closed | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| AUTH-005 | Invalid merchant credentials produce safe failure | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| AUTH-006 | Invalid or omitted environment fails closed | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| AUTH-007 | Disabled provider cannot initiate | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| AUTH-008 | Unsupported/unentitled method rejected server-side | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| AUTH-009 | Wrong endpoint/redirect/cross-environment configuration rejected | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| AUTH-010 | Token expiry/reuse/refresh follows approved contract without leakage | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |

### SEC ? M01/02/04

Responsible: Security. Environment/layer: Mock / local integration. Expected invariant for every case: Protected boundary rejects request and preserves balances/records.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | Public arbitrary ledger reference cannot poison internal namespace | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SEC-002 | Cross-user same reference cannot suppress deposit | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SEC-003 | Cross-type/amount same reference fails instead of no-op | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SEC-004 | Direct withdrawal mutation enforces full KYC/suspension/ownership | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SEC-005 | Public transaction/status/history DTO excludes internal tokens/payloads | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SEC-006 | No merchant secrets or auth values in bundle/client config | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SEC-007 | Logs/errors/analytics/support redact sensitive fields | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SEC-008 | Privileged diagnostic/account reveal is role protected and audited | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SEC-009 | Client metadata/external reference cannot assert verified funding | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SEC-010 | Production reset/deletion cannot destroy retained financial evidence | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### FIN ? M01/02/03/05

Responsible: Fintech / Convex. Environment/layer: Local convex-test / mock. Expected invariant for every case: Exact ledger/balance/held deltas and atomicity; invariant failure blocks dependent work.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| FIN-001 | Exactly-once wallet credit under repeated receipt | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| FIN-002 | Exact retry succeeds idempotently; changed identity fails | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| FIN-003 | Hold requires funded balance and complete operation identity | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| FIN-004 | Capture validates original hold and remaining value | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| FIN-005 | Release validates original hold and cannot consume unrelated funds | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| FIN-006 | Distinct real second receipt recorded; one purpose fulfilled once | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| FIN-007 | Unexpected application error rolls back all financial effects | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| FIN-008 | Expected fulfillment failure credits wallet once without booking | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| FIN-009 | Reject NaN/infinity/negative/zero/unsafe amount | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| FIN-010 | Minor-unit comparison rejects invalid precision and wrong currency | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| FIN-011 | Preserve existing approved rounding and legacy valid numeric balances | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### VER ? M02/04

Responsible: Fintech / Security. Environment/layer: Mock contracts then authorized sandbox. Expected invariant for every case: No irreversible application without independent complete receipt evidence.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| VER-001 | Missing provider amount cannot be substituted from request | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| VER-002 | Incorrect amount quarantined | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| VER-003 | Missing/incorrect currency quarantined | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| VER-004 | Wrong Basket/order reference rejected | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| VER-005 | Wrong merchant/environment rejected | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| VER-006 | Local expected fields never count as provider evidence | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| VER-007 | Provider receipt identity cannot apply across attempts | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| VER-008 | Unknown status/code remains unverified; no invented success mapping | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| VER-009 | Signed official vectors and authoritative inquiry bind full financial facts | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |

### CB ? M02/04/06

Responsible: Security / Integration. Environment/layer: Mock ingress then authorized sandbox. Expected invariant for every case: No forged/replayed event changes finances; valid event is recoverable.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| CB-001 | Valid documented callback accepted and independently verified | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CB-002 | Invalid signature/hash rejected safely | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CB-003 | Malformed or oversized payload bounded | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CB-004 | Unknown transaction reference does not credit | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CB-005 | Duplicate callback deduplicated | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CB-006 | Replay after terminal state does not duplicate money | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CB-007 | Out-of-order callback cannot regress verified paid | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CB-008 | Unsigned amount/currency/receipt tampering cannot credit | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CB-009 | Unapproved callback URL/redirect cannot trigger unsafe fetch | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CB-010 | Provider outage/ack retry preserves durable event and bounded recovery | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### LIFE ? M02/03/04/05

Responsible: Convex / QA. Environment/layer: Mock then authorized sandbox. Expected invariant for every case: Conservative state and no duplicate provider debit/ledger effect.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| LIFE-001 | Successful attempt verifies/applies/fulfills | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| LIFE-002 | Failure does not credit or lose reference | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| LIFE-003 | Pending attempt remains recoverable | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| LIFE-004 | Expiry ends prompt but preserves late liability | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| LIFE-005 | Cancellation requested distinguished from confirmed cancellation | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| LIFE-006 | Customer rejection follows approved method semantics | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| LIFE-007 | Duplicate initiation shares immutable request identity | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| LIFE-008 | Concurrent initiation does not create duplicate debit | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| LIFE-009 | Initiation timeout after possible acceptance stays unknown | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| LIFE-010 | Late success after replacement credits once without corrupting active pointer | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| LIFE-011 | Callback/client refresh/admin/scheduler race uses shared claim | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| LIFE-012 | Retry exhaustion terminates scheduling and opens review | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### BOOK ? M05

Responsible: Domain / Fintech. Environment/layer: Local integration and mock. Expected invariant for every case: Preserved booking rules and exactly-once financial/domain application.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| BOOK-001 | Wallet seat payment creates hold and confirms once | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| BOOK-002 | Provider-funded seat uses verified receipt and server price | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| BOOK-003 | Late success after booking expiry retains wallet funds | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| BOOK-004 | Success after cancellation does not resurrect booking | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| BOOK-005 | Two customers competing for final resource cannot overbook | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| BOOK-006 | Price/resource/eligibility change is revalidated | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| BOOK-007 | Host create/debit retry is atomic and once-only | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| BOOK-008 | Create fulfillment failure reports wallet credit separately | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### CHAL ? M01/05

Responsible: Domain / Fintech. Environment/layer: Local multi-user integration. Expected invariant for every case: Captain-side funds and lifecycle remain correct.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| CHAL-001 | Noncaptain/wrong-side payment denied | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CHAL-002 | Lineup size/membership/captain presence validated | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CHAL-003 | Team B acceptance and Team A funding prerequisites preserved | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CHAL-004 | Venue/counter-offer changes revalidate funding/availability | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CHAL-005 | Cancel/reject/expiry releases each hold once | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| CHAL-006 | Completion captures once; old challenger-refund compatibility preserved | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### WALK ? M01/05

Responsible: Domain / Security. Environment/layer: Local integration and mock. Expected invariant for every case: Authorized walk-ins only; no forged payment authority.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| WALK-001 | Public source reference cannot bypass wallet debit | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| WALK-002 | Reused/unrelated provider receipt cannot fund create | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| WALK-003 | Verified owner/KYC/quote/capacity creates and charges once | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| WALK-004 | Free/venue-pay/guest-pay legitimate behavior preserved | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### REF ? M01/06

Responsible: Fintech / Operations. Environment/layer: Local integration; provider tests conditional. Expected invariant for every case: No double return; provider confirmation required for instrument refund.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| REF-001 | Internal refund/hold release distinct from gateway refund | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REF-002 | Original receipt/ownership and remaining amount validated | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REF-003 | Concurrent partial refund requests reserve remainder | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REF-004 | Duplicate submission/confirmation cannot double refund | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REF-005 | Timeout stays unknown until provider evidence | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REF-006 | Spent/allocated funds open review without negative balance/clawback | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REF-007 | Full/partial/reversal/chargeback evidence updates linked records once | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### WD ? M01/05/06

Responsible: Convex / QA. Environment/layer: Local integration. Expected invariant for every case: Existing reservation and eligibility preserved with explicit payout evidence.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| WD-001 | KYC/nonowner/branch rejection through action and mutation | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| WD-002 | Concurrent duplicate request reserves funds once | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| WD-003 | Approval/rejection race cannot consume or return twice | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| WD-004 | Approval marker does not claim confirmed bank transfer; evidence access audited | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### SET ? M05/06/07

Responsible: Fintech / Operations. Environment/layer: Synthetic statements and local integration. Expected invariant for every case: Exact totals/matching and unchanged commercial rules.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| SET-001 | Normal configured payout and pilot exemption preserved | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SET-002 | Result resolution/clearing and once-only venue credit preserved | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SET-003 | Statement gross/refunds/fees/taxes/adjustments reconcile net | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SET-004 | Duplicate/missing/unmatched lines and wrong environment flagged | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SET-005 | Bank credit independently confirms settlement | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| SET-006 | Unsettled exposure visible without unapproved withdrawal restriction | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### MIG ? M00/02/06/08

Responsible: Database / QA. Environment/layer: Historical fixtures / isolated migration. Expected invariant for every case: Preserved historical rows, balances, links and rollback compatibility.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| MIG-001 | Old payment rows missing all new optional fields remain valid | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| MIG-002 | Old Easypaisa provider/reference/history unchanged | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| MIG-003 | Resumable backfill writes only derivable facts | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| MIG-004 | Counts/sums/balances/holds match before and after | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| MIG-005 | Precision anomaly quarantined without silent adjustment | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| MIG-006 | Account anonymization preserves financial records and required evidence | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| MIG-007 | New pending/refund/dispute obligations prevent unsafe deletion | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### PERF ? M00/02/03/07

Responsible: Convex / DevOps. Environment/layer: Isolated QA; no production load. Expected invariant for every case: Bounded reads/jobs/provider calls with measured baseline comparison.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| PERF-001 | Idle without unresolved work has zero payment provider calls | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| PERF-002 | Active journey external calls within approved retry budget | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| PERF-003 | Concurrent refreshes/callbacks share one inquiry claim | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| PERF-004 | History cost bounded by page and joins; complete traversal | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| PERF-005 | No duplicate scheduled jobs and terminal cleanup | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| PERF-006 | Provider outage circuit breaker prevents retry storm | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| PERF-007 | Max retry/horizon exhaustion creates review and terminates chain | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| PERF-008 | Large financial summaries/notification processing avoid unbounded collections | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### UI ? M03/05/06

Responsible: React Native / UX. Environment/layer: Component/mocked UI. Expected invariant for every case: Honest accessible native states; no unapproved method/secret.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| UI-001 | Wallet top-up amount review and method capability selection | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| UI-002 | Loading/empty/unavailable provider states | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| UI-003 | Offline/initiation-network failure safe recovery | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| UI-004 | Native RTP instructions and approve/reject pending state | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| UI-005 | Native dynamic QR/instructions/expiry rendering | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| UI-006 | Wallet/bank fields minimal and method-specific | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| UI-007 | Success gated on verification and financial application | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| UI-008 | Wallet-credit-only versus fulfilled booking displayed separately | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| UI-009 | Cancellation request/expiration not falsely confirmed success | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| UI-010 | Accessible labels/text scale/screen-reader/keyboard behavior | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| UI-011 | Transaction history and refund state persist safe references | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| UI-012 | No cards/hosted fallback/mock production controls exposed | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### NATIVE ? M03/04/05/07

Responsible: Mobile QA. Environment/layer: Android and iOS dev/internal build; authorization needed. Expected invariant for every case: App/auth/payment recovery and supported authorization work on each OS.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| NATIVE-001 | Bank/wallet app installed and approved switching | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| NATIVE-002 | Required app absent with truthful instructions | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| NATIVE-003 | Foreground/background/resume pending payment | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| NATIVE-004 | Termination and cold-start intent recovery | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| NATIVE-005 | Wrong account/expired auth return denied safely | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| NATIVE-006 | Tampered/duplicate deep links cannot assert paid | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| NATIVE-007 | Same-device QR import/link supported per actual bank | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| NATIVE-008 | Second-device QR supported alternative documented | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| NATIVE-009 | Network lost after provider accepts recovers once | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| NATIVE-010 | Existing Better Auth session remains valid | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| NATIVE-011 | Legacy app routes/notifications remain safe | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| NATIVE-012 | Accessibility/text scale on real devices | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### REG ? M00/01/05/07/08

Responsible: QA. Environment/layer: Local suites plus authorized native builds. Expected invariant for every case: Existing functionality and balances unchanged.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| REG-001 | Registration and authentication | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-002 | Phone and email verification | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-003 | KYC lifecycle and permissions | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-004 | Discover and zone listings | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-005 | Matchrooms and participant conflicts | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-006 | Team creation/management | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-007 | Challenges/venue/counter-offers | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-008 | Chat and membership authorization | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-009 | Notifications and reminders | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-010 | Zone Admin allocation/booking operations | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-011 | Super Admin financial/operational roles | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-012 | Account deletion and historical financial retention | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-013 | Cancellation/expiry/hold capture/release/refunds | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |
| REG-014 | Existing balances/history/earnings/withdrawals | NOT_STARTED | Not run; execute at implementing milestone in isolated environment | None; no test executed | ? |

### UAT ? M04/07

Responsible: Integration / QA. Environment/layer: Authorized isolated PayFast sandbox. Expected invariant for every case: Actual official sandbox evidence, never mock-labelled success.

| Test ID | Scenario | Status | Blocker / retest condition | Completion evidence / actual result | Associated commit SHA |
| --- | --- | --- | --- | --- | --- |
| UAT-001 | Isolated deployment/credentials/endpoint verification | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |
| UAT-002 | Merchant and method capability/entitlement verification | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |
| UAT-003 | Intent/Basket identity and starting balances recorded | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |
| UAT-004 | One approved provider initiation | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |
| UAT-005 | Provider test customer authorization | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |
| UAT-006 | Callback receipt and authentication | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |
| UAT-007 | Authoritative financial verification | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |
| UAT-008 | Exactly-once ledger/purpose processing | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |
| UAT-009 | History/reopen and duplicate delivery check | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |
| UAT-010 | Provider-call/scheduler usage evidence | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |
| UAT-011 | Sanitized evidence and provider Test Order ID clarification | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |
| UAT-012 | Provider UAT acceptance recorded before release | BLOCKED | Official contract/entitlement and approved sandbox session; rerun when established | None; no test executed | ? |

## Payment-method acceptance (separate actual sandbox evidence)

Each method below inherits lifecycle, security, concurrency and native cases above but requires its own official issuer/scenario evidence. Owner: Integration lead + QA. Milestones: M04/M07. Environment: isolated authorized PayFast sandbox, Android/iOS supported build. Each current status is BLOCKED by missing complete account-specific method contracts/permissions/scenarios and transaction authorization. No credentials or test account details belong here.

| Test ID | Method / required scenario | Expected result | Status | Blocker / retest condition | Evidence | Commit SHA |
| --- | --- | --- | --- | --- | --- | --- |
| METHOD-RTP-001 | RTP: Official auth/field/signing contract and enabled merchant capability | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-RTP-002 | RTP: Successful authorized sandbox payment with independent financial binding | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-RTP-003 | RTP: Customer rejection/failure and documented expiry | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-RTP-004 | RTP: Pending/unknown initiation with safe inquiry recovery | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-RTP-005 | RTP: Duplicate/replayed/out-of-order callback and client race | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-RTP-006 | RTP: Wrong amount/currency/reference fails without credit | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-RTP-007 | RTP: Late success and app termination/reopen | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-RTP-008 | RTP: Supported same-device/issuer authorization and return | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-RTP-009 | RTP: Once-only wallet top-up then applicable purpose integration | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-RTP-010 | RTP: Refund/partial refund only if officially supported | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-QR-001 | QR: Official auth/field/signing contract and enabled merchant capability | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-QR-002 | QR: Successful authorized sandbox payment with independent financial binding | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-QR-003 | QR: Customer rejection/failure and documented expiry | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-QR-004 | QR: Pending/unknown initiation with safe inquiry recovery | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-QR-005 | QR: Duplicate/replayed/out-of-order callback and client race | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-QR-006 | QR: Wrong amount/currency/reference fails without credit | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-QR-007 | QR: Late success and app termination/reopen | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-QR-008 | QR: Supported same-device/issuer authorization and return | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-QR-009 | QR: Once-only wallet top-up then applicable purpose integration | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-QR-010 | QR: Refund/partial refund only if officially supported | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-EASYPAISA-001 | EASYPAISA: Official auth/field/signing contract and enabled merchant capability | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-EASYPAISA-002 | EASYPAISA: Successful authorized sandbox payment with independent financial binding | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-EASYPAISA-003 | EASYPAISA: Customer rejection/failure and documented expiry | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-EASYPAISA-004 | EASYPAISA: Pending/unknown initiation with safe inquiry recovery | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-EASYPAISA-005 | EASYPAISA: Duplicate/replayed/out-of-order callback and client race | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-EASYPAISA-006 | EASYPAISA: Wrong amount/currency/reference fails without credit | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-EASYPAISA-007 | EASYPAISA: Late success and app termination/reopen | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-EASYPAISA-008 | EASYPAISA: Supported same-device/issuer authorization and return | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-EASYPAISA-009 | EASYPAISA: Once-only wallet top-up then applicable purpose integration | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-EASYPAISA-010 | EASYPAISA: Refund/partial refund only if officially supported | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-JAZZCASH-001 | JAZZCASH: Official auth/field/signing contract and enabled merchant capability | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-JAZZCASH-002 | JAZZCASH: Successful authorized sandbox payment with independent financial binding | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-JAZZCASH-003 | JAZZCASH: Customer rejection/failure and documented expiry | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-JAZZCASH-004 | JAZZCASH: Pending/unknown initiation with safe inquiry recovery | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-JAZZCASH-005 | JAZZCASH: Duplicate/replayed/out-of-order callback and client race | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-JAZZCASH-006 | JAZZCASH: Wrong amount/currency/reference fails without credit | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-JAZZCASH-007 | JAZZCASH: Late success and app termination/reopen | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-JAZZCASH-008 | JAZZCASH: Supported same-device/issuer authorization and return | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-JAZZCASH-009 | JAZZCASH: Once-only wallet top-up then applicable purpose integration | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-JAZZCASH-010 | JAZZCASH: Refund/partial refund only if officially supported | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-BANK-001 | BANK: Official auth/field/signing contract and enabled merchant capability | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-BANK-002 | BANK: Successful authorized sandbox payment with independent financial binding | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-BANK-003 | BANK: Customer rejection/failure and documented expiry | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-BANK-004 | BANK: Pending/unknown initiation with safe inquiry recovery | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-BANK-005 | BANK: Duplicate/replayed/out-of-order callback and client race | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-BANK-006 | BANK: Wrong amount/currency/reference fails without credit | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-BANK-007 | BANK: Late success and app termination/reopen | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-BANK-008 | BANK: Supported same-device/issuer authorization and return | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-BANK-009 | BANK: Once-only wallet top-up then applicable purpose integration | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |
| METHOD-BANK-010 | BANK: Refund/partial refund only if officially supported | Verified receipt/application or conservative non-success; exact provider scenario required | BLOCKED | Obtain method contract/entitlement/scenario and explicit test authorization | None; not run | ? |

## Usage baseline and thresholds

Capture pinned commit/dataset/deployment and before/after: idle payment calls, one journey, concurrent journeys, database I/O, compute, function calls, bytes, external provider requests, scheduler pending/due/duplicate/terminal counts and complete cursor history traversal. Existing `scripts/convex-qa-usage-snapshot.mjs` has a fixed historical QA target and 15,000-call tripwire; don't run/rebind it silently or treat threshold as migration capacity evidence. Establish approved isolated binding, measured baseline and provider-specific SLA first. Any duplicate credit/balance/environment anomaly is immediate critical; backlog thresholds follow confirmed provider expiry/reconciliation policy; no invented numerical performance promises.

## Native and production evidence boundaries

Expo Go can support component work, not complete stable app-link/custom-native SDK proof. Device cases require Android and iOS builds/devices, officially supported bank/wallet mechanisms and no production credentials. Actual sandbox and production results are separate inventories. Production restricted smoke IDs will be added under M09 only after explicit scope approval; this document authorizes none.

## Pending-test record extension

When adding a test, retain stable ID; record related PAY/SF/milestone, layer/environment, owner, prerequisite, expected balance/ledger/domain result, status, actual command/result, commit, sanitized artifact, reviewer, remaining blocker and retest trigger. Unsupported provider scenarios remain BLOCKED or gain a recorded approved scope exclusion; never silently convert missing capability to a passing mock. No task is complete on written code alone.
