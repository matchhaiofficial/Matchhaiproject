import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";

const modulesForTest = modules;

function userRecord(authId: string, username: string, walletBalance = 0) {
  return {
    authId,
    email: `${username}@example.com`,
    fullName: username,
    username,
    usernameLower: username.toLowerCase(),
    accountType: "player" as const,
    isOnline: false,
    kycVerificationStatus: "verified" as const,
    walletBalance,
    walletHeldBalance: 0,
    skillScores: {
      cs2: {
        rating: 50,
        tier: "Gold",
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        lastUpdated: 1,
      },
    },
    createdAt: 1,
    updatedAt: 1,
  };
}

function teamRecord(captainUid: Id<"users">, name: string) {
  return {
    name,
    nameLower: name.toLowerCase(),
    game: "cs2",
    captainUid,
    captainUsername: name,
    memberUids: [String(captainUid)],
    memberCount: 1,
    maxMembers: 1,
    mainRosterSize: 1,
    status: "active" as const,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("critical multi-user journeys", () => {
  test("a user report creates a block that prevents the reported user joining the same matchroom", async () => {
    const t = convexTest(schema, modulesForTest);
    const { reporterId, reportedId, roomId } = await t.run(async (ctx) => {
      const reporterId = await ctx.db.insert("users", userRecord("reporter-auth", "reporter"));
      const reportedId = await ctx.db.insert("users", userRecord("reported-auth", "reported"));
      const roomId = await ctx.db.insert("matchrooms", {
        hostUid: String(reporterId),
        hostName: "reporter",
        game: "cs2",
        title: "Safety boundary room",
        status: "open",
        maxPlayers: 2,
        currentPlayers: 1,
        players: [{ uid: String(reporterId), username: "reporter", joinedAt: 1 }],
        playerUids: [String(reporterId)],
        pricing: { perPlayer: 0, currency: "PKR" },
        slotsA: [],
        slotsB: [],
        createdAt: 1,
        updatedAt: 1,
      });
      return { reporterId, reportedId, roomId };
    });

    const report = await t.withIdentity({ subject: "reporter-auth" }).mutation(api.reports.createUserReport, {
      reportedUserId: reportedId,
      reason: "harassment",
      description: "Safety regression test",
    });
    expect(report.created).toBe(true);

    const block = await t.run((ctx) =>
      ctx.db.query("userBlocks")
        .withIndex("by_userId_and_blockedUserId", (q) =>
          q.eq("userId", reporterId).eq("blockedUserId", reportedId),
        )
        .unique(),
    );
    expect(block).not.toBeNull();

    await expect(
      t.withIdentity({ subject: "reported-auth" }).mutation(api.matchrooms.requestToJoinMatchroom, {
        matchroomId: roomId,
        fromUid: reportedId,
        fromUsername: "reported",
      }),
    ).rejects.toThrow(/cannot join this matchroom/i);
  });

  test("matchroom creation is idempotent for a retried client request", async () => {
    const t = convexTest(schema, modulesForTest);
    const hostId = await t.run((ctx) => ctx.db.insert("users", {
      ...userRecord("seed-host-auth", "seed_host"),
      playsCs2: true,
    }));
    const args = {
      hostUid: String(hostId),
      hostName: "seed_host",
      game: "cs2",
      title: "Retry-safe room",
      maxPlayers: 2,
      players: [{ uid: String(hostId), username: "seed_host", joinedAt: 1 }],
      playerUids: [String(hostId)],
      pricing: { perPlayer: 0, currency: "PKR" },
      slotsA: [],
      slotsB: [],
      bookingSource: "seed",
      paymentStatus: "unpaid",
      clientCreateRequestId: "retry-001",
      scheduledDate: "2026-10-01",
      scheduledTime: "12:00",
    };

    const first = await t.mutation(internal.matchrooms.createSeededDemo, args);
    const second = await t.mutation(internal.matchrooms.createSeededDemo, args);
    expect(second).toBe(first);

    const rooms = await t.run((ctx) =>
      ctx.db.query("matchrooms")
        .withIndex("by_hostUid_and_clientCreateRequestId", (q) =>
          q.eq("hostUid", String(hostId)).eq("clientCreateRequestId", "retry-001"),
        )
        .take(10),
    );
    expect(rooms).toHaveLength(1);
  });

  test("team challenge acceptance is captain-gated and paid holds release exactly once on cancel", async () => {
    const t = convexTest(schema, modulesForTest);
    const { captainA, captainB, teamA, teamB } = await t.run(async (ctx) => {
      const captainA = await ctx.db.insert("users", userRecord("challenge-a-auth", "challenge_a", 500));
      const captainB = await ctx.db.insert("users", userRecord("challenge-b-auth", "challenge_b", 500));
      const teamA = await ctx.db.insert("teams", teamRecord(captainA, "Challenge A"));
      const teamB = await ctx.db.insert("teams", teamRecord(captainB, "Challenge B"));
      await ctx.db.insert("teamMembers", {
        teamId: teamA,
        odxerId: captainA,
        username: "challenge_a",
        role: "captain",
        rosterRole: "main",
        rosterOrder: 0,
        joinedAt: 1,
      });
      await ctx.db.insert("teamMembers", {
        teamId: teamB,
        odxerId: captainB,
        username: "challenge_b",
        role: "captain",
        rosterRole: "main",
        rosterOrder: 0,
        joinedAt: 1,
      });
      return { captainA, captainB, teamA, teamB };
    });

    const challengeId = await t.withIdentity({ subject: "challenge-a-auth" }).mutation(api.teamChallenges.create, {
      challengerTeamId: teamA,
      challengerTeamName: "Challenge A",
      opponentTeamId: teamB,
      opponentTeamName: "Challenge B",
      game: "cs2",
      message: "Best of luck",
    });

    await expect(
      t.withIdentity({ subject: "challenge-a-auth" }).mutation(api.teamChallenges.respond, {
        challengeId,
        accept: true,
        actorUid: captainA,
      }),
    ).rejects.toThrow(/only the challenged captain/i);

    const accepted = await t.withIdentity({ subject: "challenge-b-auth" }).mutation(api.teamChallenges.respond, {
      challengeId,
      accept: true,
      actorUid: captainB,
    });
    expect(accepted).toMatchObject({ ok: true, status: "accepted" });

    const paidChallengeId = await t.run((ctx) => ctx.db.insert("teamChallenges", {
      challengerTeamId: teamA,
      challengerTeamName: "Challenge A",
      opponentTeamId: teamB,
      opponentTeamName: "Challenge B",
      game: "cs2",
      gameKey: "cs2",
      status: "accepted",
      captainAUid: captainA,
      captainAName: "challenge_a",
      captainBUid: captainB,
      captainBName: "challenge_b",
      maxPlayers: 2,
      pricePerPlayer: 200,
      paymentMode: "paid",
      teamAPaymentState: "unpaid",
      teamBPaymentState: "unpaid",
      lineupA: [String(captainA)],
      createdAt: 1,
      updatedAt: 1,
    }));

    const held = await t.withIdentity({ subject: "challenge-a-auth" }).mutation(api.teamChallenges.payTeamChallengeSideFromWallet, {
      challengeId: paidChallengeId,
      actorUid: captainA,
    });
    expect(held).toMatchObject({ ok: true, side: "teamA", state: "held", amount: 200 });

    const retried = await t.withIdentity({ subject: "challenge-a-auth" }).mutation(api.teamChallenges.payTeamChallengeSideFromWallet, {
      challengeId: paidChallengeId,
      actorUid: captainA,
    });
    expect(retried).toMatchObject({ ok: true, alreadyApplied: true, state: "held" });

    await t.withIdentity({ subject: "challenge-a-auth" }).mutation(api.teamChallenges.cancel, {
      challengeId: paidChallengeId,
      actorUid: captainA,
    });

    const result = await t.run(async (ctx) => ({
      user: await ctx.db.get(captainA),
      challenge: await ctx.db.get(paidChallengeId),
      transactions: await ctx.db.query("walletTransactions")
        .withIndex("by_userId", (q) => q.eq("userId", captainA))
        .take(20),
    }));
    expect(result.user).toMatchObject({ walletBalance: 500, walletHeldBalance: 0 });
    expect(result.challenge).toMatchObject({ status: "rejected", teamAPaymentState: "released" });
    expect(result.transactions.filter((row) => row.type === "hold")).toHaveLength(1);
    expect(result.transactions.filter((row) => row.type === "hold_release")).toHaveLength(1);
  });

  test("team chat syncs membership, tracks unread state, and denies outsiders", async () => {
    const t = convexTest(schema, modulesForTest);
    const { memberId, captainId, outsiderId, teamId } = await t.run(async (ctx) => {
      const captainId = await ctx.db.insert("users", userRecord("chat-captain-auth", "chat_captain"));
      const memberId = await ctx.db.insert("users", userRecord("chat-member-auth", "chat_member"));
      const outsiderId = await ctx.db.insert("users", userRecord("chat-outsider-auth", "chat_outsider"));
      const teamId = await ctx.db.insert("teams", {
        ...teamRecord(captainId, "Chat Team"),
        memberUids: [String(captainId), String(memberId)],
        memberCount: 2,
        maxMembers: 2,
      });
      for (const [id, username, role] of [[captainId, "chat_captain", "captain"], [memberId, "chat_member", "member"]] as const) {
        await ctx.db.insert("teamMembers", {
          teamId,
          odxerId: id,
          username,
          role,
          rosterRole: "main",
          rosterOrder: role === "captain" ? 0 : 1,
          joinedAt: 1,
        });
      }
      return { memberId, captainId, outsiderId, teamId };
    });

    const messageId = await t.withIdentity({ subject: String(captainId) }).mutation(api.teamChat.sendMessage, {
      teamId,
      text: "Ready?",
      clientMessageId: "team-chat-1",
    });
    expect(messageId).toBeTruthy();

    const beforeRead = await t.withIdentity({ subject: String(memberId) }).query(api.teamChat.listForMe, {});
    expect(beforeRead[0]).toMatchObject({ teamId, unreadCount: 1 });

    await t.withIdentity({ subject: String(memberId) }).mutation(api.teamChat.markRead, { teamId });
    const afterRead = await t.withIdentity({ subject: String(memberId) }).query(api.teamChat.listForMe, {});
    expect(afterRead[0]).toMatchObject({ teamId, unreadCount: 0 });

    const outsiderAccess = await t.withIdentity({ subject: String(outsiderId) }).query(api.teamChat.getAccess, { teamId });
    expect(outsiderAccess).toEqual({ status: "forbidden" });
    await expect(
      t.withIdentity({ subject: String(outsiderId) }).mutation(api.teamChat.sendMessage, { teamId, text: "intrusion" }),
    ).rejects.toThrow(/not a member/i);
  });

  test("KYC provider status update is applied to the linked user and leaves an audit trail", async () => {
    const t = convexTest(schema, modulesForTest);
    const { userId, verificationId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", userRecord("kyc-auth", "kyc_user"));
      const verificationId = await ctx.db.insert("identityVerifications", {
        userId,
        type: "kyc",
        role: "player",
        provider: "didit",
        vendorData: "{}",
        workflowId: "workflow-test",
        status: "pending",
        submittedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.patch(userId, { identityVerificationId: String(verificationId), kycVerificationStatus: "pending" });
      return { userId, verificationId };
    });

    await t.mutation(internal.kyc.applyDiditStatusUpdate, {
      verificationId,
      status: "verified",
      decision: "approved",
      checkStatuses: {
        emailVerificationStatus: "approved",
        idVerificationStatus: "approved",
        livenessStatus: "approved",
        faceMatchStatus: "approved",
        amlStatus: "clear",
        ipAnalysisStatus: "clear",
      },
      now: 2_000,
    });

    const result = await t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      verification: await ctx.db.get(verificationId),
      audits: (await ctx.db.query("zoneAuditEvents").take(20)).filter((row) => row.targetId === String(verificationId)),
    }));
    expect(result.user).toMatchObject({ kycVerificationStatus: "verified", kycVerifiedAt: 2_000 });
    expect(result.verification).toMatchObject({ status: "verified", decision: "approved", verifiedAt: 2_000 });
    expect(result.audits.some((row) => row.action === "verified")).toBe(true);
  });
});
