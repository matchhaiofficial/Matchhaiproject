# MatchHai — Page / Route Test Coverage Map (Phase 8)

Coverage classes:
- **UNIT** — logic behind the page covered by `__tests__/unit`.
- **UI** — component render test in `__tests__/ui`.
- **E2E** — Maestro flow in `.maestro/` drives the page.
- **SMOKE-TODO** — deferred RNTL smoke test (`__tests__/coverage/pageCoverage.test.ts`),
  not auto-tested yet because the screen pulls a heavy provider/Convex tree.

| Page | Route file | Coverage |
|------|-----------|----------|
| Home dashboard | `app/(player)/(tabs)/index.tsx` | E2E (01-login asserts dashboard) · SMOKE-TODO |
| Discover | `app/(player)/(tabs)/discover.tsx` | E2E (04) · MatchroomCard UI · SMOKE-TODO |
| Matchrooms (mine) | `app/(player)/(tabs)/matchrooms.tsx`, `app/matchrooms/my.tsx` | UI (card) · SMOKE-TODO |
| Inbox / notifications | `app/(player)/inbox.tsx` | UNIT (notificationCategories) · SMOKE-TODO |
| Friends | `app/(player)/friends.tsx` | SMOKE-TODO |
| Chat (friend) | `app/(player)/friend-chat/[friendId].tsx` | SMOKE-TODO |
| My Teams | `app/(player)/my-teams.tsx` | UNIT (teamRoster) · SMOKE-TODO |
| Team Details | `app/teams/[id].tsx` | UNIT (teamRoster) · SMOKE-TODO |
| Team Chat | `app/teams/team-chat.tsx` | SMOKE-TODO |
| Team Challenge | `app/teams/challenge.tsx`, `challenge-create.tsx`, `challenges.tsx` | SMOKE-TODO |
| Public Profile | `app/(player)/profile/[uid].tsx` | SECURITY (publicUser projection) · SMOKE-TODO |
| Own Profile | `app/(player)/(tabs)/profile.tsx`, `profile/edit.tsx` | E2E (02 select games) · SMOKE-TODO |
| Game details | `app/(player)/profile/game-details.tsx` | UNIT (skillRating, valorantRoles) · SMOKE-TODO |
| Zone Details | `app/(player)/zones/[id].tsx` | SMOKE-TODO |
| Zone Admin dashboard | `app/zone/(tabs)/index.tsx` | SMOKE-TODO |
| Zone Admin bookings | `app/zone/modules/bookings.tsx` | SECURITY (requireOwnedZone) · SMOKE-TODO |
| Zone Admin wallet | `app/zone/wallet.tsx` | SMOKE-TODO |
| Zone pricing | `app/zone/modules/pricing.tsx` | UNIT (pricingRules) · SMOKE-TODO |
| Super Admin users | `app/super-admin/users.tsx` | SECURITY (requireSuperAdmin) · SMOKE-TODO |
| Super Admin zones | `app/super-admin/zones.tsx` | SECURITY · SMOKE-TODO |
| Super Admin payments | `app/super-admin/(tabs)/payments.tsx`, `payment/[orderRefNum].tsx` | SECURITY · SMOKE-TODO |
| Super Admin withdrawals | `app/super-admin/withdrawals.tsx` | SECURITY · SMOKE-TODO |
| Super Admin reports/support | `app/super-admin/(tabs)/reports.tsx`, `support-tickets.tsx` | SMOKE-TODO |
| Settings / profile edit | `app/(player)/profile/edit.tsx`, `app/zone/modules/settings.tsx` | SMOKE-TODO |
| Booking flow | `app/matchrooms/book/[id].tsx` | E2E (07) · UNIT (statusLabels) · SMOKE-TODO |
| Booking status | `app/matchrooms/book/status/[intentId].tsx` | UNIT (getBookingIntentStatusLabel) · E2E (07) |
| Payment | `app/matchrooms/book/pay/[intentId].tsx` | UNIT (paymentUiCopy, userFacingErrors) · E2E (08 mock) |
| Result verification | `app/matchrooms/result.tsx`, `vote.tsx` | SECURITY (authzMatrix todo) · E2E (09) · SMOKE-TODO |
| Forgot/Reset password | `app/auth/forgot-password.tsx`, `reset-password.tsx` | SMOKE-TODO |
| Change password | `app/auth/change-password.tsx` | SMOKE-TODO |
| Login | `app/auth/login.tsx` | E2E (01) · SMOKE-TODO |
| Registration steps | `app/auth/register*.tsx`, `zone-register*.tsx` | UNIT (phoneUtils) · SMOKE-TODO |

## Why full screen tests are deferred
Most screens import the authenticated Convex provider tree, expo-router params,
better-auth client, and many sheets/modals. Reliable RNTL tests for them need
each screen's `useQuery`/`useMutation` calls stubbed per data shape. The mocks in
`jest/setup.ts` make this possible incrementally — convert each SMOKE-TODO in
`__tests__/coverage/pageCoverage.test.ts` by mounting the screen with overridden
`convex/react` return values. Prioritize: dashboard, discover, payment, result.
