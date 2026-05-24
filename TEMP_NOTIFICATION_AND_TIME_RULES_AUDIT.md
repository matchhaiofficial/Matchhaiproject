# TEMP — Notification System & Time-Rules Audit + Implementation Checklist

> **Do not delete this file without asking.** Living checklist for the notification + time-validation work.
> Audit complete. Implementation tracked per phase below.

---

## Executive Summary

- **Notifications**: ~50 server-driven types written to a single `notifications` table (`convex/schema.ts:1362-1439`) with dedupe keys, push policy/state, recipient role, and deep-link route. Push via **Expo Push** (`convex/pushNotificationsActions.ts`). Three in-app surfaces: player inbox, zone-admin module, super-admin page.
- **Biggest bug**: "Matchroom starts in 15 minutes" is a **client-side Expo local notification**, not a server row. The trigger was built as `{ date, channelId } as any` with **no `type: SchedulableTriggerInputTypes.DATE`** → Expo delivers immediately. Compounded by a dashboard filter that included rooms up to 15 min in the past, and walk-in/legacy near-now rooms.
- **Time rules**: solo matchroom backend enforces 3 days but the frontend picker only blocked <1h; team challenge enforced 3 days (target 2); walk-in skipped validation entirely; zone counter-offer had no ±2h / not-past validation.
- **UI**: three surfaces use three different card structures and tab vocabularies; no shared card; orderRef only in player inbox.

## Confirmed Decisions
- Solo matchroom min lead = **3 days** (max 62 days).
- Team challenge min lead = **2 days** (relaxed from 3; max 62 days).
- Walk-in matchroom min lead = **1 day** (new; max 62 days).
- Zone counter-offer = within **±2h of original**, not in the past.
- Stale reminders = **one-time full clear on next launch**, then reconcile.
- No payment/wallet/payout logic changes; no auth weakening; no raw provider/bank data in copy.

---

## Notification Inventory (existing)

Single table `notifications`. ~50 types across: `social.ts`, `teams.ts`, `teamChallenges.ts`, `matchrooms.ts`, `bookings.ts`, `zoneAdminBooking.ts`, `matchroomBroadcast.ts`, `zoneAdminResources.ts`, `kycNotifications.ts`, `reports.ts`, `support.ts`, `wallet.ts`, `easypaisa.ts`, `zones.ts`, `zonePilot.ts`, `admin.ts`, `withdrawalNotifications.ts`. Dedupe strategies: `upsert_active`, `replace_active`, `versioned_new`. Push policy: `none|eligible|force`; push state: `pending|sent|failed|skipped`. (Full per-type table in the approved plan.)

Notable existing gaps to address in Phase 4: reporter not notified of report resolution; withdrawal requester not notified of outcome; broadcast selected/won/lost partial; server-backed 24h/2h/30m reminders absent (only client 15m existed).

---

## 15-Minute Reminder — Root Cause

Client-side Expo local notification. Flow:
1. `convex/dashboard.ts:165-176` builds `upcomingRooms`; filter included `startAt >= now - 15*60*1000` (past rooms).
2. `src/components/NotificationRuntimeBridge.tsx:106-117` reconciles on every foreground tick.
3. `src/services/reminderManager.ts:17-20` computes `triggerAtMs = startAt - 15m`.
4. `src/services/localNotifications.ts:121-146` scheduled via Expo with a **malformed trigger** (`{ date, channelId } as any`, no `type`) → immediate delivery.

Fix = typed DATE trigger + future-only dashboard filter + reminderManager past-guard + one-time cleanup. No server rows involved.

---

## Time / Date / Slot Rule Audit

| Flow | BE before | FE before | Target | BE file | FE file |
|---|---|---|---|---|---|
| Solo matchroom | 3d | +1h only | 3d | `convex/timing.ts` / `matchrooms.ts:1813` | `app/matchrooms/create/index.tsx:532` |
| Team challenge | 3d | 3d | **2d** | `convex/teamChallenges.ts:36-51` | `app/teams/challenge-create.tsx:969` |
| Walk-in | none | same-day | **1d** | `convex/matchrooms.ts:1641-1725` | `app/matchrooms/create/index.tsx:534` |
| Counter-offer | none | none | **±2h, not past** | `convex/zoneAdminBooking.ts:1401-1570` | `app/matchrooms/components/MatchroomSuggestSheet.tsx` |

Timestamp risks: counter-offer used locale-dependent `toLocaleTimeString()` (normalize to `HH:mm`); walk-in stores date/time strings vs ms `scheduledStartAt` elsewhere; no timezone normalization (device-local).

---

## Risks

- Reminder fix touches a shared `upcomingRooms` field also used by the home UI (future-only filter slightly changes which rooms show as "upcoming" — semantically correct).
- Time-rule changes touch creation/counter-offer mutations — must preserve lock/expiry/resource rules; no payment movement.
- Phase 4 spam risk → enforce dedupe keys + cron idempotency.

