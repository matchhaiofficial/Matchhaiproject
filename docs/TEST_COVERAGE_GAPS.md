# Critical journey coverage and remaining gaps

The repository now has complementary local suites:

- `__tests__/security/journeyWiringContracts.test.ts` checks that server
  function entry points and the app services/screens that call them remain
  connected. These are source contracts, not end-to-end tests.
- `__tests__/security/usageSafetyContracts.test.ts` checks scheduler and
  maintenance-worker guardrails. `__tests__/unit/maintenanceDueSafety.test.ts`
  executes deadline helpers and verifies their invariants.
- `convex-test/matchroomScheduler.test.ts` runs the real registered lifecycle
  mutation against an in-memory Convex backend and proves that a due room
  advances once and leaves only one future job.

The following matrix records what still needs a real Convex test harness,
staging deployment, device, or provider mock. No production deployment is
required for any item.

| Journey | Local coverage now | Remaining evidence needed |
| --- | --- | --- |
| Player signup, OTP, profile, KYC gate | Function/client wiring + pure policy tests | `convex-test` for authenticated mutations/actions; staging Didit sandbox or deterministic provider mock for webhook/status transitions |
| Matchroom create, join/request, approval, payment, chat, result, wallet | Function/client wiring + lifecycle/deadline tests; one real scheduled transition in `convex-test` | More `convex-test` multi-user transitions, idempotent payment/refund and result settlement |
| Team challenge create/pay/accept/venue/matchroom | Function/client wiring + deadline unit tests | `convex-test` with two captain identities, wallet holds/refunds, resource conflicts and scheduled expiry |
| Matchroom/team/direct chat, unread, reaction, report, block | Function/client wiring + existing idempotency/security contracts | `convex-test` for participant authorization, blocked-pair admission and duplicate-message side-effect counts |
| Zone-admin hours/resources/booking/counter-offer | Function/client wiring + existing pure time/resource tests | `convex-test` with zone-owner identity, branch inventory and concurrent offer acceptance; staging device flow for screens |
| Super-admin auth, moderation, audit, withdrawal actions | Function/client wiring + pure role-policy tests | `convex-test`/Better Auth fixture for session-token authorization, last-admin protections and audit rows |
| Scheduled workers and crons | Static guardrails + executable deadline helpers + one in-memory scheduler assertion | More worker-specific scheduler assertions; staging canary after limits recover |
| Full mobile user journeys | Existing component tests and Maestro definitions | Android/iOS development build, seeded staging data, test identities, and Maestro execution; never production |
