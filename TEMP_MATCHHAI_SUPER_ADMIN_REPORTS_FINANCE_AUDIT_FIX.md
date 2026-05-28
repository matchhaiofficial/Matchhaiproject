# MatchHai Super Admin Reports + Finance Audit/Fix

## Scope

- Fix explicit chat/support moderation reports in Super Admin Reports.
- Keep normal support chatbot/help tickets in Super Admin Support Tickets.
- Add read-only Zone Finance analytics on Super Admin Withdrawals.
- Audit Super Admin panel and record recommendations only.
- No wallet/payment movement, payout calculation, Easypaisa/IPN/finalize, or withdrawal approve/reject behavior changes.

## Files Inspected

- `convex/_generated/ai/guidelines.md`
- `convex/schema.ts`
- `convex/reports.ts`
- `convex/support.ts`
- `convex/admin.ts`
- `convex/wallet.ts`
- `convex/matchrooms.ts`
- `convex/teamChallengeChat.ts`
- `app/(player)/friend-chat/[friendId].tsx`
- `app/matchrooms/chat/[id].tsx`
- `app/teams/challenge-chat.tsx`
- `app/super-admin/(tabs)/reports.tsx`
- `app/super-admin/report/[id].tsx`
- `app/super-admin/withdrawals.tsx`
- `app/super-admin/support-tickets.tsx`
- `src/features/support/SupportChatScreen.tsx`
- `src/features/support/supportAssistant.ts`
- `src/services/convex/reportService.ts`
- `src/services/convex/superAdminService.ts`

## Report Types Found

- Existing moderation reports:
  - `user_report`
  - `zone_complaint`
  - `matchroom_complaint`
- Added explicit chat moderation report types:
  - `friend_chat_message_report`
  - `matchroom_chat_message_report`
  - `team_challenge_chat_message_report`
- Added compatibility type for team-specific moderation grouping:
  - `team_report`

## Report Sources Found

- Player profile report: `submitUserReport` -> `reports`.
- Team screen report: currently reports a user/captain through `submitUserReport` -> `reports`.
- Venue/zone report: `submitZoneComplaint` -> `reports`.
- Matchroom report: existing matchroom/player report paths -> `reports`.
- Support chatbot normal support escalation: `create_support_ticket` / `create_admin_escalation` -> `supportTickets`.
- Support chatbot explicit moderation escalation: `create_moderation_report` -> `reports`.
- Chat message reports: added explicit long-press `Report` action -> `reports`.

## Chat/Support Report Root Cause

- Chat message reports were missing because the chat screens exposed reply/copy/edit/pin/delete actions, but no explicit `Report` action and no backend mutation for chat message moderation reports.
- Support chatbot moderation reports already used a separate `create_moderation_report` path, but the created rows lacked source/target metadata and did not notify Super Admin review queues.
- Normal support tickets are intentionally separate and should not appear in Super Admin Reports.

## Clarified Routing Rules

- Normal support/chatbot conversation = `supportTickets`, shown in Super Admin -> Support Tickets only.
- User help request = `supportTickets`, shown in Super Admin -> Support Tickets only.
- Account deletion request and operational support item = support flow / Support Tickets unless explicitly submitted as moderation.
- Explicit support/chatbot moderation report = `reports`, shown in Super Admin -> Reports.
- Explicit chat message report = `reports`, shown in Super Admin -> Reports.
- Player, zone/venue, matchroom, and team moderation reports = `reports`, shown in Super Admin -> Reports.

## Backend Queries Affected

- `reports.createFriendChatMessageReport`
- `reports.createMatchroomChatMessageReport`
- `reports.createTeamChallengeChatMessageReport`
- `support.createModerationReportFromAgent` path via `executeAgentToolGateway`
- `admin.listReports`
- `admin.getReportById`
- `admin.listZoneFinanceSummaries`

## Super Admin UI Changes

- Reports list:
  - Added chat/support source context and message preview where available.
  - Added filters for chat message reports and support moderation reports.
  - Search now includes chat/support target metadata and message preview.
- Report detail:
  - Shows target type/reference, chat IDs, support ticket/conversation IDs, source, and safe message preview.
  - Shows "Record no longer available" when linked target records are missing.
  - Warning/suspension actions remain available only when a reported user is known.
- Withdrawals:
  - Added Zone Finance summary section on the Withdrawals page.

