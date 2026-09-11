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
| Payment reconciliation | Delayed retry | 30-minute cooldown, seven-day maximum age, gated batch cron |
| Account deletion / index backfills | Explicit batch worker | Paginated, capped batches with cursor/progress checks |
| Push fan-out | User/domain event | Recipient batches are capped; no self-running idle poller |
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

The cloud development deployment is quota-stopped, so live scheduler, multi-user,
provider, and device verification remains outstanding. Do not deploy production
or run scheduling migrations until development capacity is restored (or a local
Convex backend is used), the full QA matrix passes, and usage is observed during
a small canary. Never enable all recovery jobs simultaneously.

Development circuit breakers configured on 2026-09-11:

- function calls: disable at 15,000 per day;
- database I/O: disable at 1 GB per day (the CLI only accepts whole native
  units, so the function-call limit is the earlier practical tripwire).

Convex does not support warning-type limits on development deployments, so
monitor the dashboard during canaries instead of relying on warning email.

## Recovery

The code fix cannot restore consumed quota. Options are the monthly reset,
upgrading temporarily, or asking Convex support for assistance. When access
returns: deploy only to `acrobatic-bison-271`, cancel obsolete pending lifecycle
jobs if present, run a one-record canary, confirm function-call and database-I/O
rates remain flat, then expand gradually. Production `nautical-ibex-721` remains
untouched.
