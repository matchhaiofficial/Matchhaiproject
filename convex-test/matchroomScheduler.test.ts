import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";

describe("matchroom scheduled lifecycle", () => {
  afterEach(() => vi.useRealTimers());

  test("a due room advances once and leaves only a future completion job", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-09-11T12:00:00.000Z");
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);

    const roomId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("matchrooms", {
        hostUid: "player-a",
        hostName: "Player A",
        game: "cs2",
        title: "Scheduler safety test",
        status: "locked",
        maxPlayers: 2,
        currentPlayers: 2,
        players: [
          { uid: "player-a", username: "Player A", joinedAt: now - 1_000 },
          { uid: "player-b", username: "Player B", joinedAt: now - 1_000 },
        ],
        playerUids: ["player-a", "player-b"],
        locationMode: "zone",
        zoneAdminApproved: true,
        venueConfirmedAt: now - 1_000,
        scheduledStartAt: now,
        durationMinutes: 60,
        pricing: { perPlayer: 0, currency: "PKR" },
        slotsA: [{ slotId: "a1", uid: "player-a", status: "confirmed" }],
        slotsB: [{ slotId: "b1", uid: "player-b", status: "confirmed" }],
        captainUidA: "player-a",
        captainUidB: "player-b",
        lifecycleDueAt: now,
        lifecycleScheduledAt: now,
        lifecycleScheduledFnId: "pending",
        createdAt: now - 10_000,
        updatedAt: now - 1_000,
      });
      const scheduledId = await ctx.scheduler.runAt(
        now + 1_000,
        internal.matchrooms.processScheduledLifecycle,
        { matchroomId: id, expectedDueAt: now },
      );
      await ctx.db.patch(id, { lifecycleScheduledFnId: String(scheduledId) });
      return id;
    });

    await vi.advanceTimersByTimeAsync(1_001);
    await t.finishInProgressScheduledFunctions();

    const result = await t.run(async (ctx) => {
      const room = await ctx.db.get(roomId as Id<"matchrooms">);
      const jobs = await ctx.db.system.query("_scheduled_functions").collect();
      return { room, jobs };
    });

    expect(result.room?.status).toBe("in-progress");
    expect(result.room?.lifecycleDueAt).toBe(now + 60 * 60 * 1_000);
    const pending = result.jobs.filter((job) => job.state.kind === "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].scheduledTime).toBe(now + 60 * 60 * 1_000);
  });
});
