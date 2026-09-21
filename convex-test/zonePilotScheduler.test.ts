import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";

describe("zone pilot scheduler safety", () => {
  afterEach(() => vi.useRealTimers());

  test("backfill is bounded and deduplicates the same pilot deadline", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-09-11T12:00:00.000Z");
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const ownerUid = await ctx.db.insert("users", {
        email: "pilot-scheduler@example.com",
        fullName: "Pilot Scheduler",
        username: "pilot_scheduler",
        usernameLower: "pilot_scheduler",
        accountType: "zone",
        isOnline: false,
        createdAt: now - 2_000,
        updatedAt: now - 1_000,
      });
      await ctx.db.insert("zones", {
        ownerUid,
        name: "Pilot Scheduler Zone",
        status: "active",
        games: ["cs2"],
        branches: [],
        pilotStatus: "active",
        pilotStartedAt: now - 1_000,
        pilotEndsAt: now + 60_000,
        createdAt: now - 2_000,
        updatedAt: now - 1_000,
      });
    });

    await t.mutation(internal.zonePilot.scheduleActivePilotExpiries, {});
    await t.mutation(internal.zonePilot.scheduleActivePilotExpiries, {});

    const result = await t.run(async (ctx) => {
      const zones = await ctx.db.query("zones").collect();
      const jobs = await ctx.db.system.query("_scheduled_functions").collect();
      return {
        zone: zones[0],
        pending: jobs.filter((job) => job.state.kind === "pending"),
      };
    });

    expect(result.zone?.pilotExpiryScheduledAt).toBe(now + 60_000);
    expect(result.zone?.pilotExpiryScheduledFnId).toBeTruthy();
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].scheduledTime).toBe(now + 60_000);
  });

  test("overdue pilot work is delayed once and then terminates after ending", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-09-11T12:00:00.000Z");
    vi.setSystemTime(now);
    const t = convexTest(schema, modules);

    const zoneId = await t.run(async (ctx) => {
      const ownerUid = await ctx.db.insert("users", {
        email: "overdue-pilot@example.com",
        fullName: "Overdue Pilot",
        username: "overdue_pilot",
        usernameLower: "overdue_pilot",
        accountType: "zone",
        isOnline: false,
        createdAt: now - 120_000,
        updatedAt: now - 1_000,
      });
      return ctx.db.insert("zones", {
        ownerUid,
        name: "Overdue Pilot Zone",
        status: "active",
        games: ["cs2"],
        branches: [],
        pilotStatus: "active",
        pilotStartedAt: now - 120_000,
        pilotEndsAt: now - 1_000,
        createdAt: now - 120_000,
        updatedAt: now - 1_000,
      });
    });

    await t.mutation(internal.zonePilot.scheduleActivePilotExpiries, {});
    const beforeRun = await t.run(async (ctx) => {
      const jobs = await ctx.db.system.query("_scheduled_functions").collect();
      return jobs.filter((job) => job.state.kind === "pending");
    });
    expect(beforeRun).toHaveLength(1);
    expect(beforeRun[0].scheduledTime).toBe(now + 1_000);

    await vi.advanceTimersByTimeAsync(1_001);
    await t.finishInProgressScheduledFunctions();

    const zone = await t.run(async (ctx) => ctx.db.get(zoneId));
    expect(zone?.pilotStatus).toBe("ended");
    expect(zone?.pilotExpiryScheduledAt).toBeUndefined();
    expect(zone?.pilotExpiryScheduledFnId).toBeUndefined();
  });
});
