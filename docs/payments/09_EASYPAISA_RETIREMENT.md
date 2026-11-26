# Complete direct Easypaisa retirement — Milestone 08

Objective: remove the **direct Easypaisa merchant gateway**, including REST/hosted/OTC initiation, credentials, active routes and scheduled reconciliation after all obligations close. **Easypaisa as an instrument processed through PayFast remains permitted.** Historical provider identifiers, records, ledger references and old evidence remain intact.

Canonical per-file/line/function/caller evidence, including the complete identifier-search appendix: [02_DEPENDENCY_INVENTORY.md](02_DEPENDENCY_INVENTORY.md). That inventory is incorporated into this retirement specification; no dependency there may be silently dropped. Task PAY-017 spans earlier replacements and final M08 removal. Production execution remains separately authorized M09.

## 1. Phased dependency disposition

| Dependency | Earlier replacement | Temporary requirement | Final M08 disposition |
| --- | --- | --- | --- |
| `convex/easypaisa.ts` orchestration | M02 neutral service; M04 PayFast adapter; M05 purpose integration | Existing-attempt lookup/inquiry/application/late events | Remove module only after no legacy obligations/callers |
| `convex/easypaisaNode.ts` | M04 approved PayFast transport, never credential reuse | Legacy inquiry; hosted hashing only if issued sessions require | Remove after final reconciliation |
| `convex/easypaisaRest.ts`, `easypaisaConfig.ts` | M02/M04 independent configuration/parsers | Legacy inquiry URL/auth/sanitization/capability | Remove; retain historical evidence outside active adapter |
| `convex/http.ts` legacy registrations | M04 separate PayFast ingress | Already-issued callbacks/finalize/token as proven necessary | Remove old route registrations when drain/compatibility gates satisfied |
| `convex/crons.ts`, `maintenanceDue.ts`, `migrations.ts` | M02/M06 provider-neutral bounded recovery | Existing due/backfill/worker behavior for outstanding rows | Remove active legacy scheduling; retain historical migrations/records |
| `convex/schema.ts` | M02 widen/optional fields | Existing Easypaisa rows and old clients | Keep historical provider/status/field compatibility; no relabel/delete |
| `convex/wallet.ts` provider joins/references | M02/M05 neutral receipt/ledger linking | `easypaisa:<orderRef>` historic joins | Keep historical interpretation; remove active gateway-only assumptions |
| `matchrooms.ts`, `teamChallenges.ts`, `zoneAdminBooking.ts` | M01 trust hardening; M05 neutral purpose/receipt | Old funded create, booking, side hold and refunds | Remove active provider hardcoding, retain historical refund/reference interpretation |
| `convex/admin.ts`, zone finance/withdrawal | M06 provider-neutral operations | Legacy transaction investigation/refund cases | Remove obsolete legacy list only after callers known; preserve safe historical query |
| Wallet, pay/status/create, challenge-create/challenge screens | M03/M05 native neutral flow | Published client compatibility on backend | Remove provider phone/OTC/hosted controls/status logic from new client |
| Shared creation hook/payment styles | M03/M05 neutral hook/components | Proven recovery behavior | Remove obsolete provider-specific state, keep domain rules/design |
| Legacy client service wrappers | M02/M05 neutral services | Verify imports and deployed-client usage | Remove `src/services/convex/easypaisaService.ts` and obsolete team wrapper if unused |
| Super Admin route alias | M06 neutral payments screens | Existing links/notifications | Retain alias if harmless compatibility; remove only with proof |
| Readiness/errors/layout suppression/timing | M03 neutral capability/copy/timing | Historic statuses/errors where needed | Remove direct gateway producers; do not remove PayFast Easypaisa label |
| Support/analytics/notifications | M05/M06 neutral events/copy | Old event/reference interpretation | Remove active direct event producers; preserve historical search/redaction |
| Tests/fixtures/Maestro/load scripts | Every milestone | Legacy recovery tests while gateway remains | Remove obsolete active gateway tests only after replacement coverage; retain historical fixtures as needed |
| Env templates/build/release/support docs | M02 onward | Legacy secrets remain server-side only for obligations | Remove direct variables from approved environments/templates; retain documentary history |
| Zone profile bank choice | No gateway replacement needed | Legitimate bank/wallet destination label | Keep if still valid; name match alone is not obsolete integration |

## 2. Temporary reconciliation-only boundary

Disable **new** direct checkout at all public actions, HTTP checkout and low-level debit-capable transport entrypoints independently from existing inquiry. Existing global `EASYPAISA_ENABLED` gates availability for initiation/inquiry/callbacks; simply setting it false loses recovery. Introduce distinct internal controls for initiation and reconciliation during implementation (proposed names such as `EASYPAISA_INITIATION_ENABLED` and `EASYPAISA_RECONCILIATION_ENABLED` are not provider requirements).

Temporarily retain as needed:

- `getTransactionByOrderRef`, `getCheckoutStatus` and safe historical query projections.
- `performProviderInquiryAndApply`, `syncTransactionStatus`, `listStaleActivePaymentTransactions`, `claimPaymentForReconciliation`, `reconcilePaymentByOrderRef`, `reconcileStalePayments`.
- `applyProviderUpdate` or extracted legacy verification/application boundary for already-created Easypaisa rows, with strengthened financial invariants.
- `clearActivePaymentPointerIfMatching` and late-attempt safeguards; don't expire a replacement attempt's domain state.
- `getCheckoutSessionByToken`, `easypaisaFinalizeHandler`, `easypaisaIpnHandler` and only session-token handling required for previously issued flows. `markRedirected`/`registerProviderToken`/token handler are retained only with a documented issued-session need, not new hosted initiation.
- `easypaisaNode.inquireRestTransaction`, required transport/sanitization and approved credentials. Remove or hard-disable `initiateRestTransaction`/new hosted hashing when no new initiation is allowed.
- Pending-refund/dispute investigation and historical team/create refund compatibility.

