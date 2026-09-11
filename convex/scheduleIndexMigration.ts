import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { parseKarachiDateTimeMillis } from "./karachiDateTime";

const PAGE_SIZE = 100;
const PHASES = [
  "room_open",
  "room_locked",
  "room_in_progress",
  "request_open",
  "request_pending_payment",
  "request_accepted",
] as const;
type Phase = typeof PHASES[number];

const phaseValidator = v.union(
  v.literal("room_open"),
  v.literal("room_locked"),
  v.literal("room_in_progress"),
  v.literal("request_open"),
  v.literal("request_pending_payment"),
  v.literal("request_accepted"),
);

function phaseStatus(phase: Phase) {
  const statuses: Record<Phase, string> = {
    room_open: "open",
    room_locked: "locked",
    room_in_progress: "in-progress",
    request_open: "open",
    request_pending_payment: "pending_payment",
    request_accepted: "accepted",
  };
  return statuses[phase];
}

export const prepareZoneScheduleIndex = internalMutation({
  args: {
    zoneId: v.id("zones"),
    phase: v.optional(phaseValidator),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    phase: phaseValidator,
    matchrooms: v.number(),
    bookingRequests: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new Error("Zone not found.");
    if (Number(zone.scheduleIndexVersion || 0) >= 1) {
      return { phase: args.phase || PHASES[0], matchrooms: 0, bookingRequests: 0, done: true };
    }

    const phase = args.phase || PHASES[0];
    const status = phaseStatus(phase);
    const isRoomPhase = phase.startsWith("room_");
    const page = isRoomPhase
      ? await ctx.db.query("matchrooms")
          .withIndex("by_zoneId_and_status_and_createdAt", (q: any) =>
            q.eq("zoneId", String(args.zoneId)).eq("status", status),
          )
          .paginate({ cursor: args.cursor || null, numItems: PAGE_SIZE })
      : await ctx.db.query("bookingRequests")
          .withIndex("by_zoneId_and_status_and_updatedAt", (q: any) =>
            q.eq("zoneId", args.zoneId).eq("status", status),
          )
          .paginate({ cursor: args.cursor || null, numItems: PAGE_SIZE });

    let matchrooms = 0;
    let bookingRequests = 0;

    for (const row of page.page as any[]) {
      if (Number(row.scheduledStartAt || 0) > 0) continue;
      const scheduledStartAt = isRoomPhase
        ? Number(row.startTime || 0)
          || parseKarachiDateTimeMillis(row.scheduledDate, row.scheduledTime)
          || 0
        : parseKarachiDateTimeMillis(row.preferredDate, row.preferredTime) || 0;
      if (!scheduledStartAt) {
        throw new Error(`${isRoomPhase ? "Matchroom" : "Booking request"} ${String(row._id)} has no valid schedule.`);
      }
      await ctx.db.patch(row._id, { scheduledStartAt });
      if (isRoomPhase) matchrooms += 1;
      else bookingRequests += 1;
    }

    if (!page.isDone) {
      if (!page.continueCursor || page.continueCursor === args.cursor) {
        throw new Error(`Schedule index migration made no progress in phase ${phase}.`);
      }
      await ctx.scheduler.runAfter(0, (internal as any).scheduleIndexMigration.prepareZoneScheduleIndex, {
        zoneId: args.zoneId,
        phase,
        cursor: page.continueCursor,
      });
      return { phase, matchrooms, bookingRequests, done: false };
    }

    const nextPhase = PHASES[PHASES.indexOf(phase) + 1];
    if (nextPhase) {
      await ctx.scheduler.runAfter(0, (internal as any).scheduleIndexMigration.prepareZoneScheduleIndex, {
        zoneId: args.zoneId,
        phase: nextPhase,
      });
      return { phase, matchrooms, bookingRequests, done: false };
    }

    await ctx.db.patch(args.zoneId, { scheduleIndexVersion: 1, updatedAt: Date.now() });
    return { phase, matchrooms, bookingRequests, done: true };
  },
});
