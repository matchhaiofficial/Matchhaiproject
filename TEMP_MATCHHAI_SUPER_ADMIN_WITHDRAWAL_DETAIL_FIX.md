# Super Admin Withdrawal Detail Fix

Branch: `product-ready`

## Files Inspected

- `app/super-admin/withdrawals.tsx` — withdrawal list + detail drawer UI
- `src/components/AppModalPrimitives.tsx` — AppDrawer component
- `src/components/AppModalPrimitives.styles.ts` — AppDrawer layout styles
- `src/components/AdminSurface.tsx` — AdminListCard (card press handler)
- `src/components/AdminSurface.styles.ts` — filter drawer styles
- `src/services/convex/superAdminService.ts` — getZoneWithdrawalRequestsPage, approveZoneWithdrawal, rejectZoneWithdrawal
- `convex/admin.ts` — listZoneWithdrawalRequests, listZoneWithdrawalRequestsPage, serializeAdminZoneWithdrawal, approveZoneWithdrawal, rejectZoneWithdrawal
- `convex/zoneWallet.ts` — zone admin wallet queries (context only)
- `src/motion/useEntrance.ts` — entrance animation hook

## Root Cause

When a withdrawal card is tapped, `handleSelect(item)` sets `selectedId = item.id`. The `selected` memo resolves the item from `withdrawals[]`. The `AppDrawer` then opens with `visible={Boolean(selected)}`.

The black screen was caused by a **flex layout collapse** inside `AppDrawer` when `keyboardAware=true`.

### Layout chain when `keyboardAware=true`:

```
ROW overlay (flex:1, screen height)
  KeyboardAvoidingView (flexShrink:1) ← column flex context
    Animated.View (no flex — content-sized)
      Panel View (flex:1, flexBasis:0, overflow:hidden) ← collapses to height 0
  Backdrop Pressable (flex:1)
```

The `KeyboardAvoidingView` is a **column flex container**. Inside a column, a child's height is content-driven unless it has `flex:1` or an explicit height. The `Animated.View` had neither, so it was **content-sized**.

The panel inside the `Animated.View` has `flex:1` (`flexGrow:1, flexBasis:0`). In a content-sized column parent, `flexBasis:0` collapses to 0 and `flexGrow` has no space to grow into. The panel becomes **height 0**.

The panel also has `overflow:hidden`. With zero height, **all content was clipped**. The modal overlay (dark background) was still visible, giving the appearance of a "black screen".

### Why the filter drawer (AdminFilterDrawer) was unaffected:

The filter drawer uses `AppDrawer` **without** `keyboardAware`. When `keyboardAware=false`, `MaybeKeyboardAvoidingView` renders a React Fragment — no wrapping element. The `Animated.View` is a **direct child of the ROW overlay**. In the ROW, the `Animated.View`'s cross-axis (height) defaults to `alignSelf:stretch`, giving it the full screen height. The panel's `flex:1` can then grow to fill that height. Content renders correctly.

## Route/Modal Decision

No new route or navigation needed. The full detail flow — drawer, approve, reject, confirmation dialogs — was already correctly implemented in `withdrawals.tsx`. Only the layout rendering bug needed fixing.

## Files Changed

### `src/components/AppModalPrimitives.styles.ts`
Added `drawerAnimatedFill: { flex: 1 }` style.

### `src/components/AppModalPrimitives.tsx`
In `AppDrawer`, changed:
```tsx
<Animated.View style={entrance.animatedStyle}>
```
to:
```tsx
<Animated.View style={[keyboardAware && styles.drawerAnimatedFill, entrance.animatedStyle]}>
```

When `keyboardAware=true`, the `Animated.View` now gets `flex:1`. Inside the KAV column (which has a definite height = screen height via `alignSelf:stretch` in the ROW), `flex:1` causes the `Animated.View` to fill the column height. The panel's `flex:1` inside can then grow into this definite height. Content renders at full screen height.

When `keyboardAware=false` (filter drawer, other drawers), `false && styles.drawerAnimatedFill` evaluates to `false`, which React Native ignores in style arrays. No change to existing non-keyboardAware drawer behavior.

### `app/super-admin/withdrawals.tsx`
Minor fix: `StatusPill` in the detail drawer now shows `"rejected"` label for items where `adminDecision === "rejected"`, matching the list card display. Previously showed raw `status` value (`"failed"`) for rejected items.

