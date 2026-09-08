import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

const PAGE_SIZE = 25;
const AUTH_PAGE_SIZE = 100;
const TERMINAL_STATUSES = new Set(["blocked", "failed", "completed"]);

class DeletionBlockedError extends Error {}

function blocked(message: string): never {
  throw new DeletionBlockedError(message);
}

async function scheduleNext(ctx: any, jobId: Id<"accountDeletionJobs">) {
  await ctx.scheduler.runAfter(0, (internal as any).accountDeletion.processAccountDeletionJob, { jobId });
}

function isPreflightStage(stage: string) {
  return stage.startsWith("preflight_");
}

async function mirrorJobStatusToUser(ctx: any, job: Doc<"accountDeletionJobs">, input: {
  status: "queued" | "running" | "blocked" | "failed" | "completed";
  stage?: string;
  error?: string;
}) {
  await ctx.db.patch(job.userId, {
    accountDeletionJobId: job._id,
    accountDeletionStatus: input.status,
    accountDeletionStage: input.stage || job.stage,
    accountDeletionError: input.error,
    accountDeletionUpdatedAt: Date.now(),
  });
}

async function restoreUserAfterSafePreflightStop(
  ctx: any,
  job: Doc<"accountDeletionJobs">,
  status: "blocked" | "failed",
  error: string,
) {
  await ctx.db.patch(job.userId, {
    accountStatus: job.priorAccountStatus,
    suspendedAt: job.priorSuspendedAt,
    suspendedUntil: job.priorSuspendedUntil,
    suspensionReason: job.priorSuspensionReason,
    suspendedByAdminUserId: job.priorSuspendedByAdminUserId,
    accountDeletionJobId: job._id,
    accountDeletionStatus: status,
    accountDeletionStage: job.stage,
    accountDeletionError: error,
    accountDeletionUpdatedAt: Date.now(),
  });
}

async function moveTo(ctx: any, job: Doc<"accountDeletionJobs">, stage: string, input?: {
  cursor?: string;
  processedRows?: number;
}) {
  await ctx.db.patch(job._id, {
    status: "running",
    stage,
    cursor: input?.cursor,
    error: undefined,
    processedRows: job.processedRows + Number(input?.processedRows || 0),
    updatedAt: Date.now(),
  });
  await mirrorJobStatusToUser(ctx, job, { status: "running", stage });
  await scheduleNext(ctx, job._id);
}

async function continuePage(ctx: any, job: Doc<"accountDeletionJobs">, page: any, nextStage: string, processedRows = 0) {
  if (page.isDone) {
    await moveTo(ctx, job, nextStage, { processedRows });
    return;
  }
  if (!page.continueCursor || page.continueCursor === job.cursor) {
    throw new Error(`Account deletion made no progress during ${job.stage}.`);
  }
  await moveTo(ctx, job, job.stage, { cursor: page.continueCursor, processedRows });
}

async function deleteMatchingBatch(ctx: any, job: Doc<"accountDeletionJobs">, query: any, nextStage: string) {
  const rows = await query.take(PAGE_SIZE);
  for (const row of rows) await ctx.db.delete(row._id);
  await moveTo(ctx, job, rows.length < PAGE_SIZE ? nextStage : job.stage, { processedRows: rows.length });
}

function assertInactiveRoom(room: any) {
  if (room && ["open", "locked", "in-progress"].includes(String(room.status || ""))) {
    blocked("Account deletion is blocked until active matchrooms are completed or cancelled.");
  }
}

function anonymizeRoom(room: any, userIds: string[], now: number) {
  const aliases = new Set(userIds.map(String).filter(Boolean));
  const anonymizePlayer = (player: any) => aliases.has(String(player?.uid || ""))
    ? { ...player, username: "Deleted User" }
    : player;
  const anonymizeSlot = (slot: any) => {
    const uid = String(slot?.uid || slot?.user?.uid || slot?.reservedForUid || slot?.reservedFor?.uid || "");
    if (!aliases.has(uid)) return slot;
    return {
      ...slot,
      user: slot.user ? { ...slot.user, username: "Deleted User", photoURL: undefined } : slot.user,
      reservedFor: slot.reservedFor && aliases.has(String(slot.reservedFor.uid))
        ? { ...slot.reservedFor, username: "Deleted User", photoURL: undefined }
        : slot.reservedFor,
    };
  };
  return {
    hostName: aliases.has(String(room.hostUid || "")) ? "Deleted User" : room.hostName,
    players: Array.isArray(room.players) ? room.players.map(anonymizePlayer) : room.players,
    slotsA: Array.isArray(room.slotsA) ? room.slotsA.map(anonymizeSlot) : room.slotsA,
    slotsB: Array.isArray(room.slotsB) ? room.slotsB.map(anonymizeSlot) : room.slotsB,
    assignedTeamMembers: Array.isArray(room.assignedTeamMembers)
      ? room.assignedTeamMembers.map(anonymizePlayer)
      : room.assignedTeamMembers,
    walkIn: room.walkIn && typeof room.walkIn === "object"
      ? {
          ...room.walkIn,
          roster: Array.isArray(room.walkIn.roster)
            ? room.walkIn.roster.map(anonymizePlayer)
            : room.walkIn.roster,
        }
      : room.walkIn,
    updatedAt: now,
  };
}