---

## Phase Checklist

- [x] **Phase 1 — Audit** (this document)
- [x] **Phase 2 — Wrong 15-minute reminder fix** ✅ (tsc clean, exit 0)
  - [x] Typed Expo DATE trigger in `localNotifications.ts`
  - [x] Future-only / valid reminder source in `dashboard.ts`
  - [x] Guards in `reminderManager.ts` (skip past/invalid/completed)
  - [x] One-time cleanup on next launch (AsyncStorage flag)
  - [x] Dedupe preserved (userId+roomId+startAtMs+minutesBefore)
  - [x] tsc passes
- [x] **Phase 3 — Time rules** ✅ (tsc clean, exit 0; codegen pushed to `dev:ardent-lynx-28`)
  - [x] Solo 3d (FE picker aligned to existing BE 3d)
  - [x] Team 2d (FE + BE + both FE/BE service copies)
  - [x] Walk-in 1d / no same-day (FE + BE, new `validateWalkInScheduleWindow`)
  - [x] Counter-offer ±2h + not-past (FE + BE), HH:mm + local-date normalization
  - [x] Max 62d enforced FE + BE (unchanged, reused)
  - [x] tsc passes; convex codegen run
- [x] **Phase 4 — Notification triggers** ✅ (tsc clean; pushed to `dev:ardent-lynx-28`)
  - [x] 4A server reminders 24h/2h/30m (lifecycle sweep, bucketed, dedupe pre-check)
  - [x] 4B result: verification_required, disputed, admin_review; finalized extended to participants
  - [x] 4C withdrawal.requested to requester (result already covered)
  - [x] 4D report result to reporter — ALREADY COVERED (`admin.ts updateReportStatus`)
  - [~] 4E broadcast extras — DEFERRED (started/failed/expired/offer_received/venue-confirmed/closed-elsewhere already exist)
  - [~] 4F team-challenge extras — DEFERRED (received/accepted/rejected/venue_proposed/venue_confirmed exist; completed/cancelled deferred)
  - [x] 4G sanity types — confirmed covered
- [x] **Phase 5 — Notification UI unification** ✅
  - [x] 5A shared `src/utils/notificationCategories.ts` (category/label/icon)
  - [x] 5B player inbox: new types labelled/iconed; generic-info render; filter ok
  - [x] 5C zone admin: category label/icon; honors server route for non-booking/match types
  - [x] 5D super admin: added withdrawals/kyc/zones/broadcasts categories + labels
  - [x] 5E deep-link safety: all surfaces no-op on missing route (no crash)
- [x] **Phase 6 — QA + final report** ✅ (tsc exit 0; codegen exit 0 → staging; git diff --check exit 0)

### New notification types (Phase 4)
| Type | Recipient | Trigger | Route | Dedupe key | Push |
|---|---|---|---|---|---|
| match.reminder_24h/2h/30m | participants | lifecycle sweep, bucketed by time-to-start | /matchrooms/{id} | `match.reminder_{w}:{roomId}:{userId}` | eligible |
| match.result_verification_required | captains | sweep: completed + verification open | /matchrooms/{id} | `match.result_verification_required:{roomId}:{captainId}` | eligible |
| match.result_disputed | participants | submitCaptainReport → participant_vote | /matchrooms/{id} | `match.result_disputed:{roomId}:{uid}` | eligible |
| match.result_admin_review | super admins | markInvalidResultVerificationForAdminReview | /super-admin | `match.result_admin_review:{roomId}:{saId}` | eligible |
| withdrawal.requested | requester (zone admin) | createZoneWithdrawalTransaction | /zone/profile | `withdrawal.requested:{withdrawalId}:{uid}` | eligible |

Idempotency: reminders + verification_required + admin_review use a `by_dedupeKey` existence pre-check (`notificationExistsByDedupeKey`) → exactly-once even after read/archive. All use `dedupePolicy: upsert_active`/`replace_active`. No schema change.

### Phase 4/5 files changed
- `convex/matchrooms.ts` — reminder/result helpers + sweep hooks + dispute/admin-review + finalized→participants.
- `convex/withdrawalNotifications.ts` + `convex/wallet.ts` — `withdrawal.requested`.
- `src/utils/notificationCategories.ts` (new) — shared taxonomy.
- `app/(player)/components/InboxNotificationCard.tsx` — label/icon fallback + generic-info render.
- `app/zone/modules/notifications.tsx` — category label/icon + server-route honoring.
- `app/super-admin/notifications.tsx` — extended category buckets/labels.

