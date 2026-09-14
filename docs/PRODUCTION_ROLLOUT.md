# MatchHai Production Rollout Handoff

> **Do not run the production commands in this document during QA.** The remediation branch must be tested locally against Convex QA (`striped-dog-623`). A production Convex deployment is intentionally not configured in this handoff.

## Current Release State

| Item | Value |
| --- | --- |
| QA branch | `remediation/production-readiness-2026-09-08` |
| Merge target | `product-ready` |
| Pull request | [#71](https://github.com/matchhaiofficial/Matchhaiproject/pull/71) |
| Handoff commit before this document | `dfa1ee71386769e09d9eec677a9f0c412e65f091` |
| Convex QA deployment | `striped-dog-623` under `shakir-yasin:matchhai-qa` |
| Convex production deployment | **Not configured; supply the approved URL through EAS production environment** |
| PostHog QA | Disabled; QA does not send analytics |
| PostHog production | Reconfigure the existing approved project for production before release |
| EAS owner / project | `matchhai` / `162a78ae-e223-4fe8-93d3-31665f16a590` |

The existing approved PostHog project is reserved for production. Keep its token absent from local QA and configure it in EAS/Convex only at the approved production rollout.

## Phase 1: Development QA Only

Check out the exact PR branch and confirm that the app remains connected to development:

```bash
git fetch origin
git checkout remediation/production-readiness-2026-09-08
git pull --ff-only
git status --short --branch
rg 'striped-dog-623|EXPO_PUBLIC_ENV|EXPO_PUBLIC_CONVEX_DEPLOYMENT_CLASS' .env.local eas.json
```

Never print or share `.env.local` secret values. Install and run the automated gates:

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm test -- --runInBand
npm run test:convex
npx expo-doctor
npx expo export --platform android --output-dir /tmp/matchhai-android-export
```

Run Expo Go for testers with `npx expo start --go --tunnel --clear`. Confirm the terminal reports the development Convex URL before distributing the QR code. A dedicated development/preview EAS profile is intentionally deferred.

Complete and record manual tests for both player and zone-admin accounts:

- Player and zone-admin signup clearly instruct users to verify OTP; invalid, expired, and resend flows fail safely.
- KYC blocks protected functionality until externally approved; profile actions cannot self-approve KYC.
- Branch operating hours use time controls and constrain both matchroom and team-challenge scheduling.
- Availability is calculated for the required player count. Tiers without enough free PCs/consoles are disabled or hidden with a clear explanation.
- Direct booking, broadcast booking, zone approval, rejection, expiry, and counter-offer flows preserve their public behavior.
- Team-challenge creation, acceptance, venue selection, counter-offers, expiry, and resulting matchroom work end to end.
- Reporting explains the consequence; a reported player cannot share a later matchroom with the reporter.
- Matchroom chat shows each sender's name/avatar and the lobby chat button shows unread count.
- Wallet debit/refund, notifications, account deletion, and super-admin/zone-admin authorization work and reject unauthorized callers.
- Existing/older client call paths remain compatible with the guarded canonical backend helpers.

EasyPaisa provider testing was previously deferred. It must be completed with the intended production-like sandbox credentials, callback/IPN route, success, decline, timeout, duplicate callback, reconciliation, and refund cases before release.

PostHog is intentionally disabled in QA. Use local logs and Convex metrics for QA evidence, and confirm that no analytics requests are emitted. The 2026-09-14 automated baseline is 78 Jest suites, 408 passing tests, 43 intentional todos, 4 passing Convex tests, TypeScript clean, and a successful Android export; rerun it on the final QA commit.

## Release Approval Gates

Do not merge or deploy until all of these are recorded in the PR:

- Two-person review of security-sensitive and backward-compatibility changes.
- Manual QA matrix with device/OS, account role, result, and evidence.
- EasyPaisa, OTP/MNP, Didit KYC, push notification, and email integrations verified.
- No unresolved P0/P1 defects; lower-severity deferrals have an owner and written acceptance.
- Convex Database I/O baseline captured on development, with no runaway scheduled jobs. The in-memory scheduler regression test must pass and a development canary must show bounded calls before any production scheduling migration.
- Production backup owner, deployment operator, app-store operator, monitoring owner, and rollback lead identified.

Only then merge PR #71 into `product-ready`. Record the merge commit and use that same commit for Convex and EAS release artifacts.

## Production Configuration Preparation

Reconfigure the existing approved PostHog project for MatchHai production. Record its project ID, public project token, and host (`https://us.i.posthog.com`), and verify that any retained dashboards are production-labelled.

Configure build-time variables in EAS's `production` environment. The PostHog project token is a public ingestion token, but it should still be managed through EAS rather than committed:

```bash
eas env:set --environment production --name EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN --value '<production-project-token>' --visibility plaintext
eas env:set --environment production --name EXPO_PUBLIC_POSTHOG_HOST --value 'https://us.i.posthog.com' --visibility plaintext
eas env:list --environment production
```

Keep PostHog variables absent from local/Expo Go QA. Before a production build, set and verify the approved production Convex URL, site URL, deployment class, exact URL allowlist, and production PostHog values in EAS's `production` environment; do not copy `.env.local` wholesale.

Audit Convex production variables by name without exposing their values. Required categories include Better Auth/site URLs, Veevotech (`VEEVOTECH_*`, including MNP lookup), Didit (`DIDIT_*`), FCM, Resend/support email, EasyPaisa, external gaming APIs, super-admin allowlist, and PostHog. Production safety settings must include:

- `MATCHHAI_ENV=production`
- `SKIP_PHONE_OTP` and `SKIP_KYC_VERIFICATION` absent or not `1`
- `DEMO_SEED_ENABLED` absent or not `true`; never run demo/dev seed functions in production
- `EXPO_PUBLIC_SKIP_PHONE_OTP` and `EXPO_PUBLIC_SKIP_KYC_VERIFICATION` absent from production builds
- Maintenance master/per-job flags enabled only after migration and scheduler verification

After the existing PostHog project is approved for production, configure its server ingestion token without putting it in shell history:

```bash
npx convex env set --prod POSTHOG_PROJECT_TOKEN
npx convex env set --prod POSTHOG_HOST https://us.i.posthog.com
npx convex env set --prod APP_ENV production
```

The first command prompts securely when the value is omitted.

## Backup, Convex Deploy, and Data Migration

Immediately before the approved maintenance window, export production outside the repository and store the archive securely:

```bash
npx convex export --prod --include-file-storage --path ../matchhai-production-pre-rollout-YYYY-MM-DD.zip
npx convex deploy --dry-run
```

Review the dry run for schema/index changes and unexpected function removal. Then, and only with release approval:

```bash
npx convex deploy --message 'production readiness rollout'
```

Run non-scheduling backfills one at a time, observe completion/errors in the Convex dashboard, and record results:

```bash
npx convex run migrations:runBackfillMatchroomLifecycleDueAt '{}' --prod
npx convex run migrations:runBackfillBookingRequestLifecycleDueAt '{}' --prod
npx convex run migrations:runBackfillTeamChallengeLifecycleDueAt '{}' --prod
npx convex run migrations:runBackfillPaymentNextReconcileAt '{}' --prod
```

Do **not** run `runScheduleExistingMatchroomLifecycles`,
`runScheduleExistingTeamChallengeLifecycles`,
`runReschedulePendingTeamChallengeAcceptDeadlines`, or
`runScheduleExistingZoneOfferExpiries` as blanket production migrations. They
create scheduled work. First prove the exact revision on development with a
one-record canary and usage observation; then use a reviewed, rate-limited
production canary procedure with an explicit stop condition. Existing records
remain covered by the individually enabled, bounded recovery jobs during a
controlled rollout.

Next, obtain the real active production zone and branch IDs with read-only queries. For each existing zone, run `scheduleIndexMigration:prepareZoneScheduleIndex` once; for each branch, run `resourceCapacity:refreshBranchSnapshot`. Both are internal operations helpers and require deployment-admin access. Use the Convex dashboard or CLI only after confirming the exact IDs—never invent or reuse development IDs. New/edited zones schedule these updates automatically.

Enable `MATCHHAI_ENABLE_PUSH_DELIVERY=1` only after Firebase/Expo push credentials and a real production device have been verified. It must remain `0` in local/QA while native push testing is deferred; otherwise every in-app notification can spawn a scheduled delivery action that has no device to reach.

Finally, enable the maintenance master flag and required job flags deliberately: `MATCHHAI_ENABLE_MAINTENANCE_CRONS`, `MATCHHAI_ENABLE_LIFECYCLE_CRON`, `MATCHHAI_ENABLE_ZONE_BOOKING_EXPIRY_CRON`, `MATCHHAI_ENABLE_PAYMENT_RECONCILER_CRON`, `MATCHHAI_ENABLE_TEAM_CHALLENGE_EXPIRY_CRON`, and `MATCHHAI_ENABLE_ZONE_PILOT_CRON`. Start with only the jobs the release owner has verified, then watch scheduled-function volume and Database I/O.

## App Build and Staged Release

Authenticate as the configured EAS owner and confirm the remote version/environment before building:

```bash
eas whoami
eas env:list --environment production
eas build --platform android --profile production
```

Install the signed artifact through an internal/closed testing track. Repeat the critical smoke tests against production with designated test accounts and small-value payment transactions. Confirm PostHog events appear only in **MatchHai Production** with `environment=production`.

After sign-off, submit and use a staged Play Store rollout rather than 100% immediately:

```bash
eas submit --platform android --profile production
```

Apply the equivalent reviewed process for iOS when releasing that platform.

## Post-Deploy Monitoring and Rollback

For at least the initial rollout window, monitor Convex function failures, scheduler backlog, Database I/O, auth/OTP errors, payment reconciliation, KYC callbacks, push failures, and PostHog event volume. Compare with the captured baseline. Test an older supported app build against the new backend before expanding rollout.

If the app is faulty, halt the store rollout and ship a build from the last known-good commit. If the backend is faulty, disable only the implicated maintenance job flag, preserve additive schema compatibility, and redeploy reviewed known-good code. Convex data/schema changes do not have a one-command rollback: do not blindly import the backup. Diagnose affected records and use a reviewed forward repair or targeted restore. Disabling PostHog tokens safely stops new analytics but does not repair application behavior.

Record the final merge SHA, Convex deployment timestamp, migration results, backup location, EAS build ID, store release ID/percentage, PostHog project ID, monitoring links, operators, and rollback decision owner in the release ticket.

## Reference Documentation

- [Convex deployment](https://docs.convex.dev/cli/reference/deploy)
- [Convex export](https://docs.convex.dev/cli/reference/export)
- [EAS environment variables](https://docs.expo.dev/eas/environment-variables/)
- [EAS production builds](https://docs.expo.dev/deploy/build-project/)
- [PostHog projects](https://posthog.com/docs/settings/projects)
- [PostHog multiple environments](https://posthog.com/tutorials/multiple-environments)
- Repository monitoring notes: [`docs/MONITORING.md`](./MONITORING.md)
- Test data rules: [`docs/TEST_DATA.md`](./TEST_DATA.md)