function redactDisplayNames(value: unknown, displayNames: string[]) {
  let output = typeof value === "string" ? value : "";
  for (const name of displayNames) {
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wholeName = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, "giu");
    output = output.replace(wholeName, (_match, prefix) => `${prefix}Deleted User`);
  }
  return output;
}

async function anonymizedReplyTo(ctx: any, message: any, identityAliases: string[]) {
  if (!message?.replyTo?.messageId) return message?.replyTo;
  const repliedMessage = await ctx.db.get(message.replyTo.messageId as any).catch(() => null);
  if (!repliedMessage || !identityAliases.includes(String(repliedMessage.senderUid || ""))) {
    return message.replyTo;
  }
  return { ...message.replyTo, senderName: "Deleted User" };
}

async function deleteAuthBatch(ctx: any, job: Doc<"accountDeletionJobs">, model: string, where: any[], nextStage: string) {
  const result: { count: number; isDone: boolean; continueCursor?: string } =
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model, where },
      // Always restart from the beginning because matching rows are deleted.
      paginationOpts: { cursor: null, numItems: AUTH_PAGE_SIZE },
    });
  if (!result.isDone && result.count <= 0) {
    throw new Error(`Account deletion made no progress while deleting auth ${model} rows.`);
  }
  await moveTo(ctx, job, result.isDone ? nextStage : job.stage, { processedRows: result.count });
}

async function assertNoActiveFinancialOrBookingWork(ctx: any, user: Doc<"users">) {
  const userId = user._id;
  if (Number(user.walletBalance || 0) !== 0 || Number(user.walletHeldBalance || 0) !== 0) {
    blocked("Account deletion is blocked until wallet funds and active holds are fully settled.");
  }
  const pendingWallet = await ctx.db.query("walletTransactions")
    .withIndex("by_userId_and_status", (q: any) => q.eq("userId", userId).eq("status", "pending")).first();
  if (pendingWallet) blocked("Account deletion is blocked while a wallet transaction is pending.");
  for (const status of ["created", "redirected", "token_received", "pending"]) {
    const payment = await ctx.db.query("paymentTransactions")
      .withIndex("by_userId_and_status", (q: any) => q.eq("userId", userId).eq("status", status)).first();
    if (payment) blocked("Account deletion is blocked while a provider payment is pending.");
  }
  for (const status of ["open", "pending_payment"]) {
    const request = await ctx.db.query("bookingRequests")
      .withIndex("by_userId_and_status", (q: any) => q.eq("userId", userId).eq("status", status)).first();
    if (request) blocked("Account deletion is blocked until active booking requests and venue offers are resolved.");
  }
  for (const status of ["pending", "accepted", "venue_proposed", "venue_confirmed", "admin_pending"]) {
    const [asA, asB] = await Promise.all([
      ctx.db.query("teamChallenges").withIndex("by_captainAUid_and_status", (q: any) => q.eq("captainAUid", userId).eq("status", status)).first(),
      ctx.db.query("teamChallenges").withIndex("by_captainBUid_and_status", (q: any) => q.eq("captainBUid", userId).eq("status", status)).first(),
    ]);
    if (asA || asB) blocked("Account deletion is blocked until active team challenges are resolved.");
  }
}

