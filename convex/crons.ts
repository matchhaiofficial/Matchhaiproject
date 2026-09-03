import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { isMaintenanceJobEnabled } from "./runtimeEnv";

const crons = cronJobs();

if (isMaintenanceJobEnabled("MATCHHAI_ENABLE_LIFECYCLE_CRON")) {
  crons.interval(
    "matchroom lifecycle sweep",
    { minutes: 2 },
    (internal as any).matchrooms.runLifecycleSweep,
    { batchSize: 25 },
  );
}

if (isMaintenanceJobEnabled("MATCHHAI_ENABLE_ZONE_PILOT_CRON")) {
  crons.interval(
    "zone pilot expiry sweep",
    { minutes: 60 },
    (internal as any).zonePilot.expireEndedPilots,
    { batchSize: 50 },
  );
}

if (isMaintenanceJobEnabled("MATCHHAI_ENABLE_ZONE_BOOKING_EXPIRY_CRON")) {
  crons.interval(
    "zone booking request expiry sweep",
    { minutes: 2 },
    (internal as any).zoneAdminBooking.expireStaleBookingRequests,
    { batchSize: 50 },
  );
}

// Reconcile stale/abandoned Easypaisa transactions that the client poll/IPN
// never resolved (e.g. app killed after payment, IPN dropped). Re-inquires the
// provider and applies the result through the idempotent applyProviderUpdate
// path, which credits the wallet + notifies on paid-but-uncompletable orders.
if (isMaintenanceJobEnabled("MATCHHAI_ENABLE_PAYMENT_RECONCILER_CRON")) {
  crons.interval(
    "stale payment reconciler",
    { minutes: 5 },
    (internal as any).easypaisa.reconcileStalePayments,
    { batchSize: 15 },
  );
}

// Expire Team Challenges that never reached a linked matchroom (e.g. paid-but-
// unaccepted, or past their scheduled time) and release any held captain funds
// back to their wallets. Linked-matchroom challenges are handled by the matchroom
// lifecycle sweep instead.
if (isMaintenanceJobEnabled("MATCHHAI_ENABLE_TEAM_CHALLENGE_EXPIRY_CRON")) {
  crons.interval(
    "team challenge expiry sweep",
    { minutes: 30 },
    (internal as any).teamChallenges.expireStaleChallenges,
    { batchSize: 25 },
  );
}

export default crons;
