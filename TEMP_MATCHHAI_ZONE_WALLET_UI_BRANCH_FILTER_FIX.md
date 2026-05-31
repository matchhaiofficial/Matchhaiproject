# TEMP: Zone Admin Wallet UI/UX Consistency & Branch Filter Fix

**Branch:** product-ready
**Date:** 2026-05-31
**Based on screenshot:** Zone Wallet screen showed functional but visually inconsistent UI

---

## Task 1 — Root Cause Audit

### Files Inspected
- `app/zone/wallet.tsx` — zone wallet screen (prior version)
- `app/zone/(tabs)/dashboard.styles.ts` — dashboard style reference
- `src/theme.ts` — COLORS, SPACING, FONTS, RADII, CONTROL_SIZES, TEXT_SIZES tokens
- `src/components/Screen.tsx` — Screen component horizontal padding logic
- `src/hooks/useScreenPadding.ts` — responsive padding hook
- `src/hooks/useZoneData.ts` — zone/branch data hook
- `src/theme/icons.ts` — valid AppIcon names

### Root Causes Found

| # | Problem | Root Cause |
|---|---------|-----------|
| 1 | Cards/content narrower than other zone screens | **Double horizontal padding**: `Screen` component applies `paddingHorizontal` from `useScreenPadding()` (16–24px per side), AND the wallet ScrollView/FlatList `contentContainerStyle` had an additional `padding: 16`. On a 360px device, content was ~296px wide instead of the correct ~328px. |
| 2 | SegmentedTabs narrower than content | `marginHorizontal: 16` applied to tabs on top of Screen's own horizontal padding. Double inset. |
| 3 | "Total Earned" icon completely blank | `"revenue"` is not a valid AppIconName in `src/theme/icons.ts`. No match in the icon registry — renders empty. |
| 4 | Stat icons dim/dark | Icon container background `${color}18` (9% opacity in hex) nearly invisible on `#1E1E1E` dark cards. Stats using `COLORS.textSecondary` as color had near-zero contrast. |
| 5 | Stats grid cramped on small screens | `width: "47%"` with `gap: 10` on individual AppCards was inconsistent with the dashboard's unified panel pattern. Each card had its own border, creating visual noise. |
| 6 | No branch chips | `useZoneData` not imported; no branch state or chip UI. |
| 7 | Font/spacing tokens not used | Inline string values (`"Montserrat..."`) and raw numbers instead of `FONTS.*`, `SPACING.*`, `TEXT_SIZES.*` from theme. |
| 8 | Withdraw button styling | Generic `AppButton` with `marginTop: 8` — not using spacing tokens. |

---

## Task 2 — Container/Padding Fix

### Change
- Removed `padding: 16` from `overviewContent` contentContainerStyle (was `padding: 16, gap: 12`).
- New `overviewContent`: `{ paddingTop: SPACING.md, gap: SPACING.md }` — Screen's `paddingHorizontal` handles sides.
- Removed `padding: 16, gap: 10` from `txContent` (transactions FlatList).
- New `txContent`: `{ paddingTop: SPACING.sm, gap: SPACING.sm }`.
- Removed `marginHorizontal: 16` from `tabs` (SegmentedTabs).
- New `tabs`: `{ marginTop: SPACING.sm, marginBottom: 0 }`.

### Result
Cards now align at the same horizontal position as Zone Dashboard hero card, module grid, and branch cards. No double horizontal padding.

---

## Task 3 — Footer/Withdraw Button Fix

### Change
- `withdrawBtn` uses `marginTop: SPACING.xs` (token, not raw number).
- Screen variant is auto → detected as `stack` for `/zone/wallet` (not in `(tabs)`), so Screen adds `bottomPadding: SPACING.xxl` and safe-area bottom edge. `useTabBarClearance(24)` ensures extra clearance if bottom tab bar is present.
- Button is inside ScrollView content; no fixed-footer overlap risk — button scrolls with content and has adequate bottom padding via `paddingBottom: bottomPad`.

---

## Task 4 — Icon Visibility Fix

### Changes
| Stat | Old icon | New icon | Old color | New color | Old bg opacity | New bg opacity |
|------|----------|----------|-----------|-----------|---------------|----------------|
| Today | "status" | "status" | accent | accent | 18 (9%) | 22 (13%) |
| This Week | "matchroom" | "matchroom" | successBright | successBright | 18 (9%) | 22 (13%) |
| This Month | "business" | "business" | warning | warning | 18 (9%) | 22 (13%) |
| **Total Earned** | **"revenue" (INVALID)** | **"trending-up"** | successBright | successBright | 18 (9%) | 22 (13%) |
| Withdrawn | "wallet" | "wallet" | textSecondary | textSecondary | 18 (9%) | 22 (13%) |
| Pending | "pending" | "pending" | warning | warning | 18 (9%) | 22 (13%) |

