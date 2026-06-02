import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "matchroom lifecycle sweep",
  { minutes: 2 },
  (internal as any).matchrooms.runLifecycleSweep,
  { batchSize: 25 },
);

crons.interval(
  "zone pilot expiry sweep",
  { minutes: 60 },
  (internal as any).zonePilot.expireEndedPilots,
  { batchSize: 50 },
);

// Reconcile stale/abandoned Easypaisa transactions that the client poll/IPN
// never resolved (e.g. app killed after payment, IPN dropped). Re-inquires the
// provider and applies the result through the idempotent applyProviderUpdate
// path, which credits the wallet + notifies on paid-but-uncompletable orders.
crons.interval(
  "stale payment reconciler",
  { minutes: 5 },
  (internal as any).easypaisa.reconcileStalePayments,
  { batchSize: 15 },
);

export default crons;
