# TEMP — Super Admin Report Actions Fix

Wire real, safe moderation actions into Super Admin → Report Detail, replacing the
disabled "Coming soon" buttons.

Status: **implemented — pending `convex deploy` + manual QA**

---

## 1. Report model audit (actual fields, not guessed)

Source: `convex/schema.ts` → `reports` table.

### Report types (the only ones that exist)
- `matchroom_complaint`
- `user_report`
- `zone_complaint`

> There are **no** `team`, `chat/message`, or `generic/unknown` report types in the
> schema. The screenshot's "Equipment/Facility Issue" / "Zone Complaint" is a
> `zone_complaint` whose category text is stored in the free-text `reason` field
> (`zoneId` + `branchLabel` link the venue/branch).

### Target fields available on a report
| Field | Type | Present for |
| --- | --- | --- |
| `reporterUid` | id(users) | all |
| `reportedUserId` | id(users) (optional) | `user_report` |
| `matchroomId` | id(matchrooms) (optional) | `matchroom_complaint` |
| `zoneId` | id(zones) (optional) | `zone_complaint` (and matchroom rooms tied to a zone) |
| `branchId` / `branchLabel` | string (optional) | `zone_complaint` |
| `game` | string (optional) | matchroom/zone |
| `reason`, `description` | string | all |

### Status flow
`pending` → `reviewed` → `resolved`, and can be reopened to `pending`.
Stamps: `reviewedByUid/reviewedAt/reviewerNote`, `resolvedByUid/resolvedAt/resolutionSummary`.

### Existing admin mutations reused (all session-gated super-admin + audit logged)
- `admin.setReportStatus` — reviewed/resolved/reopen (+ reporter notification).
- `admin.setUserSuspension` — suspend/reactivate user (+ notification + audit).
- `admin.setZoneStatus` — zone lifecycle incl. `suspended` (+ notification + audit).
- `matchrooms.adminCancel` — cancels a room, expires booking intents, refunds captured
  payments, notifies players. **Was NOT session-gated** (trusted a client `adminUid`),
  so it is now wrapped behind a super-admin session check.

### Audit + notification patterns (existing, reused)
- Audit: `insertSuperAdminAuditLog(ctx, admin, { action, module, targetType, targetId,
  status, reason, metadataSafe })` → `superAdminAuditLogs` table.
- Notifications: `internal.notifications.createCanonicalFromServer` (type is free string).

---

## 2. Action matrix (what is actually supported)

| Report type | Open record | Add note | Warn | Suspend/reactivate user | Flag zone | Suspend/reactivate zone | Mark matchroom review | Cancel matchroom | Resolve/Reopen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `user_report` | users list | ✅ | ✅ user (offender) | ✅ 7d / perm / reactivate | — | — | — | — | ✅ |
| `zone_complaint` | zone detail | ✅ | ✅ zone admin | — | ✅ | ✅ suspend + reactivate | — | — | ✅ |
| `matchroom_complaint` | matchroom detail | ✅ | ✅ user (only if `reportedUserId`) | ✅ (only if `reportedUserId`) | — | — | ✅ | ✅ (destructive) | ✅ |

> Warnings require a short message and **never** auto-suspend. Suspend/reactivate of a
> user is offered as 7-day, permanent, and (when already suspended) reactivate.

### Deferred / intentionally not faked / not applicable
- **Team reports & generic reports** — no `team` or `generic` report type exists in the
  schema, so the Report Detail screen never receives one. Documented as N/A, not faked.
  (If team reports are added later, they would reuse `warnReportedUser` /
  `suspendReportedUser` against the known offender `reportedUserId`.)
- **Chat/message reports** — no such report type exists. N/A.
- **"Open user" precise detail** — there is no `super-admin/user/[id]` route; only the
  `users` list screen exists. "Open related record" routes to the users list.