Access: inquiry is authenticated owner/admin or internal worker; unauthenticated callback is merely an officially verified recovery trigger, never paid authority. Bound requests, deduplicate and preserve evidence. No manual generic wallet credit or financial success override.

## 3. Exact routes to remove after drain

Registered in `convex/http.ts:17–41`, path constants `easypaisa.ts:62–65`:

- GET `/payments/easypaisa/checkout`.
- GET `/payments/easypaisa/token`.
- GET and POST `/payments/easypaisa/finalize`.
- GET `/payments/easypaisa/ipn` (handler has additional parsing branches; route registration is the actual exposure).

Do not invent callback retention duration. Determine maximum late/retry/dispute windows from official legacy agreement/provider confirmation and actual unresolved inventory. If evidence is unavailable, retirement stays BLOCKED; do not choose an arbitrary date.

## 4. Exact scheduling cleanup

- `internal.easypaisa.reconcilePaymentByOrderRef` one-shot jobs created from checkout and retries.
- `internal.easypaisa.reconcileStalePayments` called by optional `stale payment reconciler` cron every 15 minutes under `MATCHHAI_ENABLE_PAYMENT_RECONCILER_CRON`.
- Due-state logic `getPaymentNextReconcileAt` / `withPaymentNextReconcileAt` currently uses legacy active statuses and ten-minute initial, 30-minute cooldown, seven-day maximum-age policy; preserve only where needed until drain.
- Enumerate actual scheduled function IDs, cancel obsolete/superseded legacy jobs after verified drain and prevent rescheduling. Safe terminal no-op is needed during deployment races; don't remove exports while scheduled jobs still need them.
- Do not delete unrelated lifecycle, pilot, zone booking or team expiry jobs. A shared payment-reconciler flag may remain for new provider work; remove only obsolete legacy use, not blindly the name.
- Keep historical `backfillPaymentNextReconcileAt` migration evidence; do not rerun it indefinitely or delete old payment rows.

## 5. Direct gateway variables to remove

Confirmed code/template identifiers, never values:

```text
EASYPAISA_ENABLED
EASYPAISA_ENV
EASYPAISA_STORE_ID
EASYPAISA_HASH_KEY
EASYPAISA_API_USERNAME
EASYPAISA_API_PASSWORD
EASYPAISA_ACCOUNT_NUM
EASYPAISA_DEFAULT_FLOW
EASYPAISA_HOSTED_FALLBACK_ENABLED
EASYPAISA_INDEX_URL
EASYPAISA_CONFIRM_URL
EASYPAISA_PAYMENT_METHOD
EASYPAISA_IPN_ALLOWED_HOSTS
EASYPAISA_REST_BASE_URL
EASYPAISA_REQUEST_TIMEOUT_MS
```

Also remove temporary migration-only legacy controls once retired. Server secret removal/rotation is an approved environment operation, never part of this documentation phase. Do not remove shared `CONVEX_SITE_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`, app scheme, auth, generic payment recovery or unrelated environment variables merely because legacy code used them.

## 6. Historical and client compatibility

Never delete successful/failed/expired/cancelled/pending legacy payments or wallet entries; never relabel old provider to PayFast. Preserve order reference/provider receipt/reference joins, refund/reversal/dispute evidence and required retention. Unknown historical verification remains unknown.

Inventory deployed Android/iOS versions and backend calls before removing APIs. Existing versions may call `api.easypaisa.startCheckout`, `getCapability`, `getCheckoutStatus`, `syncTransactionStatus`. Retained initiation wrapper safely reports unavailable/update required; never silently starts PayFast. Existing wallet/domain APIs remain usable where compatible. Old notification/deep-link routes and admin alias must resolve safely.

A legacy read/disabled stub may remain temporarily for published clients, but it is not active direct gateway processing. Final removal of compatibility exports requires version evidence and approved release policy. Report precisely whether gateway transport/credentials are gone while harmless historic route aliases remain; do not falsely claim all string references are gone.

## 7. Outstanding obligation checklist and final acceptance

For each unresolved legacy attempt record safe identity, amount/currency, current authoritative outcome, wallet/hold/booking linkage, refund/dispute/settlement liability, owner/operator and next action. Include late success after failure/expiry/retry, duplicate real payments and paid-but-unfulfilled funds. No real provider query or record modification is authorized in this documentation task.

M08 retirement is complete only with evidence that:

1. No new direct initiation is possible through any public/internal/HTTP/old-client path.
2. All accepted/pending/late-payable attempts and refunds/disputes are resolved or supported by an explicitly approved surviving operational obligation; remaining gateway-dependent obligations prevent final removal.
3. Callback/inquiry windows and deployed-client compatibility are verified, not assumed.
4. No scheduled gateway calls, active transport, hosted/OTC UI or credentials remain where retired.
5. Financial records/balances, historic display/refund relationships and retention remain valid.
6. Repository-wide identifier/caller/dead-code review classifies all remaining Easypaisa references as history, safe compatibility or PayFast instrument.
7. Replacement tests, native old/new-client recovery, security and usage evidence pass; pending blockers are explicit.
8. Operations and founder review confirm retirement evidence. Production actions still require M09 authorization.

If removal cannot safely complete, leave PAY-017/M08 BLOCKED with exact dependency and retirement condition; continue independent readiness work. Never erase an obligation to satisfy a milestone label.
