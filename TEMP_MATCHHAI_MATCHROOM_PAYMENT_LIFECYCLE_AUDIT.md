# MatchHai — Matchroom & Team Challenge Payment Lifecycle Audit

> **Status:** AUDIT COMPLETE — audit-only, no fixes implemented.
> **Branch:** `product-ready`
> **Date:** 2026-06-02
> **Method:** 7 read-only sub-agents (create / join / wallet / provider / zone payout / race-recovery / team challenge), each citing `file:line`.
>
> **Constraints honored:** No payment logic changed. No wallet money movement changed. No
> Easypaisa/IPN/finalize changes. No payout formula changes. No ELO/KYC changes. No deploy/build/push.
>
> **Headline:** The **solo/zone matchroom** payment flow is **largely launch-safe** — idempotency is
> layered and robust. Two systemic gaps must be fixed before launch: **(1)** holds are **not released
> when a player leaves** (wrongful capture), and **(2)** there is **no server-side reconciliation/cleanup
> of stuck pending payments** (money taken, never credited if the app is killed and IPN drops). The
> **Team Challenge** flow is **NOT launch-safe** — real money is collected but never escrowed, never
> paid to the venue, and payment status is client-asserted. See [Final Report](#phase-10).

---

## Table of Contents

1. [Files Inspected](#files)
2. [Phase 1 — Payment Architecture Map](#phase-1)
3. [Phase 2 — Matchroom Creation Payment Flow](#phase-2)
4. [Phase 3 — Matchroom Join Payment Flow](#phase-3)
5. [Phase 4 — Holds / Release / Refund / Capture](#phase-4)
6. [Phase 5 — Zone Payout & Zone Wallet Settlement](#phase-5)
7. [Phase 6 — Notifications Audit](#phase-6)
8. [Phase 7 — Security / Idempotency Audit](#phase-7)
9. [Phase 8 — Worst-Case Scenario Matrix (40+)](#phase-8)
10. [Phase 9 — Recommended Target Design](#phase-9)
11. [Team Challenge Payment Lifecycle](#team-challenge)
12. [Phase 10 — Final Report](#phase-10)

---

<a name="files"></a>
## Files Inspected

**Backend (Convex):** `schema.ts`, `wallet.ts`, `matchrooms.ts`, `bookings.ts`, `easypaisa.ts`,
`easypaisaRest.ts`, `easypaisaNode.ts`, `zoneAdminBooking.ts`, `zoneWithdrawals.ts`, `zoneWallet.ts`,
`zonePilot.ts`, `admin.ts`, `superAdminAccess.ts`, `notifications.ts`, `withdrawalNotifications.ts`,
`zoneAudit.ts`, `timing.ts`, `crons.ts`, `http.ts`, `teamChallenges.ts`, `teamChallengeChat.ts`,
`teams.ts`, `ratingEngine.ts` (confirmation only).

**Frontend / services:** `app/matchrooms/create/index.tsx`,
`app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts`,
`app/matchrooms/create/hooks/useMatchroomCreatePricing.ts`, `app/matchrooms/[id].tsx`,
`app/matchrooms/book/[id].tsx`, `app/matchrooms/book/pay/[intentId].tsx`,
`app/matchrooms/book/status/[intentId].tsx`, `app/(player)/wallet.tsx`, `app/zone/wallet.tsx`,
`app/zone/modules/bookings.tsx`, `app/super-admin/withdrawals.tsx`, `app/super-admin/(tabs)/payments.tsx`,
`app/teams/challenge-create.tsx`, `app/teams/challenge.tsx`, `app/teams/challenges.tsx`,
`app/teams/challenge-chat.tsx`, and the `src/services/convex/*` service layer (matchService,
easypaisaService, bookingService, bookingRequestService, zoneAdminBookingService, superAdminService,
zoneWithdrawalService, teamMatchService, teamActionService, teamService).

> ⚠️ **Line numbers** cited below are from the audit snapshot on `product-ready`. Treat them as
> close pointers, not exact addresses — verify before editing in any follow-up.

---

<a name="phase-1"></a>
## Phase 1 — Payment Architecture Map

### 1.1 Payment methods that exist

| Method | Exists? | Mechanism |
|---|---|---|
| Wallet balance (direct) | ✅ | `users.walletBalance` debited inside the create/seat mutation |
| Easypaisa / provider | ✅ | All provider payments are modeled as a **wallet top-up** (`kind:"wallet_topup"`) that then funds the action — there is no direct "pay provider for this booking" rail |
| Free / internal (amountDue == 0) | ✅ | No wallet/provider touch |
| Zone-admin walk-in | ✅ | `createZoneWalkInMatchroom`, bypasses KYC + payment prompt |
| Bundle | ❌ | No bundle create path found for matchrooms |
| Team Challenge "pay" | ✅ (broken) | Wallet top-up → bare `deductFunds`, **not** escrowed or linked to booking |

### 1.2 Money states & the fields that represent them

| Concept | Field(s) | Source |
|---|---|---|
| Matchroom payment intent | `matchrooms.paymentStatus` (`paid`/`unpaid`), `paymentAmount` | `schema.ts:540+` |
| Provider transaction | `paymentTransactions.status` = `created \| redirected \| token_received \| pending \| paid \| failed \| expired \| cancelled` (`cancelled` is **unreachable** — never written) | `schema.ts:491-500` |
| Provider sub-status | `paymentTransactions.providerStatus` (free-form), `processedAt` (paid marker) | `easypaisa.ts:2139,2446` |
| Booking intent | `bookingIntents.status` = `pending_approvals \| approved_pending_payment \| confirmed \| paid \| expired …`; `heldStatus` = `held \| captured \| released \| refunded` | `schema.ts:774-843` |
| Wallet balances | `users.walletBalance` (available), `users.walletHeldBalance` (escrow) | `schema.ts:325-330` |
| Wallet ledger | `walletTransactions.type` = `deposit \| withdrawal \| booking_payment(dead) \| refund \| hold \| hold_release \| hold_capture`; `.status` = `pending \| completed \| failed`; `.reference` (idempotency key) | `schema.ts:436-464` |
| Venue settlement | `matchrooms.venuePayoutStatus` (`paid`), `venuePayoutReference`, `merchantSettlementStatus/Amount` | `matchrooms.ts:1079-1135` |

### 1.3 Functions that mutate money (the primitives)

| Function | Mutates | Reference key | Visibility | Idempotent? |
|---|---|---|---|---|
| `wallet.addFunds` | `walletBalance +=` ; `deposit` row | `args.reference` | internal | ✅ **only if reference passed** (gap) |
| `wallet.deductFunds` (public) / `deductWalletFunds` / `deductFundsInternal` | `walletBalance -=` ; `withdrawal` row | `reference \|\| source \|\| "payment"` | public + internal | ✅ |
| `wallet.holdFunds` | `walletBalance -=`, `walletHeldBalance +=` ; `hold` row | required `reference` | internal | ✅ |
| `wallet.releaseHeldFunds` | held → available ; `hold_release` row | required | internal | ✅ |
| `wallet.captureHeldFunds` | `walletHeldBalance -=` ; `hold_capture` row | required | internal | ✅ |
| `wallet.refundFunds` | `walletBalance +=` ; `refund` row | required | internal | ✅ |
| `payVenueWalletForCompletedMatchroom` | venue `addFunds` | `venue_payout:${matchroomId}` | internal | ✅ |
| `wallet.createZoneWithdrawalTransaction` | inserts pending `withdrawal` (no debit) | `zone_withdrawal_${userId}_${now}` | public | ❌ (timestamp ref) |
| `admin.approveZoneWithdrawal` | `walletBalance -=`, txn → completed | n/a (status-guarded) | super-admin | ✅ (no-op if not pending) |

**Public (client-callable):** `matchrooms.create`, `matchrooms.checkCreateAvailability`,
`matchrooms.requestToJoinMatchroom`, `respondToMatchroomJoinRequest`, `payMatchroomSeatIntent`,
`easypaisa.startCheckout`, `easypaisa.syncTransactionStatus`, `easypaisa.getCheckoutStatus`,
`wallet.deductFunds` (legacy, self-only), `wallet.createZoneWithdrawalTransaction`,
`teamChallenges.createFull/respond/proposeVenue/cancel/complete/update`.

**Internal-only:** `finalizePaidCreateFromProvider`, `confirmPaidMatchroomSeatIntentFromProvider`,
`applyProviderUpdate`, `createCheckoutTransactionWithLock`, all wallet primitives except `deductFunds`,
`payVenueWalletForCompletedMatchroom`. **HTTP (unauthenticated, inquiry-gated):** `easypaisaIpnHandler`,
`easypaisaFinalizeHandler`.

### 1.4 Lifecycle diagram (solo / zone matchroom)

```
CREATE
  free (amountDue=0) ─────────────► matchrooms.create → row status:open (no money)
  wallet ─────────────────────────► matchrooms.create → insert room + deductWalletFunds (ATOMIC, ref matchroom_create:<id>)
  easypaisa ─► startCheckout(wallet_topup + matchroomCreateArgs)
              └─► provider ─► IPN/poll ─► applyProviderUpdate(source:inquiry)
                              └─ addFunds(ref easypaisa:<orderRef>)
                                 └─ finalizePaidCreateFromProvider (dedupe by sourcePaymentOrderRefNum)
                                    └─ deductFundsInternal(ref matchroom_create:<id>)   [all ONE mutation = atomic]

JOIN
  requestToJoinMatchroom ─► bookingIntent(pending_approvals) + notify captains   [NO money, NO slot]
  captain accept ─────────► bookingIntent(approved_pending_payment) + notify payment_required
  payMatchroomSeatIntent ─► re-check slot+lock ─► holdFunds(ref hold:booking_intent:<id>:<src>)
                            ─► assignPlayerToTeamSlots (slot claimed, ATOMIC) ─► intent confirmed/heldStatus:held
                            ─► scheduleBookingHoldCapture(at scheduledStartAt)

CAPTURE / SETTLE
  scheduled capture at startAt  OR  matchroom→completed
     └─ captureHeldFunds(ref capture:booking_intent:<id>)   [re-checks room: releases if cancelled]
  matchroom→completed ─► payVenueWalletForCompletedMatchroom
     └─ gross × payoutRate (90% normal / 100% active pilot) → venue addFunds(ref venue_payout:<id>)

CANCEL / EXPIRE
  updateStatus(cancelled|expired) / adminCancel / lifecycle sweep
     └─ releaseHeldBookingIntentsForMatchroom + refundCapturedBookingIntentsForMatchroom

WITHDRAW (zone admin)
  requestZoneWithdrawal (KYC-gated, NO hold) ─► pending withdrawal txn
     └─ super-admin approveZoneWithdrawal ─► walletBalance -= amount (approve == complete)
```

---

<a name="phase-2"></a>
## Phase 2 — Matchroom Creation Payment Flow

### Path (a) Free / internal (amountDue == 0)
`submit()` → KYC gate → `amountDue = ceil(price)` is `0` so the payment prompt is skipped → public
`matchrooms.create` inserts row `status:"open"`; the `paymentStatus==="paid" && paymentAmount>0` guard
is false so no wallet deduct. (`useMatchroomCreateSubmitFlow.ts:509-808`, `matchrooms.ts:2888-2916`)

### Path (b) Wallet / direct-paid
`submit()` → availability re-checked (`checkCreateAvailability`) → user picks "Pay with Wallet" →
`matchrooms.create` with `paymentStatus:"paid"`, `paymentAmount=amountDue`. The server **inserts the
matchroom and runs `deductWalletFunds` in the same transaction** (reference `matchroom_create:<id>`);
insufficient balance throws and rolls back the whole mutation (no orphan room).
(`matchrooms.ts:2891-2916`, `wallet.ts:680-705`). *Note:* `payWithWallet()` in the submit hook is dead
code — the deduct happens server-side.

### Path (c) Easypaisa / provider-paid
1. Create payload serialized into `pendingPaidMatchroomCreateArgsRef`; phone prompt.
2. `easypaisa.startCheckout({kind:"wallet_topup", matchroomCreateArgs})` stores the args in
   `paymentTransactions.providerPayload.checkoutContext.matchroomCreateArgs` (`easypaisa.ts:1305-1311`).
3. Client polls `getCheckoutStatus` + calls `syncTransactionStatus`, which does a **server-to-server REST
   inquiry** then `applyProviderUpdate(source:"inquiry")` (`easypaisa.ts:1795-1853`).
4. On paid: `addFunds` → `finalizePaidCreateFromProvider` (idempotent on `sourcePaymentOrderRefNum`
   unique index) → `deductFundsInternal` — **all nested in one `applyProviderUpdate` mutation, atomic**
   (`easypaisa.ts:2357-2448`).
5. `getCheckoutStatus.finalizedMatchroomId` lets the client navigate; if the app was closed the room is
   created server-side regardless (`easypaisa.ts:1917`).

### Path (d) Zone-admin walk-in — bypasses KYC + payment prompt (`createZoneWalkInMatchroom`). Server-side
price validation **UNKNOWN**, flagged for follow-up.

### Idempotency layers (create)
| Layer | Key | Where |
|---|---|---|
| Duplicate room (provider) | `matchrooms.sourcePaymentOrderRefNum` unique index → returns existing `_id` | `matchrooms.ts:2757-2766` |
| Already finalized | `providerPayload.matchroomCreate.matchroomId` marker | `easypaisa.ts:2179,2430` |
| Wallet double-debit | `walletTransactions.reference` (`matchroom_create:<id>`) | `wallet.ts:670-678` |
| Provider already paid | `processedAt` / `status==="paid"` early-return | `easypaisa.ts:2175` |

### Create worst cases
| Scenario | Behavior | Safe? |
|---|---|---|
| Pays (provider) then app closes before nav | Room created server-side; IPN/inquiry finalize independent of client | ✅ |
| Provider callback delayed/duplicated | Triple-guarded (processedAt, matchroomCreate marker, unique orderRef) | ✅ |
| Insufficient balance after precheck | Deduct throws, whole mutation rolls back, no orphan room | ✅ |
| Wallet balance changes between precheck & create | No precheck lock; deduct re-reads live balance in-txn | ✅ |
| `sourcePaymentOrderRefNum` already used | Unique lookup returns existing room | ✅ |
| Payment confirmed but room create fails | Provider path is atomic (one mutation) → all-or-nothing; degraded path keeps funds as wallet credit + admin alert | ✅ funds |
| **Taps "create" many times (wallet/free path)** | **No idempotency key** on wallet/free create; each tap = new room + new debit (reference is per-new-room). UI `setSubmitting` is the only guard | ⚠️ **UNSAFE** |
| **Client-set price** | Server never recomputes price vs zone rules; `paymentAmount`/`pricing.perPlayer` are client-supplied, only cross-checked against each other | ⚠️ **UNSAFE (High)** |

---

<a name="phase-3"></a>
## Phase 3 — Matchroom Join Payment Flow

**Order of operations:** request → **captain approval** → **payment (hold)** → slot assigned. Payment
happens **strictly after** approval; funds are **HELD, not charged**, and captured later at match start.

| # | Step | Function | Effect |
|---|---|---|---|
| 1 | Request to join | `requestToJoinMatchroom` (`matchrooms.ts:3890`) | Creates `bookingIntent(pending_approvals)` + notifies captains. No slot, no money |
| 2 | Captain accept | `respondToMatchroomJoinRequest` (`:4190`) | Intent → `approved_pending_payment`, sends `match.payment_required`. (Out-of-range requester needs **all** captains to accept) |
| 3 | Pay | `payMatchroomSeatIntent` → `confirmMatchroomSeatIntentForUser` (`:4430`) | Re-checks slot+lock+full atomically → `holdFunds` → `assignPlayerToTeamSlots` → intent `confirmed/heldStatus:held` → schedule capture |
| 4 | Capture | scheduled `captureBookingIntentHold` (`:5057`) or on `completed` (`:3229`) | Hold → captured at `scheduledStartAt` |

**Slot/capacity safety:** the pay mutation re-reads the slot and rejects if `slot.uid` is set ("slot no
longer available"); because each Convex mutation is one serializable OCC transaction, the read-check-write
is atomic — **two users racing for the last slot is SAFE** (loser's intent expires, no hold placed)
(`matchrooms.ts:4504-4535`, `assignPlayerToTeamSlots:1615`).

**Lock window:** join locks at `scheduledStartAt − 24h` or explicit `lockAt`; leave additionally locks once
venue-confirmed (`timing.ts:9-25`, `matchrooms.ts:828-841`).

### Join worst cases
| Scenario | Behavior | Safe? |
|---|---|---|
| Two users pay for last slot at once | Serialized by OCC; loser → intent expired, no hold | ✅ |
| Host accepts a stale request | Accept re-loads room; expired/full → rejected; approval doesn't reserve | ✅ |
| Duplicate accept/reject | Guarded by `notif.status!=="pending"` ("already handled") | ✅ |
| Duplicate join request | Detected, returns `alreadyPending`, reuses intent | ✅ |
| Payment callback after request expired | Confirm throws expired; Easypaisa already credited wallet → money lands as **wallet balance** (seat denied, no auto-refund-to-source) | ⚠️ partial |
| **Player leaves after being accepted/paid (before lock)** | `leave` reopens slot + removes player but **does NOT release the hold or cancel scheduled capture** → funds captured at start for a player no longer in the room | ⚠️ **UNSAFE (High)** |
| Accept **after** lock | Accept path omits `isJoinLocked`; emits `payment_required` that can never be paid → dead-end | ⚠️ UX bug |
| Direct `join` mutation (`:2968`) | Adds player with **no payment, no slot, no skill gate**; can flip room to `locked`. No UI caller found, exposure **UNKNOWN** | ⚠️ Medium |

---

<a name="phase-4"></a>
## Phase 4 — Holds / Release / Refund / Capture

**Wallet balance fields:** `walletBalance` (available) and `walletHeldBalance` (escrow). A hold moves
`amount` available→held; capture removes from held; release moves held→available; refund adds to
available. No DB-level non-negativity constraint beyond per-call guards. (`schema.ts:325-330`,
`wallet.ts:419-642`)

**Hold reference keys** (`matchrooms.ts:1149-1164`): hold `hold:booking_intent:<id>:<source>`, capture
`capture:booking_intent:<id>`, release `release:booking_intent:<id>`, refund `refund:booking_intent:<id>`.
Granularity = **one hold per bookingIntent (per seat)**; amount = `intent.pricing.totalCost ||
room.pricing.perPlayer`.

### Phase-4 scenario table (as requested)
| # | Scenario | Expected | Current function | Current behavior | Risk | Fix? |
|---|---|---|---|---|---|---|
| 1 | Player leaves before 24h lock | Release hold | `leave` (`matchrooms.ts:3109`) | **No release; capture still scheduled → wrongful capture** | **HIGH** | ✅ |
| 2 | Player leaves after lock | Blocked | `leave` (`:3122`) | Blocked (`isLeaveLocked`) | none | — |
| 3 | Host cancels before zone confirm | Release | `updateStatus(cancelled)` (`:3232`) | Releases + refunds | none | — |
| 4 | Host cancels after zone confirm | Release/refund | same | Releases + refunds | none | — |
| 5 | Zone admin rejects | Release/refund | `zoneAdminBooking.ts:1523-1527` | Releases + refunds intents | none | — |
| 6 | Counter-offer rejected by captain | Release | (zone reject path) | Releases held intents | none | — |
| 7 | Counter-offer, captain no response | Expire+release | lifecycle sweep | Released on room expiry | low | — |
| 8 | Matchroom expires incomplete | Release/refund | `expireMatchroomForInvalidLifecycle` (`:1355`) | Releases + refunds | none | — |
| 9 | Expires after full, before zone approval | Release/refund | same | Releases + refunds | none | — |
| 10 | Paid but room not created | Keep funds | provider atomic path | Funds preserved as wallet credit | low | — |
| 11 | Paid but slot not assigned | Refund/keep | confirm seat | Wallet credit retained, seat denied | ⚠️ partial | maybe |
| 12 | Duplicate provider callback | No double | `processedAt` + ref dedupe | No double credit | none | — |
| 13 | Duplicate wallet deduction | No double | `by_reference` | Short-circuits | none | — |
| 14 | Failed provider payment | No charge | `applyProviderUpdate` failed branch | No charge | none | — |
| 15 | Refunded then callback says paid | No re-charge | `heldStatus` guards | Re-capture blocked (needs `held`) | none | — |
| 16 | Account deleted with active hold | Release | **none found** | Orphaned held balance; capture later throws | **HIGH/UNKNOWN** | ✅ |
| 17 | Zone admin suspended w/ pending earnings | Hold payout | mixed | Earnings still accrue; withdrawal blocked at request | ⚠️ | maybe |
| 18 | App crashes after payment confirmation | Recover | IPN/poll | Recovered **iff** IPN fires or user reopens; else stuck (see Phase 8) | ⚠️ | ✅ |
| 19 | Backend ok, client times out | No double | idempotency refs | Safe on retry | none | — |
| 20 | Convex retry/replay | No double | nested-mutation atomicity + refs | Safe | none | — |

**Critical Phase-4 findings:**
- **`ctx.scheduler.cancel` is never called anywhere in the codebase** (0 hits). `captureScheduledFnId` is
  stored but never used to cancel. The **only** thing preventing wrongful capture is the fire-time
  room-status re-check inside `captureBookingIntentHold` — and that guard checks room status, **not roster
  membership**, which is exactly why "player leaves" (#1) slips through.
- **`addFunds` is not idempotent when called without a `reference`** (guard is gated on
  `if (args.reference)`, `wallet.ts:385`).

---

<a name="phase-5"></a>
## Phase 5 — Zone Payout & Zone Wallet Settlement

**There is no dedicated zone-wallet table.** The zone admin's wallet is `users.walletBalance` +
`walletTransactions` rows tagged `source:"matchroom_completion_payout"`.

1. **When does the zone admin get paid?** At **matchroom completion** (`status:"completed"`), via
   `payVenueWalletForCompletedMatchroom` → `wallet.addFunds` (`matchrooms.ts:1075-1147`, credit at `:1113`).
   **Not** at room-full, accept, match start, payment capture, or result verification. **Completion does
   NOT require `resultVerification.status==="verified"`** (`:3204-3219`).
2. **Credit function:** `payVenueWalletForCompletedMatchroom` → `internal.wallet.addFunds`.
3. **Idempotent?** ✅ Yes — reference `venue_payout:${matchroomId}` + `venuePayoutStatus==="paid"` guard.
4. **Branch-level earnings?** ❌ `branchFilteringAvailable:false`; payout metadata lacks `branchId`
   (`zoneWallet.ts:90-94`).
5. **Pilot 100% vs normal 90/10:** `pilotApplied = zone.pilotStatus==="active" && now <= zone.pilotEndsAt`,
   evaluated with **backend time at payout calc** (robust at the boundary); `payoutAmount = gross ×
   (pilot?1.0:0.9)`, `platformShareAmount = gross − payout` (`matchrooms.ts:1100-1109`).
6. **Commission recorded?** Only in the deposit txn `metadata` (`platformShareAmount`, `payoutRate`,
   `pilotApplied`) — **no separate platform-revenue ledger** (`:1117-1127`).
7. **Cancelled/refunded after payout?** ❌ **No reversal/clawback path exists.** Player refund
   (`:1267-1280`) never touches the venue balance.
8. **Withdraw before reversal/dispute?** ✅ possible — payout fires before result verification, no clearing
   window, so a venue can withdraw funds for a later-disputed match.
9. **Pending vs available balances?** Not separate. Available = `walletBalance`; "pending" in the zone UI
   is just the sum of pending **withdrawal** amounts (not pending earnings) (`zoneWallet.ts:60-80`).
10. **Same source of truth (zone view vs super-admin)?** ✅ Both read `walletTransactions` + `walletBalance`
    (`zoneWallet.ts:29`, `admin.ts:2243/2404-2460`), though they re-derive aggregates independently.
11. **Withdrawals deducted from?** **Available** `walletBalance`, only on super-admin approval
    (`admin.ts:2620-2623`); total-earned is display-only.
12. **Duplicate settlement prevention:** ✅ (reference + status guard).
13. **Withdrawal state machine:** request (KYC-gated, **no funds held**) → super-admin approve (==complete,
    deducts balance) / reject (reason required). Both approve/reject are idempotent (no-op if not pending).

### Zone payout worst cases
| Scenario | Behavior | Safe? |
|---|---|---|
| Duplicate payout (same matchroom) | Prevented (reference + `venuePayoutStatus`) | ✅ |
| Zone admin triggers payout for another zone | Payout always follows room's own `zoneOwnerUid` | ✅ |
| Pilot boundary mid-lifecycle | Rate chosen at payout time w/ backend clock | ✅ |
| **Matchroom cancelled after payout** | No clawback → venue overpaid | ⚠️ **HIGH** |
| **Withdraw before dispute resolves** | No clearing/hold window; payout precedes verification | ⚠️ **HIGH** |
| **Result dispute after payout** | No reversal hook | ⚠️ **HIGH** |
| Gross fallback when `merchantSettlementAmount` absent | `perPlayer × maxPlayers` even if fewer paid → possible over-credit | ⚠️ Low |

**Plain answer — does the zone admin get paid correctly and when?** **Happy path: YES**, at matchroom
completion, with idempotent, server-computed, correctly-split credit and no cross-zone leakage. **Adverse
paths: NO** — payout fires before result verification with **no clearing period and no reversal/clawback**,
so a completed-then-cancelled/disputed/refunded match leaves the venue paid money it may not be owed and
free to withdraw it.

---

<a name="phase-6"></a>
## Phase 6 — Notifications Audit

| Event | Player | Captain/Host | Zone admin | Super admin | Notes |
|---|---|---|---|---|---|
| Payment required | ✅ `match.payment_required` | — | — | — | sent on accept |
| Join request received | — | ✅ `match.join_request` | — | — | |
| Join accepted/rejected | ✅ `match.join_request_result` | — | — | — | |
| Payment confirmed | ⚠️ implicit (UI poll) | — | — | — | no explicit "payment confirmed" push |
| Payment failed | ⚠️ UI only | — | — | — | no server notification |
| Hold created / released / refunded | ❌ | ❌ | — | — | **no notifications** |
| Matchroom full | partial | partial | — | — | |
| Zone approval needed | — | — | ✅ (booking request) | — | only for `zone_accepted`/`walkin`, **not challenge rooms** |
| Zone accepted / rejected / counter-offer | ✅ | ✅ | — | — | |
| Matchroom cancelled / expired | ✅ | ✅ | — | — | |
| **Zone payout credited** | — | — | ❌ **no notification** | — | venue isn't told it was paid |
| Withdrawal requested | — | — | — | ✅ | `withdrawalNotifications.ts` |
| Withdrawal approved / rejected | — | — | ✅ | — | |
| **Payment anomaly / reconciliation** | — | — | — | ✅ | `collectPaymentAttentionFlags` → super-admin alerts (detection only) |

**Notification gaps:** (1) no "payment confirmed"/"payment failed" server notification to the payer;
(2) **no hold/release/refund notifications**; (3) **no "zone payout credited" notification** to the venue;
(4) **Team Challenge: essentially no zone-admin/super-admin notifications** because challenge rooms never
enter the zone-admin pipeline.

---

<a name="phase-7"></a>
## Phase 7 — Security / Idempotency Audit

| Check | Result | Severity |
|---|---|---|
| Can client mark a payment paid? | **Solo/zone: NO** — only internal mutations write status; client supplies no status; `syncTransactionStatus` forces a real inquiry. **Team Challenge: YES** — `teamAPaymentStatus:"paid"` is client-asserted and `teamBPaymentStatus` defaults to `"paid"` | **Critical (TC)** |
| Can client create a fake paid matchroom? | Solo: No (server deducts/credits). TC: effectively yes (status trusted) | Critical (TC) |
| Can user pay less than required? | **YES (solo/zone)** — server never recomputes price vs zone rules; client sets `paymentAmount` | **High** |
| Can provider callback with wrong amount pass? | No — IPN/inquiry credit uses server `row.amount`; mismatch → anomaly + admin alert + no status change (amount check is skipped only when provider returns no amount) | Low caveat |
| Can same orderRef be reused/replayed? | No — replay short-circuits on `processedAt`/`paid`. Order-ref generation is `timestamp+Math.random()` (theoretical collision, `.unique()` fails closed) | Low |
| Can one user use another user's payment order? | No cross-user benefit — ownership enforced by `createdByUid`/`userId`. **But** IPN handler looks up by orderRef **without userId** → any party knowing an orderRef can trigger inquiry/reconcile (churn/abuse, not theft) | Medium |
| Can wallet deduction be replayed? | No — `by_reference` dedupe | — |
| Can hold/capture/release be replayed? | No — `heldStatus` guards + reference dedupe | — |
| Can zone admin trigger payout for another zone? | No — payout bound to room's `zoneOwnerUid` | — |
| Can super-admin-only APIs be called by normal users? | No — `getAuthenticatedAdmin` on withdrawal approve/reject | — |
| **Unauthenticated hosted-finalize can credit a wallet?** | **YES** when `EASYPAISA_HOSTED_FALLBACK_ENABLED` — `easypaisaFinalizeHandler` trusts inbound `status` text, no inquiry; attacker with a guessable 24-char `checkoutToken` can flip a still-pending order to paid | **High** |
| Are payment callbacks verified through provider inquiry? | IPN: ✅ (always re-inquires). Hosted-finalize: ❌ (trusts body). Initiate: synchronous MA only | High (finalize) |
| Sensitive bank/user fields exposed? | Not flagged by sub-agents; withdrawal bank fields are user-entered labels — **UNKNOWN**, recommend a dedicated pass | UNKNOWN |
| Refund state modeled on paymentTransactions? | ❌ no `refunded` status — post-refund reconcile semantics rely on `processedAt` short-circuit | Medium |

---

<a name="phase-8"></a>
## Phase 8 — Worst-Case Scenario Matrix (50 cases)

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low/Safe.

### Create payment
| # | Scenario | Current behavior | Expected | Sev | Files |
|---|---|---|---|---|---|
| 1 | Pays then app killed | Room created server-side via IPN/inquiry | same | 🟢 | easypaisa.ts:2394 |
| 2 | Provider callback duplicated | Triple-guarded dedupe | no double | 🟢 | easypaisa.ts:2175 |
| 3 | Taps create many times (wallet/free) | Duplicate rooms + duplicate debits possible | one room | 🟡 | matchrooms.ts:2805 |
| 4 | Client sets low price | Server trusts client amount | server recompute | 🟠 | matchService.ts:467 |
| 5 | Insufficient balance after precheck | Rolls back, no orphan | same | 🟢 | wallet.ts:681 |
| 6 | `sourcePaymentOrderRefNum` reused | Returns existing room | same | 🟢 | matchrooms.ts:2757 |
| 7 | Paid, create args missing | Funds kept as wallet credit, no room | refund/retry | 🟡 | easypaisa.ts:2394 |
| 8 | Walk-in price not server-validated | UNKNOWN | validate | 🟡 | createZoneWalkInMatchroom |

### Join payment
| # | Scenario | Current behavior | Expected | Sev | Files |
|---|---|---|---|---|---|
| 9 | Two pay for last slot | OCC serializes; loser expires | one wins | 🟢 | matchrooms.ts:4504 |
| 10 | Accept stale request | Re-validated; approval doesn't reserve | safe | 🟢 | matchrooms.ts:4221 |
| 11 | Accept after lock | Dead-end payment prompt | block accept | 🟡 | matchrooms.ts:4209 |
| 12 | Pay but host rejects (multi-captain) | Reject doesn't expire upgraded intent | block pay | 🟡 | matchrooms.ts:4265 |
| 13 | Pay but room full | Slot re-check; loses cleanly | refund/keep | 🟢 | matchrooms.ts:4504 |
| 14 | Callback after request expired | Funds → wallet balance, seat denied | refund source | 🟡 | matchrooms.ts:4451 |
| 15 | **Leave after accepted/paid (pre-lock)** | **Hold not released; wrongful capture at start** | release hold | 🟠 | matchrooms.ts:3109 |
| 16 | Direct `join` bypass | No pay/slot/skill gate | remove/guard | 🟡 | matchrooms.ts:2968 |
| 17 | Duplicate accept/reject | "already handled" | safe | 🟢 | matchrooms.ts:4202 |

### Wallet hold / refund
| # | Scenario | Current behavior | Expected | Sev | Files |
|---|---|---|---|---|---|
| 18 | Duplicate deduction (same ref) | Short-circuits | safe | 🟢 | wallet.ts:670 |
| 19 | `addFunds` without reference | Not idempotent → double credit possible | always pass ref | 🟡 | wallet.ts:385 |
| 20 | Duplicate hold | `alreadyApplied` | safe | 🟢 | wallet.ts:432 |
| 21 | Capture/release replay | `heldStatus` guard + ref dedupe | safe | 🟢 | matchrooms.ts:5061 |
| 22 | Refund after capture | Guarded transition captured→refunded | safe | 🟢 | matchrooms.ts:1234 |
| 23 | Negative/zero amount | Throws "must be positive" | safe | 🟢 | wallet.ts:380 |
| 24 | **Account deleted with active hold** | Orphaned held balance; capture throws | release first | 🟠 | (none) |
| 25 | Scheduled capture can't be cancelled | `scheduler.cancel` never used | cancelable | 🟡 | grep:0 hits |

### Provider callback
| # | Scenario | Current behavior | Expected | Sev | Files |
|---|---|---|---|---|---|
| 26 | Client marks tx paid | Impossible (no client status write) | safe | 🟢 | easypaisa.ts:2007 |
| 27 | Wrong-amount callback | Anomaly + admin alert, no credit | safe | 🟢 | easypaisa.ts:2060 |
| 28 | Duplicate IPN | Re-inquire + short-circuit | safe | 🟢 | easypaisa.ts:2175 |
| 29 | IPN paid after local expiry | Inquiry-sourced can promote; funds → wallet | safe-ish | 🟢 | easypaisa.ts:2481 |
| 30 | **Hosted-finalize forged** | Trusts inbound status, no inquiry → fake credit | inquiry-gate | 🟠 | easypaisa.ts:2689 |
| 31 | Unauth IPN trigger by orderRef | Inquiry churn (no theft) | secret/allowlist | 🟡 | easypaisa.ts:2826 |
| 32 | Order-ref collision | `.unique()` fails closed | stronger id | 🟢 | easypaisa.ts:181 |
| 33 | Refund then callback paid | `processedAt` short-circuit; no `refunded` state | model refund | 🟡 | schema.ts:491 |
| 34 | Network failure mid-finalize | One atomic mutation → all-or-nothing | safe | 🟢 | easypaisa.ts:2357 |

### Zone payout / withdrawal
| # | Scenario | Current behavior | Expected | Sev | Files |
|---|---|---|---|---|---|
| 35 | Duplicate payout | Reference + status guard | safe | 🟢 | matchrooms.ts:1112 |
| 36 | **Cancel after payout** | No clawback | reverse | 🟠 | matchrooms.ts:1075 |
| 37 | **Withdraw before dispute** | No clearing window | hold window | 🟠 | wallet.ts:299 |
| 38 | **Dispute after payout** | No reversal hook | reverse | 🟠 | matchrooms.ts:1075 |
| 39 | Payout for another zone | Bound to room owner | safe | 🟢 | matchrooms.ts:1113 |
| 40 | Pilot boundary | Backend-time decision | safe | 🟢 | matchrooms.ts:1104 |
| 41 | Withdrawal not reserved at request | Re-checked at approve; can become unfulfillable | reserve | 🟡 | wallet.ts:330 |
| 42 | Suspended admin pending earnings | Accrues; withdrawal blocked at request | review | 🟡 | kycGate.ts:39 |

### Race / recovery
| # | Scenario | Current behavior | Expected | Sev | Files |
|---|---|---|---|---|---|
| 43 | Backend ok, client retries | Idempotency refs | safe | 🟢 | wallet.ts:388 |
| 44 | Two writers same slot | OCC abort/retry | safe | 🟢 | OCC |
| 45 | Lifecycle tick during pay | OCC conflict, retry | safe | 🟢 | matchrooms.ts:4942 |
| 46 | Capture fires after cancel | Releases instead | safe | 🟢 | matchrooms.ts:5065 |
| 47 | **App killed, IPN dropped** | **No cron reconciles stuck pending → paid-but-not-credited** | reconcile cron | 🟠 | easypaisa.ts:1795 |
| 48 | **Abandoned pending payment** | No TTL cleanup cron | sweep | 🟡 | crons.ts |
| 49 | **Booking-intent TTL server-side** | Only client-filtered; never expired in DB | sweep | 🟡 | bookings.ts:219 |
| 50 | Held balance leak (room never terminal) | Edge-case strand | watchdog | 🟢/UNKNOWN | matchrooms.ts:103 |

### Team Challenge (see dedicated section)
| # | Scenario | Current behavior | Sev |
|---|---|---|---|
| TC1 | Money never escrowed/paid to venue | Platform silently keeps 100% | 🔴 |
| TC2 | Payment status client-asserted/trusted | Create+accept without paying | 🔴 |
| TC3 | No refund on cancel/expiry; Team B never refundable | Funds stranded | 🔴 |
| TC4 | Pay & create non-atomic (2 calls) | Charge with no challenge | 🟠 |
| TC5 | Cancel deletes challenge, orphans matchroom | Locked orphan room, captains paid | 🟠 |
| TC6 | No expiry cron | Paid-but-unaccepted stuck forever | 🟠 |
| TC7 | Commission/pilot never applied | No settlement | 🟠 |
| TC8 | No venue/slot availability check | Room created unconditionally | 🟡 |

---

<a name="phase-9"></a>
## Phase 9 — Recommended Target Design (NOT implemented)

### State machine (single source of truth)
- **paymentTransactions** owns provider truth: `created → redirected/token_received → pending → {paid,
  failed, expired}`. Add a real `refunded` terminal state; make `cancelled` reachable or remove it.
- **bookingIntents** owns seat truth: `pending_approvals → approved_pending_payment → confirmed(held) →
  captured → {released, refunded}`. Server must move intents to `expired` (cron), not just client-filter.
- **matchrooms.venuePayoutStatus** owns settlement truth: `none → pending_clearing → paid → reversed`.

### Idempotency keys (keep + extend)
- Keep stable references everywhere (`easypaisa:<orderRef>`, `hold/capture/release/refund:booking_intent:<id>`,
  `venue_payout:<id>`). **Make `addFunds` reject calls without a reference.** Add a `by_status` index on
  `paymentTransactions` and a per-intent idempotency key to the wallet/free **create** path so duplicate
  taps can't create duplicate rooms.

### Money-movement rules
- **Release hold on leave/removal:** `leave` (and any roster-removal path) must call
  `releaseBookingIntentHold` and flip `heldStatus` so the fire-time capture guard no-ops.
- **Server-recompute price** at create/seat time from zone pricing rules; never trust client `paymentAmount`.
- **Clearing window for venue payout:** credit to a `pending_clearing` bucket at completion, move to
  available only after result verification (or a fixed window); add a **reversal/clawback** path for
  cancel/refund/dispute-after-payout.

### Recovery jobs / crons (currently missing)
1. **Stuck-pending reconciler:** scan `paymentTransactions` in active statuses past checkout TTL and run a
   server-side inquiry (the single biggest gap — money taken but never credited if app killed + IPN dropped).
2. **Abandoned-payment cleanup:** expire `pending`/`created` rows past `expiresAt`.
3. **Booking-intent expiry sweep:** move stale `approved_pending_payment` intents to `expired` server-side.
4. **Orphaned-hold watchdog:** detect `heldStatus:"held"` with no live matchroom/scheduled capture.
5. **Team Challenge expiry + refund cron.**

### Provider hardening
- Gate `easypaisaFinalizeHandler` through the same REST inquiry as IPN (don't trust inbound status).
- Add a shared-secret/allowlist to the IPN/finalize routes.
- Replace `timestamp+Math.random()` order-ref/token generation with a cryptographically strong unique id.

### Refund policy / admin tooling
- Model refunds as first-class (`refunded` state + reversal ledger). Add a super-admin reconciliation tool
  (force-inquiry, force-release-hold, reverse-payout) — today recovery is manual via the payment-detail
  screen with no repair actions.

### Team Challenge redesign (largest work item)
- Route challenge payments through `bookingIntents` holds (per team), set `zoneOwnerUid` on the linked
  matchroom, run it through the zone-admin approval pipeline, make payment status **server-verified**, make
  pay+create atomic, add expiry/refund crons, and apply the same commission/pilot split + payout as solo.

---

<a name="team-challenge"></a>
## Team Challenge Payment Lifecycle

> **VERDICT: NOT LAUNCH-SAFE.** Real money is collected (Easypaisa top-up → wallet deduction) but the
> money model is disconnected: funds are never escrowed, never linked to the booking, never paid to the
> venue, and only partially refundable. Payment status is **client-asserted and server-trusted**.

### Flow
1. Captain A opens create, picks opponent/zone/series; `captainPaymentAmount = pricePerPlayer ×
   challengerActivePlayers` (`challenge-create.tsx:460`).
2. Pays via Wallet or "Pay Now" (a **wallet top-up**, `kind:"wallet_topup"`), then a **separate** call
   `teamChallenges.createFull` stores `teamAPaymentStatus:"paid"` **verbatim from the client**
   (`teamMatchService.ts:387`).
3. Captain B accepts; `respond` defaults `teamBPaymentStatus` to `"paid"` even if the arg is omitted
   (`teamChallenges.ts:474`). Payment (if any) is a bare `wallet.deductFunds`.
4. When both captains propose the **same** `zoneId`, the client creates a linked matchroom with
   `bookingSource:"challenge"`, **`paymentStatus:"unpaid"`, no `zoneOwnerUid`, `zoneAdminApproved:false`**
   (`teamMatchService.ts:694`).

### Findings
- **Payment model:** per-team, per-player, computed independently for A and B (amounts can diverge). Money
  goes into the payer's own wallet deduction — **not escrow, not linked to the booking**.
- **Venue/zone approval:** **absent.** `zoneAdminBooking` only processes `zone_accepted`/`walkin`;
  `"challenge"` rooms never surface to a zone admin (`zoneAdminBooking.ts:1035`).
- **Zone payout:** **never happens** — `payVenueWalletForCompletedMatchroom` returns null when
  `!zoneOwnerUid` (`matchrooms.ts:1078`). Commission/pilot split never executes.
- **Refunds:** only Captain-B-rejects-pending refunds Team A (`teamChallenges.ts:176`). **Team B is never
  refundable.** `cancel` **deletes the challenge row with no refund** and orphans the linked matchroom
  (`:663`). **No expiry cron** (`crons.ts` has zero challenge references) → paid-but-unaccepted is stranded.
- **Security:** non-captains are blocked from accept/pay (`requireCaptain` + `captainBUid`), and a captain
  can only debit their own wallet — but **payment status is client-trusted**, so a modified client / direct
  mutation can create and accept "paid" challenges without paying. Pay+create is **non-atomic** (two calls;
  failure after payment strands funds).
- **Notifications:** captain↔captain notifications exist; **zone-admin/super-admin notifications are
  effectively absent** because challenge rooms never enter the zone pipeline.

### Launch-safety
**NOT launch-safe.** Critical: real money collected but never escrowed/paid out (platform silently keeps
100%); client-asserted payment status; no refund on cancel/expiry and Team B never refundable. Requires
the redesign in [Phase 9](#phase-9) before any paid team-challenge launch. *Mitigation option for an
interim launch: disable paid team challenges (free/social only) until the money model is rebuilt.*

---

<a name="phase-10"></a>
## Phase 10 — Final Report

### 1. Files inspected — see [top section](#files).

### 2. Current payment architecture summary
Wallet-centric. Every provider payment is a **wallet top-up** that then funds a wallet deduction/hold.
Idempotency is enforced through stable `walletTransactions.reference` keys + status guards, and Convex's
single-transaction mutation model (nested `runMutation` is atomic) makes the core money paths crash-safe.
Zone admins are paid out of `users.walletBalance`; there is no separate zone-wallet table.

### 3. Matchroom create payment flow — three paths (free / wallet-atomic / provider-atomic). Provider path
is well-guarded and recoverable. Two gaps: **client-trusted pricing** and **no idempotency key on the
wallet/free create path**.

### 4. Matchroom join payment flow — request → approval → **hold** → slot (atomic) → capture at start.
Slot races are safe (OCC). Main gap: **leave does not release the hold** → wrongful capture.

### 5. Hold / release / refund summary — primitives are idempotent and correct. Releases/refunds fire on
cancel/expire/zone-reject. **Schedulers are never cancelled**; the only safety net for stale captures is the
fire-time room-status guard, which misses the "player left" case. `addFunds` isn't idempotent without a
reference. No release on account deletion.

### 6. Zone payout / settlement summary — paid at completion, idempotent, correct split (90/10 or pilot
100%), correct source-of-truth across views. **No clearing window and no reversal/clawback**, and payout
precedes result verification.

### 7. Worst-case risks by severity
- 🔴 **Critical (Team Challenge):** money collected but never escrowed/paid to venue; client-asserted
  payment status; no refunds (cancel/expiry, Team B).
- 🟠 **High:** (a) leave-after-pay → wrongful capture; (b) no server reconciliation of stuck pending
  payments (app killed + IPN dropped = paid-but-not-credited); (c) no zone-payout reversal/clearing window;
  (d) client-trusted create pricing; (e) unauthenticated hosted-finalize can credit a wallet; (f) orphaned
  holds on account deletion.
- 🟡 **Medium:** no idempotency key on wallet/free create; `addFunds` without reference; abandoned-pending
  & booking-intent TTL not swept server-side; scheduled capture uncancelable; accept-after-lock dead-end;
  multi-captain reject doesn't expire intent; direct `join` bypass; unauth IPN trigger; refund state not
  modeled; withdrawal funds not reserved at request.
- 🟢 **Low:** order-ref/token generation strength; gross fallback over-credit; dead `booking_payment` type;
  `cancelled` tx state unreachable; no platform-revenue ledger.

### 8. Payment security / idempotency findings — see [Phase 7](#phase-7). Solo/zone money movement is
idempotent and replay-safe. The two security holes are **client-trusted pricing** (underpayment) and the
**unverified hosted-finalize handler**. Team Challenge has a **critical** client-trusted-status hole.

### 9. Notification gaps — no payment-confirmed/failed push to payer; no hold/release/refund notifications;
no zone-payout-credited notification; Team Challenge has no zone/super-admin notifications.

### 10. Does the Zone Admin currently get paid correctly and when? — **For solo/zone matchrooms: YES**,
at matchroom completion, idempotently, with the correct 90/10 or pilot-100% split, from a single source of
truth. **But** with no clearing window and **no reversal/clawback**, and it fires before result
verification. **For Team Challenges: NO — the zone admin is never paid at all.**

### 11. Is the current flow safe enough for launch?
- **Solo / zone matchroom payments:** **conditionally yes.** The core money movement is idempotent and
  crash-safe. **Two High-severity fixes should land before launch:** (1) release the hold when a player
  leaves, and (2) add a stuck-pending payment reconciler cron. Strongly recommended alongside: server-side
  price validation, and inquiry-gating the hosted-finalize handler.
- **Team Challenge payments:** **No — not launch-safe.** Either rebuild the money model (Phase 9) or ship
  team challenges as free/social-only for launch.

### 12. Recommended implementation phases (for the eventual fix PR — not started)
- **P0 (launch blockers):** release hold on leave/removal; stuck-pending reconciler cron; disable or fix
  paid Team Challenges.
- **P1 (security):** server-side create/seat price validation; inquiry-gate hosted-finalize; secret on
  IPN/finalize routes; `addFunds` require reference; idempotency key on wallet/free create.
- **P2 (settlement integrity):** venue-payout clearing window + reversal/clawback; payout-after-verification;
  refund state modeling; abandoned-pending & booking-intent expiry sweeps; orphaned-hold watchdog;
  account-deletion hold release.
- **P3 (team challenge rebuild):** bookingIntent-based escrow per team, zoneOwnerUid + zone-admin pipeline,
  atomic pay+create, expiry/refund crons, commission/pilot split.
- **P4 (ops/notifications):** payment-confirmed/failed/payout-credited notifications; super-admin
  reconciliation/repair tooling; platform-revenue ledger; branch-level earnings.

### 13. TypeScript result
`npx tsc -p tsconfig.json --noEmit` → **exit 0, no errors.** (Audit added no source code; type-clean.)

### 14. git status (`git status --porcelain`)
```
 M TEMP_MATCHHAI_PROFILE_EXTERNALS_AND_QR_PRIVACY_FIX.md   (pre-existing, not from this audit)
 M app/super-admin/users.tsx                                (pre-existing)
 M app/super-admin/withdrawals.tsx                          (pre-existing)
 M convex/admin.ts                                          (pre-existing)
 M convex/wallet.ts                                         (pre-existing)
 M convex/zoneWithdrawals.ts                                (pre-existing)
 M src/services/convex/superAdminService.ts                 (pre-existing)
?? TEMP_MATCHHAI_MATCHROOM_PAYMENT_LIFECYCLE_AUDIT.md       (this audit — new tracker only)
```
The 7 modified files were already dirty at session start (see opening git snapshot). **This audit
changed no source — only the new tracker file was created.** No commit made.

### 15. Tracker path — `d:\matchhai_app\TEMP_MATCHHAI_MATCHROOM_PAYMENT_LIFECYCLE_AUDIT.md`

---

> **Reminder:** This is an audit. No payment logic, wallet movement, provider/finalize logic, payout
> formula, ELO, or KYC was changed. Do not implement fixes until reviewed and explicitly approved.