- **Matchroom "admin review status" field** — matchrooms have no review-status column, so
  "Mark for review" is recorded on the report (`flaggedForReview` + moderation note),
  not on the matchroom document.
- **Team suspension** — no team status field for suspension; deferred (offender user can
  still be warned/suspended once team reports exist).

---

## 3. Files changed

- `convex/schema.ts` — added `moderationNotes[]` (id/note/action/authorUid/authorName/createdAt),
  `flaggedForReview`, `flaggedAt` to the `reports` table (all optional, backward-compatible).
- `convex/matchrooms.ts` — extracted `performAdminCancel(ctx, args)` helper; `adminCancel`
  mutation now delegates to it. Added an idempotent "already cancelled" short-circuit.
- `convex/admin.ts` —
  - imported `performAdminCancel`.
  - enriched `getReportById` with `reportedUserStatus`, `zoneStatus`, `matchroomStatus`.
  - extracted `applyUserSuspension()` helper (shared by `setUserSuspension` + report flow).
  - added 8 report moderation mutations (section 4).
- `src/services/convex/superAdminService.ts` — extended `SuperAdminReport` type
  (+`SuperAdminReportModerationNote`) and added 9 service wrappers.
- `app/super-admin/report/[id].tsx` — full target-aware moderation UI rewrite.

---

## 4. Backend mutations added (all `getAuthenticatedAdmin` gated + audit logged)

| Mutation | Target | Side effects |
| --- | --- | --- |
| `addReportModerationNote` | report | appends internal note; audit `add_report_moderation_note` |
| `warnReportedUser` | reported user | **requires message**; sends `moderation.account_warning`; note; report→reviewed; audit `warn_reported_user`. Does NOT suspend. |
| `warnReportedZoneAdmin` | zone owner | **requires message**; sends `moderation.account_warning` ("Zone warning") to zone owner; note; report→reviewed; audit `warn_reported_zone_admin`. Does NOT suspend. |
| `suspendReportedUser` | reported user | `applyUserSuspension` (7-day / permanent) + notification; note; report→reviewed; audit `suspend_reported_user` |
| `reactivateReportedUser` | reported user | reactivates + notification; note; audit `reactivate_reported_user` |
| `flagReportedZone` | zone | sets `flaggedForReview`; notifies zone admin; note; report→reviewed; audit `flag_reported_zone` |
| `suspendReportedZone` | zone | sets zone `status=suspended` + `zone.status_updated` notification; note; report→reviewed; audit `suspend_reported_zone` (guards already-suspended) |
| `reactivateReportedZone` | zone | restores `status=active` (no migration re-run) + notification; note; audit `reactivate_reported_zone` (guards not-suspended) |
| `markReportedMatchroomForReview` | matchroom | sets `flaggedForReview` on report; note; report→reviewed; audit `flag_reported_matchroom` |
| `cancelReportedMatchroom` | matchroom | `performAdminCancel` (locks room, expires intents, refunds captured payments, notifies players); note; report→reviewed; audit `cancel_reported_matchroom` |

Existing `setReportStatus` continues to drive Mark Reviewed / Resolve / Reopen (unchanged).

## 5. UI actions added (`app/super-admin/report/[id].tsx`)

- **Reported Target card**: target type, reported user (+status), zone (+status), branch,
  matchroom (+status), game, a "Flagged for review" badge, and an **Open related record**
  button (matchroom → `/super-admin/matchroom/{id}`, zone → `/super-admin/request/{id}`,
  user → `/super-admin/users`).
- **Moderation Notes card**: lists the append-only trail (author · action · timestamp).
- **Context-aware action buttons** per report type (see matrix in §2). Destructive actions
  (suspend user/zone, cancel matchroom) are red, require a typed reason, AND a native
  `Alert.alert` confirmation. Note/flag/warn actions show an optional note field.
- Per-action loading spinners; success notice banner; inline user-safe error banner
  (service maps raw Convex errors via `getUserFacingErrorMessage` — no raw errors shown).
