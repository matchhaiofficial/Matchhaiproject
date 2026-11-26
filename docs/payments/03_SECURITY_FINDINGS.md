# Financial security findings and threat model

Baseline: `ed173e603ed6a9cca9a7a9b934411821bc78f589`. Findings are static source observations, not live exploit execution or proven production loss. **No fixes or security tests have been executed.** Prioritize Milestone 01 before PayFast activation. Full caller map: [02_DEPENDENCY_INVENTORY.md](02_DEPENDENCY_INVENTORY.md). Target controls: [05_ARCHITECTURE.md](05_ARCHITECTURE.md). Test IDs: [07_TEST_INVENTORY.md](07_TEST_INVENTORY.md).

## SF-01 — Caller-selected ledger reference and incomplete idempotency identity

- **Priority:** P0. **State:** NOT_STARTED. **Tasks:** PAY-005, PAY-018.
- **Evidence:** `convex/wallet.ts:843–917`: public `deductFunds` accepts arbitrary reference/source/metadata and calls `deductWalletFunds`. At 869–875 a global `by_reference` hit returns success without matching owner/amount/type. `addFunds:555–611`, `holdFunds:614–668`, `releaseHeldFunds:670–730`, `captureHeldFunds:732–789`, `refundFunds:791–841` similarly use reference-only dedupe.
- **Path/impact:** an authenticated funded actor can write a caller-chosen reference through a public debit. A later legitimate operation with that reference can be suppressed as already applied, despite different user/type/value. Ownership of the debit does not secure the global idempotency namespace. Exact reachable exploit outcomes need behavioral validation; this is not a claim of observed loss.
- **Existing defense:** public debit resolves authenticated user; internal credit is internal-only; balances are checked. These do not establish complete idempotency identity.
- **Remediation:** use purpose-specific public commands and server-issued domain references; internal helpers compare full immutable operation identity; reference collision fails/quarantines; preserve old trusted references. Trace old clients before removing public API; retain a safe compatibility wrapper where necessary.
- **Acceptance:** cross-user/type/amount collision cannot suppress a deposit/hold/refund; exact retry is a no-op; concurrent callbacks produce one correct entry. Tests FIN-001–006, SEC-001–003.

## SF-02 — Withdrawal KYC check is above the enforcement point

- **Priority:** P0. **State:** NOT_STARTED. **Tasks:** PAY-005, PAY-015, PAY-018.
- **Evidence:** `convex/zoneWithdrawals.ts:60–119` action calls `requireKycVerified` and `assertKycFullyVerified`; public `convex/wallet.ts:349–547` mutation uses `requireSelf`, zone ownership/branch and balance checks but lacks equivalent full KYC enforcement.
- **Impact:** direct mutation invocation can bypass the action's stricter KYC policy. Preserve existing policy, do not invent a new eligibility rule.
- **Remediation:** enforce full applicable KYC/suspension/ownership checks at reservation mutation; use authenticated canonical actor and shared policy. Do not rely on UI/service wrappers.
- **Acceptance:** unverified/suspended/nonowner requests fail through both entrypoints with zero reservation/write; verified owner behavior and rejection return unchanged. Tests SEC-004, WD-001–004.

## SF-03 — Public walk-in source reference acts as funding authority

- **Priority:** P0. **State:** NOT_STARTED. **Tasks:** PAY-005, PAY-011, PAY-018.
- **Evidence:** public walk-in validator includes `sourcePaymentOrderRefNum` at `convex/zoneAdminBooking.ts:3412`; helper at 3434 accepts it; lines 3574–3589 skip paid Matchhai wallet debit when the reference is nonempty; public `createWalkInMatchroom:3624` uses that validator. Internal `finalizePaidWalkInCreateFromProvider:3635` legitimately needs trusted funding context.
- **Impact:** an authorized zone owner can assert provider-funded context without a verified receipt. Ownership/KYC does not prove payment. Potential unpaid creation/downstream earnings require focused behavioral validation; no real transaction was run.
- **Remediation:** remove/reject privileged funding fields from public input, or ignore them and require ordinary wallet funding. Internal provider finalization receives a verified receipt, validates owner/purpose/amount and records once-only linkage. Distinguish free, venue-pay and guest-pay modes under existing rules.
- **Acceptance:** forged/reused/unrelated source refs cannot bypass a charge; legitimate internally verified walk-in creates/debits once; free/venue-pay unaffected. Tests WALK-001–004.

