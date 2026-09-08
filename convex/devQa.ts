import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  assertSelectedResourcesAvailableForSlot,
  findActiveBranchAssignment,
  reconcileResourceLegacyAssignment,
} from "./bookingConflicts";
import { interruptAccountDeletionForIncomingFunds } from "./wallet";
import { releaseHeldResourcesForBroadcastRequest } from "./matchroomBroadcast";

function requireDevQaEnabled() {
  if (String(process.env.DEMO_SEED_ENABLED || "").trim() !== "true") {
    throw new Error("Development QA is disabled.");
  }
}

export const verifyResourceSlotReuse = internalMutation({
  args: { zoneId: v.id("zones"), branchId: v.string() },
  handler: async (ctx, args) => {
    requireDevQaEnabled();
    const resource = await ctx.db.query("zoneResources")
      .withIndex("by_zoneId_and_branchId", (q) =>
        q.eq("zoneId", args.zoneId).eq("branchId", args.branchId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!resource || resource.lifecycleStatus === "maintenance") {
      throw new Error("No active resource is available for the QA probe.");
    }

    const original = {
      lifecycleStatus: resource.lifecycleStatus,
      bookingRequestId: resource.bookingRequestId,
      matchroomId: resource.matchroomId,
      bookedAt: resource.bookedAt,
      bookedByUid: resource.bookedByUid,
      updatedAt: resource.updatedAt,
    };
    const now = Date.now();
    const startA = now + 14 * 24 * 60 * 60 * 1000;
    const startB = startA + 2 * 60 * 60 * 1000;
    const baseRoom = {
      hostUid: "dev_qa_host",
      hostName: "Development QA",
      game: "fc26",
      title: "Temporary resource QA",
      status: "open" as const,
      maxPlayers: 2,
      currentPlayers: 0,
      players: [],
      playerUids: [],
      locationMode: "zone" as const,
      zoneId: String(args.zoneId),
      branchId: args.branchId,
      resourceIds: [resource._id],
      durationMinutes: 60,
      pricing: { perPlayer: 0, currency: "PKR" },
      slotsA: [],
      slotsB: [],
      bookingSource: "dev_qa",
      createdAt: now,
      updatedAt: now,
    };
    const firstRoomId = await ctx.db.insert("matchrooms", {
      ...baseRoom,
      scheduledStartAt: startA,
    } as any);
    await ctx.db.patch(resource._id, {
      lifecycleStatus: "booked",
      matchroomId: firstRoomId,
      updatedAt: now,
    });

    let sameSlotRejected = false;
    try {
      await assertSelectedResourcesAvailableForSlot(ctx, {
        zoneId: String(args.zoneId),
        branchId: args.branchId,
        resourceIds: [resource._id],
        scheduledStartAt: startA + 15 * 60 * 1000,
        durationMinutes: 60,
      });
    } catch {
      sameSlotRejected = true;
    }
    await assertSelectedResourcesAvailableForSlot(ctx, {
      zoneId: String(args.zoneId),
      branchId: args.branchId,
      resourceIds: [resource._id],
      scheduledStartAt: startB,
      durationMinutes: 60,
    });

    const secondRoomId = await ctx.db.insert("matchrooms", {
      ...baseRoom,
      scheduledStartAt: startB,
    } as any);
    const reassigned = await reconcileResourceLegacyAssignment(ctx, {
      resourceId: resource._id,
      excludeMatchroomId: String(firstRoomId),
      now,
    });
    const pointerReconciled = String(reassigned?.matchroomId || "") === String(secondRoomId);

    await ctx.db.delete(firstRoomId);
    await ctx.db.delete(secondRoomId);
    await ctx.db.patch(resource._id, original);
    if (!sameSlotRejected || !pointerReconciled) {
      throw new Error("Resource slot reuse QA failed.");
    }
    return { sameSlotRejected, nonOverlapAccepted: true, pointerReconciled };
  },
});

export const verifyDeletionCreditInterruption = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireDevQaEnabled();
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email: `dev_qa_delete_${now}@matchhai.invalid`,
      fullName: "Development QA",
      username: `dev_qa_${now}`,
      usernameLower: `dev_qa_${now}`,
      accountType: "player",
      accountStatus: "suspended",
      isOnline: false,
      walletBalance: 0,
      createdAt: now,
      updatedAt: now,
    });
    const jobId = await ctx.db.insert("accountDeletionJobs", {
      userId,
      requestedByAdminName: "Development QA",
      requestedByAdminEmail: "dev-qa@matchhai.invalid",
      status: "running",
      stage: "convex_identity",
      verificationIdentifiers: [],
      shortId: String(userId).slice(-8),
      anonEmail: `deleted_${String(userId).slice(-8)}@deleted.matchhai.internal`,
      processedRows: 0,
      attempts: 1,
      createdAt: now,
      updatedAt: now,
      priorAccountStatus: "active",
    });
    await ctx.db.patch(userId, {
      accountDeletionJobId: jobId,
      accountDeletionStatus: "running",
      accountDeletionStage: "convex_identity",
    });
    try {
      const user = await ctx.db.get(userId);
      if (!user) throw new Error("QA user disappeared.");
      const runningPatch = await interruptAccountDeletionForIncomingFunds(
        ctx,
        user,
        "a development QA credit arrived",
      );
      await ctx.db.patch(userId, { walletBalance: 100, ...runningPatch, updatedAt: now });
      const [updatedUser, updatedJob] = await Promise.all([ctx.db.get(userId), ctx.db.get(jobId)]);

      await ctx.db.patch(jobId, {
        status: "completed",
        stage: "completed",
        error: undefined,
        completedAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(userId, {
        accountDeletionStatus: "completed",
        accountDeletionStage: "completed",
        accountDeletionError: undefined,
        updatedAt: now,
      });
      const completedUser = await ctx.db.get(userId);
      if (!completedUser) throw new Error("Completed QA user disappeared.");
      const completedPatch = await interruptAccountDeletionForIncomingFunds(
        ctx,
        completedUser,
        "a late development QA credit arrived",
      );
      await ctx.db.patch(userId, { walletBalance: 200, ...completedPatch, updatedAt: now });
      const [lateCreditUser, lateCreditJob] = await Promise.all([ctx.db.get(userId), ctx.db.get(jobId)]);

      const result = {
        fundsPreserved: Number(updatedUser?.walletBalance || 0) === 100,
        destructiveJobFailed: updatedJob?.status === "failed",
        accessStayedSuspended: updatedUser?.accountStatus === "suspended",
        completedDeletionReopened: lateCreditJob?.status === "blocked"
          && lateCreditJob.stage === "preflight_final",
        lateFundsPreserved: Number(lateCreditUser?.walletBalance || 0) === 200,
        completedAccountStayedSuspended: lateCreditUser?.accountStatus === "suspended",
      };
      if (!Object.values(result).every(Boolean)) {
        throw new Error("Deletion credit interruption QA failed.");
      }
      return result;
    } finally {
      const remainingJob = await ctx.db.get(jobId);
      if (remainingJob) await ctx.db.delete(jobId);
      const remainingUser = await ctx.db.get(userId);
      if (remainingUser) await ctx.db.delete(userId);
    }
  },
});