## Files Inspected
`convex/{notifications,matchrooms,matchroomBroadcast,zoneAdminBooking,teamChallenges,wallet,easypaisa,zonePilot,zones,support,reports,admin,bookings,kycNotifications,withdrawalNotifications,dashboard,timing,crons,schema,pushNotificationsActions}.ts`; `src/services/{localNotifications,reminderManager,pushRegistration}.ts`; `src/utils/timeFilters.ts`; `src/constants/timing.ts`; `src/hooks/useNotifications.ts`; `src/components/{NotificationRuntimeBridge,PushRegistrationBridge}.tsx`; `app/(player)/inbox.tsx` + `components/InboxNotificationCard.tsx`; `app/zone/modules/notifications.tsx`; `app/super-admin/notifications.tsx`; `app/matchrooms/create/*`; `app/teams/challenge-create.tsx`; `app/matchrooms/components/MatchroomSuggestSheet.tsx`; `app/matchrooms/hooks/useMatchroomDetailActions.ts`.

## Files Changed (running log)

**Phase 2:**
- `src/services/localNotifications.ts` — typed `SchedulableTriggerInputTypes.DATE` trigger; `runOneTimeReminderCleanupIfNeeded()` + flag.
- `src/services/reminderManager.ts` — skip completed/cancelled/expired rooms; skip invalid/past `startAtMs`; skip past `triggerAtMs`.
- `convex/dashboard.ts` — `upcomingRooms` filter changed to future-only (`startAt >= now`).
- `src/components/NotificationRuntimeBridge.tsx` — run one-time cleanup on mount; gate reconciliation on `cleanupReady`.

**Phase 3:**
- `convex/timing.ts` + `src/constants/timing.ts` — add `WALKIN_MIN_LEAD_MS` (1d), `COUNTER_OFFER_TIME_WINDOW_MS` (2h), `validateWalkInScheduleWindow()` (no same-day, max 2mo).
- `convex/teamChallenges.ts` + `src/services/convex/teamMatchService.ts` — team min lead 3d → 2d (constant + message), both BE and FE copies.
- `app/teams/challenge-create.tsx` — picker min +3d → +2d; helper text.
- `app/matchrooms/create/index.tsx` — picker min: solo now+3d (was +1h); walk-in earliest = tomorrow (was today).
- `app/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts` — walk-in submit uses `validateWalkInScheduleWindow`.
- `convex/zoneAdminBooking.ts` — `createWalkInMatchroom` uses `validateWalkInScheduleWindow`; `sendCounterOffer` adds `originalStartAt`/`proposedStartAts` args + ±2h/not-past enforcement.
- `src/services/convex/zoneAdminBookingService.ts` — `sendZoneCounterOffer` passes `originalStartAt`/`proposedStartAts`.
- `app/matchrooms/hooks/useMatchroomDetailActions.ts` — HH:mm + local-date counter; FE ±2h/not-past guard; passes ms bounds.
- `app/zone/modules/hooks/useZoneBookingsActions.ts` — computes `proposedStartAts`; FE not-past guard; passes them through.

**Deployment note:** `npx convex codegen` in this repo bundles + uploads functions; it pushed backend changes to `dev:ardent-lynx-28` (project: matchhai-staging — the dev deployment in `.env.local`) during Phase 3 **and** Phase 4/5. Not production. No payment/wallet/payout logic changed. ⚠️ Codegen uploads the **entire** `convex/` directory, so it also pushed pre-existing uncommitted backend WIP (see below) to staging.

---

## Pre-existing working-tree changes (NOT this effort)

At session start the tree already had ~942 insertions of unrelated WIP (an auth/session-error-logging + super-admin payments/withdrawals effort). These are **bundled into the safe-branch checkpoint commit** but are not part of Phases 2–6:
`TEMP_FILTER_AUDIT_AND_FIX_CHECKLIST.md`, `app/super-admin/(tabs)/payments.tsx`, `app/super-admin/withdrawals.tsx`, `app/super-admin/zones.tsx`, `app/zone/modules/pricing.tsx`, `convex/admin.ts`, `convex/kycGate.ts`, `convex/schema.ts`, `src/lib/convex.ts`, `src/providers/AuthenticatedConvexProvider.tsx`, `src/services/convex/superAdminService.ts`, `src/services/convex/zoneService.ts`, `src/utils/userFacingErrors.ts`. (Also `src/services/convex/zoneAdminBookingService.ts` mixes a pre-existing logging refactor with my counter-offer pass-through.)

## Deferred (documented, not started)
- Broadcast extras: `selected` / `closed-elsewhere-to-zone` / `offer accepted-rejected` detail types (core states already notify).
- Team-challenge extras: `completed` / `cancelled` / `expired` (received/accepted/rejected/venue states already notify).
- Walk-in `scheduledStartAt` UTC-vs-local parsing cleanup (pre-existing; date-based 1-day rule is robust to it).

## Remaining device QA
- Reminders fire once at ~24h/2h/30m; skip cancelled/completed/expired; no immediate false 15m.
- Result verification/dispute/admin-review reach correct recipients; finalized reaches participants.
- Withdrawal requested + result reach requester; no bank/account data shown.
- All categories render across player/zone/super-admin; routes open safely; unknown types don't crash.
- Timezone edge cases around midnight for lead-time/counter-offer.