## SF-04 — Expected financial fields substituted for provider evidence

- **Priority:** P0 verification. **State:** NOT_STARTED. **Tasks:** PAY-008, PAY-018.
- **Evidence:** Easypaisa finalize `convex/easypaisa.ts:3437–3438` and IPN `3611–3612` populate snapshot order/amount from local session/row. `getProviderAmount:947` prioritizes explicit snapshot amount. `applyProviderUpdate:2549–2551` compares only supplied values.
- **Existing defense:** both handlers inquire server-to-server rather than accepting inbound success. This is valuable and must remain.
- **Risk:** assigning expected values cannot independently verify the provider's amount/reference; equality can be tautological. New PayFast implementation must not reproduce it.
- **Remediation:** parse official authoritative response facts only, preserve provenance, and require complete receipt binding. Missing facts stay pending/manual review; do not fill from requests.
- **Acceptance:** missing or incorrect provider financial facts never produce irreversible credit; expected amount is visibly separate from evidence. Tests VER-001–006.

## SF-05 — Missing fields, currency and provider receipt uniqueness

- **Priority:** P0. **State:** NOT_STARTED. **Tasks:** PAY-004, PAY-008, PAY-018.
- **Evidence:** `convex/easypaisa.ts:905–954` recursive amount/reference extraction and tolerance; `applyProviderUpdate:2549` rejects mismatches only when fields exist. That enforcement block does not require authenticated currency or globally unique provider receipt identity. Historical fallback may use local order reference.
- **Remediation:** explicit versioned parsers; require merchant/environment/Basket ID/receipt ID/amount/currency/final status; unique receipt application scoped to actual provider uniqueness contract. Preserve historical unknowns, never backfill fake verification.
- **Acceptance:** unsigned amount/currency/identity cannot become verified; receipt reuse across attempts fails; distinct genuine payments remain separate liabilities. Tests VER-001–009, FIN-006.

## SF-06 — Hold and refund primitives lack original-operation validation

- **Priority:** P0. **State:** NOT_STARTED. **Tasks:** PAY-005, PAY-014, PAY-018.
- **Evidence:** `wallet.ts:670–789` checks aggregate held balance and records `originalHoldReference` but does not independently validate source hold ownership/value/remainder there. Refund helpers use reference-only dedupe. Domain guards mitigate some normal flows but are not a reusable financial invariant.
- **Remediation:** validate source hold and remaining capture/release, operation identity, ownership and amount atomically; enforce refundable remainder including concurrent pending refunds. Distinguish release from refund.
- **Acceptance:** no overcapture/overrelease, cross-user source or double return; holds cannot consume unrelated held funds. Tests FIN-003–008, REF-001–007.

## SF-07 — Incomplete numeric validation

- **Priority:** P0. **State:** NOT_STARTED. **Tasks:** PAY-005, PAY-004, PAY-018.
- **Evidence:** monetary functions accept `v.number()` with several `amount <= 0` checks; that is not a complete finite/precision/range policy. `amountsMatch:953` uses float difference, while create/challenge paths have existing whole-rupee rounding.
- **Remediation:** checked finite positive safe minor-unit comparison for new payments; preserve approved domain rounding and historical numeric records. Audit/flag incompatible historic precision, never silently adjust balances.
- **Acceptance:** NaN/infinities/negative/zero/unsafe range/unsupported decimals fail at writes; valid rounding stays unchanged. Tests FIN-009–011, MIG-001–005.

## SF-08 — Raw or overly broad public projections

