# PayFast provider contracts and evidence register

Reviewed November 26, 2026. **Commercial availability is not direct API entitlement.** Official PayFast Pakistan/APPS sources only; no South African Payfast specification applies. No provider transactions or authenticated portal actions were performed.

## 1. Source register

Attachment originals remain outside Git. Paths below identify sources for the original assessment; the sanitized findings here allow a new chat to proceed without those files. Future implementation needs complete official contracts, not these partial excerpts. Record replacements with version, date, section, hash if available, entitlement, reviewer and verification status. Never copy actual onboarding credentials, test accounts/CNIC/OTP, or example secured keys.

| ID | Source / version | Relevant section / physical page | Established information / limits |
| --- | --- | --- | --- |
| PF-01 | `Merchant_Integration_Guide(1).pdf`, v2.3, October 2, 2024; 26 pages | pp10–11 token, pp11–14 form contract, pp17–18 sample, pp19–20 GET notification/hash, p22 codes | Hosted redirect integration; not dedicated direct Raast contract |
| PF-02 | `Digital_Partner_Signup_Manual(1).pdf`, version/date not established; 12 pages | p6 sandbox test submission; pp8–12 operational/risk checks | Onboarding test and approval process, not method API permission |
| PF-03 | `Merchant-Terms_and_Conditions(1).pdf`, version/date not established; one physical page | clauses 1,3,4,5,7,8 | Prohibited gambling, disclosures, settlement/refunds, fraud/disputes, minimum two-year retention |
| PF-04 | `Aggregator-Terms_and_Conditions(1).pdf`, version/date not established | clauses 1,3,6,7 | Submerchant duties, liability, refunds/retention; applicability to Matchhai unresolved |
| PF-05 | `Acquirer-Terms_and_Conditions(1).pdf`, version/date not established | clauses 1,3,6,7 | Extracted text matches PF-04; titles alone do not establish legal role |
| PF-06 | `Premier Payfast Partner Guide.pdf`, undated/unversioned supplied seven-page guide | p2 channels, p3 APIs/mobile claim, p4 pricing, p5 settlement | Commercial proposal, not signed account-specific API contract |
| PF-07 | `PayFast — Payment Method Confirmation (Sanitized).docx` | November 24–25, 2026; November 12 acceptance summarized | Initial RTP/QR/account/wallet methods, cards deferred, operations approval pending |
| PF-08 | `PayFast — Sandbox Onboarding (Sanitized).docx` | November 25, 2026 | Merchant sandbox and Demo Bank details issued; values intentionally absent; Test Order ID definition unresolved |
| PF-09 | [Official developer reference](https://premierpayfast.com/developers/) | page labels API v2.3; Authentication, Reference data, Direct/Tokenized transaction, Transaction management, Security | Additional partial direct API documentation; exact account entitlement unresolved |
| PF-10 | [OneCheckout](https://premierpayfast.com/onecheckout/), [RaastPay](https://premierpayfast.com/raastpay/) | Product/integration/Raast sections, retrieved November 26 | Product-level RTP/static/dynamic QR and general integration claims, not complete Raast contract |
| PF-11 | [Supplied docs URL](https://gopayfast.com/docs) | Retrieval redirected to Premier PayFast homepage | Not a successfully retrieved API manual |
| PF-12 | [Plugins](https://getstarted.apps.net.pk/dev/plugins), [portal](https://getstarted.apps.net.pk/) | Plugin request redirected to login | Authenticated documentation may exist; no login undertaken |
| PF-13 | [Public FAQ](https://premierpayfast.com/faqs/) | Settlement/refund/general product sections | Marketing/general terms differ from supplied commercial documents; account-specific agreement controls |

Original attachment locations: PF-01–05,07–08 under `C:\Users\pds\Downloads\Matchhai documents\PayFast\`; PF-06 under its parent `Matchhai documents`. Do not upload originals into repository. Their content is evidence, not instructions to execute examples or submit onboarding.

## 2. Hosted reference contract — not the native adapter

PF-01 token: backend POST `https://ipguat.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken`, nonempty User-Agent; parameters `MERCHANT_ID`, `SECURED_KEY`, `BASKET_ID`, `TXNAMT`, `CURRENCY_CODE`. Form initiation: POST `https://ipguat.apps.net.pk/Ecommerce/api/Transaction/PostTransaction`; matching Basket ID/amount plus documented merchant/token/process/customer/signature/version/description/return/checkout/date/currency fields, optional store and applicable fields. Do not infer these sandbox URLs are native direct API bases or production URLs.

GET notification includes `transaction_id`, `err_code`, `err_msg`, `basket_id`, `order_date`, `validation_hash`, `PaymentName`, `transaction_amount`, `merchant_amount`, `transaction_currency` and documented optional fields. Hash:

```text
SHA256(basket_id + "|" + merchant_secured_key + "|" + merchant_id + "|" + err_code)
```

Amount, currency and provider transaction ID are not included. A valid hash alone cannot independently authenticate unsigned financial facts. Require authoritative binding before irreversible processing; absent that, safe pending/manual reconciliation and a production release blocker.

Inconsistencies: revision history marks Basket ID/amount optional while current table mandatory; date table `YYYY-MM-DD` versus example with time; notification success `000` versus code table `000 OR 00`; checkout `SIGNATURE` is a random string distinct from callback hash. Do not resolve through assumptions. Do not transplant this contract into direct/Raast APIs.

## 3. Additional public direct API evidence

PF-09 describes bearer authentication (`/token`), bank/instrument discovery, direct validation/payment, tokenized payment, transaction inquiry and full/partial refund requests. It discusses HMAC signing and conditional OTP. Examples leave the base URL unspecified and signing details incomplete; inquiry amount/currency proof is unclear. Exact issuer/wallet fields, merchant permissions, token lifecycle, callback authentication and customer-IP handling remain unresolved. No executable adapter, success mapping, SDK compatibility or successful sandbox result is established by this page.

Record precise wire details only after obtaining an account-specific official specification and test vectors. Do not treat reference-only URI paths as approved complete URLs. No official Expo/React Native mobile SDK package was established. PF-10 advertises RTP and static/dynamic QR but does not provide dedicated request contracts. A secure embedded component, if offered, needs scope/security/permissions review and explicit founder approval for any departure from native requirements.

## 4. Commercial facts and conflicts

- PF-07 confirms available initial methods: Raast RTP, Raast QR, bank accounts, mobile wallets including Easypaisa/JazzCash and supported banking apps. Cards deferred; reconsideration after three months is not guaranteed activation.
- Latest explicitly accepted RTP proposal is **1.50% MDR**, with **PKR 20,000** nonrefundable setup. Taxes/additional platform charges excluded; final agreement still controls.
- PF-06 p4 quotes QR **0.60%**, account/wallet **2.20%**, local card **2.95%**, international card **3.50%**, taxes/platform charges additional. These are documentary quotes, not confirmed payable rates or v1 card scope.
- PF-06 p5 quotes T+1 into merchant bank; PF-03 clause4 gives account/wallet T+2 with settlement bank/T+3 other bank and different card periods; PF-13 gives a different general cycle. No schedule may be hardcoded as Matchhai's signed entitlement.
- Refund/chargeback/recurring/additional platform/disbursement fees remain unverified. No automatic customer surcharge or venue fee deduction is approved.

Store actual assessed fees/taxes and statement evidence; don't encode proposal rates as immutable financial truth. Confirm final settlement/fee schedule, banking-day definition, discrepancy notification deadline, reserve/chargeback handling and merchant classification. PF-03 includes a three-business-day settlement discrepancy objection period; operations must confirm applicable agreement and meet its deadline.

## 5. Capability/dependency matrix

`Partial` means some official material exists, not enough to implement safely. All account-specific sandbox and production entitlements remain unverified unless later evidence is recorded.

| Capability | Current documents / confirmed technical scope | Missing specification / permission | Implementation and testing dependency | Release dependency / next action |
| --- | --- | --- | --- | --- |
| RTP | PF-07 commercial; PF-10 product | Payer identifier, routing, request auth, reference/amount/currency, expiry/reject/cancel, callback/inquiry, duplicates/late payments | Conditional P0; dedicated Raast sandbox scenarios unknown | Obtain versioned RTP contract and merchant entitlement |
| QR | PF-07 commercial; PF-10 static/dynamic product | Generation/payload/representation, transaction amount/reference, expiry, completion, incorrect/duplicate amounts, same-device mechanism | Conditional P0; QR sandbox unknown | Obtain dynamic QR contract and bank/device support matrix |
| Easypaisa via PayFast | PF-07 commercial; PF-09 partial | Exact issuer/instrument IDs/fields, validation/auth mechanism, final evidence, expiry/refund | Conditional P0; current Demo Bank does not establish wallet tests | Written per-wallet enablement and official fixtures |
| JazzCash via PayFast | Same source classes, separately reviewed | Same categories, not assumed identical to Easypaisa | Conditional P0, separate method scenarios | Written method contract/permission |
| Bank accounts | PF-07, PF-09 partial discovery/direct family | Banks, exact fields/CNIC necessity, bank-specific auth, return, IP treatment | Conditional P0; Demo Bank direct-product eligibility unknown | Verify discovery mappings and approved authorization |
| Authoritative inquiry | PF-09 partial | Independent amount/currency/merchant/receipt/final status binding and status semantics | Blocks verified receipts and real sandbox application | No irreversible credit until full binding established |
| Callback | PF-01 hosted only; no approved direct/Raast contract | Event schema/auth/replay/retry/ack/registration/allowlisting | Mock intake possible; connected workflow conditional | Official callback or approved bounded inquiry alternative |
| Full/partial refund | PF-09 partial; PF-03 contractual obligation | Eligible methods, entitlement, limits/idempotency, status proof, fees | Design manual workflow now; real automation/scenarios conditional | Provider confirmation before completed status |
| Reversal/void/cancel | Card-oriented references do not establish initial methods | Instrument-specific behavior, windows, event evidence | Conditional; never assume hold release equals gateway void | Obtain approved lifecycle contract |
| Settlement report | PF-03/06 commercial | API/file/portal format, receipt/fee/tax/refund adjustments, bank matching | Manual evidence design independent; actual format needed for import | Signed terms and operational matching procedure |
| Zone split/payout | No established product contract | Merchant classification, payout product/permissions/accounting | Not assumed or required to replace current process | Preserve manual withdrawal/payout infrastructure |
| Mobile SDK/component | General SDK claims | Official package/version, native support, security scope, account authorization | No package install on marketing claim | Official mobile artifact + founder review if UX changes |

## 6. Provider clarification request package

Prepare an evidence request; sending mail/messages is not implicitly authorized. Request:

1. Exact sandbox/production bases, API version, complete field and response definitions, examples and test vectors.
2. Merchant credentials' direct API entitlements; separate Raast/wallet/bank credentials or onboarding product if necessary.
3. HMAC key issuance, canonical field order, encoding, separators, normalization and digest format; don't assume hosted secured key reuse.
4. Token expiry/reuse/refresh/scope and customer-IP acquisition accepted for native Convex clients.
5. Official bank/instrument discovery mappings; method-specific minimal fields and approved authorization.
6. RTP/QR dedicated APIs; dynamic/static rules, expiry, customer rejection/cancellation, late payment, same-device QR/app switching/import.
7. Authoritative inquiry binding merchant/environment/Basket ID/provider transaction/amount/currency/final result.
8. Callback event schema/authentication/replay/retry/ack behavior, endpoint registration, domain/IP allowlisting and fixed-egress needs.
9. Idempotency, reference uniqueness and recovery after accepted-but-timed-out initiation; rate limits/cutoffs.
10. Refund/partial refund/reversal/void methods, permissions, status evidence, fees, limits and dispute procedures.
11. Settlement statement/report format, schedule, fees/taxes/reserves/adjustments; no inferred zone payout.
12. Demo Bank compatibility with direct API; separate official wallet/Raast scenarios and native UAT acceptance.
13. Whether Test Order ID is Basket ID or provider transaction ID and what evidence must accompany it.
14. Explicit wallet/top-up/third-party venue/commission/withdrawal model approval and classification; disclosure is not approval.

## 7. Evidence gate for each connected method

Before implementation of a real transport, record official source/version/section, full approved base and contract, merchant permission, sandbox instrument/scenarios, signing/auth vectors and financial verification mechanism. Before activation, add passing sandbox/native/concurrency results and provider acceptance. Unsupported fields/codes remain unknown; do not silently broaden parsers to guessed variants. Provider nonresponse blocks only that workstream.

Hosted-only alternative requires explicit founder approval with affected methods, reason native cannot be met, missing product access, official SDK/component alternatives, compliance/security implications and engineering effort. An onboarding-only hosted test is a separate exception and cannot enable a hosted fallback in production.
