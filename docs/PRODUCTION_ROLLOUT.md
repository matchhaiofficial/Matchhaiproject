# MatchHai Production Rollout Handoff

> **Do not run the production commands in this document during QA.** The remediation branch must be tested locally against Convex development (`acrobatic-bison-271`). Production (`nautical-ibex-721`) has not been deployed to or changed as part of this handoff.

## Current Release State

| Item | Value |
| --- | --- |
| QA branch | `remediation/production-readiness-2026-09-08` |
| Merge target | `product-ready` |
| Pull request | [#71](https://github.com/matchhaiofficial/Matchhaiproject/pull/71) |
| Handoff commit before this document | `dfa1ee71386769e09d9eec677a9f0c412e65f091` |
| Convex QA deployment | `acrobatic-bison-271` |
| Convex production deployment | `nautical-ibex-721` |
| PostHog QA project | `Default project` (ID `569505`, US Cloud) |
| PostHog production project | **Not created yet** |
| EAS owner / project | `basimmmmm` / `cc63aac8-7e68-4dbc-9e95-c59e145fb7b4` |

The authenticated PostHog CLI token is project-scoped. Its available commands cannot create an organization-level project, and the organization request was rejected for insufficient scope. Create a separate project named **MatchHai Production** in the PostHog UI before release. Do not reuse the QA project or a personal API key.

## Phase 1: Development QA Only

Check out the exact PR branch and confirm that the app remains connected to development:

```bash
git fetch origin
git checkout remediation/production-readiness-2026-09-08
git pull --ff-only
git status --short --branch
rg 'acrobatic-bison-271|EXPO_PUBLIC_ENV' .env.local eas.json
```

Never print or share `.env.local` secret values. Install and run the automated gates:

```bash
npm ci --legacy-peer-deps
npm run typecheck
npm test -- --runInBand
npx expo-doctor
npx expo export --platform android --output-dir /tmp/matchhai-android-export
```

Run Expo for testers with `npx expo start --tunnel --clear`. Confirm the terminal reports the development Convex URL before distributing the QR code. Use a development/preview build if a native module is unavailable in Expo Go.

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

Use the [QA PostHog dashboard](https://us.posthog.com/project/569505/dashboard/2076206) to confirm development events arrive once, contain `environment=development`, and exclude phone numbers, email addresses, chat text, KYC data, tokens, and other sensitive payloads. The existing automated baseline is 67 suites, 344 passing tests, 43 intentional todos, TypeScript clean, Expo Doctor 18/18, and a successful Android export; rerun it on the final QA commit.

## Release Approval Gates

Do not merge or deploy until all of these are recorded in the PR:

- Two-person review of security-sensitive and backward-compatibility changes.
- Manual QA matrix with device/OS, account role, result, and evidence.
- EasyPaisa, OTP/MNP, Didit KYC, push notification, and email integrations verified.
- No unresolved P0/P1 defects; lower-severity deferrals have an owner and written acceptance.
- Convex Database I/O baseline captured on development, with no runaway scheduled jobs.
- Production backup owner, deployment operator, app-store operator, monitoring owner, and rollback lead identified.

Only then merge PR #71 into `product-ready`. Record the merge commit and use that same commit for Convex and EAS release artifacts.

## Production Configuration Preparation

Create **MatchHai Production** in PostHog US Cloud. Record its project ID, public project token, and host (`https://us.i.posthog.com`). Recreate the QA dashboard in that project because dashboards do not span projects.

Configure build-time variables in EAS's `production` environment. The PostHog project token is a public ingestion token, but it should still be managed through EAS rather than committed:

```bash
eas env:set --environment production --name EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN --value '<production-project-token>' --visibility plaintext
eas env:set --environment production --name EXPO_PUBLIC_POSTHOG_HOST --value 'https://us.i.posthog.com' --visibility plaintext
eas env:list --environment production
```

Keep the QA PostHog token in local/development/preview environments only. Verify that production EAS values still point to `nautical-ibex-721`; do not copy `.env.local` wholesale.

Audit Convex production variables by name without exposing their values. Required categories include Better Auth/site URLs, Veevotech (`VEEVOTECH_*`, including MNP lookup), Didit (`DIDIT_*`), FCM, Resend/support email, EasyPaisa, external gaming APIs, super-admin allowlist, and PostHog. Production safety settings must include:

- `MATCHHAI_ENV=production`
- `SKIP_PHONE_OTP` and `SKIP_KYC_VERIFICATION` absent or not `1`
- `DEMO_SEED_ENABLED` absent or not `true`; never run demo/dev seed functions in production
- `EXPO_PUBLIC_SKIP_PHONE_OTP` and `EXPO_PUBLIC_SKIP_KYC_VERIFICATION` absent from production builds
- Maintenance master/per-job flags enabled only after migration and scheduler verification

After the PostHog production project exists, configure its server ingestion token without putting it in shell history:

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

Run migrations one at a time, observe completion/errors in the Convex dashboard, and record results:

```bash
npx convex run migrations:runBackfillMatchroomLifecycleDueAt '{}' --prod
npx convex run migrations:runBackfillBookingRequestLifecycleDueAt '{}' --prod
npx convex run migrations:runBackfillTeamChallengeLifecycleDueAt '{}' --prod
npx convex run migrations:runBackfillPaymentNextReconcileAt '{}' --prod
npx convex run migrations:runScheduleExistingMatchroomLifecycles '{}' --prod
npx convex run migrations:runScheduleExistingTeamChallengeLifecycles '{}' --prod
npx convex run migrations:runReschedulePendingTeamChallengeAcceptDeadlines '{}' --prod
npx convex run migrations:runScheduleExistingZoneOfferExpiries '{}' --prod
```

These runners are batched, but scheduling migrations create scheduled work. Watch failure rate and Database I/O after every command instead of launching them together.

Next, obtain the real active production zone and branch IDs with read-only queries. For each existing zone, run `scheduleIndexMigration:prepareZoneScheduleIndex` once; for each branch, run `resourceCapacity:refreshBranchSnapshot`. Both are internal operations helpers and require deployment-admin access. Use the Convex dashboard or CLI only after confirming the exact IDs—never invent or reuse development IDs. New/edited zones schedule these updates automatically.

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
