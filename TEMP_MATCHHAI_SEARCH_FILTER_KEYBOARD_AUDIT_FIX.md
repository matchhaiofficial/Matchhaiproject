# TEMP — Search/Filter Layout + Keyboard Avoidance Audit & Fix

Do not delete this file.

## Context
Two cross-app UI/UX issues to audit then fix:
1. **Search + Filter layout inconsistency** — some pages stack the search input and the
   filter button on separate rows. They must be on the same horizontal row (search `flex:1`,
   filter a fixed square button on the right, badge attached, responsive, no overflow).
2. **Keyboard avoidance** — tapping a text field often leaves the focused field hidden behind
   the keyboard. Focused inputs must scroll above the keyboard on Android + iOS, inside screens,
   modals, bottom sheets, drawers, and forms, without breaking sticky bottom CTAs.

Previous batch product-fix commit: **102c0b1** (Valorant/registration/date-time/counter-offer/lobby/external-stats).

## Existing shared primitives (verified)
- `src/components/AdminSurface.tsx` → `AdminSearchFilterBar` — already correct one-row layout
  (`searchFilterRow` flexDirection row + gap; `searchBar` flex:1; `filterButton` 48x48 fixed;
  `filterBadge` absolute on button). Used by most Super Admin screens.
- `src/components/AdminSurface.tsx` → `AdminFilterDrawer` — standard Reset/Done drawer.
- `src/components/AppModalPrimitives.tsx` → `AppDialog` / `AppBottomSheet` / `AppPickerSheet` /
  `AppDrawer` all accept `keyboardAware`, `keyboardAvoidBehavior`, `keyboardVerticalOffset`.
  `AppModalBody` supports `scroll` (ScrollView + keyboardShouldPersistTaps="handled").
- `src/components/Screen.tsx` — screen wrapper (to inspect for keyboard support).

## Constraints (do not violate)
- Do not change filter semantics, add/remove filters, or change query behavior.
- Do not break active filter count badges, drawer open behavior, or Reset/Done.
- Do not change placeholder copy unless needed for space.
- Prefer fixing shared components over per-page hacks. Avoid huge paddingBottom hacks.
- Do not break sticky bottom CTAs. Do not run Convex codegen (no schema/API change expected).
- Do not run EAS build.

---

## 1. Pages inspected
**Search/filter pair (search input + filter button):** super-admin matchrooms / audit-logs / zones /
withdrawals / identity-verifications / users / (tabs)/payments / (tabs)/reports / notifications /
support-tickets (all via `AdminSearchFilterBar`); player My Matchrooms, Discover, Schedule; zone
Bookings (Requests + Matchrooms sections), Resources, Pricing.
**Search-only / out of scope (no filter button):** wallet Transactions (filter button, no search),
inbox (filter button, no search), friends (search + SegmentedTabs), my-teams (search only),
chatrooms (search only), zone notifications/insights/audit.
**Keyboard (TextInput) screens:** auth login/register(1-4)/zone-register(1-4)/forgot/reset;
player profile/edit, zone profile/edit, wallet, matchroom create, chat (ChatThread), teams
create/challenge-create, all report/support/suggest/invite/cancel sheets; zone branch new/[id],
bookings counter-offer, pricing rule form, resources; super-admin support-ticket/[id], report/[id],
request/[id], withdrawals, identity-verifications.

## 2. Search/Filter layout findings
**Result: NO split-row defect exists anywhere.** Every screen with both a search input and a
filter button already renders them on one horizontal row (row container + gap, `searchBar` flex:1,
fixed square filter button 48–50px, badge attached). Super Admin uses the canonical
`AdminSearchFilterBar`; player/zone screens hand-roll the same structure faithfully. No `flexWrap`
that could drop the filter button to a second line was found. The only gap was a parity nit: the
hand-rolled replicas omitted `minWidth:0` (the house standard, already present in `schedule.styles.ts`),
a defensive token against extreme-narrow text overflow. Applied for consistency.

| File | Layout | Same row? | Badge works? | Small-screen risk? | Action |
|------|--------|-----------|--------------|--------------------|--------|
| 10× `app/super-admin/*` (AdminSearchFilterBar) | row, flex:1 search, 48px btn | Yes | Yes | No | None (already correct) |
| `app/matchrooms/my.styles.ts` | `filterBar` row, searchBar flex:1, 48px | Yes | Yes | No | +`minWidth:0` parity |
| `app/(player)/(tabs)/discover.styles.ts` | `searchRow` row, flex:1, 48px | Yes | Yes (9+ cap) | No | +`minWidth:0` parity |
| `app/(player)/schedule.styles.ts` | `searchRow` row, flex:1+minWidth:0 | Yes | Yes | No | None (reference) |
| `app/zone/modules/bookings.styles.ts` | `searchRow` row, flex:1, 48px | Yes | Yes (9+ cap) | No | +`minWidth:0` parity |
| `app/zone/modules/resources.styles.ts` | `searchRow` row, flex:1, 50px | Yes | Yes (9+ cap) | No | +`minWidth:0` parity |
| `app/zone/modules/pricing.styles.ts` | `searchRow` row, flex:1, 50px | Yes | Yes (9+ cap) | No | +`minWidth:0` parity |