- **Priority:** P0 for tokens/payloads; P1 legacy cleanup. **State:** NOT_STARTED. **Tasks:** PAY-003, PAY-016, PAY-018.
- **Evidence:** `easypaisa.listMyTransactions:2350` returns full rows, including optional internal fields. `getCheckoutStatus:2363` is safer but returns provider description/reference. Legacy `admin.listEasypaisaTransactions:1323` remains privileged but broad. Owner authentication does not justify exposing internal tokens.
- **Remediation:** explicit safe DTOs; redact raw payload/auth/access/instrument secrets; preserve useful customer/support references. Keep privileged diagnostic evidence access audited and minimized.
- **Acceptance:** owner/admin history responses satisfy allowlists; no secrets in bundles/errors/logs/analytics/support. Tests SEC-005–008.

## SF-09 — Gateway/domain context and public external reference coupling

- **Priority:** P0 migration. **State:** NOT_STARTED. **Tasks:** PAY-003, PAY-005, PAY-010, PAY-011.
- **Evidence:** `easypaisa.ts:1051–1053,1385–1387,1541–1546,1748–1750` carries broad create/hold context in `providerPayload`. `matchrooms.payMatchroomSeatIntent:6597` publicly accepts an external reference; hold still checks wallet balance, so this alone is not proof of free funds, but provider labeling is client-influenced.
- **Remediation:** typed domain intents, server quote and internal verified receipt linkage; remove public provider authority. `matchroom_create` wallet callback in shared hook is passed to another submit function; trace that consumer before labeling it active or deleting it. Main public create already charges atomically at `matchrooms.ts:4323`.
- **Acceptance:** no client metadata can mark paid/choose provider authority or alter immutable purpose. Tests SEC-009, BOOK-001–008, CHAL-001–006.

## SF-10 — Inquiry amplification and scheduler policy

- **Priority:** P0 resource safety. **State:** NOT_STARTED. **Tasks:** PAY-019, PAY-008.
- **Evidence:** wallet `743` and booking status `96` inquire every five seconds; shared creation hook `1180` and challenge `502` use two seconds. Public `syncTransactionStatus:2124` inquires without scheduled worker's shared claim. Scheduled worker has a six-retry cap; due-time constants are ten minutes/30 minutes/seven days, and cron is optional every 15 minutes.
- **Remediation:** shared server throttle/claim across all entrypoints, focused reactive state, bounded jobs and explicit exhaustion. Do not transplant Easypaisa timings to PayFast.
- **Acceptance:** duplicate refreshes/callbacks cannot amplify provider calls; no idle traffic; terminal retries stop. Tests PERF-001–007, LIFE-001–012.

## SF-11 — Growing reads and incomplete pagination

- **Priority:** P0 where financial completion can fail; P1 reporting. **State:** NOT_STARTED. **Tasks:** PAY-019, PAY-016.
- **Evidence:** `admin.ts:854–856` growing financial collections; `zoneWallet.ts:192` lifetime ledger collect; `matchrooms.ts:6541` user notification collect during confirmation; legacy challenge refund `teamChallenges.ts:383`; wallet page `300` merges fixed recent windows; admin page `1715` rescans offset windows capped at 1000 and filters Easypaisa.
- **Remediation:** appropriate indexed cursor traversal/bounded joins/aggregates. Maintain exact financial totals and full traversable history; truncation is not correctness. Existing conflict helpers are bounded too; do not interpret a truncated set as proof of no reservation conflict.
- **Acceptance:** large histories remain complete/pageable; financial operations fit limits; cost follows page/unresolved work. Tests PERF-004–008.

## SF-12 — Settlement/payout labels exceed evidence

- **Priority:** P0 financial interpretation. **State:** NOT_STARTED. **Tasks:** PAY-014–016.
- **Evidence:** `matchrooms.ts:1565` sets internal merchant capture; `1595` credits venue wallet after service/result/clearing. `admin.approveZoneWithdrawal:2690` marks wallet withdrawal completed without bank-transfer confirmation in that command.
- **Remediation:** separate internal allocation, bank settlement and actual payout evidence; preserve legacy meanings and commercial eligibility. Do not automatically restrict withdrawals to settled funds without founder approval.
- **Acceptance:** screens/reports never claim provider bank settlement or bank payout from internal markers alone. Tests SET-001–006, WD-004.