export const verifyBroadcastReleaseAndBranchGuard = internalMutation({
  args: { zoneId: v.id("zones"), branchId: v.string() },
  handler: async (ctx, args) => {
    requireDevQaEnabled();
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new Error("QA zone not found.");
    const resource = await ctx.db.query("zoneResources")
      .withIndex("by_zoneId_and_branchId", (q) =>
        q.eq("zoneId", args.zoneId).eq("branchId", args.branchId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!resource || resource.lifecycleStatus === "maintenance") {
      throw new Error("No active resource is available for the QA probe.");
    }

    const original = {
      lifecycleStatus: resource.lifecycleStatus,
      bookingRequestId: resource.bookingRequestId,
      matchroomId: resource.matchroomId,
      bookedAt: resource.bookedAt,
      bookedByUid: resource.bookedByUid,
      updatedAt: resource.updatedAt,
    };
    const now = Date.now();
    let userId: any;
    let walkInId: any;
    let canonicalRoomId: any;
    let requestId: any;
    try {
      userId = await ctx.db.insert("users", {
        email: `dev_qa_broadcast_${now}@matchhai.invalid`,
        fullName: "Development QA Broadcast",
        username: `dev_qa_broadcast_${now}`,
        usernameLower: `dev_qa_broadcast_${now}`,
        accountType: "player",
        accountStatus: "active",
        isOnline: false,
        createdAt: now,
        updatedAt: now,
      });
      const baseRoom = {
        hostUid: String(userId),
        hostName: "Development QA",
        game: "fc26",
        title: "Temporary broadcast QA",
        status: "open" as const,
        maxPlayers: 2,
        currentPlayers: 0,
        players: [],
        playerUids: [],
        locationMode: "zone" as const,
        zoneId: String(args.zoneId),
        branchId: args.branchId,
        scheduledStartAt: now + 14 * 24 * 60 * 60 * 1000,
        durationMinutes: 60,
        pricing: { perPlayer: 0, currency: "PKR" },
        slotsA: [],
        slotsB: [],
        createdAt: now,
        updatedAt: now,
      };
      walkInId = await ctx.db.insert("matchrooms", {
        ...baseRoom,
        bookingSource: "walkin",
      });
      const branchAssignment = await findActiveBranchAssignment(ctx, {
        zoneId: String(args.zoneId),
        branchId: args.branchId,
        primaryBranchId: String((zone.branches || [])[0]?.id || ""),
      });

      canonicalRoomId = await ctx.db.insert("matchrooms", {
        ...baseRoom,
        title: "Temporary canonical allocation QA",
        resourceIds: [resource._id],
        scheduledStartAt: baseRoom.scheduledStartAt + 2 * 60 * 60 * 1000,
      });
      requestId = await ctx.db.insert("bookingRequests", {
        userId,
        gameKey: "fc26",
        zoneId: args.zoneId,
        requestKind: "broadcast_fanout",
        status: "cancelled",
        playerCount: 2,
        allocatedBranchId: args.branchId,
        allocatedResourceIds: [resource._id],
        scheduledStartAt: baseRoom.scheduledStartAt + 4 * 60 * 60 * 1000,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(resource._id, {
        lifecycleStatus: "held",
        bookingRequestId: requestId,
        matchroomId: undefined,
        updatedAt: now,
      });
      const request = await ctx.db.get(requestId);
      await releaseHeldResourcesForBroadcastRequest(ctx, request, now);
      const reconciled = await ctx.db.get(resource._id);

      const terminalBranchId = `dev_qa_terminal_${now}`;
      await ctx.db.patch(canonicalRoomId, {
        status: "completed",
        branchId: terminalBranchId,
        updatedAt: now,
      });
      await ctx.db.patch(requestId, {
        status: "accepted",
        matchroomId: canonicalRoomId,
        allocatedBranchId: terminalBranchId,
        updatedAt: now,
      });
      const terminalAssignment = await findActiveBranchAssignment(ctx, {
        zoneId: String(args.zoneId),
        branchId: terminalBranchId,
        primaryBranchId: String((zone.branches || [])[0]?.id || ""),
      });

      const result = {
        capacityOnlyWalkInBlocksBranchDeletion: branchAssignment?.kind === "matchroom"
          && String(branchAssignment.id) === String(walkInId),
        broadcastReleaseReconciled: reconciled?.lifecycleStatus === "booked"
          && String(reconciled.matchroomId || "") === String(canonicalRoomId),
        terminalLinkedRequestIgnored: terminalAssignment === null,
      };
      if (!Object.values(result).every(Boolean)) {
        throw new Error("Broadcast release/branch guard QA failed.");
      }
      return result;
    } finally {
      if (requestId && await ctx.db.get(requestId)) await ctx.db.delete(requestId);
      if (canonicalRoomId && await ctx.db.get(canonicalRoomId)) await ctx.db.delete(canonicalRoomId);
      if (walkInId && await ctx.db.get(walkInId)) await ctx.db.delete(walkInId);
      await ctx.db.patch(resource._id, original);
      if (userId && await ctx.db.get(userId)) await ctx.db.delete(userId);
    }
  },
});

export const startDeletionWorkflowProbe = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireDevQaEnabled();
    const now = Date.now();
    const qaUsername = `dev_qa_workflow_${now}`;
    const userId = await ctx.db.insert("users", {
      email: `dev_qa_workflow_${now}@matchhai.invalid`,
      fullName: "Development QA Workflow",
      username: qaUsername,
      usernameLower: qaUsername,
      accountType: "player",
      accountStatus: "suspended",
      isOnline: false,
      walletBalance: 0,
      walletHeldBalance: 0,
      createdAt: now,
      updatedAt: now,
    });
    const peerId = await ctx.db.insert("users", {
      email: `dev_qa_peer_${now}@matchhai.invalid`,
      fullName: "Development QA Peer",
      username: `dev_qa_peer_${now}`,
      usernameLower: `dev_qa_peer_${now}`,
      accountType: "player",
      accountStatus: "active",
      isOnline: false,
      createdAt: now,
      updatedAt: now,
    });
    const notificationId = await ctx.db.insert("notifications", {
      toUid: peerId,
      fromUid: userId,
      fromUsername: qaUsername,
      type: "dev_qa.account_deletion",
      status: "pending",
      title: "development qa workflow invited you",
      body: `A valid invitation from ${qaUsername.toUpperCase()}.`,
      createdAt: now,
      updatedAt: now,
    });
    const chatroomId = await ctx.db.insert("chatrooms", {
      type: "dm",
      dmPairKey: [String(userId), String(peerId)].sort().join("_"),
      participantUids: [String(userId), String(peerId)],
      lastReadBy: { [String(userId)]: now },
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("chatroomMembers", {
      chatroomId,
      userId: String(userId),
      joinedAt: now,
      updatedAt: now,
    });
    const authoredChatMessageId = await ctx.db.insert("chatMessages", {
      chatroomId,
      senderUid: userId,
      senderUsername: "Development QA Workflow",
      content: "Temporary authored QA message",
      createdAt: now,
    });
    const chatMessageId = await ctx.db.insert("chatMessages", {
      chatroomId,
      senderUid: peerId,
      senderUsername: "Development QA Peer",
      content: "Temporary QA message",
      reactions: [{ emoji: "👍", userId, createdAt: now }],
      replyTo: {
        messageId: String(authoredChatMessageId),
        senderName: "Development QA Workflow",
        text: "Temporary authored QA message",
      },
      createdAt: now,
    });
    const teamChatId = `dev_qa_team_chat_${now}`;
    const teamChatDocId = await ctx.db.insert("teamChallengeChats", {
      chatId: teamChatId,
      participantUids: [userId, peerId],
      lastReadBy: { [String(userId)]: now },
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("teamChallengeChatMembers", {
      chatId: teamChatId,
      userId,
      joinedAt: now,
      updatedAt: now,
    });
    const authoredTeamChatMessageId = await ctx.db.insert("teamChallengeChatMessages", {
      chatId: teamChatId,
      senderUid: String(userId),
      senderName: "Development QA Workflow",
      text: "Temporary authored QA message",
      createdAt: now,
    });
    const teamChatMessageId = await ctx.db.insert("teamChallengeChatMessages", {
      chatId: teamChatId,
      senderUid: String(peerId),
      senderName: "Development QA Peer",
      text: "Temporary QA message",
      reactions: [{ emoji: "👍", userId, createdAt: now }],
      replyTo: {
        messageId: String(authoredTeamChatMessageId),
        senderName: "Development QA Workflow",
        text: "Temporary authored QA message",
      },
      createdAt: now,
    });
    const teamAId = await ctx.db.insert("teams", {
      name: `Deleted QA A ${now}`,
      nameLower: `deleted qa a ${now}`,
      game: "fc26",
      captainUid: userId,
      captainUsername: "Development QA Workflow",
      memberUids: [String(userId)],
      memberCount: 1,
      maxMembers: 2,
      status: "deleted",
      createdAt: now,
      updatedAt: now,
    });
    const teamBId = await ctx.db.insert("teams", {
      name: `Deleted QA B ${now}`,
      nameLower: `deleted qa b ${now}`,
      game: "fc26",
      captainUid: peerId,
      captainUsername: "Development QA Peer",
      memberUids: [String(peerId)],
      memberCount: 1,
      maxMembers: 2,
      status: "deleted",
      createdAt: now,
      updatedAt: now,
    });
    const challengeId = await ctx.db.insert("teamChallenges", {
      challengerTeamId: teamAId,
      challengerTeamName: `Deleted QA A ${now}`,
      opponentTeamId: teamBId,
      opponentTeamName: `Deleted QA B ${now}`,
      game: "fc26",
      status: "completed",
      captainAUid: userId,
      captainAName: "Development QA Workflow",
      captainBUid: peerId,
      captainBName: "Development QA Peer",
      createdAt: now,
      updatedAt: now,
    });
    const shortId = String(userId).slice(-8);
    const jobId = await ctx.db.insert("accountDeletionJobs", {
      userId,
      requestedByAdminName: "Development QA",
      requestedByAdminEmail: "dev-qa@matchhai.invalid",
      status: "queued",
      stage: "preflight_basics",
      verificationIdentifiers: [],
      displayNames: ["Development QA Workflow", qaUsername],
      shortId,
      anonEmail: `deleted_${shortId}@deleted.matchhai.internal`,
      processedRows: 0,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      priorAccountStatus: "active",
    });
    await ctx.db.patch(userId, {
      accountDeletionJobId: jobId,
      accountDeletionStatus: "queued",
      accountDeletionStage: "preflight_basics",
    });
    await ctx.scheduler.runAfter(0, (internal as any).accountDeletion.processAccountDeletionJob, { jobId });
    return {
      userId,
      jobId,
      peerId,
      chatroomId,
      chatMessageId,
      authoredChatMessageId,
      teamChatDocId,
      teamChatMessageId,
      authoredTeamChatMessageId,
      teamAId,
      teamBId,
      challengeId,
      notificationId,
    };
  },
});

export const inspectAndCleanupDeletionWorkflowProbe = internalMutation({
  args: {
    userId: v.id("users"),
    jobId: v.id("accountDeletionJobs"),
    peerId: v.id("users"),
    chatroomId: v.id("chatrooms"),
    chatMessageId: v.id("chatMessages"),
    authoredChatMessageId: v.id("chatMessages"),
    teamChatDocId: v.id("teamChallengeChats"),
    teamChatMessageId: v.id("teamChallengeChatMessages"),
    authoredTeamChatMessageId: v.id("teamChallengeChatMessages"),
    teamAId: v.id("teams"),
    teamBId: v.id("teams"),
    challengeId: v.id("teamChallenges"),
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    requireDevQaEnabled();
    const [user, job, chatMessage, teamChatMessage, challenge, notification] = await Promise.all([
      ctx.db.get(args.userId),
      ctx.db.get(args.jobId),
      ctx.db.get(args.chatMessageId),
      ctx.db.get(args.teamChatMessageId),
      ctx.db.get(args.challengeId),
      ctx.db.get(args.notificationId),
    ]);
    const result = {
      status: job?.status || "missing",
      stage: job?.stage || "missing",
      profileAnonymized: user?.fullName === "Deleted User"
        && String(user.email || "").endsWith("@deleted.matchhai.internal"),
      accessSuspended: user?.accountStatus === "suspended"
        && user?.suspensionReason === "account_deletion_processed",
      identifiersCleared: !job?.authId && (job?.verificationIdentifiers || []).length === 0,
      transientNamesCleared: (job?.displayNames || []).length === 0,
      chatReactionsCleared: (chatMessage?.reactions || []).length === 0,
      teamChatReactionsCleared: (teamChatMessage?.reactions || []).length === 0,
      chatReplyAnonymized: chatMessage?.replyTo?.senderName === "Deleted User",
      teamChatReplyAnonymized: teamChatMessage?.replyTo?.senderName === "Deleted User",
      challengeCaptainAnonymized: challenge?.captainAName === "Deleted User",
      notificationCopyAnonymized: notification?.title === "Deleted User invited you"
        && String(notification?.body || "").startsWith("A valid invitation from Deleted User"),
    };
    if (job?.status !== "completed") return { ...result, cleanedUp: false };
    const logs = await ctx.db.query("superAdminAuditLogs")
      .withIndex("by_targetType_targetId", (q) =>
        q.eq("targetType", "user").eq("targetId", String(args.userId)),
      )
      .collect();
    for (const log of logs) await ctx.db.delete(log._id);
    if (chatMessage) await ctx.db.delete(args.chatMessageId);
    if (await ctx.db.get(args.authoredChatMessageId)) await ctx.db.delete(args.authoredChatMessageId);
    if (teamChatMessage) await ctx.db.delete(args.teamChatMessageId);
    if (await ctx.db.get(args.authoredTeamChatMessageId)) await ctx.db.delete(args.authoredTeamChatMessageId);
    if (challenge) await ctx.db.delete(args.challengeId);
    if (notification) await ctx.db.delete(args.notificationId);
    if (await ctx.db.get(args.teamAId)) await ctx.db.delete(args.teamAId);
    if (await ctx.db.get(args.teamBId)) await ctx.db.delete(args.teamBId);
    if (await ctx.db.get(args.chatroomId)) await ctx.db.delete(args.chatroomId);
    if (await ctx.db.get(args.teamChatDocId)) await ctx.db.delete(args.teamChatDocId);
    await ctx.db.delete(args.jobId);
    if (user) await ctx.db.delete(args.userId);
    if (await ctx.db.get(args.peerId)) await ctx.db.delete(args.peerId);
    return { ...result, cleanedUp: true };
  },
});
