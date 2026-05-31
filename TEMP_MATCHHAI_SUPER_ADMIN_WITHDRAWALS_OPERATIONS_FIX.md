# Super Admin Withdrawals Operations Redesign

Branch: `product-ready`

## Files Inspected

- `app/super-admin/withdrawals.tsx` — full list + detail UI
- `convex/admin.ts` — listZoneWithdrawalRequests, listZoneWithdrawalRequestsPage, serializeAdminZoneWithdrawal, approveZoneWithdrawal, rejectZoneWithdrawal
- `convex/withdrawalNotifications.ts` — notification helpers for zone admin and super admin
- `convex/wallet.ts` — withdrawal creation, metadata stored at request time
- `convex/schema.ts` — users table fields (phone, phoneNumberMasked, kycVerificationStatus, accountStatus, city, walletBalance), zones table fields (status, city, venueBrandName)
- `src/services/convex/superAdminService.ts` — SuperAdminWithdrawalRequest type, service functions

## Root Cause of Black Screen (from TEMP_MATCHHAI_SUPER_ADMIN_WITHDRAWAL_DETAIL_FIX.md)

Fixed in the previous session: `AppDrawer` with `keyboardAware=true` collapsed the animated panel to height 0 due to a flex layout issue in the `KeyboardAvoidingView` column context. Fixed by applying `flex:1` (`drawerAnimatedFill`) to the `Animated.View` when `keyboardAware` is active.

## Operations Dashboard Redesign Summary

### Summary Metrics Section
Added `SummaryMetrics` component at the top of the list, computed from already-loaded `zoneFinance` data (no new backend query):
- **Pending**: total pending amount across all zones + count from currently loaded pending items
- **Today / This week / This month**: processed withdrawal totals from zone finance summaries

### Redesigned Withdrawal Card
Each card now shows in a compact, scannable layout:
- Amount (large, in card title)
- Status badge (via AdminListCard)
- Zone/branch name as subtitle
- **Admin identity row**: owner name, email, KYC status badge
- **Bank payout row**: bank name + masked account number
- **Zone status** + **account status** badges (warnings prominent if suspended/rejected)
- Reference (truncated) + "Review" / "View details" CTA label depending on status

### Enhanced Detail Drawer
Organized in labelled sections:
1. **Zone Admin** — name, email, masked phone, city, KYC status badge, account status badge
2. **Zone & Branch** — zone name, zone status badge, zone city, branch name
3. **Bank Payout** — bank name, masked account, reference
4. **Wallet** — available balance at query time (present when user record enrichment succeeds)
5. **Decision** — admin decision, decided-at date, rejection reason (non-pending only)
6. **Rejection reason input** (pending only, required for reject action)
7. **Approve / Reject footer** (pending only)

## Backend Changes

### `convex/admin.ts`

**New `serializeAdminZoneWithdrawalEnriched` function**
Async-compatible (uses pre-fetched maps). Returns all fields from the basic serializer plus:
- `ownerEmail` — from metadata.ownerEmail (stored at creation time), verified from user record
- `ownerPhone` — `user.phoneNumberMasked` (never raw phone)
- `ownerCity` — `user.city`
- `ownerKycStatus` — `user.kycVerificationStatus`
- `ownerAccountStatus` — `user.accountStatus`
- `availableBalance` — `user.walletBalance` at query time
- `zoneStatus` — `zone.status`
- `zoneCity` — `zone.city`
- `zoneName` — `zone.venueBrandName || zone.name || metadata.venueName`
- `rejectionReason` — `metadata.rejectionReasonSafe` (sanitized before storage)

**Updated `listZoneWithdrawalRequestsPage`**
Added batch-fetch step before serialization:
- Deduplicates userIds and zoneIds from the page
- Runs `Promise.all(ctx.db.get(...))` for each unique user and zone
- Builds `Map<string, any>` caches and passes to enriched serializer
- Max reads: page_limit (100) unique users + page_limit unique zones = max 200 extra reads per query (well within Convex limits)

**Updated `approveZoneWithdrawal`**
Passes `amount` to `notifyZoneAdminWithdrawalDecision` so notification body includes the formatted amount.

**Updated `rejectZoneWithdrawal`**
Passes `amount` to `notifyZoneAdminWithdrawalDecision`.

