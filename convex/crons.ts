import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "matchroom lifecycle sweep",
  { minutes: 2 },
  (internal as any).matchrooms.runLifecycleSweep,
  { batchSize: 25 },
);

export default crons;
