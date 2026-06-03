// Race-condition test skeleton.
//
// ============================================================================
// STAGING ONLY. Requires a staging test harness + tokens (see README). This is
// a DOCUMENTED SKELETON: most steps are inert until the write paths and a
// per-VU token pool are available, because the contended mutations are not
// reachable without an authenticated identity.
// ============================================================================
//
// Goal: prove the backend enforces single-winner semantics under true
// concurrency. Two scenarios:
//
//   A) Two VUs attempt to book / hold the SAME slot at the SAME instant.
//      Expected: exactly ONE succeeds; the other is rejected cleanly
//      (conflict / already-held), NOT a 5xx, and NO double-booking persists.
//
//   B) Duplicate join requests from the same user to the same matchroom fired
//      concurrently. Expected: exactly ONE pending join request is created;
//      duplicates are de-duplicated or rejected, never producing two rows.
//
// We use a tiny per-iteration "barrier" (sleep aligned to a wall-clock tick)
// so the two VUs fire as close to simultaneously as k6 allows. True lockstep
// is impossible in k6, but aligning to a shared time boundary maximises
// contention.

import { sleep } from 'k6';
import { thresholds } from '../config/options.js';
import {
  convexMutation,
  convexQuery,
  expectNoServerError,
  hasToken,
} from '../lib/http.js';

// Contended targets must be provided via env (a disposable staging slot).
const TARGET_MATCHROOM_ID = __ENV.TARGET_MATCHROOM_ID || '';
const TARGET_ZONE_ID = __ENV.TARGET_ZONE_ID || '';

export const options = {
  scenarios: {
    // Two scenarios, each pinned to exactly 2 VUs that race each other.
    booking_race: {
      executor: 'per-vu-iterations',
      vus: 2,
      iterations: 10, // 10 contended attempts per VU
      maxDuration: '2m',
      exec: 'bookingRace',
      tags: { race: 'booking_slot' },
    },
    join_request_race: {
      executor: 'per-vu-iterations',
      vus: 2,
      iterations: 10,
      maxDuration: '2m',
      startTime: '2m30s', // run after booking_race to avoid cross-talk
      exec: 'joinRequestRace',
      tags: { race: 'duplicate_join' },
    },
  },
  // Reuse shared thresholds. NOTE: under a race test we EXPECT some 4xx
  // (the losing attempt), so http_req_failed will legitimately be non-zero.
  // We still require zero 5xx. Override http_req_failed here to a looser bound
  // appropriate for an intentionally-contended test.
  thresholds: Object.assign({}, thresholds, {
    http_req_failed: ['rate<0.60'], // up to ~half of contended attempts lose
    server_errors: ['rate<0.001'],  // but a 5xx is still a hard failure
  }),
};

// Setup runs once before VUs start. Use it to (eventually) seed a fresh
// disposable matchroom/slot on staging and hand its id to all VUs.
export function setup() {
  if (!hasToken()) {
    // eslint-disable-next-line no-console
    console.warn(
      '[race] No CONVEX_TEST_TOKEN supplied — race mutations cannot run. ' +
        'This run will only verify reachability/no-5xx. See README.'
    );
  }
  // TODO (harness): create a disposable matchroom + bookable slot here and
  // return its ids so both VUs contend on the SAME target. For now we pass
  // through env-provided ids.
  return {
    matchroomId: TARGET_MATCHROOM_ID,
    zoneId: TARGET_ZONE_ID,
  };
}

// Align all VUs to the next whole second so they fire near-simultaneously.
function barrier() {
  const now = Date.now();
  const nextTick = Math.ceil(now / 1000) * 1000;
  sleep((nextTick - now) / 1000);
}

// Scenario A: two VUs book/hold the same slot at once.
export function bookingRace(data) {
  barrier();

  if (!hasToken() || !data.matchroomId) {
    // Harness not available: just probe a read path and assert no 5xx so the
    // skeleton is runnable end-to-end without exploding.
    const probe = convexQuery('matchrooms:getById', { id: data.matchroomId || 'missing' });
    expectNoServerError(probe, 'booking_race_probe');
    return;
  }

  // TODO (harness): replace with the real booking-intent mutation and verify
  // single-winner. Expected: exactly one VU gets a 2xx; the other gets a clean
  // 4xx (slot already held), never a 5xx, and the slot is held exactly once.
  const res = convexMutation('bookings:createIntent', {
    matchroomId: data.matchroomId,
    // ...remaining intent args (see convex/bookings.ts createIntent)
  });
  expectNoServerError(res, 'booking_race_attempt');

  // Post-condition (commented): after both VUs finish, a verification query
  // should confirm the slot is held by exactly one user. Best asserted in
  // teardown() or a follow-up read once the harness exposes that state.
}

// Scenario B: duplicate join requests from the same identity, concurrently.
export function joinRequestRace(data) {
  barrier();

  if (!hasToken() || !data.matchroomId) {
    const probe = convexQuery('matchrooms:getById', { id: data.matchroomId || 'missing' });
    expectNoServerError(probe, 'join_race_probe');
    return;
  }

  // TODO (harness): both VUs use the SAME user token (duplicate request from
  // one user). Expected: exactly one pending request row exists afterward.
  const res = convexMutation('matchrooms:requestToJoinMatchroom', {
    matchroomId: data.matchroomId,
  });
  expectNoServerError(res, 'join_race_attempt');
}

// Teardown runs once after all VUs. Use it to (eventually) assert invariants
// and clean up the disposable staging data created in setup().
export function teardown(data) {
  if (!hasToken() || !data.matchroomId) {
    return;
  }
  // TODO (harness): query final state and assert single-winner invariants,
  // then delete the disposable matchroom/slot created in setup().
}