async function cleanChatMembershipAndReactions(ctx: any, job: Doc<"accountDeletionJobs">, input: {
  lookupUserId: string;
  identityAliases: string[];
  nextStage: string;
  now: number;
}) {
  const membership = await ctx.db.query("chatroomMembers")
    .withIndex("by_userId", (q: any) => q.eq("userId", input.lookupUserId)).first();
  if (!membership) return await moveTo(ctx, job, input.nextStage);
  const cursor = job.cursor || null;
  const page = await ctx.db.query("chatMessages")
    .withIndex("by_chatroomId_and_createdAt", (q: any) => q.eq("chatroomId", membership.chatroomId))
    .paginate({ cursor, numItems: PAGE_SIZE });
  for (const message of page.page) {
    const reactions = Array.isArray(message.reactions) ? message.reactions.filter(
      (reaction: any) => !input.identityAliases.includes(String(reaction?.userId || "")),
    ) : message.reactions;
    const replyTo = await anonymizedReplyTo(ctx, message, input.identityAliases);
    const reactionsChanged = Array.isArray(message.reactions) && reactions.length !== message.reactions.length;
    const replyChanged = replyTo?.senderName !== message.replyTo?.senderName;
    if (reactionsChanged || replyChanged) await ctx.db.patch(message._id, { reactions, replyTo });
  }
  if (!page.isDone) {
    if (!page.continueCursor || page.continueCursor === job.cursor) {
      throw new Error("Account deletion made no progress while cleaning chat reactions.");
    }
    return await moveTo(ctx, job, job.stage, {
      cursor: page.continueCursor,
      processedRows: page.page.length,
    });
  }

  const chatroom = await ctx.db.get(membership.chatroomId);
  if (chatroom) {
    const lastReadBy = { ...((chatroom.lastReadBy as Record<string, number>) || {}) };
    for (const alias of input.identityAliases) delete lastReadBy[alias];
    await ctx.db.patch(chatroom._id, {
      participantUids: (chatroom.participantUids || []).filter(
        (uid: string) => !input.identityAliases.includes(String(uid)),
      ),
      lastReadBy,
      lastMessage: input.identityAliases.includes(String(chatroom.lastMessage?.senderUid || ""))
        ? { ...chatroom.lastMessage!, senderName: "Deleted User" }
        : chatroom.lastMessage,
      updatedAt: input.now,
    });
  }
  await ctx.db.delete(membership._id);
  return await moveTo(ctx, job, job.stage, {
    cursor: undefined,
    processedRows: page.page.length + 1,
  });
}

