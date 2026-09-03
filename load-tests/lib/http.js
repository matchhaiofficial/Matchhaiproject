// Shared HTTP helpers for MatchHai k6 scenarios.
//
// ============================================================================
// STAGING ONLY. The default base URLs below point at the staging deployment.
// Never override them with a production URL.
// ============================================================================
//
// Convex exposes two relevant origins:
//   - CONVEX_SITE_URL (.site)  -> custom httpAction routes registered in
//                                 convex/http.ts (Better Auth, Easypaisa,
//                                 support, KYC webhook).
//   - CONVEX_URL (.cloud)      -> the deployment's generic function API
//                                 (/api/query, /api/mutation, /api/action),
//                                 which is how the client SDK drives queries
//                                 and mutations under the hood.
//
// Most query/mutation flows (discover, matchrooms, notifications, bookings)
// are NOT custom HTTP routes. To exercise them over HTTP you call the generic
// function API on the .cloud origin with a JSON body of { path, args, format }
// and an Authorization bearer token. See README.md for the full explanation
// and the caveats around auth.

import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

// Tracks any 5xx response so options.js can threshold it to zero.
export const serverErrors = new Rate('server_errors');

// Staging defaults. Overridable via environment, but must remain non-prod.
const DEFAULT_SITE_URL = 'https://acrobatic-bison-271.convex.site';
const DEFAULT_CLOUD_URL = 'https://acrobatic-bison-271.convex.cloud';

export const SITE_URL = (__ENV.CONVEX_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
export const CLOUD_URL = (__ENV.CONVEX_URL || DEFAULT_CLOUD_URL).replace(/\/$/, '');

// Optional bearer token for authenticated flows. See README for how to mint a
// staging-only test token. When absent, authenticated flows should be skipped.
const TEST_TOKEN = __ENV.CONVEX_TEST_TOKEN || '';

// Loud guard against accidentally aiming at production.
if (/REPLACE_WITH_PRODUCTION|prod/i.test(SITE_URL) || /REPLACE_WITH_PRODUCTION|prod/i.test(CLOUD_URL)) {
  throw new Error(
    `[http] Refusing to run: a URL looks production-like (SITE_URL=${SITE_URL}, CLOUD_URL=${CLOUD_URL}). ` +
      `Load tests are staging-only.`
  );
}

export function hasToken() {
  return TEST_TOKEN.length > 0;
}

// Standard headers; includes the bearer token only when one is supplied.
export function headers(extra) {
  const base = { 'Content-Type': 'application/json' };
  if (TEST_TOKEN) {
    base['Authorization'] = `Bearer ${TEST_TOKEN}`;
  }
  return Object.assign(base, extra || {});
}

// GET against the .site origin (custom httpAction routes from convex/http.ts).
export function siteGet(path, params) {
  const res = http.get(`${SITE_URL}${path}`, Object.assign({ headers: headers() }, params || {}));
  recordServerError(res);
  return res;
}

// POST against the .site origin.
export function sitePost(path, body, params) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body || {});
  const res = http.post(`${SITE_URL}${path}`, payload, Object.assign({ headers: headers() }, params || {}));
  recordServerError(res);
  return res;
}

// Call a Convex query via the generic function API on the .cloud origin.
//   funcRef example: "discover:listDiscoverMatchrooms"
//   args:            plain object of named args (Convex uses named args)
export function convexQuery(funcRef, args, params) {
  const body = JSON.stringify({ path: funcRef, args: args || {}, format: 'json' });
  const res = http.post(`${CLOUD_URL}/api/query`, body, Object.assign({ headers: headers() }, params || {}));
  recordServerError(res);
  return res;
}

// Call a Convex mutation via the generic function API on the .cloud origin.
export function convexMutation(funcRef, args, params) {
  const body = JSON.stringify({ path: funcRef, args: args || {}, format: 'json' });
  const res = http.post(`${CLOUD_URL}/api/mutation`, body, Object.assign({ headers: headers() }, params || {}));
  recordServerError(res);
  return res;
}

// Call a Convex action via the generic function API on the .cloud origin.
export function convexAction(funcRef, args, params) {
  const body = JSON.stringify({ path: funcRef, args: args || {}, format: 'json' });
  const res = http.post(`${CLOUD_URL}/api/action`, body, Object.assign({ headers: headers() }, params || {}));
  recordServerError(res);
  return res;
}

// Record whether a response was a 5xx (used by the server_errors threshold).
function recordServerError(res) {
  serverErrors.add(res.status >= 500 && res.status < 600);
}

// Safe check() wrapper: every assertion is tagged with the supplied name so
// failing checks are easy to find in the summary, and a 5xx never silently
// passes. `extraChecks` is an optional map of { label: (res) => bool }.
export function expectOk(res, name, extraChecks) {
  const checks = {
    [`${name}: status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name}: no server error (5xx)`]: (r) => !(r.status >= 500 && r.status < 600),
  };
  if (extraChecks) {
    for (const label of Object.keys(extraChecks)) {
      checks[`${name}: ${label}`] = extraChecks[label];
    }
  }
  return check(res, checks, { check_group: name });
}

// Variant for endpoints where a 2xx is not guaranteed (e.g. an endpoint that
// legitimately returns 401 without a token). Still flags any 5xx.
export function expectNoServerError(res, name) {
  return check(
    res,
    {
      [`${name}: no server error (5xx)`]: (r) => !(r.status >= 500 && r.status < 600),
    },
    { check_group: name }
  );
}
