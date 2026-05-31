# Dashboard Text-Wrap Polish

Branch: product-ready

## Scope
UI-only fix for User Dashboard label wrapping.

## Files changed
- app/(player)/components/dashboard/DashboardQuickActionTile.tsx — `numberOfLines={1}` + `ellipsizeMode="tail"` on label.
- app/(player)/(tabs)/index.tsx — Quick Action labels shortened: Create / Find Match / Venues / Chat. USP step row uses Pressable-free Text with `numberOfLines={1}`.
- app/(player)/(tabs)/_dashboard.styles.ts — tightened USP step layout (smaller icon, smaller gap, `flexShrink: 1`, label fontSize reduced); Quick Action text constrained to one line.

## Final label choices
- USP steps: Find Players · Book Venue · Play Match (single-line, smaller chip + label font).
- Quick Actions: Create · Find Match · Venues · Chat.

## Validation
- `npx tsc -p tsconfig.json --noEmit`: pending re-run after final edit.
- `git diff --check`: clean (CRLF warnings only).

## Codegen
Not required.

## Risks
- USP labels rely on shrink + small font; ultra-narrow devices (<320dp) may still ellipsize "Find Players" — acceptable per fallback rules.

## Manual QA
- Verify on Samsung A32 (360dp): all 3 USP steps + all 4 Quick Action labels on one line.
- Verify dark theme contrast unchanged.