## Zone Finance Analytics Model

- Timezone/week definition: Asia/Karachi, week starts Monday.
- Earned amount:
  - Source: `walletTransactions` where `type === "deposit"`, `status === "completed"`, and `metadata.source === "matchroom_completion_payout"`.
  - Zone grouping: `metadata.zoneId` if present, otherwise `metadata.matchroomId -> matchrooms.zoneId`.
  - Respects existing payout truth; does not recompute payout math.
- Withdrawn amount:
  - Source: `walletTransactions` where `type === "withdrawal"`, `status === "completed"`, and `metadata.source === "zone_admin_withdrawal_request"`.
- Pending withdrawal amount:
  - Source: same withdrawal source with `status === "pending"`.
- Failed/rejected withdrawals:
  - Not counted as completed withdrawn.
- Privacy:
  - Zone Finance table does not expose bank account details, CNIC, phone, provider payloads, or payment secrets.

## Files Changed

- `convex/schema.ts`
- `convex/reports.ts`
- `convex/support.ts`
- `convex/admin.ts`
- `src/services/convex/reportService.ts`
- `src/services/convex/superAdminService.ts`
- `app/(player)/friend-chat/[friendId].tsx`
- `app/matchrooms/chat/[id].tsx`
- `app/teams/challenge-chat.tsx`
- `app/super-admin/(tabs)/reports.tsx`
- `app/super-admin/report/[id].tsx`
- `app/super-admin/withdrawals.tsx`
- `TEMP_MATCHHAI_SUPER_ADMIN_REPORTS_FINANCE_AUDIT_FIX.md`

## Super Admin Audit Recommendations

| Area | Recommendation | Priority | Risk | Phase |
| --- | --- | --- | --- | --- |
| Dashboard | Add moderation/support/withdrawal alert grouping with links to filtered queues. | P1 | Low | Phase 2 |
| Users | Add user detail route instead of routing reports to the users list only. | P1 | Medium | Phase 2 |
| Zones | Add zone finance detail drilldown and linked reports count. | P1 | Medium | Phase 2 |
| Payments | Add reconciliation summary cards for stale pending/failed-with-wallet rows. | P1 | Medium | Phase 2 |
| Withdrawals | Add dedicated withdrawal detail route and hide bank details from list view by default. | P1 | Medium | Phase 2 |
| Reports | Add pagination and server-side search for larger moderation queues. | P1 | Medium | Phase 2 |
| Support | Add explicit "convert ticket to moderation report" admin action if ops needs it. | P2 | Medium | Phase 3 |
| Matchrooms | Add linked payment/withdrawal/result-dispute cards in detail. | P2 | Medium | Phase 3 |
| Audit Logs | Add export/filter presets for sensitive actions. | P2 | Low | Phase 3 |
| Notifications | Add category filter chips and deep-link health review. | P2 | Low | Phase 3 |
| UX | Standardize empty/loading/error states across all Super Admin lists. | P2 | Low | Phase 3 |

## Known Risks

- `reports` schema changed; Convex codegen was intentionally not run pending target confirmation.
- Zone Finance first version scans capped recent rows and returns a `capped` flag if limits are reached.
- Historical earned totals are not implemented; this batch focuses on today/week/month from authoritative payout transactions.
- Some existing Super Admin files were already modified before this batch; changes were kept targeted.
- Support chatbot moderation report creation depends on the chatbot/worker choosing `create_moderation_report` instead of `create_support_ticket`.

## Manual QA Remaining

- Submit a friend chat message report; verify Super Admin Reports list/detail.
- Submit a matchroom chat message report; verify linked matchroom and missing-record behavior.
- Submit a team challenge chat message report; verify detail opens and reported user action availability.
- Trigger support chatbot `create_moderation_report`; verify it appears in Reports, not Support Tickets.
- Trigger normal support ticket flow; verify it appears only in Support Tickets.
- Resolve/reopen/add-note on new report types.
- Confirm Zone Finance values against known payout and withdrawal rows.
- Confirm no bank/CNIC/phone/provider secrets appear in Zone Finance or report target cards.

## Tests Run

- Passed: `npx tsc -p tsconfig.json --noEmit`
- Passed: `git diff --check` (line-ending warnings only for existing working-copy files)

## Codegen

- Not run. Schema/API changed, but target confirmation is required before running Convex codegen.
