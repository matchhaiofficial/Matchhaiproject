# TEMP - Super Admin Sync + Zone Pilot Checklist

## Context
- Matchhai already has Convex tables and flows for users, zones, notifications, reports, support tickets/messages, identity verifications, payments, wallets, matchrooms, booking requests, and zone offers.
- The current sync weakness is mainly around Super Admin visibility and lifecycle follow-up: Super Admin notification rows can exist, but there is no dedicated Super Admin notification center; support creation alerts are incomplete; KYC, withdrawal, and report follow-up notifications need later phases.
- Player and Zone Admin notification UIs already exist and should not be refactored during this work.
- Broadcast Marketplace Phases 1-6 are considered complete and must not be changed unless a backend payout hook must be adjusted for the approved pilot payout rule.
- The temporary file tracks implementation and handoff context across possible Codex context-window limits.
- Do not delete this file automatically. Ask before deletion.
- Do not include this file in a production commit unless explicitly approved.

## Phase 1 - Super Admin Notification Center + Support Alerts
- [x] Audit existing super-admin routes/navigation
- [x] Identify existing notification queries/mutations to reuse
- [x] Add Super Admin notifications screen
- [x] Add unread badge/count
- [x] Add sessionToken-gated Super Admin notification APIs
- [x] Add support.new_ticket notification to Super Admins
- [x] Add support.ticket_created confirmation to ticket creator
- [x] Add support.ticket_status_changed when Super Admin changes ticket status
- [x] Verify support.admin_reply remains unchanged
- [x] Verify player/zone notification behavior remains unchanged
- [x] Run TypeScript
- [x] Run Convex codegen if needed
- [ ] Manual test

## Phase 1B - Zone 1-Month Pilot Payout
- [x] Add optional pilot fields to zones schema
- [x] Start pilot only on true first approval from pending-review to active
- [x] Do not backfill existing approved zones
- [x] Do not restart or extend pilot on approval retry or reactivation
- [x] Add zone.pilot_started notification
- [x] Update venue payout calculation to use backend pilot status
- [x] Add payout metadata for payoutRate, platformRate, pilotApplied, pilotStartedAt, pilotEndsAt, grossAmount, and platformShareAmount
- [x] Add pilot end cron/internal mutation
- [x] Add zone.pilot_ended notification
- [x] Ensure pilot start/end idempotency
- [x] Run TypeScript
- [x] Run Convex codegen
- [ ] Manual payout test

## Phase 2 - KYC/Didit Notifications
- [x] Add kyc.status_updated notifications
- [x] Add kyc.review_needed if applicable
- [x] Trigger from Didit webhook/status update
- [x] Trigger from manual verification override if applicable
- [x] Verify player and zone admin route/recipientRole mappings
- [x] Redact/hash KYC auth email mismatch audit details
- [x] Preserve sessionToken-gated Super Admin KYC visibility
- [ ] Manual test player and zone admin status updates

## Phase 3 - Withdrawal Admin Workflow
- [x] Audit current withdrawal flow
- [x] Add Super Admin pending withdrawal visibility
- [x] Add approve/reject lifecycle
- [x] Add withdrawal notifications
- [x] Add audit logs
- [ ] Manual test withdrawal review flow

## Phase 4 - Reports/Moderation Follow-Ups
- [x] Add transition-only report status notifications
- [x] Add zone complaint resolution coverage via existing reporter notification
- [x] Confirm moderation action notifications already exist where applicable

## Phase 5 - Super Admin Dashboard Badges / Cleanup
- [ ] Add dashboard badges for pending zones, KYC reviews, support tickets, reports, withdrawals, and notifications
- [ ] Improve auto-refresh/useQuery where safe
- [ ] Normalize routes
- [ ] Replace important operations.general alerts with structured notification types
- [ ] Audit userId auth ownership risks

## File Inventory - Phase 1
- Likely files to change:
  - `convex/admin.ts`
  - `convex/support.ts`
  - `src/services/convex/superAdminService.ts`
  - `app/super-admin/_layout.tsx`
  - `app/super-admin/(tabs)/index.tsx`
  - `app/super-admin/notifications.tsx`