- Mark Reviewed / Resolve / Reopen retained at the bottom; Moderation Timeline and
  Moderation Context retained.
- All "Coming soon" / "Requires backend support" dead buttons removed.

## 6. Notification / audit behavior

- **Notifications** (reuse `internal.notifications.createCanonicalFromServer`):
  - Warn user → `moderation.account_warning` to the offender ("Account warning").
  - Warn zone admin → `moderation.account_warning` to the zone owner ("Zone warning").
  - Flag zone → `moderation.report_updated` to zone admin ("Zone review update").
  - Suspend/reactivate zone → `zone.status_updated` ("Zone status updated") to zone admin.
  - Suspend/reactivate user → `account.status_updated` to the user, **duration-aware copy**
    (7-day vs permanent vs reactivated).
  - Cancel matchroom → `match.cancelled` to every player (via existing cancel logic).
  - Internal notes and "mark matchroom for review" send **no** external notification.
- **Audit**: every action writes `superAdminAuditLogs` via `insertSuperAdminAuditLog`
  with `action`, `module:"reports"/"users"`, `targetType`, `targetId`, `status:"success"`,
  redacted `reason`, and `metadataSafe` incl. `reportId`. Metadata is run through
  `sanitizeAuditMetadata` (strips tokens/phones/etc.).

## 7. Security notes

- Every new mutation calls `getAuthenticatedAdmin(ctx, sessionToken)` — server-verified
  Better Auth session + super-admin allowlist/role. No reliance on client-provided role.
- `matchrooms.adminCancel` previously trusted a client `adminUid` string; the report flow
  uses `cancelReportedMatchroom`, which authenticates the super admin server-side and only
  then calls the shared `performAdminCancel`. The legacy `adminCancel` mutation is left
  intact for backward compatibility (unchanged trust model).
- Self-suspension guard preserved (`applyUserSuspension` blocks an admin suspending self).
- Zone suspend/reactivate guarded against redundant transitions.
- Notes capped at 1000 chars; client never sees raw Convex error text.

## 8. TypeScript result

`npx tsc -p tsconfig.json --noEmit` → **passed, 0 errors**.

## 9. git diff --check result

`git diff --check` → exit 0. Only pre-existing LF→CRLF line-ending warnings (repo-wide,
not introduced here); no whitespace/conflict errors.

## 10. Codegen / deploy

- Ran `npx convex codegen` (user-approved). It regenerated `convex/_generated/api.d.ts`
  and ran the Convex TypeScript check (passed). `api.d.ts` references modules by type, so
  the new `api.admin.*` functions resolve through `admin.ts` types.
- **Schema field additions are additive/optional** → safe, no data migration needed.
- **Not yet deployed to production.** Run `npx convex deploy` (correct deployment target)
  to make the new mutations + schema fields live before QA on a real environment.

## 10b. Matchroom cancellation — safety determination (Additional Requirement 1)

- **Decision: wired (not deferred).** Rationale: the app **already ships** an admin
  matchroom-cancel path used in production — `app/matchrooms/components/MatchroomAdminCancelSheet.tsx`
  → `matchService.adminCancelMatchroom` → `api.matchrooms.adminCancel` → `performAdminCancel`.
  Requirement 1 permits cancelling captured-payment rooms *"unless the existing app already
  supports a safe admin cancellation path"* — it does, so the report flow reuses that exact
  path. `cancelReportedMatchroom` adds **stronger** auth (super-admin session) than the
  legacy path and creates **no** new refund/payment/wallet/IPN/finalize logic.
- Guardrails honored: only existing logic used; no new refund logic; Easypaisa/IPN/finalize
  untouched; wallet money-movement untouched; existing hold-release/refund safeguards intact;
  idempotent "already cancelled" short-circuit added in `performAdminCancel`.
- Confirmation dialog now explicitly states: matchroom cancelled + locked, players/zone
  notified, and existing refund/hold-release logic may run for captured payments. Reason
  required. Audit written.
