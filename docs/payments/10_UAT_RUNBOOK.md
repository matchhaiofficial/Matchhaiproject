# Sandbox UAT runbook

**Not executed.** No transaction authorization is granted by this runbook. Obtain explicit authorization for actual sandbox transactions in the implementation workflow; real-money and production smoke transactions always require separate authorization. Mock outcomes must never be called successful PayFast tests.

Related: [provider contracts](04_PROVIDER_CONTRACTS.md), [test inventory](07_TEST_INVENTORY.md), [rollout](11_ROLLOUT_AND_ROLLBACK.md).

## Preconditions and stop conditions

- Pin reviewed commit/branch and completed P0 financial tests.
- Verify isolated migration QA identity, synthetic users/balances and server environment. Never reuse historically live-enabled remediation QA by assumption.
- No live Easypaisa or PayFast production credentials in QA. Defaults: mock transport, payments disabled, explicit sandbox-only allowlist. Enable only the approved sandbox method for the approved session.
- Securely configure actual secrets server-side; never print env lists/values or include them in evidence. No actual account/CNIC/OTP in repository or report.
- Confirm direct API bases, signing vectors, full verification binding and merchant entitlement. Confirm method-specific official test instruments. Issued merchant sandbox and Demo Bank alone do not prove direct/Raast/wallet access.
- Confirm callback registration, domain/IP allowlisting and provider retry/ack policy. Stop if these are unknown for the selected test.
- Confirm supported approval flow/device and amount/scenario. Do not invent sandbox failure or refund cases.
- Suspend affected test on amount/currency mismatch, missing authoritative evidence, duplicate ledger application, unexpected live endpoint, failed integrity checks or secret leakage. Preserve sanitized evidence; continue only independent safe work.

## First complete slice: wallet top-up

1. Verify QA deployment/environment and record only safe identity/config version/commit.
2. Query server capabilities and select one fully documented enabled noncard method.
3. Authenticate a synthetic customer; record starting available/held balances and relevant ledger counts.
4. Create a wallet-top-up intent with approved amount/currency; record safe internal intent ID and Basket ID.
5. Initiate exactly once; record attempt identity and provider response classification, never tokens/credentials.
6. Complete approved sandbox authorization using provider test details outside reports/source. No real bank/card information.
7. Receive callback or execute approved bounded inquiry; record event identity and source/version.
8. Verify independent merchant/environment/Basket/receipt/amount/currency/final-status binding. A valid hosted hash alone is insufficient.
9. Apply receipt once; verify one correct deposit and exact balance delta with unchanged held balance.
10. Redeliver/refresh through approved scenarios; prove no duplicate deposit. Distinct genuine payments need separate receipts, not swallowed dedupe.
11. Terminate/reopen app and confirm owned history/status recovery. Validate no client success parameter can credit funds.
12. Inspect scheduler/retries/provider call count and sanitized error/analytics projections.
13. Record result per test ID. Failures/blocked cases remain open; never erase them after code changes.

Only after the real sandbox top-up slice is verified extend to booking/create, challenge and walk-in workflows. Wallet mock success is not this gate.

## Per-method evidence

Maintain separate RTP, QR, Easypaisa, JazzCash and bank records. Include official scenario reference, merchant permission, bank/device/OS/build, success/rejection/pending/expiry where supported, callbacks/inquiry, duplicate/late handling, verified financial facts and exactly-once application. Same-device QR is separately accepted per supported bank mechanism. Refund/partial refund tests run only if contract and sandbox explicitly permit them.

Financial journey tests additionally prove: seat/capacity concurrency, host once-only create/debit, captain side/lineup/Team B rules, authorized walk-ins, cancellation/expiry, holds/captures/releases, internal refunds and wallet-credit-only fulfillment failure. Preserve existing payout/commission/pilot tests.

## Sanitized evidence template

```text
Test ID / scenario / method:
Status (approved tracker vocabulary):
Commit / branch / QA deployment identity / environment:
Provider source + version + official scenario:
Authorization reference for this test session:
Internal intent / Basket ID / provider transaction ID (safe references only):
Requested / independently verified amount and currency:
Callback authentication and verification evidence summary:
Before/after balance + ledger operation counts:
Fulfillment result / refund or settlement relation:
Retry and provider-call counts / scheduler outcome:
Android/iOS build and device:
Sanitized artifacts / reviewer / time:
Remaining failures / blockers / retest condition:
```

Never include access/instrument tokens, merchant secured key, personal/test bank details, CNIC, OTP, screenshots exposing identifiers, full raw payloads or provider session URLs.

## Test Order ID / onboarding submission

PF-08 instructs a successful test transaction and signup portal Test Order ID; whether this is Basket ID or provider transaction ID is unresolved. Preserve both safe references internally, obtain provider clarification and prepare the correct submission package. Sending/submitting evidence needs explicit authorization; do not submit from this documentation task. Record accepted native UAT evidence, callback registration and final provider approval.

If PayFast requires a hosted-only onboarding transaction, present a separate founder decision: scope is one onboarding test, no native architecture change and no production hosted fallback. Do not run it merely because hosted documentation is available.

## Exit criteria

Selected method contract and sandbox entitlement verified; all required tests passed or explicitly scoped exclusions approved; financial facts independently bound; replay/race/recovery proven; sanitized history/evidence complete; provider Test Order ID definition resolved; pending inventory retained; provider UAT acceptance recorded. Production remains separately gated.