- Icon size: 16 → **18** (more legible in 36×36 container)
- Icon container size: 32×32 → **36×36** (more breathing room)
- Background: `${color}18` → `${color}22` (~13% opacity, clearly visible tint)
- Border: `${color}30` → `${color}55` (more defined ring)

---

## Task 5 — Branch Chip Filter

### UI
- `useZoneData()` now imported in wallet screen
- `branches` derived from `zone.branches` array (filtered to those with display name)
- Horizontal `ScrollView` of `BranchChip` components shown below balance card (Overview tab) and as `ListHeaderComponent` on Transactions tab
- "All" chip always present; branch chips generated per branch
- Toggling a branch deselects if same branch re-tapped (toggle behavior)
- If zero branches available (zone not loaded yet or single-branch without name), chips are hidden

### Branch limitation notice
When any specific branch chip is selected, a yellow info banner appears:
> "Branch-level earnings breakdown coming soon. Totals shown are for all branches combined."

This is honest — transactions don't carry `branchId` in metadata, so actual per-branch filtering cannot be applied yet.

### Backend changes (convex/zoneWallet.ts)
- Added optional `branchId: v.optional(v.string())` arg to `getSummary` query.
- Added optional `branchId: v.optional(v.string())` arg to `listTransactionsPage` query.
- `branchId` is security-validated implicitly: zone ownership is verified by `getOwnedZoneForCurrentUser()`. Since branches belong to the zone, passing a branchId for a zone you own is always safe. Passing another zone's branchId is impossible because the query only operates on the authenticated user's zone.
- `getSummary` returns `selectedBranchId` (echoed from args) and `branchFilteringAvailable: false` (signals to client that per-branch data is not yet filtered).
- Actual transaction filtering by branchId deferred: payout metadata does not include `branchId`. Will require update to `payVenueWalletForCompletedMatchroom` in matchrooms.ts (out of scope for this batch, deferred).