## Safe Data Fields Shown in Detail View

- Amount (formatted, PKR)
- Status (pending / completed / rejected / failed)
- Zone/admin owner name
- Branch name
- Bank name
- **Masked account number only** (e.g., `**********8826`)
- Reference
- Requested date (formatted)
- Admin decision + decided-at date (for non-pending)
- Reject reason input (for pending, admin use only)

NOT shown: full account number, CNIC, raw provider payloads, raw Convex errors.

## Approve/Reject Flow Status

Fully preserved. No changes to mutation callers or money movement:

- `approveZoneWithdrawal(selected.id)` → `admin.approveZoneWithdrawal` mutation
- `rejectZoneWithdrawal(selected.id, reason)` → `admin.rejectZoneWithdrawal` mutation
- Both require rejection reason validation (client-side)
- Both require confirmation dialog before executing
- After action: drawer closes, list refreshes via `load("refresh")`
- Toast shows success/already-processed/failure

## Backend Query Changes

None. The list page query (`listZoneWithdrawalRequestsPage`) already returns all safe fields needed for the detail view via `serializeAdminZoneWithdrawal`. No new Convex query was added.

## TypeScript Result

```
npx tsc -p tsconfig.json --noEmit
```

Two pre-existing errors in unrelated files:
- `app/zone/wallet.tsx:143` — tone type mismatch (pre-existing, untracked file)
- `src/features/zoneAdmin/modules.ts:72` — ZoneAdminModuleId type (pre-existing)

**Zero errors in changed files.**

## git diff --check

Line-ending (CRLF/LF) warnings on pre-existing files not touched in this session. No whitespace errors introduced.

## Codegen

Not run. No new Convex schema, table, or public API changes were made. The existing `listZoneWithdrawalRequestsPage` and approve/reject mutations were used as-is.

## Known Risks

- **Keyboard avoidance on Android:** `KeyboardAvoidingView` with `behavior="padding"` in a lateral (row-direction) drawer context may over-compensate on devices using `adjustResize` window soft input mode. If the rejection reason TextInput is obscured by the keyboard on some Android devices, the user can scroll the `AppModalBody` ScrollView to reach it. This is a pre-existing trade-off of using `keyboardAware` in a drawer.
- **Other `AppDrawer` uses with `keyboardAware=true`:** The fix applies globally to `AppDrawer`. Any other drawer using `keyboardAware=true` (none found in codebase currently) will also gain the `flex:1` on `Animated.View`, which is the correct behavior.

## Manual QA Checklist

1. [ ] Open Super Admin → Withdrawals
2. [ ] Pending tab shows withdrawal card (amount, branch, bank, masked account, reference)
3. [ ] Tap card body → detail drawer opens (no black screen)
4. [ ] Tap "View details" hint → same (it's inside the pressable card)
5. [ ] Detail drawer shows: amount, status pill, owner, branch, bank, masked account, reference, requested date
6. [ ] Close button (X) closes drawer correctly
7. [ ] Back gesture / hardware back closes drawer
8. [ ] List remains stable after close
9. [ ] Pending withdrawal → Approve button visible → tap → confirmation dialog → Approve → success toast → drawer closes → list refreshes → item moves to Completed tab
10. [ ] Pending withdrawal → Reject button → no reason entered → error toast "Reason required"
11. [ ] Pending withdrawal → Reject → add reason → tap Reject → confirmation dialog → Reject → success toast → drawer closes → list refreshes → item moves to Rejected tab
12. [ ] Completed/Rejected/Failed withdrawal → detail opens as read-only (no action footer)
13. [ ] Rejected item detail shows "rejected" label on StatusPill (not "failed")
14. [ ] No full account number, CNIC, or raw error data visible
15. [ ] Search / tabs / filter drawer still work independently

## Recommended Commit Message

```
fix(admin): repair withdrawal detail drawer black screen

The AppDrawer rendered a black overlay when keyboardAware=true because
KeyboardAvoidingView introduced a column flex context where Animated.View
was content-sized, collapsing the panel (flex:1 flexBasis:0) to height 0.
With overflow:hidden on the panel, all content was clipped.

Add drawerAnimatedFill (flex:1) applied to Animated.View when keyboardAware
is active so it fills the KAV's definite column height, allowing the panel
and its children to render at full screen height.

Also fix StatusPill label in drawer to show 'rejected' for rejected items.
```