## 3. Keyboard avoidance findings
Shared primitives already support keyboard handling: `Screen` has a `keyboardAvoiding` prop
(iOS `behavior:"padding"`, Android relies on `softwareKeyboardLayoutMode:"resize"` from app.json);
`AppDialog`/`AppBottomSheet`/`AppDrawer` accept `keyboardAware`; `AppModalBody` accepts `scroll`.
Most modals/sheets were already disciplined (keyboardAware + Body scroll). The recurring root cause
was detail screens using `<Screen scroll={false}>` + a **manual `<ScrollView>` with no
KeyboardAvoidingView**, and one dialog missing `keyboardAware`. All fixed by toggling existing
props — **no shared primitive code changed.**

| File:line | Input | Wrapper before | Risk | Fix applied |
|-----------|-------|----------------|------|-------------|
| `app/super-admin/support-ticket/[id].tsx`:271/286/313 | reply/note/resolution (multiline) | Screen scroll=false + manual ScrollView, no KAV | HIGH (inputs at very bottom) | `keyboardAvoiding` on Screen + `keyboardShouldPersistTaps="handled"` |
| `app/zone/(tabs)/profile.tsx`:527/554 | withdraw amount + account number | AppDialog (no keyboardAware) + Body scroll | HIGH (account # covered) | `keyboardAware` on AppDialog |
| `app/zone/report/[id].tsx`:167 | review reply | Screen scroll=false + manual ScrollView, no KAV | HIGH | `keyboardAvoiding` + persistTaps |
| `app/super-admin/report/[id].tsx`:320/335 | review note | Screen scroll=false + manual ScrollView, no KAV | MED-HIGH | `keyboardAvoiding` + persistTaps |
| `app/super-admin/request/[id].tsx`:293 | admin note | Screen scroll=false + manual ScrollView, no KAV | MED | `keyboardAvoiding` + persistTaps |
| `app/zone/modules/pricing.tsx`:709/771/905 | rule amounts + priority | Screen scroll=false + manual ScrollView, no KAV | MED | `keyboardAvoiding` + persistTaps |
| `app/(player)/wallet.tsx`:799 | top-up amount | Screen scroll=false + manual ScrollView, no KAV | LOW-MED | `keyboardAvoiding` + persistTaps |
| auth, profile-edit, matchroom create, teams, chat, all sheets/dialogs (except above) | various | already KAV/keyboardAware + scroll | NONE | No change needed |

## 4. Files changed
Keyboard avoidance (7 screens):
- `app/super-admin/support-ticket/[id].tsx`
- `app/super-admin/report/[id].tsx`
- `app/super-admin/request/[id].tsx`
- `app/zone/report/[id].tsx`
- `app/zone/modules/pricing.tsx`
- `app/zone/(tabs)/profile.tsx` (withdrawal AppDialog)
- `app/(player)/wallet.tsx`

Search/filter row parity (`minWidth:0`, 5 style files):
- `app/matchrooms/my.styles.ts`
- `app/(player)/(tabs)/discover.styles.ts`
- `app/zone/modules/bookings.styles.ts`
- `app/zone/modules/resources.styles.ts`
- `app/zone/modules/pricing.styles.ts`

Tracker: `TEMP_MATCHHAI_SEARCH_FILTER_KEYBOARD_AUDIT_FIX.md`

## 5. Shared primitives updated
**None.** All fixes used existing props (`Screen.keyboardAvoiding`, `AppDialog.keyboardAware`,
`ScrollView.keyboardShouldPersistTaps`). `AppModalPrimitives.tsx`, `AdminSurface.tsx`,
`Screen.tsx` were read but not modified — no behavioral change to shared components.

## 6. Manual QA checklist
Search/filter (normal + narrow width, e.g. Samsung A32 / iPhone SE):
- [ ] Search + filter on one row on every affected page; no wrap, no horizontal overflow.
- [ ] Search still filters results.
- [ ] Filter drawer opens; Reset/Done unchanged.
- [ ] Active filter count badge shows and stays attached to the filter button.

Keyboard avoidance (Android + iOS):
- [ ] Super-admin support ticket: Reply / Internal note / Resolution inputs scroll above keyboard; Send/Add/Resolve buttons tappable while keyboard open.
- [ ] Super-admin report `[id]` review note + request `[id]` note visible above keyboard.
- [ ] Zone report `[id]` reply visible above keyboard.
- [ ] Zone withdrawal dialog: amount + account number both reachable; footer Submit/Cancel tappable.
- [ ] Zone pricing Create Rule: amount + priority fields visible above keyboard.
- [ ] Wallet Add Funds amount field visible; Add button tappable.
- [ ] No giant empty space below content; no overlap with bottom nav / sticky CTA.

## 7. Tests run
- `npx tsc -p tsconfig.json --noEmit` → **pass (exit 0)**.
- `git diff --check` → **clean (exit 0)**; only LF→CRLF informational warnings (pre-existing repo line-ending behavior), no whitespace errors.
- Convex codegen: **not run** (no Convex schema/API change).
- EAS build: **not run**.

## 8. Remaining risks / screens needing manual device QA
- Detail-screen fix relies on iOS `KeyboardAvoidingView behavior="padding"` + Android
  `softwareKeyboardLayoutMode:"resize"`. Verified by code; needs device confirmation that the
  bottom-most multiline inputs clear the keyboard on small devices (Samsung A32, iPhone SE).
- Withdrawal `AppDialog` is centered; with `keyboardAware` the card lifts via KAV + the body already
  scrolls. Confirm on a short screen that the account-number field is fully reachable.
- `minWidth:0` is a no-op on most RN layouts (Yoga defaults flex children to shrink); applied purely
  for parity with `schedule.styles.ts`. No visual change expected.
- No keyboard changes were made to screens already handled (auth/register, profile edit, matchroom
  create, chat, teams, and the many sheets) — they were verified by code review only, not device.
