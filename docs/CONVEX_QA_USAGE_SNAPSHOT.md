# Convex QA usage snapshot

`npm run qa:convex:usage` is a small, read-only regression check for the
shared MatchHai QA deployment:

```text
shakir-yasin:matchhai-qa / striped-dog-623
```

It checks the CLI's configured team/project/deployment identity, reads current
function-call and database-I/O counters, and samples the Convex
`_scheduled_functions` system table with a hard cap of 1,000 rows. It prints
aggregate counts only; scheduler IDs and arguments are never printed. The
script has no mutation, deploy, import, or export path. It also refuses
deployment arguments and refuses a non-QA `.env.local` binding.

The JSON form is useful for saving two comparable samples:

```bash
npm run qa:convex:usage -- --json > /tmp/matchhai-qa-usage-before.json
# perform the approved QA activity, or wait five minutes
npm run qa:convex:usage -- --json > /tmp/matchhai-qa-usage-after.json
```

Do not treat `sampleTruncated: true` as a pass: the sample is then too small
to establish a scheduler bound. The script emits an alert for that condition,
for pending jobs already due, or when a daily tripwire is reached.

## Idle check

After seed completion and with no user activity, take two samples five minutes
apart. An idle pass requires all of the following:

- `scheduler.sampleTruncated` is `false`;
- `scheduler.duePendingRows` is `0` in both samples;
- `pendingRows` does not increase between samples;
- function calls increase by no more than **15 calls / 5 minutes**; and
- database I/O increases by no more than **0.05 GB / 5 minutes**.

The two CLI reads themselves account for a small, expected amount of usage.
If any condition fails, stop the canary and inspect the pending function names
and Convex insights before continuing.

## Active one-record canary

Run one approved QA user flow that is expected to create one scheduled
lifecycle job. Take a sample immediately before the flow and another five
minutes after it. For a one-record canary, a pass requires:

- no more than **one additional pending job** (or the explicitly documented
  number for a flow that intentionally schedules more than one);
- no unexpected `duePendingRows` after the flow's expected deadline;
- function calls increase by no more than **100 calls / 5 minutes**; and
- database I/O increases by no more than **0.10 GB / 5 minutes**.

After the active sample, repeat the idle check. A pending count that grows on
each sample, a due job that remains due, or a duplicate-looking function
bucket is a stop condition even when the aggregate is below these limits.

The daily safety tripwires are **15,000 function calls** or **1 GB database
I/O**. They are reported in the snapshot's `alerts` array; reaching either is
an immediate stop-and-investigate condition. These tripwires do not configure
or change Convex usage limits.

If the script refuses to run, restore the QA-only local binding before trying
again. Do not pass `--deployment`, `--prod`, or another project's deployment.
