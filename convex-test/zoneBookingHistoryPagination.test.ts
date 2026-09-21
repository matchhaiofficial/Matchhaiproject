import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";

describe("zone booking history pagination", () => {
  test("walks all historical broadcast requests without changing the legacy array endpoint", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, zoneId } = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        authId: "zone-history-owner",
        email: "zone-history-owner@example.com",
        fullName: "Zone History Owner",
        username: "zone_history_owner",
        usernameLower: "zone_history_owner",
        accountType: "zone",
        isOnline: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const zoneId = await ctx.db.insert("zones", {
        ownerUid: ownerId,
        name: "History Zone",
        status: "active",
        games: ["cs2"],
        branches: [],
        createdAt: 1,
        updatedAt: 1,
      });

      for (let index = 0; index < 3; index += 1) {
        await ctx.db.insert("bookingRequests", {
          userId: ownerId,
          gameKey: "cs2",
          zoneId,
          requestKind: "broadcast_fanout",
          status: "expired",
          lifecycleStatus: "expired",
          playerCount: 1,
          createdAt: index + 1,
          updatedAt: index + 1,
        });
      }
      return { ownerId, zoneId };
    });

    const identity = { subject: "zone-history-owner" };
    const firstPage = await t.withIdentity(identity).query(api.zoneAdminBooking.listBookingHistoryPageForZone, {
      zoneId: String(zoneId),
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(firstPage.page).toHaveLength(1);
    expect(firstPage.isDone).toBe(false);

    const secondPage = await t.withIdentity(identity).query(api.zoneAdminBooking.listBookingHistoryPageForZone, {
      zoneId: String(zoneId),
      paginationOpts: { numItems: 1, cursor: firstPage.continueCursor },
    });
    const thirdPage = await t.withIdentity(identity).query(api.zoneAdminBooking.listBookingHistoryPageForZone, {
      zoneId: String(zoneId),
      paginationOpts: { numItems: 1, cursor: secondPage.continueCursor },
    });

    expect([...firstPage.page, ...secondPage.page, ...thirdPage.page]).toHaveLength(3);
    expect(thirdPage.isDone).toBe(true);

    const legacyRows = await t.withIdentity(identity).query(api.zoneAdminBooking.listBookingHistoryForZone, {
      zoneId: String(zoneId),
      limit: 3,
    });
    expect(legacyRows).toHaveLength(3);
    expect(String(legacyRows[0].id)).toBe(String(firstPage.page[0]?.id));
    expect(ownerId).toBeTruthy();
  });
});
