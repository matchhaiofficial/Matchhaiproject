# Convex Usage Remediation

## What failed

The development deployment ran `matchrooms.processScheduledLifecycle` about
938,000 times and consumed 10.96 GB of database I/O. A matchroom stored a
`lifecycleDueAt` timestamp describing the next moment when its state might need
to change. For some already-due states, the worker made no state change and
scheduled the same timestamp again. Convex executes past timestamps immediately,
so the function repeatedly called itself as fast as the backend allowed.

In plain terms, the scheduler is an alarm clock for server-owned transitions:
lock an unfilled room, start a confirmed room, finish it, expire a venue search,
or request result confirmation even when nobody has the app open. `nextDueAt`
is the next alarm time. We need this for reliable lifecycle behavior, but every
alarm must either change state, move to a future time, or stop.

## Changes made

- Matchroom jobs now recompute state after every run and only schedule a
  strictly future deadline. An unchanged due deadline terminates the chain.
- Overdue jobs use a shared one-second safety delay instead of scheduling at
  `Date.now()`. The rule is enforced across matchrooms, team challenges, zone
  pilots, offers, and migrations.
- Existing-matchroom migration ignores stale persisted deadlines. Offer
  scheduling persists a marker so rerunning its migration does not duplicate
  jobs.
- Notification dedupe reads are newest-first and bounded. Better Auth seed
  pagination aborts if its cursor stops advancing.
- Native push delivery now requires `MATCHHAI_ENABLE_PUSH_DELIVERY=1` and an
  active recipient device before a scheduled action is created. QA keeps the
  flag off.
- EasyPaisa's per-payment self-scheduled chain stops after six retries; later
  manual or explicitly enabled recovery-cron reconciliation stays idempotent.
- When a matchroom deadline changes, both scheduling entry points cancel the
  superseded pending job before storing the replacement.
- The always-mounted notification bridge no longer subscribes to the broad home
  dashboard query. Friend presence was split from that query; heartbeats run
  every 90 seconds and duplicate writes inside 30 seconds are ignored.

## Recurring-work inventory

| Work | Trigger | Termination / bound |
| --- | --- | --- |
| Matchroom lifecycle | One job per persisted future deadline | State advances or chain stops; optional recovery cron is feature-gated |
| Team-challenge expiry | One job per deadline | Terminal status or recomputed future deadline |
| Zone offer / broadcast expiry | One job per offer/window | Status or generation/deadline check; migration marker prevents duplicates |
| Zone pilot expiry | One terminal job | Active pilot becomes ended; recovery cron is gated and batched |
| Payment reconciliation | Delayed retry | At most six self-scheduled retries at a 30-minute cooldown; seven-day recovery eligibility; batch cron separately gated |
| Account deletion / index backfills | Explicit batch worker | Paginated, capped batches with cursor/progress checks |
| Push fan-out | User/domain event | Explicit environment flag, active-device preflight, capped recipient batches; no idle poller |
| Presence | Foreground client heartbeat | 90-second client interval plus server write throttle |

No other infinite server-side loop was found. Broad admin/reporting queries and
user-scoped `.collect()` calls remain finite scaling risks; they require indexed
counters or pagination rather than arbitrary caps that could display incorrect
business totals.

## Verification and release gates

Run `npm run validate`. It includes Jest contracts/unit/UI tests and the
`convex-test` suite. The scheduler test executes the registered Convex mutation
in memory, advances fake time, and verifies one due job becomes exactly one
future job.

Fresh QA deployment `striped-dog-623` is healthy and has zero cron jobs. After
seeding it contained 197 scheduler rows: 157 completed push attempts from the
pre-circuit-breaker seed, 32 completed area-notification batches, and eight
legitimate future matchroom lifecycle jobs (one per room). A later observation
showed the same total and pending set, so no idle chain was running. Multi-user,
provider, and device verification remains outstanding. Do not deploy production
until the full QA matrix and active usage canary pass. Never enable all recovery
jobs simultaneously.

Circuit breakers recorded for the former development deployment on 2026-09-11
must not be assumed to apply to the fresh QA project:

- function calls: disable at 15,000 per day;
- database I/O: disable at 1 GB per day (the CLI only accepts whole native
  units, so the function-call limit is the earlier practical tripwire).

Convex does not support warning-type limits on development deployments, so
monitor the dashboard during canaries instead of relying on warning email.

## Recovery

The code fix cannot restore consumed quota. Continue deploying only to
`striped-dog-623` during QA. Run a one-record active canary, confirm function-call
and database-I/O rates remain flat, then expand gradually. The old production
deployment `nautical-ibex-721` remains untouched.