## SF-13 — Financial retention and destructive tools

- **Priority:** P0. **State:** NOT_STARTED. **Tasks:** PAY-004, PAY-018, PAY-022.
- **Evidence:** financial tables in `devReset.ts:20`, `devCleanup.ts:36`, `fullDataReset.ts:45`, `protectedDataReset.ts:59`; protected reset `376` supports explicit prod target behind flags/token. Existing account deletion `167` blocks financial work and anonymizes identity rather than deleting ledger records.
- **Remediation:** production financial history/obligations must not be erased by reset authorization; isolated synthetic QA only. Extend account deletion for new pending/refund/dispute states and required retention. Actual identity retention/legal scope needs review.
- **Acceptance:** production financial table reset is refused; new unresolved obligations block unsafe deletion; historical balances/records preserved. Tests MIG-005–007, SEC-010.

## SF-14 — Callback parsing, return trust and fetch boundary

- **Priority:** P0 boundary review. **State:** NOT_STARTED. **Tasks:** PAY-008, PAY-018.
- **Evidence:** hosted finalize/IPN in `easypaisa.ts:3390,3541`; IPN URL validates HTTPS/initial hostname at `753`, then fetches at `3560`. This initial-host check alone does not prove redirect destinations remain allowlisted. Provider messages/payloads can enter diagnostic storage/error responses. Callback auth for PayFast direct methods remains undocumented.
- **Remediation:** bounded body/depth/field validation, official authentication, replay/deduplication, allowlisted fetch destinations/redirect policy, constant-time hash comparison where applicable, safe ack/error mapping. URL/return never drives paid state. Do not invent a PayFast signature or assume IP allowlisting is sufficient proof.
- **Acceptance:** malicious callback/redirect/return cannot change finances or expose secrets; outages remain recoverable. Tests CB-001–010.

## Threat model

Assets: available/held balances, immutable ledger, verified receipts, booking capacity, captain-side holds, zone earnings/withdrawals, credentials, identity evidence, audit and settlement records. Actors: authenticated or malicious customer, captain, zone owner, Super Admin, unauthenticated callback sender, provider/issuer, operator and scheduled worker.

| Boundary | Threat | Control / evidence needed |
| --- | --- | --- |
| Native client → payment API | Amount/purpose/owner/method tampering | Authenticated actor, quote, capability and typed purpose |
| Public command → ledger | Reference poisoning, arbitrary financial authority | Domain-issued references, full operation identity; SF-01/03 |
| Action → mutation | Wrapper-only KYC/auth | Enforce at actual money write; SF-02 |
| Internet → HTTP handler | Forgery, replay, malformed/oversized body, amplification | Official auth, bounded parsing, rate/claim controls |
| Provider response → verification | Missing/unsigned fields treated as evidence | Complete receipt binding; no expected-value substitution |
| Concurrent jobs/callbacks → application | Double credit/fulfillment/refund/booking | Atomic indexed claims and once-only receipt/operation |
| Admin → correction/refund/payout | Privilege misuse, fabricated paid state | Existing role/session gate, evidence, audit, proposed separate approval |
| Scheduler → provider | Duplicate jobs, infinite retry, terminal churn | Job identity, lease, bounded provider policy, exhaustion queue |
| Deletion/reset → evidence | Loss of liabilities/history | Retention, legal holds, environment guard and immutable finance |
| Logs/support/analytics → external systems | Secrets/OTP/account data leakage | Allowlisted redacted events and safe projections |
| Code/config rollback → database | Old code rejects new rows or replays charges | Expand-compatible deployment, kill switch, no destructive rollback |

Protected controls worth preserving: internal-only wallet credit; centralized authenticated ownership; provider inquiry on legacy callbacks; active-attempt pointers; deterministic references; scheduled retry cap; captain/lineup checks; capacity/participant guards; account-deletion preflight; admin audits; existing maintenance flags. Strengthen their enforcement rather than deleting correct financial logic.
