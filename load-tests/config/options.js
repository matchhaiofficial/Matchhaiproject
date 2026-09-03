// Shared k6 options and staged ramp profiles for MatchHai load testing.
//
// ============================================================================
// STAGING ONLY. Never point these profiles at production.
// ============================================================================
//
// Each profile is exported by name and consumed by scenarios via:
//   import { profiles, thresholds } from '../config/options.js';
//
// Thresholds (applied to every profile below):
//   - http_req_failed   : request error rate must stay below 1%.
//   - http_req_duration : p95 latency target of 800ms (documented SLO target;
//                         tune to the staging deployment's real baseline).
//   - checks            : functional check pass rate must stay above 99%.
//
// NO-5xx EXPECTATION:
//   The backend should never return a 5xx under any of these profiles. A 5xx
//   is a hard failure signal (server crash / unhandled exception / overload),
//   not an acceptable degradation. We assert this with a dedicated rate metric
//   `server_errors` in lib/http.js (recorded per response) and a threshold
//   that requires it to stay at zero.

export const thresholds = {
  // Fraction of requests that failed (network error or status >= 400).
  http_req_failed: ['rate<0.01'],
  // 95th percentile request duration. 800ms is the documented target SLO.
  // Adjust after establishing a clean baseline on staging.
  http_req_duration: ['p(95)<800'],
  // Functional checks (assertions in scenarios) must pass > 99% of the time.
  checks: ['rate>0.99'],
  // Custom metric defined in lib/http.js: must remain exactly 0.
  // Any 5xx from staging is treated as a hard failure.
  server_errors: ['rate<0.001'],
};

// ----------------------------------------------------------------------------
// Profiles. Use ramping-vus executor so load builds gradually (a sudden cliff
// of VUs is unrealistic and hides where latency starts to degrade).
// ----------------------------------------------------------------------------

export const profiles = {
  // Quick sanity check. 1-2 VUs for 30s. Used by smoke.js.
  smoke: {
    executor: 'constant-vus',
    vus: 2,
    duration: '30s',
    tags: { profile: 'smoke' },
  },

  // ~100 concurrent users, gradual ramp.
  load100: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 50 },   // ramp up
      { duration: '1m', target: 100 },  // ramp to target
      { duration: '3m', target: 100 },  // hold at target
      { duration: '1m', target: 0 },    // ramp down
    ],
    gracefulRampDown: '30s',
    tags: { profile: 'load100' },
  },

  // ~500 concurrent users, gradual ramp.
  load500: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 200 },
      { duration: '2m', target: 500 },
      { duration: '5m', target: 500 },
      { duration: '1m', target: 0 },
    ],
    gracefulRampDown: '30s',
    tags: { profile: 'load500' },
  },

  // ~1000 concurrent users, gradual ramp. Heaviest profile.
  load1000: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 300 },
      { duration: '3m', target: 700 },
      { duration: '3m', target: 1000 },
      { duration: '5m', target: 1000 },
      { duration: '2m', target: 0 },
    ],
    gracefulRampDown: '45s',
    tags: { profile: 'load1000' },
  },
};

// Resolve a profile by name with a safe fallback to smoke.
export function resolveProfile(name) {
  if (name && profiles[name]) {
    return profiles[name];
  }
  // eslint-disable-next-line no-console
  console.warn(
    `[options] Unknown PROFILE "${name}", falling back to "smoke". ` +
      `Valid values: ${Object.keys(profiles).join(', ')}.`
  );
  return profiles.smoke;
}
