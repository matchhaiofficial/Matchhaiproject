import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const cron = cronJobs();

cron.interval(
  "expire stale bookings",
  { hours: 1 },
  internal.bookings.expireStaleBookingsInternal,
  {}
);

export default cron;