- Files actually changed:
  - `convex/admin.ts`
  - `convex/support.ts`
  - `src/services/convex/superAdminService.ts`
  - `app/super-admin/_layout.tsx`
  - `app/super-admin/(tabs)/index.tsx`
  - `app/super-admin/notifications.tsx`
- New functions added:
  - `admin.listMyNotifications`
  - `admin.countMyUnreadNotifications`
  - `admin.markMyNotificationRead`
  - `admin.archiveMyNotification`
  - `support.notifySupportTicketCreated`
  - `admin.notifySupportTicketStatusChanged`
- New notification types added:
  - `support.new_ticket`
  - `support.ticket_created`
  - `support.ticket_status_changed`
- Schema fields added:
  - None expected
- Test commands run:
  - `npx convex codegen`
  - `npx tsc --noEmit`
- Known risks:
  - Need to preserve existing `support.admin_reply`.
  - Need to avoid public arbitrary userId access for Super Admin notifications.
  - Need to map player vs zone admin support routes safely.

## File Inventory - Phase 1B
- Likely files to change:
  - `convex/schema.ts`
  - `convex/admin.ts`
  - `convex/matchrooms.ts`
  - `convex/crons.ts`
  - `convex/zonePilot.ts`
- Files actually changed:
  - `convex/schema.ts`
  - `convex/admin.ts`
  - `convex/matchrooms.ts`
  - `convex/crons.ts`
  - `convex/zonePilot.ts`
  - `convex/_generated/api.d.ts`
- New functions added:
  - `zonePilot.expireEndedPilots`
  - `addMonthsClamped`
- New notification types added:
  - `zone.pilot_started`
  - `zone.pilot_ended`
- Schema fields added:
  - `zones.pilotStatus`
  - `zones.pilotStartedAt`
  - `zones.pilotEndsAt`
  - `zones.pilotEndedAt`
  - `zones.pilotPayoutRate`
  - `zones.normalPayoutRate`
- Test commands run:
  - `npx convex codegen`
  - `npx tsc --noEmit`
- Known risks:
  - Pilot must only start on first pending-review to active approval.
  - Existing approved zones must not receive pilot automatically.
  - Payout rate must be computed server-side only.
  - Pilot end cron must not duplicate notifications.

## File Inventory - Phase 2
- Likely files to change:
  - `convex/kyc.ts`
  - `convex/admin.ts`
  - `convex/notifications.ts`
  - `convex/kycNotifications.ts`
- Files actually changed:
  - `convex/kyc.ts`
  - `convex/admin.ts`
  - `convex/notifications.ts`
  - `convex/kycNotifications.ts`
  - `TEMP_SUPER_ADMIN_SYNC_AND_ZONE_PILOT_CHECKLIST.md`
- New functions added:
  - `notifyKycStatusUpdated`
  - `notifySuperAdminsKycReviewNeeded`
- New notification types added:
  - `kyc.status_updated`
  - `kyc.review_needed`
- Schema fields added:
  - None
- Test commands run:
  - `npx convex codegen`
  - `npx tsc --noEmit`
- Known risks:
  - Existing notification dedupe lookup is global by `dedupeKey`, so Super Admin fan-out uses `kyc.review_needed:{verificationId}:{adminId}` to avoid archiving other admins' notifications.
  - Webhook retry spam guard depends on `verification.status !== effectiveStatus` before creating notifications.
  - Manual device/provider webhook testing still needed.
- Role/route confirmation:
  - Stored Super Admin user role: `super-admin`
  - Notification recipientRole for Super Admins: `super_admin`
  - Player KYC notification route/role: `/auth/verification-required`, `player`
  - Zone Admin KYC notification route/role: `/zone/profile`, `zone_admin`
- Trigger locations:
  - Didit webhook/refresh status path: `convex/kyc.ts` -> `applyDiditStatusUpdate`
  - Manual Super Admin approval path: `convex/admin.ts` -> `manuallyVerifyIdentityVerification`

