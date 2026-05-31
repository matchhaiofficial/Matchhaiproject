# MatchHai Post-Security Remediation QA

Started: 2026-05-28

Scope: compatibility audit/fix after critical actor-scoped Convex remediation. No pagination/UI/store-readiness work. No EAS build. No production deploy.

## Targets

- Users/profile callsites
- Dashboard/discover callsites
- Notifications callsites
- Reports callsites
- Wallet callsites
- Bookings callsites
- Matchroom lifecycle/result callsites

## Findings

- Public profile incoming friend-request probe was stale: `checkPendingFriendRequest` is now sender-scoped, so the public profile screen could no longer query "target -> me" directly.
- Client helper `updateIntentPaymentStatus(..., "paid")` could now fail closed because paid status is provider/internal-authoritative.
- External Easypaisa booking reconciliation called public `matchrooms.payMatchroomSeatIntent`, which now requires an authenticated player context.
- Auto-dispatch of full paid zone matchrooms called public `bookings.createRequest` from server-side matchroom logic, which now requires a user auth context.
- `getPendingResultForUser` still accepted a legacy `userId`; backend now derives the actor for compatibility and ignores the client actor identity.

## Fixes

- Public profile now checks only the authenticated viewer's outgoing friend request and avoids the unauthorized reverse probe.
- Booking service now rejects client attempts to mark an intent paid and tells callers provider verification is required.
- Matchroom payment confirmation now has a shared internal helper and an internal provider-only mutation for Easypaisa reconciliation.
- Zone booking request auto-dispatch now inserts the server-created request directly after the matchroom has already been authorized.
- Pending result lookup now uses the authenticated actor rather than trusting the passed `userId`.

## Codegen

- Required because `convex/matchrooms.ts` added `internal.matchrooms.confirmPaidMatchroomSeatIntentFromProvider`.
- Target already confirmed in prior tracker from `.env.local`: `CONVEX_DEPLOYMENT=dev:ardent-lynx-28` (team `shakir-yasin`, project `matchhai-staging`).

## Validation

- `npx convex codegen`: PASS against `dev:ardent-lynx-28`.
- `npx tsc -p tsconfig.json --noEmit`: PASS.
- `git diff --check`: PASS, with line-ending warnings only.

## Manual QA

- Player profile friend-request buttons: verify outgoing request state still shows and incoming requests are handled through inbox.
- Easypaisa booking payment: verify provider-confirmed booking still adds player to roster and creates hold once.
- Full zone matchroom: verify auto-created zone booking request still appears for the zone owner.
- Match result gate: verify only the authenticated participant/captain sees their own pending result.
