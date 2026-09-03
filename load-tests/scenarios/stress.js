// Stress / load test: read-heavy flows under a ramped concurrent load.
// Run with one of:
//   npm run load:100   (PROFILE=load100)
//   npm run load:500   (PROFILE=load500)
//   npm run load:1000  (PROFILE=load1000)
//
// ============================================================================
// STAGING ONLY. These profiles can generate substantial traffic. Never aim
// them at production or at Easypaisa production endpoints.
// ============================================================================
//
// The profile is selected from __ENV.PROFILE and resolved against options.js.
// We exercise the read-heavy surfaces that dominate real traffic:
//   - discover listings (matchrooms, players, zones)
//   - matchrooms open list
//   - notifications fetch
//
// Write flows (create matchroom, join request, booking intent, mock payment
// confirm, result verification) are intentionally NOT driven here yet because
// they require an authenticated, per-VU identity and a staging-only test
// harness (see README.md and the commented block at the bottom of this file).

import { group, sleep } from 'k6';
import { resolveProfile, thresholds } from '../config/options.js';
import {
  convexQuery,
  expectOk,
  expectNoServerError,
  hasToken,
} from '../lib/http.js';

const PROFILE = __ENV.PROFILE || 'smoke';
const profile = resolveProfile(PROFILE);

// Optional targets supplied via env for parameterised reads.
const TARGET_ZONE_ID = __ENV.TARGET_ZONE_ID || '';
const TARGET_MATCHROOM_ID = __ENV.TARGET_MATCHROOM_ID || '';

export const options = {
  scenarios: {
    [PROFILE]: profile,
  },
  thresholds,
};

// Assert helper that adapts to whether a token is present.
function assertRead(res, name, extraChecks) {
  if (hasToken()) {
    expectOk(res, name, extraChecks);
  } else {
    expectNoServerError(res, name);
  }
}

export default function () {
  group('discover', function () {
    assertRead(
      convexQuery('discover:listDiscoverMatchrooms', { limit: 20 }),
      'discover_matchrooms'
    );
    assertRead(
      convexQuery('discover:listDiscoverPlayers', { limit: 20 }),
      'discover_players'
    );
    assertRead(convexQuery('discover:listDiscoverZones', {}), 'discover_zones');
  });

  group('matchrooms', function () {
    assertRead(convexQuery('matchrooms:listOpen', {}), 'matchrooms_open');
    if (TARGET_ZONE_ID) {
      assertRead(
        convexQuery('matchrooms:listByZone', { zoneId: TARGET_ZONE_ID }),
        'matchrooms_by_zone'
      );
    }
    if (TARGET_MATCHROOM_ID) {
      assertRead(
        convexQuery('matchrooms:getById', { id: TARGET_MATCHROOM_ID }),
        'matchroom_by_id'
      );
    }
  });

  group('notifications', function () {
    // These require an authenticated identity; without a token they will be
    // unauthenticated, so we only assert "no 5xx" unless a token is supplied.
    assertRead(
      convexQuery('notifications:countUnreadFast', {}),
      'notifications_unread_count'
    );
    assertRead(
      convexQuery('notifications:listInboxPage', { paginationOpts: { numItems: 20, cursor: null } }),
      'notifications_inbox'
    );
  });

  sleep(1);
}

// ============================================================================
// WRITE-FLOW PLAN (NOT YET ACTIVE) — documented for when a staging test
// harness + per-VU tokens exist. Do NOT enable against production.
//
// Prerequisites:
//   - A pool of staging test-user bearer tokens (CONVEX_TEST_TOKEN per VU, or a
//     SharedArray of tokens keyed by __VU). See README "Auth" section.
//   - A staging-only seed of disposable zones/matchrooms so writes don't
//     pollute shared data, plus a documented cleanup mutation.
//   - A MOCK payment path. Easypaisa production must never be hit; use the
//     test/mock token + finalize endpoints described in the README.
//
// Sketch of the write journey (commented; verify exact arg shapes against
// convex/matchrooms.ts and convex/bookings.ts before enabling):
//
//   // 1. Create a matchroom.
//   // const created = convexMutation('matchrooms:create', { ...seedArgs });
//
//   // 2. Request to join (a second identity) -> exercises join-request path.
//   // convexMutation('matchrooms:requestToJoinMatchroom', { matchroomId });
//
//   // 3. Captain responds to the join request.
//   // convexMutation('matchrooms:respondToMatchroomJoinRequest', { requestId, accept: true });
//
//   // 4. Booking intent (hold a slot) -> bookings:createIntent.
//   // convexMutation('bookings:createIntent', { ...intentArgs });
//
//   // 5. Mock payment confirm. Drive the MOCK/test Easypaisa finalize route on
//   //    the .site origin: /payments/easypaisa/finalize (GET/POST). Use test
//   //    credentials only.
//   //    sitePost('/payments/easypaisa/finalize', { ...mockProviderPayload });
//
//   // 6. Result verification (captain report + participant votes).
//   // convexMutation('matchrooms:submitCaptainReport', { matchroomId, ... });
//   // convexMutation('matchrooms:submitParticipantVote', { matchroomId, vote });
// ============================================================================