## File Inventory - Phase 3
- Likely files to change:
  - `convex/zoneWithdrawals.ts`
  - `convex/wallet.ts`
  - Super Admin withdrawal UI files
  - Zone Admin wallet/dashboard UI files if needed
- Files actually changed:
  - `convex/admin.ts`
  - `convex/wallet.ts`
  - `convex/withdrawalNotifications.ts`
  - `src/services/convex/superAdminService.ts`
  - `app/super-admin/_layout.tsx`
  - `app/super-admin/(tabs)/index.tsx`
  - `app/super-admin/withdrawals.tsx`
  - `TEMP_SUPER_ADMIN_SYNC_AND_ZONE_PILOT_CHECKLIST.md`
- New functions added:
  - `notifySuperAdminsWithdrawalReviewNeeded`
  - `notifyZoneAdminWithdrawalDecision`
  - `admin.listZoneWithdrawalRequests`
  - `admin.approveZoneWithdrawal`
  - `admin.rejectZoneWithdrawal`
  - `getZoneWithdrawalRequests`
  - `approveZoneWithdrawal`
  - `rejectZoneWithdrawal`
- New notification types added:
  - `withdrawal.review_needed`
  - `withdrawal.approved`
  - `withdrawal.rejected`
- Schema fields added:
  - None
- Test commands run:
  - `npx convex codegen` - passed
  - `npx tsc --noEmit` - passed
- Known risks:
  - Withdrawal records live in `walletTransactions` with `type: "withdrawal"` and statuses limited to `pending`, `completed`, and `failed`.
  - Zone withdrawal requests are identified by `metadata.source === "zone_admin_withdrawal_request"`.
  - Request-time wallet behavior: `createZoneWithdrawalTransaction` only checks `users.walletBalance` and inserts a pending transaction; it does not deduct `walletBalance` or move funds into `walletHeldBalance`.
  - Approval-time wallet behavior: `admin.approveZoneWithdrawal` deducts `users.walletBalance` exactly once when transitioning `pending` -> `completed`.
  - Rejection behavior: `admin.rejectZoneWithdrawal` only marks the pending transaction `failed`; it does not refund or release funds because no funds were reserved at request time.
  - Status mapping: `completed` represents admin-approved withdrawal and `failed` represents admin-rejected withdrawal because no approved/rejected wallet transaction enum values exist.
  - Decision context is stored in existing wallet transaction metadata as safe fields: `adminDecision`, `decidedAt`, `decidedBy`, and capped `rejectionReasonSafe` for rejection.
  - Super Admin list query uses `by_type` plus in-memory filtering with scan window `Math.min(limit * 10, 200)`; future improvement is a dedicated source/status index if withdrawal volume grows.
  - Notification dedupe keys: `withdrawal.review_needed:{withdrawalId}:{superAdminId}` per admin because notification dedupe is global, plus `withdrawal.approved:{withdrawalId}` and `withdrawal.rejected:{withdrawalId}` for zone admin decisions.
  - Notification bodies/data contain no bank details, account numbers, emails, CNIC, or sensitive provider payloads.
  - Terminal retries return `changed: false`, do not duplicate notifications or wallet effects, and audit as `approve_withdrawal_noop` / `reject_withdrawal_noop`.

## File Inventory - Phase 4
- Likely files to change:
  - `convex/reports.ts`
  - `convex/admin.ts`
  - report/moderation UI files if needed
- Files actually changed:
  - `convex/admin.ts`
  - `TEMP_SUPER_ADMIN_SYNC_AND_ZONE_PILOT_CHECKLIST.md`
- New functions added:
  - None
- New notification types added:
  - None; reused existing canonical `moderation.report_updated`
- Schema fields added:
  - None
- Test commands run:
  - `npx convex codegen` - passed
  - `npx tsc --noEmit` - passed
