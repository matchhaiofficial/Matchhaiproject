import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";

describe("bounded team chat list", () => {
  test("caps recent memberships while retaining unread and avatar projections", async () => {
    const t = convexTest(schema, modules);
    const { userId, otherId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "chat-list-owner@example.com",
        fullName: "Chat List Owner",
        username: "chat_list_owner",
        usernameLower: "chat_list_owner",
        accountType: "player",
        isOnline: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const otherId = await ctx.db.insert("users", {
        email: "chat-list-friend@example.com",
        fullName: "Chat List Friend",
        username: "chat_list_friend",
        usernameLower: "chat_list_friend",
        photoURL: "https://example.test/friend.png",
        accountType: "player",
        isOnline: false,
        createdAt: 1,
        updatedAt: 1,
      });

      for (let index = 0; index < 105; index += 1) {
        const now = index + 1;
        const teamId = await ctx.db.insert("teams", {
          name: `Team ${index}`,
          nameLower: `team-${index}`,
          game: "cs2",
          captainUid: userId,
          captainUsername: "chat_list_owner",
          memberUids: [String(userId), String(otherId)],
          memberCount: 2,
          maxMembers: 7,
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("teamMembers", {
          teamId,
          odxerId: userId,
          username: "chat_list_owner",
          role: "captain",
          joinedAt: now,
        });
        const chatroomId = await ctx.db.insert("chatrooms", {
          type: "team",
          teamId,
          participantUids: [String(userId), String(otherId)],
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("chatroomMembers", {
          chatroomId,
          userId: String(userId),
          joinedAt: now,
          unreadCount: index === 104 ? 3 : 0,
          updatedAt: now,
        });
      }
      return { userId, otherId };
    });

    const rows = await t.withIdentity({ subject: String(userId) }).query(api.teamChat.listForMe, {});
    expect(rows).toHaveLength(100);
    expect(rows[0]).toMatchObject({
      unreadCount: 3,
      avatarURL: "https://example.test/friend.png",
    });
    expect(rows.every((row) => row.participantUids.includes(String(otherId)))).toBe(true);
  });
});