### `convex/withdrawalNotifications.ts`

**Updated `ZONE_ADMIN_WITHDRAWAL_ROUTE`**
Changed from `/zone/profile` to `/zone/wallet` to deep-link zone admin to the dedicated wallet screen after a withdrawal decision notification.

**Updated `notifyZoneAdminWithdrawalDecision`**
- Added optional `amount` parameter
- Notification bodies now include formatted amount:
  - Approved: "Your withdrawal request for PKR X has been approved."
  - Rejected: "Your withdrawal request for PKR X was not approved. Check your wallet for details."

## Service Layer Changes

### `src/services/convex/superAdminService.ts`

`SuperAdminWithdrawalRequest` type updated with new enrichment fields:
- `ownerEmail?: string | null`
- `ownerPhone?: string | null`
- `ownerCity?: string | null`
- `ownerKycStatus?: string | null`
- `ownerAccountStatus?: string | null`
- `availableBalance?: number | null`
- `zoneName?: string | null`
- `zoneStatus?: string | null`
- `zoneCity?: string | null`
- `rejectionReason?: string | null`

## Zone Admin Notification Summary

Notifications were already implemented and wired correctly. This session:
1. Added `amount` to notification bodies (approved and rejected messages now include PKR amount)
2. Updated zone admin notification deep-link route to `/zone/wallet`
3. Deduplication (`replace_active` policy) ensures no duplicate notifications on retry

Notification flow remains:
- Zone admin creates withdrawal → Super admins notified (`withdrawal.review_needed`)
- Zone admin creates withdrawal → Zone admin confirmation (`withdrawal.requested`)
- Super admin approves → Zone admin notified (`withdrawal.approved`, with amount)
- Super admin rejects → Zone admin notified (`withdrawal.rejected`, with amount)

## Privacy / Security Summary

**Safe fields shown in card**: owner name, masked phone, email, KYC status label, masked account number, zone status
**Safe fields in detail**: all above + available balance, city, zone city, rejection reason (already sanitized by `sanitizeWithdrawalDecisionReason` before storage)
**Never exposed**: full account number, raw `phone` (uses `phoneNumberMasked`), CNIC, `decidedBy` admin ID, raw Convex document IDs outside of reference strings, raw provider payloads
**Auth**: all queries/mutations require session token → `getAuthenticatedAdmin` → super_admin role check. Zone admin users can only view their own wallet transactions via zone-scoped queries.

## Pagination Preservation

All pagination behavior preserved:
- `listZoneWithdrawalRequestsPage` cursor-based pagination unchanged
- `load("more")` still works; enrichment is per-page (batch-fetched for each page)
- Tabs, search, client-side filters, load-more all unchanged
- Detail drawer opens for cards from any loaded page

## Codegen

Not run. No new Convex tables, indexes, or schema changes were made. No new public API functions added (enrichment is within the existing `listZoneWithdrawalRequestsPage` function body). No `_generated/api.d.ts` changes expected.

## TypeScript Result

Zero errors in changed files.
Pre-existing errors (unchanged):
- `app/zone/wallet.tsx:143` — tone type mismatch (untracked file, pre-existing)
- `src/features/zoneAdmin/modules.ts:72` — ZoneAdminModuleId mismatch (pre-existing)

## git diff --check

No whitespace errors introduced.

## Files Changed

| File | Change |
|------|--------|
| `convex/withdrawalNotifications.ts` | Amount in notification bodies; zone wallet route |
| `convex/admin.ts` | `serializeAdminZoneWithdrawalEnriched` + batch enrichment in paginated query + amount passed to notifications |
| `src/services/convex/superAdminService.ts` | `SuperAdminWithdrawalRequest` type extended |
| `app/super-admin/withdrawals.tsx` | Full operations dashboard redesign |
| `src/components/AppModalPrimitives.styles.ts` | `drawerAnimatedFill` (from previous session) |
| `src/components/AppModalPrimitives.tsx` | `AppDrawer` keyboardAware fix (from previous session) |

## Known Risks

