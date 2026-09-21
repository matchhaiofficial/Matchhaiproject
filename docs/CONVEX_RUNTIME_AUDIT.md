# Convex Runtime and Query Audit

## Scope and deployment

Reviewed all `ctx.scheduler`, cron registrations, and `.collect()` calls in the
Convex source. Runtime checks targeted only QA deployment `striped-dog-623`.
Production was not accessed or changed.

## Background-work findings

- Matchroom lifecycle work is one-shot and event-driven. A room stores its next
  meaningful deadline plus the scheduled-function ID. Changed deadlines now
  cancel the superseded job; callbacks also reject stale `expectedDueAt` values
  and terminate if processing cannot advance to a future deadline.
- Team-challenge and zone-pilot expiry use the same deadline/ID/cancellation
  pattern. Broadcast and counter-offer expiry callbacks validate their current
  deadline/state before acting.
- All five recovery crons require both the maintenance master flag and their
  individual flag. QA has zero registered cron jobs.
- EasyPaisa's per-payment exception retry chain previously had no attempt cap.
  It is now limited to six scheduled retries. Optional recovery-cron/manual
  reconciliation remains available and idempotent.
- In-app notifications previously scheduled native-push actions even in QA and
  for recipients with no active device. Push delivery now requires
  `MATCHHAI_ENABLE_PUSH_DELIVERY=1` and an active token before an action is
  scheduled. Chat push uses the same preflight.

The QA scheduler table contained 197 historical rows after seeding: 157 push
delivery attempts, 32 batched area notifications, and 8 matchroom lifecycle
jobs. Only the 8 legitimate future matchroom lifecycle jobs remained pending;
there were no pending push jobs. This explains the observed one-time seed burst
without indicating another idle loop.

After the QA pagination deploy, a fixed-target five-minute idle snapshot kept
all 197 scheduler rows and 8 pending jobs unchanged, with 0 overdue jobs. The
daily function-call counter increased by 4 (the read-only checks themselves)
and Database I/O did not increase.

## On-demand query findings

Current chat lists and player wallet history use bounded recent reads. Wallet
pagination reports when its two-source merge reaches the scan window instead
of presenting an exact total. Legacy array-returning endpoints remain available
for deployed clients.

The following are not idle workloads, but can become expensive while their
reactive screens are open and data grows:

- exact super-admin dashboard totals/revenue scan multiple complete tables;
- legacy booking, matchroom, team-challenge, and report history endpoints still
  return arrays built from full user/zone histories;
- unread/pending notification counts read every matching notification;
- zone resource administration intentionally loads full branch inventories.

These require indexed cursor pagination and, for exact aggregate counts,
transactionally maintained counter tables. Silently applying arbitrary limits
would break older clients or mislead admins, so they remain an explicit release
risk rather than being disguised as complete.

## Verification gates

Regression tests cover scheduler progress, stale-job rejection, cancellation,
push circuit breaking/device preflight, and capped EasyPaisa retries. Before
production, run an active user-journey soak and an idle soak, then compare
function calls, scheduled backlog, Database I/O, and compute with the recorded
baseline.