- Known risks:
  - Manual verification still needed for duplicate retry behavior and push delivery.
  - Reporter-only notification is intentional; reported parties and zone owners are not notified by the Super Admin status update path.
  - Existing `admin.setUserSuspension` already emits safe `account.status_updated`; no new moderation action notification was added.
  - Trigger point: `convex/admin.ts` -> `setReportStatus`.
  - Notification rule: emit `moderation.report_updated` only when `previousStatus !== newStatus`.
  - Dedupe key: `moderation.report_updated:{reportId}:{newStatus}` with `replace_active`; dedupe is not the only spam guard.
  - Route/payload: `/(player)/reports`; data only includes `reportId`, `status`, `route`, and `href`.
  - Payload safety: no reviewer notes, resolution summaries, report text, user names, emails, phones, CNIC, bank data, or private moderation details.
  - Audit metadataSafe fields: `previousStatus`, `status`, `changed`, `updatedReviewerNote`, `updatedResolutionSummary`, and `anyChange`.

## File Inventory - Phase 5
- Likely files to change:
  - Super Admin dashboard and nav files
  - notification route helpers
  - admin summary query/service files
- Files actually changed:
  - TBD
- New functions added:
  - TBD
- New notification types added:
  - TBD
- Schema fields added:
  - TBD
- Test commands run:
  - TBD
- Known risks:
  - Cleanup must not break existing player/zone inbox behavior.

## Phase 1 Handoff Summary
- Status: Implemented; codegen and TypeScript passed; manual UI test not run
- Files changed:
  - `convex/admin.ts`
  - `convex/support.ts`
  - `src/services/convex/superAdminService.ts`
  - `app/super-admin/_layout.tsx`
  - `app/super-admin/(tabs)/index.tsx`
  - `app/super-admin/notifications.tsx`
- New APIs/functions:
  - `admin.listMyNotifications`
  - `admin.countMyUnreadNotifications`
  - `admin.markMyNotificationRead`
  - `admin.archiveMyNotification`
- Schema changes:
  - None expected
- Notifications added:
  - `support.new_ticket`
  - `support.ticket_created`
  - `support.ticket_status_changed`
- Tests passed:
  - `npx convex codegen`
  - `npx tsc --noEmit`
- Known risks:
  - Super Admin notification count is bounded to recent 300 rows.
  - Manual route/UI verification still needed on device.
- Next phase starting point:
  - Phase 1B implemented in same approved pass
- Unrelated dirty files:
  - None observed before this implementation

## Phase 1B Handoff Summary
- Status: Implemented; codegen and TypeScript passed; manual payout test not run
- Files changed:
  - `convex/schema.ts`
  - `convex/admin.ts`
  - `convex/matchrooms.ts`
  - `convex/crons.ts`
  - `convex/zonePilot.ts`
  - `convex/_generated/api.d.ts`
- New APIs/functions:
  - `zonePilot.expireEndedPilots`
- Schema changes:
  - Added optional `zones` pilot fields and `by_pilotStatus_and_pilotEndsAt` index
- Notifications added:
  - `zone.pilot_started`
  - `zone.pilot_ended`
- Tests passed:
  - `npx convex codegen`
  - `npx tsc --noEmit`
- Known risks:
  - Existing active zones are intentionally not backfilled.
  - Pilot eligibility uses payout calculation time; if cron is delayed, expired active pilots still receive normal 90% payout.
  - Manual payout lifecycle verification still needed with completed matchroom data.
- Next phase starting point:
  - Phase 2 KYC/Didit notifications after approval
- Unrelated dirty files:
  - None observed before this implementation

## Phase 2 Handoff Summary
- Status: Implemented; codegen and TypeScript passed; manual webhook/device push tests not run
- Files changed:
  - `convex/kyc.ts`
  - `convex/admin.ts`
  - `convex/notifications.ts`
  - `convex/kycNotifications.ts`
  - `convex/_generated/api.d.ts`
  - `TEMP_SUPER_ADMIN_SYNC_AND_ZONE_PILOT_CHECKLIST.md`
- New APIs/functions:
  - `notifyKycStatusUpdated`
  - `notifySuperAdminsKycReviewNeeded`
- Schema changes:
  - None
- Notifications added:
  - `kyc.status_updated`
  - `kyc.review_needed`
