// Smoke test: minimal, fast sanity check that staging is up and the main
// read paths respond. Run with: npm run load:smoke
//
// ============================================================================
// STAGING ONLY.
// ============================================================================
//
// Covers:
//   1. App/session reachability check (Better Auth route on the .site origin).
//   2. Discover matchrooms read (generic Convex query API on the .cloud origin).
//   3. Matchrooms list read.
//
// Notes on auth: read paths that require a signed-in user will return 401
// without CONVEX_TEST_TOKEN. The smoke test still asserts "no 5xx" for those
// so we catch server crashes regardless of auth state. See README.md.

import { sleep } from 'k6';
import { profiles, thresholds } from '../config/options.js';
import {
  siteGet,
  convexQuery,
  expectOk,
  expectNoServerError,
  hasToken,
} from '../lib/http.js';

export const options = {
  scenarios: {
    smoke: profiles.smoke,
  },
  thresholds,
};

export default function () {
  // 1. Session / app reachability. Better Auth exposes routes under the
  //    .site origin (registered in convex/http.ts via registerRoutes).
  //    Hitting the session endpoint should never 5xx; it returns 200/401.
  const session = siteGet('/api/auth/get-session');
  expectNoServerError(session, 'auth_session');

  // 2. Discover matchrooms (read-heavy public-ish list).
  const discover = convexQuery('discover:listDiscoverMatchrooms', { limit: 20 });
  if (hasToken()) {
    expectOk(discover, 'discover_matchrooms', {
      'body is non-empty': (r) => r.body && r.body.length > 0,
    });
  } else {
    // Without a token this may be unauthenticated; still must not 5xx.
    expectNoServerError(discover, 'discover_matchrooms');
  }

  // 3. Matchrooms open list.
  const matchrooms = convexQuery('matchrooms:listOpen', {});
  if (hasToken()) {
    expectOk(matchrooms, 'matchrooms_list');
  } else {
    expectNoServerError(matchrooms, 'matchrooms_list');
  }

  sleep(1);
}