async function runStage(ctx: any, job: Doc<"accountDeletionJobs">, user: Doc<"users">) {
  const userId = user._id;
  const userIdString = String(userId);
  const authId = String(job.authId || "");
  const authSuffix = authId.includes("|") ? authId.split("|").pop() || "" : "";
  const identityAliases = Array.from(new Set([userIdString, authId, authSuffix].filter(Boolean)));
  const authAlias = identityAliases.find((value) => value !== userIdString) || null;
  const cursor = job.cursor || null;
  const now = Date.now();

  if (job.stage === "preflight_basics") {
    await assertNoActiveFinancialOrBookingWork(ctx, user);
    await moveTo(ctx, job, "preflight_accepted_requests");
    return;
  }

  if (job.stage === "preflight_accepted_requests") {
    const page = await ctx.db.query("bookingRequests")
      .withIndex("by_userId_and_status", (q: any) => q.eq("userId", userId).eq("status", "accepted"))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const request of page.page) {
      const pendingOffer = await ctx.db.query("zoneOffers")
        .withIndex("by_requestId_and_status", (q: any) => q.eq("requestId", request._id).eq("status", "pending")).first();
      if (pendingOffer) blocked("Account deletion is blocked until active booking requests and venue offers are resolved.");
      if (request.matchroomId) {
        const room = await ctx.db.get(request.matchroomId);
        if (!room || !["completed", "expired", "cancelled"].includes(String(room.status || ""))) {
          blocked("Account deletion is blocked until the accepted booking's matchroom is completed or cancelled.");
        }
      }
    }
    await continuePage(ctx, job, page, "preflight_member_rooms");
    return;
  }

  if (job.stage === "preflight_member_rooms") {
    const page = await ctx.db.query("matchroomMembers").withIndex("by_uid", (q: any) => q.eq("uid", userIdString))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const membership of page.page) assertInactiveRoom(await ctx.db.get(membership.matchroomId));
    await continuePage(ctx, job, page, authAlias ? "preflight_member_rooms_auth" : "preflight_hosted_rooms");
    return;
  }

  if (job.stage === "preflight_member_rooms_auth") {
    if (!authAlias) return await moveTo(ctx, job, "preflight_hosted_rooms");
    const page = await ctx.db.query("matchroomMembers").withIndex("by_uid", (q: any) => q.eq("uid", authAlias))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const membership of page.page) assertInactiveRoom(await ctx.db.get(membership.matchroomId));
    await continuePage(ctx, job, page, "preflight_hosted_rooms");
    return;
  }

  if (job.stage === "preflight_hosted_rooms") {
    const page = await ctx.db.query("matchrooms").withIndex("by_hostUid", (q: any) => q.eq("hostUid", userIdString))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const room of page.page) assertInactiveRoom(room);
    await continuePage(ctx, job, page, authAlias ? "preflight_hosted_rooms_auth" : "preflight_team_members");
    return;
  }

  if (job.stage === "preflight_hosted_rooms_auth") {
    if (!authAlias) return await moveTo(ctx, job, "preflight_team_members");
    const page = await ctx.db.query("matchrooms").withIndex("by_hostUid", (q: any) => q.eq("hostUid", authAlias))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const room of page.page) assertInactiveRoom(room);
    await continuePage(ctx, job, page, "preflight_team_members");
    return;
  }

  if (job.stage === "preflight_team_members") {
    const page = await ctx.db.query("teamMembers").withIndex("by_userId", (q: any) => q.eq("odxerId", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const membership of page.page) {
      const team = await ctx.db.get(membership.teamId);
      if (team && team.status !== "deleted") blocked("Account deletion is blocked until active team membership is removed or transferred.");
    }
    await continuePage(ctx, job, page, "preflight_captained_teams");
    return;
  }

  if (job.stage === "preflight_captained_teams") {
    const page = await ctx.db.query("teams").withIndex("by_captainUid", (q: any) => q.eq("captainUid", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    if (page.page.some((team: any) => team.status !== "deleted")) blocked("Account deletion is blocked until active team captaincy is transferred.");
    await continuePage(ctx, job, page, "preflight_zones");
    return;
  }

  if (job.stage === "preflight_zones") {
    const page = await ctx.db.query("zones").withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    if (page.page.some((zone: any) => zone.status !== "rejected")) blocked("Account deletion is blocked until venue ownership is transferred or the venue application is rejected.");
    await continuePage(ctx, job, page, "preflight_final");
    return;
  }

  if (job.stage === "preflight_final") {
    await assertNoActiveFinancialOrBookingWork(ctx, user);
    await moveTo(ctx, job, job.authId ? "auth_identifier_verifications" : "storage");
    return;
  }

  if (job.stage === "auth_identifier_verifications") {
    if (!job.verificationIdentifiers.length) return await moveTo(ctx, job, "auth_value_verifications");
    return await deleteAuthBatch(ctx, job, "verification", [
      { field: "identifier", operator: "in", value: job.verificationIdentifiers },
    ], "auth_value_verifications");
  }
  if (job.stage === "auth_value_verifications") {
    return await deleteAuthBatch(ctx, job, "verification", [
      { field: "value", operator: "eq", value: job.authId },
    ], "auth_identity");
  }
  if (job.stage === "auth_identity") {
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "_id", operator: "eq", value: job.authId }],
        update: {
          email: job.anonEmail,
          name: "Deleted User",
          image: null,
          username: `deleted_${job.shortId}`,
          displayUsername: "Deleted User",
          phoneNumber: null,
          phoneNumberVerified: false,
          updatedAt: now,
        },
      },
    });
    await moveTo(ctx, job, "auth_sessions");
    return;
  }
  if (job.stage === "auth_sessions") {
    return await deleteAuthBatch(ctx, job, "session", [
      { field: "userId", operator: "eq", value: job.authId },
    ], "auth_accounts");
  }
  if (job.stage === "auth_accounts") {
    return await deleteAuthBatch(ctx, job, "account", [
      { field: "userId", operator: "eq", value: job.authId },
    ], "storage");
  }

  if (job.stage === "storage") {
    if (user.profileImageStorageId) await ctx.storage.delete(user.profileImageStorageId);
    await moveTo(ctx, job, "convex_identity");
    return;
  }

  if (job.stage === "convex_identity") {
    await ctx.db.patch(userId, {
      fullName: "Deleted User",
      username: `deleted_${job.shortId}`,
      usernameLower: `deleted_${job.shortId}`,
      email: job.anonEmail,
      photoURL: undefined,
      phone: undefined,
      phoneValidated: undefined,
      phoneValidationProvider: undefined,
      phoneValidationCheckedAt: undefined,
      phoneOtpVerified: undefined,
      phoneOtpVerifiedAt: undefined,
      phoneNumberMasked: undefined,
      phoneNumberHash: undefined,
      pendingEmail: undefined,
      pendingPhone: undefined,
      profileImageStorageId: undefined,
      profileImageUpdatedAt: undefined,
      bio: undefined,
      areasPreferred: undefined,
      city: undefined,
      ageRange: undefined,
      playsCs2: undefined,
      cs2Role: undefined,
      playsCs16: undefined,
      cs16Role: undefined,
      playsValorant: undefined,
      valorantRole: undefined,
      valorantAgent: undefined,
      playsFc: undefined,
      fcTeam: undefined,
      fcFormation: undefined,
      selectedFcLeagueId: undefined,
      playsTekken: undefined,
      tekkenFavorites: undefined,
      playsFutsal: undefined,
      playsIndoorCricket: undefined,
      playsPadel: undefined,
      playsPickleball: undefined,
      futsalPosition: undefined,
      futsalPositions: undefined,
      indoorCricketRole: undefined,
      indoorCricketBowlingStyle: undefined,
      indoorCricketBattingStyle: undefined,
      padelRole: undefined,
      pickleballRole: undefined,
      steamProfileUrl: undefined,
      faceitProfileUrl: undefined,
      eaProfileUrl: undefined,
      xboxGamertag: undefined,
      steamId: undefined,
      steamPersonaName: undefined,
      steamCs2Hours: undefined,
      steamFc26Hours: undefined,
      steamTekken8Hours: undefined,
      eaId: undefined,
      faceitId: undefined,
      faceitNickname: undefined,
      faceitElo: undefined,
      faceitSkillLevel: undefined,
      faceitGame: undefined,
      faceitStats: undefined,
      psnAccountId: undefined,
      psnOnlineId: undefined,
      psnStats: undefined,
      steamStats: undefined,
      lastExternalSyncAt: undefined,
      steamLastSyncedAt: undefined,
      faceitLastSyncedAt: undefined,
      psnLastSyncedAt: undefined,
      identityVerificationId: undefined,
      emailVerificationStatus: undefined,
      emailVerifiedAt: undefined,
      cnicMasked: undefined,
      skillScores: undefined,
      teamsByGame: undefined,
      trustScore: undefined,
      role: undefined,
      mustChangePassword: undefined,
      passwordChangedAt: undefined,
      passwordResetRequestedAt: undefined,
      createdBySuperAdmin: undefined,
      isSystemAdminAccount: undefined,
      hiddenFromPublic: true,
      isHiddenFromDiscovery: true,
      lastActiveAt: undefined,
      chatMuted: undefined,
      isOnline: false,
      accountStatus: "suspended",
      suspendedAt: now,
      suspendedUntil: null,
      suspensionReason: "account_deletion_processed",
      updatedAt: now,
    });
    await moveTo(ctx, job, "phone_verifications", { processedRows: 1 });
    return;
  }

  if (job.stage === "phone_verifications") return await deleteMatchingBatch(ctx, job,
    ctx.db.query("phoneVerifications").withIndex("by_userId", (q: any) => q.eq("userId", userId)), "push_devices");
  if (job.stage === "push_devices") {
    const device = await ctx.db.query("pushDevices").withIndex("by_userId", (q: any) => q.eq("userId", userId)).first();
    if (!device) return await moveTo(ctx, job, "typing_status");
    const tickets = await ctx.db.query("pushTickets").withIndex("by_deviceId", (q: any) => q.eq("deviceId", device._id)).take(PAGE_SIZE);
    for (const ticket of tickets) await ctx.db.delete(ticket._id);
    if (tickets.length < PAGE_SIZE) await ctx.db.delete(device._id);
    await moveTo(ctx, job, "push_devices", { processedRows: tickets.length + (tickets.length < PAGE_SIZE ? 1 : 0) });
    return;
  }
  if (job.stage === "typing_status") return await deleteMatchingBatch(ctx, job,
    ctx.db.query("chatTypingStatus").withIndex("by_userId", (q: any) => q.eq("userId", userId)), "friendships_out");
  if (job.stage === "friendships_out") return await deleteMatchingBatch(ctx, job,
    ctx.db.query("friendships").withIndex("by_userId", (q: any) => q.eq("userId", userId)), "friendships_in");
  if (job.stage === "friendships_in") return await deleteMatchingBatch(ctx, job,
    ctx.db.query("friendships").withIndex("by_friendId", (q: any) => q.eq("friendId", userId)), "blocks_out");
  if (job.stage === "blocks_out") return await deleteMatchingBatch(ctx, job,
    ctx.db.query("userBlocks").withIndex("by_userId", (q: any) => q.eq("userId", userId)), "blocks_in");
  if (job.stage === "blocks_in") return await deleteMatchingBatch(ctx, job,
    ctx.db.query("userBlocks").withIndex("by_blockedUserId", (q: any) => q.eq("blockedUserId", userId)), "booking_requests");

  if (job.stage === "booking_requests") {
    const page = await ctx.db.query("bookingRequests").withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const row of page.page) await ctx.db.patch(row._id, { userName: "Deleted User", updatedAt: now });
    await continuePage(ctx, job, page, "booking_intents", page.page.length);
    return;
  }
  if (job.stage === "booking_intents") {
    const page = await ctx.db.query("bookingIntents").withIndex("by_createdByUid", (q: any) => q.eq("createdByUid", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const row of page.page) await ctx.db.patch(row._id, { createdByUsername: "Deleted User" });
    await continuePage(ctx, job, page, "chat_messages", page.page.length);
    return;
  }
  if (job.stage === "chat_messages") {
    const page = await ctx.db.query("chatMessages").withIndex("by_senderUid", (q: any) => q.eq("senderUid", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const row of page.page) await ctx.db.patch(row._id, { senderUsername: "Deleted User" });
    await continuePage(ctx, job, page, authAlias ? "chat_messages_auth" : "team_challenge_authored_messages", page.page.length);
    return;
  }
  if (job.stage === "chat_messages_auth") {
    if (!authAlias) return await moveTo(ctx, job, "team_challenge_authored_messages");
    const page = await ctx.db.query("chatMessages").withIndex("by_senderUid", (q: any) => q.eq("senderUid", authAlias))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const row of page.page) await ctx.db.patch(row._id, { senderUsername: "Deleted User" });
    await continuePage(ctx, job, page, "team_challenge_authored_messages", page.page.length);
    return;
  }
  if (job.stage === "team_challenge_authored_messages") {
    const page = await ctx.db.query("teamChallengeChatMessages")
      .withIndex("by_senderUid", (q: any) => q.eq("senderUid", userIdString))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const row of page.page) {
      await ctx.db.patch(row._id, {
        senderName: "Deleted User",
        reactions: Array.isArray(row.reactions)
          ? row.reactions.filter((reaction: any) => String(reaction?.userId || "") !== userIdString)
          : row.reactions,
      });
    }
    await continuePage(ctx, job, page, authAlias ? "team_challenge_authored_messages_auth" : "member_rooms", page.page.length);
    return;
  }
  if (job.stage === "team_challenge_authored_messages_auth") {
    if (!authAlias) return await moveTo(ctx, job, "member_rooms");
    const page = await ctx.db.query("teamChallengeChatMessages")
      .withIndex("by_senderUid", (q: any) => q.eq("senderUid", authAlias))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const row of page.page) {
      await ctx.db.patch(row._id, {
        senderName: "Deleted User",
        reactions: Array.isArray(row.reactions)
          ? row.reactions.filter((reaction: any) => !identityAliases.includes(String(reaction?.userId || "")))
          : row.reactions,
      });
    }
    await continuePage(ctx, job, page, "member_rooms", page.page.length);
    return;
  }
  if (job.stage === "member_rooms") {
    const page = await ctx.db.query("matchroomMembers").withIndex("by_uid", (q: any) => q.eq("uid", userIdString))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const membership of page.page) {
      const room = await ctx.db.get(membership.matchroomId);
      if (room) await ctx.db.patch(room._id, anonymizeRoom(room, identityAliases, now));
    }
    await continuePage(ctx, job, page, authAlias ? "member_rooms_auth" : "hosted_rooms", page.page.length);
    return;
  }
  if (job.stage === "member_rooms_auth") {
    if (!authAlias) return await moveTo(ctx, job, "hosted_rooms");
    const page = await ctx.db.query("matchroomMembers").withIndex("by_uid", (q: any) => q.eq("uid", authAlias))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const membership of page.page) {
      const room = await ctx.db.get(membership.matchroomId);
      if (room) await ctx.db.patch(room._id, anonymizeRoom(room, identityAliases, now));
    }
    await continuePage(ctx, job, page, "hosted_rooms", page.page.length);
    return;
  }
  if (job.stage === "hosted_rooms") {
    const page = await ctx.db.query("matchrooms").withIndex("by_hostUid", (q: any) => q.eq("hostUid", userIdString))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const room of page.page) await ctx.db.patch(room._id, anonymizeRoom(room, identityAliases, now));
    await continuePage(ctx, job, page, authAlias ? "hosted_rooms_auth" : "chat_memberships", page.page.length);
    return;
  }
  if (job.stage === "hosted_rooms_auth") {
    if (!authAlias) return await moveTo(ctx, job, "chat_memberships");
    const page = await ctx.db.query("matchrooms").withIndex("by_hostUid", (q: any) => q.eq("hostUid", authAlias))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const room of page.page) await ctx.db.patch(room._id, anonymizeRoom(room, identityAliases, now));
    await continuePage(ctx, job, page, "chat_memberships", page.page.length);
    return;
  }
  if (job.stage === "chat_memberships") {
    return await cleanChatMembershipAndReactions(ctx, job, {
      lookupUserId: userIdString,
      identityAliases,
      nextStage: authAlias ? "chat_memberships_auth" : "team_challenge_memberships",
      now,
    });
  }
  if (job.stage === "chat_memberships_auth") {
    if (!authAlias) return await moveTo(ctx, job, "team_challenge_memberships");
    return await cleanChatMembershipAndReactions(ctx, job, {
      lookupUserId: authAlias,
      identityAliases,
      nextStage: "team_challenge_memberships",
      now,
    });
  }
  if (job.stage === "team_challenge_memberships") {
    // Keep the membership until every page of that chat has been scrubbed, so
    // retries always resume the same work item without an unbounded nested scan.
    const membership = await ctx.db.query("teamChallengeChatMembers")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId)).first();
    if (!membership) return await moveTo(ctx, job, "notifications_to");
    const page = await ctx.db.query("teamChallengeChatMessages")
      .withIndex("by_chatId_and_createdAt", (q: any) => q.eq("chatId", membership.chatId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const message of page.page) {
      const reactions = Array.isArray(message.reactions) ? message.reactions.filter(
        (reaction: any) => !identityAliases.includes(String(reaction?.userId || "")),
      ) : message.reactions;
      const replyTo = await anonymizedReplyTo(ctx, message, identityAliases);
      const reactionsChanged = Array.isArray(message.reactions) && reactions.length !== message.reactions.length;
      const replyChanged = replyTo?.senderName !== message.replyTo?.senderName;
      if (reactionsChanged || replyChanged) {
        await ctx.db.patch(message._id, { reactions, replyTo });
      }
    }
    if (!page.isDone) {
      if (!page.continueCursor || page.continueCursor === job.cursor) {
        throw new Error("Account deletion made no progress while cleaning challenge reactions.");
      }
      await moveTo(ctx, job, job.stage, { cursor: page.continueCursor, processedRows: page.page.length });
      return;
    }

    const chat = await ctx.db.query("teamChallengeChats")
      .withIndex("by_chatId", (q: any) => q.eq("chatId", membership.chatId)).unique();
    if (chat) {
      const lastReadBy = { ...((chat.lastReadBy as Record<string, number>) || {}) };
      for (const alias of identityAliases) delete lastReadBy[alias];
      await ctx.db.patch(chat._id, {
        participantUids: (chat.participantUids || []).filter((uid: Id<"users">) => String(uid) !== userIdString),
        lastReadBy,
        lastMessage: identityAliases.includes(String(chat.lastMessage?.senderUid || ""))
          ? { ...chat.lastMessage!, senderName: "Deleted User" }
          : chat.lastMessage,
        updatedAt: now,
      });
    }
    await ctx.db.delete(membership._id);
    await moveTo(ctx, job, job.stage, { cursor: undefined, processedRows: page.page.length + 1 });
    return;
  }
  if (job.stage === "notifications_to") return await deleteMatchingBatch(ctx, job,
    ctx.db.query("notifications").withIndex("by_toUid", (q: any) => q.eq("toUid", userId)), "notifications_from");
  if (job.stage === "notifications_from") {
    const page = await ctx.db.query("notifications").withIndex("by_fromUid", (q: any) => q.eq("fromUid", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const row of page.page) {
      const displayNames = job.displayNames || [];
      const data = row.data && typeof row.data === "object"
        ? { ...row.data, fromUsername: "Deleted User", userName: "Deleted User", senderName: "Deleted User" }
        : row.data;
      await ctx.db.patch(row._id, {
        fromUsername: "Deleted User",
        title: redactDisplayNames(row.title, displayNames),
        body: redactDisplayNames(row.body, displayNames),
        data,
        updatedAt: now,
      });
    }
    await continuePage(ctx, job, page, "team_members", page.page.length);
    return;
  }
  if (job.stage === "team_members") {
    const page = await ctx.db.query("teamMembers").withIndex("by_userId", (q: any) => q.eq("odxerId", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const row of page.page) await ctx.db.patch(row._id, { username: "Deleted User" });
    await continuePage(ctx, job, page, "captain_a_challenges", page.page.length);
    return;
  }
  if (job.stage === "captain_a_challenges") {
    const page = await ctx.db.query("teamChallenges")
      .withIndex("by_captainAUid_and_createdAt", (q: any) => q.eq("captainAUid", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const row of page.page) await ctx.db.patch(row._id, { captainAName: "Deleted User", updatedAt: now });
    await continuePage(ctx, job, page, "captain_b_challenges", page.page.length);
    return;
  }
  if (job.stage === "captain_b_challenges") {
    const page = await ctx.db.query("teamChallenges")
      .withIndex("by_captainBUid_and_createdAt", (q: any) => q.eq("captainBUid", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const row of page.page) await ctx.db.patch(row._id, { captainBName: "Deleted User", updatedAt: now });
    await continuePage(ctx, job, page, "captained_teams", page.page.length);
    return;
  }
  if (job.stage === "captained_teams") {
    const page = await ctx.db.query("teams").withIndex("by_captainUid", (q: any) => q.eq("captainUid", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const row of page.page) await ctx.db.patch(row._id, { captainUsername: "Deleted User", updatedAt: now });
    await continuePage(ctx, job, page, "rejected_zones", page.page.length);
    return;
  }
  if (job.stage === "rejected_zones") {
    const page = await ctx.db.query("zones").withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", userId))
      .paginate({ cursor, numItems: PAGE_SIZE });
    for (const zone of page.page) {
      if (zone.status !== "rejected") continue;
      await ctx.db.patch(zone._id, {
        ownerUsername: "Deleted User",
        ownerFullName: "Deleted User",
        contactEmail: job.anonEmail,
        contactPhone: undefined,
        phone: undefined,
        updatedAt: now,
      });
    }
    await continuePage(ctx, job, page, "finalize", page.page.length);
    return;
  }

  if (job.stage === "finalize") {
    const ticketIds = Array.from(new Set([
      ...(job.ticketIds || []),
      job.ticketId,
    ].filter(Boolean).map(String))) as Id<"supportTickets">[];
    for (const ticketId of ticketIds) {
      const ticket = await ctx.db.get(ticketId);
      if (ticket && ticket.status !== "resolved") {
        await ctx.db.patch(ticketId, {
          status: "resolved",
          assignedAdminId: ticket.assignedAdminId || job.requestedByAdminId,
          resolutionSummary: `Account deletion completed by ${job.requestedByAdminName}. Profile and linked identity fields anonymized; sessions revoked. Financial, KYC, and historical message content retained.`,
          updatedAt: now,
        });
      }
    }
    await ctx.db.insert("superAdminAuditLogs", {
      superAdminUserId: job.requestedByAdminId,
      superAdminName: job.requestedByAdminName,
      superAdminEmail: job.requestedByAdminEmail,
      action: job.ticketId ? "process_account_deletion" : "delete_user_account",
      module: "users",
      targetType: "user",
      targetId: userIdString,
      status: "success",
      metadataSafe: {
        jobId: String(job._id),
        ticketId: job.ticketId ? String(job.ticketId) : null,
        ticketCount: ticketIds.length,
        anonymizedUsername: `deleted_${job.shortId}`,
        processedRows: job.processedRows,
      },
      createdAt: now,
    });
    await ctx.db.patch(job._id, {
      status: "completed",
      stage: "completed",
      cursor: undefined,
      error: undefined,
      completedAt: now,
      updatedAt: now,
      authId: undefined,
      verificationIdentifiers: [],
      displayNames: [],
    });
    await mirrorJobStatusToUser(ctx, job, { status: "completed", stage: "completed" });
    return;
  }

  throw new Error(`Unknown account deletion stage: ${job.stage}`);
}

export const processAccountDeletionJob = internalMutation({
  args: { jobId: v.id("accountDeletionJobs") },
  returns: v.object({ status: v.string(), stage: v.string() }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return { status: "missing", stage: "missing" };
    if (TERMINAL_STATUSES.has(job.status)) return { status: job.status, stage: job.stage };
    const user = await ctx.db.get(job.userId);
    if (!user) {
      await ctx.db.patch(job._id, { status: "failed", error: "Target user no longer exists.", updatedAt: Date.now() });
      return { status: "failed", stage: job.stage };
    }

    await ctx.db.patch(job._id, { status: "running", attempts: job.attempts + 1, updatedAt: Date.now() });
    await mirrorJobStatusToUser(ctx, job, { status: "running" });
    try {
      await runStage(ctx, job, user);
      return { status: "running", stage: job.stage };
    } catch (error: any) {
      const status = error instanceof DeletionBlockedError ? "blocked" : "failed";
      const message = String(error?.message || error || "Account deletion failed.").slice(0, 1000);
      await ctx.db.patch(job._id, {
        status,
        error: message,
        updatedAt: Date.now(),
      });
      if (isPreflightStage(job.stage)) {
        await restoreUserAfterSafePreflightStop(ctx, job, status, message);
      } else {
        await mirrorJobStatusToUser(ctx, job, { status, error: message });
      }
      return { status, stage: job.stage };
    }
  },
});