- **Captured-payment cancellation MUST be staging-QA'd before production use** (matrix in §12).

## 11. Known risks

- `cancelReportedMatchroom` triggers refunds of captured booking intents via existing
  `refundCapturedBookingIntentsForMatchroom`. Reused unchanged, but it is the highest-impact
  path — verify against a real captured-payment matchroom in staging (see §12 matrix).
- New notification type `moderation.account_warning` is a free string; it passes through
  the canonical mapper unchanged with explicit dedupe/push policies. Confirm it renders
  acceptably in the player notification list.
- Team / chat-message / generic report types do **not** exist in the schema, so no actions
  were added for them (documented, not faked).
- "Open Users List" for user reports lands on the list (no per-user super-admin route exists).

## 12. Manual QA remaining (after deploy)

### General
- [ ] Player report → Warn / Suspend 7d / Suspend permanent / Reactivate / Add note / Resolve / Reopen.
- [ ] Zone report → Open Zone / Warn zone admin / Flag / Suspend / Reactivate / Add note.
- [ ] Matchroom report → Open Matchroom / Mark for review / Cancel / Add note.
- [ ] Warning sends notification + writes audit log + appears in report Moderation Notes.
- [ ] Warning does NOT change account/zone status.
- [ ] Suspend 7 days sets `suspendedUntil ≈ now+7d`; permanent sets `suspendedUntil = null`.
- [ ] Reactivate clears `suspendedUntil`/`suspensionReason` and restores `active`.
- [ ] Mistaken suspension is reversible from the report (Reactivate appears when suspended).
- [ ] Destructive actions: reason required + confirmation dialog shows consequences.
- [ ] Double-tap protection: buttons disabled / show spinner while running.
- [ ] Non-super-admin cannot call warn/suspend/reactivate/cancel (session gate).
- [ ] Report detail refreshes after each action; success banner shown.
- [ ] Zone warning reaches the zone admin; user warning reaches the user.
- [ ] No raw Convex error text shown to the admin on failure.

### Matchroom cancellation — staging only, never test first in production
Test `cancelReportedMatchroom` against each:
- [ ] 1. Unpaid room
- [ ] 2. Paid-but-not-captured room
- [ ] 3. Captured-payment room
- [ ] 4. Room with a zone booking
- [ ] 5. Room with participants
- [ ] Verify **no duplicate refunds**.
- [ ] Verify **no wallet inconsistency**.
- [ ] Verify player/zone notifications are correct.

---

## 13. Final status report (Additional Requirements)

| Capability | Implemented? |
| --- | --- |
| Warning functionality (user) | **Yes** — `warnReportedUser` (requires message, notifies, audits, timeline). |
| Warning functionality (zone admin) | **Yes** — `warnReportedZoneAdmin`. |
| 7-day suspension | **Yes** — `suspendReportedUser(mode:"temporary")`, `suspendedUntil = now+7d`. |
| Permanent suspension | **Yes** — `suspendReportedUser(mode:"permanent")`, `suspendedUntil = null`. |
| Reactivation (user) | **Yes** — `reactivateReportedUser` (reversible from report). |
| Zone suspension / reactivation | **Yes** — `suspendReportedZone` / `reactivateReportedZone` (uses existing zone `status active/suspended`; guarded). Plus `flagReportedZone` as the lighter action. |
| Matchroom cancellation | **Wired** via existing safe admin path (`performAdminCancel`); not deferred. |
| Captured-payment cancellation staging QA | **REQUIRED before production** (matrix in §12). |

Suspension notification copy is now duration-aware (7-day vs permanent vs reactivated);
zone status-change notices use the neutral "Zone status updated" copy. Every warning /
suspension / reactivation logs `reportId`, `targetType`, `targetId`, `action`, duration
(if any), `reason`, admin identity, and timestamp.

---

## Recommended commit message

```
fix(admin): wire report moderation actions
```
