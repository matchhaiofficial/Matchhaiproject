import { convexTest } from "convex-test";
import { afterEach, describe, expect, test } from "vitest";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";

describe("notification push circuit breaker", () => {
  const originalFlag = process.env.MATCHHAI_ENABLE_PUSH_DELIVERY;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.MATCHHAI_ENABLE_PUSH_DELIVERY;
    } else {
      process.env.MATCHHAI_ENABLE_PUSH_DELIVERY = originalFlag;
    }
  });

  test("creates the in-app notification but schedules no delivery when disabled", async () => {
    process.env.MATCHHAI_ENABLE_PUSH_DELIVERY = "0";
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "push-disabled@example.com",
        fullName: "Push Disabled",
        username: "push_disabled",
        usernameLower: "push_disabled",
        accountType: "player",
        isOnline: false,
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    const result = await t.mutation(internal.notifications.createCanonicalFromServer, {
      toUid: userId,
      type: "system.announcement",
      title: "In-app only",
      body: "This notification should not schedule native delivery.",
      pushPolicy: "eligible",
    });

    const state = await t.run(async (ctx) => ({
      notification: await ctx.db.get(result.notificationId) as any,
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));

    expect(result.scheduledPush).toBe(false);
    expect(state.notification?.pushPolicy).toBe("eligible");
    expect(state.notification?.pushState).toBe("skipped");
    expect(state.jobs).toHaveLength(0);
  });

  test("does not spawn a delivery action for a recipient without an active device", async () => {
    process.env.MATCHHAI_ENABLE_PUSH_DELIVERY = "1";
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "no-device@example.com",
        fullName: "No Device",
        username: "no_device",
        usernameLower: "no_device",
        accountType: "player",
        isOnline: false,
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    const result = await t.mutation(internal.notifications.createCanonicalFromServer, {
      toUid: userId,
      type: "system.announcement",
      pushPolicy: "eligible",
    });
    const state = await t.run(async (ctx) => ({
      notification: await ctx.db.get(result.notificationId) as any,
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));

    expect(result.scheduledPush).toBe(false);
    expect(state.notification?.pushState).toBe("no_device");
    expect(state.notification?.pushError).toBe("no_active_devices");
    expect(state.jobs).toHaveLength(0);
  });
});