- Tests passed:
  - `npx convex codegen`
  - `npx tsc --noEmit`
- Known risks:
  - Existing notification dedupe is global, not recipient-scoped; Super Admin review-needed fan-out uses per-admin dedupe suffixes.
  - Manual webhook retry and device push verification still needed.
- Next phase starting point:
  - Phase 3 withdrawal admin workflow
- Unrelated dirty files:
  - TBD after validation

## Phase 3 Handoff Summary
- Status: Implemented; manual testing pending
- Files changed:
  - `convex/admin.ts`
  - `convex/wallet.ts`
  - `convex/withdrawalNotifications.ts`
  - `src/services/convex/superAdminService.ts`
  - `app/super-admin/_layout.tsx`
  - `app/super-admin/(tabs)/index.tsx`
  - `app/super-admin/withdrawals.tsx`
  - `convex/_generated/api.d.ts`
  - `TEMP_SUPER_ADMIN_SYNC_AND_ZONE_PILOT_CHECKLIST.md`
- New APIs/functions:
  - `admin.listZoneWithdrawalRequests`
  - `admin.approveZoneWithdrawal`
  - `admin.rejectZoneWithdrawal`
  - `notifySuperAdminsWithdrawalReviewNeeded`
  - `notifyZoneAdminWithdrawalDecision`
- Schema changes:
  - None
- Notifications added:
  - `withdrawal.review_needed`
  - `withdrawal.approved`
  - `withdrawal.rejected`
- Tests passed:
  - `npx convex codegen`
  - `npx tsc --noEmit`
- Known risks:
  - Manual verification still needed for Super Admin fan-out, retry idempotency, and push delivery.
  - `listZoneWithdrawalRequests` uses `by_type` plus a capped in-memory scan, not a dedicated source/status index.
  - Request email still contains operational withdrawal details from the pre-existing email path; canonical notifications and Super Admin UI do not expose raw account numbers.
- Next phase starting point:
  - Phase 4 report/moderation follow-ups
- Unrelated dirty files:
  - Existing working tree includes Phase 1/1B/2 files and generated files from earlier phases; do not revert without review.

## Phase 4 Handoff Summary
- Status: Implemented; codegen and TypeScript passed; manual testing pending
- Files changed:
  - `convex/admin.ts`
  - `TEMP_SUPER_ADMIN_SYNC_AND_ZONE_PILOT_CHECKLIST.md`
- New APIs/functions:
  - None
- Schema changes:
  - None
- Notifications added:
  - No new types; hardened existing `moderation.report_updated`
- Tests passed:
  - `npx convex codegen`
  - `npx tsc --noEmit`
- Known risks:
  - Manual UI/device testing still needed for status transitions, no-op calls, and push delivery.
  - Existing working tree includes uncommitted earlier phase files and generated Convex API updates; do not revert without review.
- Next phase starting point:
  - Phase 5 dashboard badges and cleanup
- Unrelated dirty files:
  - Existing working tree includes Phase 1/1B/2/3 files and generated files from earlier phases.

## Phase 5 Handoff Summary
- Status: Not started
- Files changed:
  - TBD
- New APIs/functions:
  - TBD
- Schema changes:
  - TBD
- Notifications added:
  - TBD
- Tests passed:
  - TBD
- Known risks:
  - TBD
- Next phase starting point:
  - Final cleanup and deletion decision
- Unrelated dirty files:
  - TBD

## Deletion Rule
- This is a temporary tracking file.
- Do not delete it automatically.
- After a phase is completed and verified, ask: "Phase X is complete. Do you want me to delete the temporary checklist file or keep it for the next phase?"
- Default is to keep the file until all phases are completed.
- Delete only if explicitly confirmed.

## Commit Rule
- Do not include this temporary checklist file in a production commit unless explicitly approved.
- If it is only for tracking, keep it unstaged or commit it only if explicitly requested.

## Context-Window Rule
- If Codex context becomes full, the next Codex chat should be able to continue from this file.
- Keep this checklist clear, detailed, and updated after every phase.