1. **Phone masking fallback**: `phoneNumberMasked` may be null for zone admins who have not completed phone verification. Card shows nothing in that case, which is safe.
2. **Zone lookup for old withdrawals**: Very old withdrawal transactions may have `zoneId: null` in metadata. Zone enrichment fields will be null for these; graceful degradation works correctly.
3. **walletBalance race condition**: `availableBalance` shown in detail is the balance at query time, not at withdrawal request time. For completed withdrawals where balance was deducted, the shown balance is the post-deduction value. This is safe and accurate for admin purposes.
4. **Notification route `/zone/wallet`**: Updated from `/zone/profile`. If `app/zone/wallet.tsx` route is not yet registered in the navigator, the deep link will fall back to the app's default route. The file exists as untracked in the working tree.
5. **Batch reads in paginated query**: Adding up to 200 `ctx.db.get()` reads per `listZoneWithdrawalRequestsPage` call is within Convex limits (16,384 document read limit per query). No performance risk at current scale.

## Deferred Items

- **Date grouping** (Today / Yesterday / Earlier) on the pending list: deferred — safe to add later on top of the sorted list without backend changes.
- **Bank filter** in filter drawer: the current branch/venue filter covers most use cases. Bank-specific filter deferred.
- **Full account number in detail** behind explicit Super Admin action: not needed by current ops workflow; deferred unless compliance requires it.
- **Zone admin phone unmasked access**: phone is masked (`phoneNumberMasked`) in all views. Unmasked access would require a separate Super Admin privileged action if ever needed.

## Manual QA Checklist

### Super Admin — Withdrawals Operations

1. [ ] Open Super Admin → Withdrawals
2. [ ] Summary metrics section shows Pending amount, Today, Week, Month totals
3. [ ] Pending tab shows withdrawal cards
4. [ ] Each card shows: amount, status badge, zone/branch name, admin name, admin email, bank + masked account, KYC badge, zone status badge
5. [ ] Many same-day requests remain easy to scan (compact card layout)
6. [ ] Search finds by owner name, email, zone name, branch, bank, reference
7. [ ] Filter drawer: branch, amount range, date range still work
8. [ ] Load more works (scroll to bottom, more cards appear)
9. [ ] Tap card → detail drawer opens (no black screen)
10. [ ] Detail drawer shows all sections: Zone Admin, Zone & Branch, Bank Payout, Wallet (if available), Decision (if applicable)
11. [ ] Pending detail shows Approve + Reject buttons
12. [ ] Approve requires confirmation dialog, then processes
13. [ ] Reject requires rejection reason (shows error if empty), then confirmation
14. [ ] After approve: drawer closes, list refreshes, item moves to Completed tab
15. [ ] After reject: drawer closes, list refreshes, item moves to Rejected tab
16. [ ] Completed / Rejected / Failed detail opens read-only (no action footer)
17. [ ] Rejected detail shows adminDecision + decidedAt + rejectionReason
18. [ ] No full account number shown
19. [ ] No CNIC shown
20. [ ] Status pill shows "rejected" (not "failed") for rejected items

### Zone Admin — Notifications

1. [ ] After Super Admin approves: zone admin receives "Withdrawal approved" notification with PKR amount
2. [ ] After Super Admin rejects: zone admin receives "Withdrawal rejected" notification with PKR amount
3. [ ] Notification deep-links to zone wallet screen
4. [ ] Retry approve/reject on already-processed withdrawal does not send duplicate notification
5. [ ] Wrong zone admin does not receive notification

### Regression

1. [ ] Zone admin withdrawal request creation still works
2. [ ] Zone admin wallet balance still updates after approve
3. [ ] Existing pagination still loads all pages correctly
4. [ ] Filter drawer does not affect summary metrics
5. [ ] Super admin filter/search drawer still opens and works
6. [ ] Payout formula unchanged

## Recommended Commit Message

```
fix(admin): redesign withdrawal review flow and notifications

- Add operations dashboard with summary metrics (pending amount, today/week/month)
- Redesign withdrawal cards with zone admin identity, KYC/account/zone status
- Enrich detail drawer with full safe zone admin context (email, masked phone, city,
  KYC status, zone status, available balance, rejection reason)
- Batch-enrich listZoneWithdrawalRequestsPage with user/zone lookups (max 200 reads/page)
- Include PKR amount in zone admin approve/reject notification bodies
- Update zone admin notification deep-link to /zone/wallet
- Preserve all pagination, tabs, search, filter, approve/reject behavior
```