### Security summary
- Zone admin can only access their own zone wallet (enforced by `getOwnedZoneForCurrentUser` → `zones.by_ownerUid` index on current user ID).
- Client-supplied `branchId` does not bypass ownership — it's an advisory filter only, and the zone query is still scoped to the authenticated user's zone.
- Passing another zone's branchId safely returns the authenticated zone's data (not the other zone's). No information leakage.

---

## Task 6 — Copy and Visual Hierarchy

### Changes
- `balanceEyebrow`: uppercase, `FONTS.interMedium`, `letterSpacing: 0.8` — matches zone dashboard hero eyebrow style
- `balanceAmount`: `fontFamily: FONTS.heading` (Montserrat Bold), `fontSize: 36` — prominent display
- `sectionLabel`: uppercase, `FONTS.interSemiBold ?? interMedium`, letterSpacing — section headers match zone admin pattern
- All text styles use `FONTS.*` and `TEXT_SIZES.*` tokens, not raw strings
- `footerNote` has `lineHeight: 18` for readability

---

## Task 7 — Transactions Tab Consistency

### Changes
- `txCard` padding: `SPACING.md` (12px) from raw 14
- `txLabel`: `fontFamily: FONTS.interSemiBold`, `fontSize: TEXT_SIZES.label` (14)
- `txDate`: `fontFamily: FONTS.interRegular`, `fontSize: TEXT_SIZES.caption` (12)
- `txRef`: 11px with opacity 0.65
- `txAmount`: `fontFamily: FONTS.heading`, 15px
- Branch chips appear as `ListHeaderComponent` in Transactions tab, same state as Overview
- Empty state uses `centeredSmall` (no `flex: 1` — avoids expanding inside FlatList)
- Load more: `Pressable` with `SPACING.lg` padding, `FONTS.interSemiBold` text

---

## Task 8 — Reused Components

| Component | Source | Notes |
|-----------|--------|-------|
| `SegmentedTabs` | Existing shared | Same as player wallet, zone insights |
| `AppCard` | Existing shared | Used for transaction rows |
| `AppButton` | Existing shared | Withdraw CTA |
| `StatusPill` | Existing shared | Transaction status tags |
| `AppIcon` | Existing shared | All icons |
| `AppHeader` | Existing shared | Screen header with back |
| `Screen` | Existing shared | Layout wrapper |
| `useZoneData` | Zone hook | Branch data |
| `useTabBarClearance` | Existing hook | Bottom padding |
| `useRouteLogger` | Existing hook | Route telemetry |

Stats grid pattern adopted from **dashboard `snapshotPanel`** style (unified bordered card with internal hairline dividers, not individual cards per stat). This is the correct MatchHai admin panel pattern.

---

## Files Changed

| File | Action | Change summary |
|------|--------|---------------|
| `app/zone/wallet.tsx` | Updated | Full style/layout rewrite; added branch chips; fixed icons; adopted dashboard panel pattern for stats; font/spacing tokens throughout |
| `convex/zoneWallet.ts` | Updated | Added optional `branchId` param to `getSummary` and `listTransactionsPage` with implicit zone ownership validation |
| `convex/_generated/api.d.ts` | Auto-generated | Codegen updated |

---

## TypeScript & Lint Results

- `npx tsc -p tsconfig.json --noEmit` — **EXIT 0 — CLEAN**
- `git diff --check` — **CLEAN** (LF/CRLF warnings on pre-existing unrelated files only)

---

## Codegen Result

- Target: `dev:ardent-lynx-28` (matchhai-staging)
- Command: `npx convex codegen`
- Result: **SUCCESS** — `api.zoneWallet.getSummary` and `api.zoneWallet.listTransactionsPage` updated with `branchId` param

---

## Manual QA Checklist

### UI consistency
- [ ] Overview and Transactions card/content width matches Zone Dashboard and Module screens
- [ ] SegmentedTabs aligns with balance card edges
- [ ] Balance card is prominent and readable on Samsung A32 (360px)
- [ ] Stats panel shows all 6 stats in 3×2 grid with visible icons
- [ ] "Total Earned" icon is now visible (BarChart3 / trending-up)
- [ ] "Withdrawn" wallet icon is visible
- [ ] "Today" status icon visible with blue tint
- [ ] Request Withdrawal button full-width, matches system CTA style
- [ ] Footer note readable, not overlapping anything
- [ ] No horizontal overflow on small Android

### Branch chips
- [ ] If zone has branches, chips appear below balance card
- [ ] "All" chip selected by default
- [ ] Branch chip shows correct display name
- [ ] Selecting a branch chip shows limitation banner
- [ ] Chips work in Transactions tab header too
- [ ] Single-branch zone: chips still show (All + 1 branch)
- [ ] Zone with no branch data: chips hidden (no crash)

### Regression
- [ ] Zone withdrawal request from profile still works
- [ ] Super admin withdrawal approval/rejection still works
- [ ] Player wallet still works
- [ ] No payout formula changed
- [ ] Zone dashboard module grid still includes Wallet card

---

## Known Risks

1. **`branchId` filtering not yet applied server-side** — transactions/payouts don't carry branchId in metadata. Banner informs user. Future: update `payVenueWalletForCompletedMatchroom` to include `branchId` in payout metadata.
2. **Branch ID derivation in UI** — Uses `b.branchId ?? b.id ?? b.branchDisplayName` as key. If branch objects don't have a stable unique ID, two branches with same displayName would collide. Low risk for current data shape but worth monitoring.
3. **`FONTS.interSemiBold`** — Used with `?? FONTS.interMedium` fallback in case font isn't registered. Confirm `Inter_600SemiBold` is loaded in app layout.

---

## Deferred Items

- Per-branch earnings filtering (requires `branchId` in wallet transaction metadata)
- Animated balance change (nice-to-have)
- Wallet export/PDF statement
- Walk-in payment via zone wallet (separate product decision)

---

## Recommended Commit Message

```
fix(zone): polish wallet layout, fix icons, add branch filter chips

- Remove double horizontal padding (Screen + ScrollView) that narrowed
  all wallet cards vs rest of the zone admin screens
- Fix SegmentedTabs alignment (remove extra marginHorizontal)
- Replace invalid 'revenue' icon with 'trending-up' (was rendering blank)
- Increase icon container opacity (22% vs 9%) and size (36x36 vs 32x32)
  for clear visibility on dark cards
- Adopt dashboard snapshotPanel bordered-grid pattern for earnings stats
- Use FONTS/SPACING/TEXT_SIZES/COLORS tokens throughout
- Add branch chip filter UI using useZoneData(); show limitation banner
  when branch selected (per-branch data deferred, documented)
- Add optional branchId to zoneWallet backend queries with implicit
  zone ownership validation; run codegen against dev:ardent-lynx-28
```
