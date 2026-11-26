# Production readiness, rollout and rollback

Milestone 08 establishes readiness and final legacy retirement; **Milestone 09 requires separate production authorization**. No production action is authorized by these documents. [Retirement obligations](09_EASYPAISA_RETIREMENT.md) constrain every rollout/rollback. [Decision log](08_DECISION_LOG.md) controls policy exceptions.

## Production release blockers

1. Written merchant operational approval and explicit direct-method entitlements, not commercial disclosure alone.
2. Complete official versioned contract, approved endpoints/auth/signing and authoritative financial verification.
3. P0 security findings fixed and behaviorally verified; no unresolved financial integrity regressions.
4. Selected-method sandbox/UAT/native/concurrency evidence, provider acceptance and pending-test review.
5. Existing published Android/iOS and backend compatibility inventory; old public calls have safe retained behavior.
6. New optional schema/index migrations verified against historical rows; unchanged balances/records and no fake verification backfill.
7. Outstanding Easypaisa payments/refunds/disputes/late callbacks resolved or explicitly serviced; final retirement gates met before removal.
8. Refund/dispute/reconciliation operators and evidence handling, including spent/allocated-fund recovery decisions.
9. Signed commercial settlement/fee/tax terms and working-capital assessment; no unapproved payout/surcharge changes.
10. Provider/legal/store classification of physical services versus digital/entry-fee/prize/wallet categories and website coordination.
11. Environment-bound callbacks and credential rotation/incident procedure; no QA-to-live confusion.
12. Usage baseline, alert thresholds, kill switches, rollback rehearsal and owner sign-off.
13. Explicit founder approval for production configuration, deployment and restricted real-money smoke cases.

Missing method-specific documentation blocks that method, not safe core work. Failed integrity tests block progression that depends on the broken invariant. Exclusions cannot silently waive P0 financial/security gates.

## Compatibility and deployment order

1. Recheck branch, reviewed SHA, clean tree and approved diff. Inventory actual deployed backend/app versions and financial obligations through separately authorized safe operations; do not assume source HEAD equals production.
2. Approved backup/snapshot and recovery rehearsal with preserved IDs; no destructive import/reset. Capture schema/config versions and safe financial totals.
3. Deploy additive schema/indexes and dual-format readers with PayFast disabled; legacy callers still work safely.
4. Deploy financial enforcement fixes and independent legacy initiation/reconciliation controls. Verify accepted financial work is not cut off by a global disabled flag.
5. Run approved bounded/resumable backfills, audit counts/amounts/links; leave unknown evidence unknown. No required-field tightening before compatibility proof.
6. Deploy neutral service/approved adapters, disabled. Register official callback URLs/allowlisting and securely configure production secrets under separate authorization.
7. Release compatible Android/iOS clients in approved sequence; preserve auth sessions, identifiers/signing/EAS ownership. No Android-only assumption.
8. Confirm merchant/method/provider UAT acceptance and release decision. Unsupported methods remain hidden and unavailable server-side.
9. Execute separately approved restricted production smoke cases, with explicit amount/account/operator/recovery/evidence scope. No general live testing permission is inferred.
10. Activate one approved method/cohort behind server control. Reconcile each early receipt, internal application and bank settlement before expansion.
11. Monitor errors/latency/mismatches, financial deltas, scheduler/backlog, request rate and resource use; expand only on reviewed evidence.
12. Complete final Easypaisa removal only at Milestone 08 acceptance boundary, preserving historical readers/obligations. If obligations remain, report retirement BLOCKED rather than claim complete.

Milestone 08 may prepare the above sequence and verify isolated rehearsals; production commands belong exclusively to separately authorized Milestone 09. Any required production compatibility preparation before final retirement is a restricted release action requiring authorization, not a reason to bypass milestone gates. Keep readiness and actual activation evidence separate.

## Activation controls

Global PayFast initiation, environment/merchant configuration version and per-method capability controls are server-authoritative. Mock transport can never be production-enabled or selected by client input. An unavailable method fails safely before provider initiation and does not automatically redirect to hosted checkout or old Easypaisa. Existing wallet remains available where its domain eligibility allows.

Old clients must not receive incompatible mandatory fields or newly mixed responses they cannot render safely. Legacy status/history endpoints project safe compatible data, scoped to proper provider/owner. If old external-pay flow is retired, show a safe unavailable/update-required response; do not translate the call into another gateway silently.

## Rollback classes and triggers

| Class | Action |
| --- | --- |
| A | Revert compatible UI/additive code; retain financial records |
| B | Disable new behavior; keep expanded schema/readers and evidence |
| C | Stop new provider initiation; continue callbacks/inquiry/refund/reconciliation obligations |
| D | Correct finances through separately authorized audited compensating operations; never delete/reverse valid history by code rollback |

Immediate stop-initiation triggers: duplicate application, wrong amount/currency/merchant/environment, unexplained balance change, unauthorized financial mutation, secret exposure, unbounded provider calls/jobs or verification incompatibility. Isolate one method only if control separation is proven; otherwise stop PayFast initiation globally.

Circuit breaker also limits provider-outage amplification. It must not destroy already accepted requests or receipts. Existing legacy reconciliation flags remain separate.

## Rollback procedure

1. Preserve safe incident evidence and select the smallest trustworthy initiation kill switch.
2. Keep receipt intake, existing accepted-attempt recovery and refund/dispute operations active where safe.
3. Record impacted intents/attempts/receipts by immutable references; no blind resend after timeout.
4. Roll back client/adapter only to a revision able to read all already-written formats. Never restore a restrictive old schema over new rows.
5. Reconcile independently verified funds and domain outcomes before compensating actions. No automatic duplicate refund or deletion of valid deposit.
6. Do not automatically reactivate direct Easypaisa. Reintroduction, if ever needed, is a separate approved operational decision with credentials/compatibility review.
7. Fix/test/review in isolation; reopen only after integrity gates and authorized release decision.

## Monitoring and incident response

On-call responsibilities must be assigned before release: fintech owner handles receipt/ledger discrepancy; DevOps handles endpoint/credential/usage incident; operations handles provider/bank evidence and customer support; founder approves policy/financial exceptions. Alert immediately on duplicate receipt application, mismatch, unauthorized command or environment confusion. Backlog/expiry thresholds follow signed provider policy; cost tripwires follow measured baseline and traffic forecast. Do not invent provider SLA.

Credential compromise: disable affected initiation, restrict exposure, rotate through approved server configuration, preserve needed old callback verification/obligations, assess affected receipts and notify provider as applicable. Never publish secret values in incident evidence.

Rollback rehearsal uses synthetic data/isolated environments and demonstrates old/new readers, in-flight receipt recovery, no duplicate credit/refund, schema compatibility, job termination and historical retention. Application rollback is not financial recovery.
