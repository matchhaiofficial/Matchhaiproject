import { query } from "./_generated/server";
import { v } from "convex/values";

function normalizeGameKey(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  switch (normalized) {
    case "cs2":
      return "cs2";
    case "cs16":
    case "cs1.6":
    case "counterstrike1.6":
      return "cs16";
    case "valorant":
      return "valorant";
    case "fc25":
      return "fc25";
    case "fc26":
      return "fc26";
    case "tekken8":
    case "tekken":
      return "tekken8";
    // Physical sports are temporarily disabled.
    // case "futsal":
    //   return "futsal";
    // case "cricket":
    // case "indoorcricket":
    // case "indoor_cricket":
    //   return "indoor_cricket";
    // case "padel":
    //   return "padel";
    // case "pickleball":
    //   return "pickleball";
    default:
      return normalized || null;
  }
}

function getPreferredGameKeysFromProfile(profile: any) {
  if (!profile) return [];
  const games: string[] = [];
  if (profile.playsCs2) games.push("cs2");
  if (profile.playsCs16) games.push("cs16");
  if (profile.playsValorant) games.push("valorant");
  if (profile.playsFc) games.push("fc26");
  if (profile.playsTekken) games.push("tekken8");
  // Physical sports are temporarily disabled.
  // if (profile.playsFutsal) games.push("futsal");
  // if (profile.playsIndoorCricket) games.push("indoor_cricket");
  // if (profile.playsPadel) games.push("padel");
  // if (profile.playsPickleball) games.push("pickleball");
  return games;
}

function getGameTagsFromProfile(profile: any) {
  if (!profile) return [];
  const tags: string[] = [];
  if (profile.playsCs2) tags.push("CS2");
  if (profile.playsCs16) tags.push("CS 1.6");
  if (profile.playsValorant) tags.push("Valorant");
  if (profile.playsFc) tags.push("FC26");
  if (profile.playsTekken) tags.push("Tekken 8");
  // Physical sports are temporarily disabled.
  // if (profile.playsFutsal) tags.push("Futsal");
  // if (profile.playsIndoorCricket) tags.push("Cricket");
  // if (profile.playsPadel) tags.push("Padel");
  // if (profile.playsPickleball) tags.push("Pickleball");
  return tags;
}

function getRoomStartAt(room: any) {
  if (typeof room?.scheduledStartAt === "number") return room.scheduledStartAt;
  const date = String(room?.scheduledDate || "").trim();
  const time = String(room?.scheduledTime || "").trim();
  if (!date) return null;
  const parsed = new Date(`${date}T${time || "00:00"}`);
  const timeMs = parsed.getTime();
  return Number.isNaN(timeMs) ? null : timeMs;
}

function isRoomExpired(room: any) {
  if (["expired", "completed", "cancelled"].includes(String(room?.status || ""))) {
    return true;
  }
  return typeof room?.expiresAt === "number" && room.expiresAt <= Date.now();
}

function isRoomLocked(room: any) {
  return room?.status === "locked" || room?.isLocked === true;
}

function dedupeById<T extends { _id: any }>(rows: T[]) {
  const byId = new Map<string, T>();
  for (const row of rows) {
    byId.set(String(row._id), row);
  }
  return Array.from(byId.values());
}

function countJoinedFriends(room: any, friendIds: Set<string>) {
  if (!Array.isArray(room?.playerUids) || friendIds.size === 0) return 0;
  let total = 0;
  for (const uid of room.playerUids) {
    if (friendIds.has(String(uid))) total += 1;
  }
  return total;
}

export const getPlayerHomeSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const HOME_RECENT_ROOM_LIMIT = 100;
    const HOME_HOSTED_ROOM_LIMIT = 60;
    const HOME_TEAM_MEMBERSHIP_LIMIT = 10;
    const now = Date.now();

    const [friendships, bookingIntents, myRequests, zones, memberships, hostedRooms, recentRooms] = await Promise.all([
      ctx.db.query("friendships").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("bookingIntents").withIndex("by_createdByUid", (q) => q.eq("createdByUid", args.userId)).collect(),
      ctx.db.query("bookingRequests").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("zones").withIndex("by_status", (q) => q.eq("status", "active")).take(3),
      ctx.db.query("teamMembers").withIndex("by_userId", (q) => q.eq("odxerId", args.userId)).take(HOME_TEAM_MEMBERSHIP_LIMIT),
      ctx.db.query("matchrooms").withIndex("by_hostUid", (q) => q.eq("hostUid", String(args.userId))).order("desc").take(HOME_HOSTED_ROOM_LIMIT),
      ctx.db.query("matchrooms").withIndex("by_createdAt").order("desc").take(HOME_RECENT_ROOM_LIMIT),
    ]);

    const uniqueFriendIds = Array.from(
      new Map(friendships.map((friendship) => [String(friendship.friendId), friendship.friendId])).values()
    );
    const friendIdSet = new Set(uniqueFriendIds.map((id) => String(id)));
    const friendDocs = await Promise.all(
      uniqueFriendIds.map((friendId) => ctx.db.get(friendId))
    );
    const presenceNow = Date.now();
    const PRESENCE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
    const friendOnlineCount = friendDocs.filter(
      (friend) => friend?.lastActiveAt && (presenceNow - friend.lastActiveAt) < PRESENCE_TIMEOUT_MS
    ).length;

    const walletStats = bookingIntents.reduce(
      (acc, intent: any) => {
        const total = Number(intent?.pricing?.totalCost || intent?.pricing?.total || 0);
        if (total <= 0) return acc;
        if (intent.paymentStatus === "paid") acc.totalSpent += total;
        else acc.pendingAmount += total;
        acc.transactions += 1;
        return acc;
      },
      { totalSpent: 0, pendingAmount: 0, transactions: 0 }
    );

    const myRoomDocs = dedupeById(
      [
        ...hostedRooms,
        ...recentRooms.filter(
          (room: any) =>
            Array.isArray(room?.playerUids) &&
            room.playerUids.includes(String(args.userId))
        ),
      ].filter((room: any) => !isRoomExpired(room))
    );

    const myRoomIds = new Set(myRoomDocs.map((room) => String(room._id)));
    const upcomingRooms = myRoomDocs
      .filter((room: any) => {
        const startAt = getRoomStartAt(room);
        return startAt != null && startAt >= now - 15 * 60 * 1000 && room.status !== "completed";
      })
      .sort((a: any, b: any) => (getRoomStartAt(a) || 0) - (getRoomStartAt(b) || 0))
      .slice(0, 3)
      .map((room: any) => ({
        ...room,
        id: room._id,
        friendJoinedCount: countJoinedFriends(room, friendIdSet),
      }));

    const preferredGames = getPreferredGameKeysFromProfile(user);
    const recommendedRooms = recentRooms
      .filter((room: any) => !isRoomExpired(room) && !isRoomLocked(room))
      .filter((room: any) => {
        const roomId = String(room._id);
        if (myRoomIds.has(roomId)) return false;
        if (String(room.hostUid) === String(args.userId)) return false;
        if (Array.isArray(room.playerUids) && room.playerUids.includes(String(args.userId))) return false;
        if (!preferredGames.length) return true;
        const gameKey = normalizeGameKey(room.game);
        return !!gameKey && preferredGames.includes(gameKey);
      })
      .slice(0, 4)
      .map((room: any) => ({
        ...room,
        id: room._id,
        friendJoinedCount: countJoinedFriends(room, friendIdSet),
      }));

    const teamDocs = await Promise.all(memberships.slice(0, 10).map((membership) => ctx.db.get(membership.teamId)));
    const myTeams = teamDocs
      .filter(Boolean)
      .slice(0, 3)
      .map((team: any) => ({ ...team, id: team._id }));

    const offersByRequest = await Promise.all(
      myRequests.map((request) =>
        ctx.db
          .query("zoneOffers")
          .withIndex("by_requestId", (q) => q.eq("requestId", request._id))
          .collect()
      )
    );
    const offerCount = offersByRequest.reduce((total, offers) => total + offers.length, 0);

    return {
      tags: getGameTagsFromProfile(user),
      upcomingRooms,
      recommendedRooms,
      myTeams,
      nearbyZones: zones.map((zone: any) => ({ ...zone, id: zone._id })),
      requestStats: {
        myRequests: myRequests.length,
        myOffers: offerCount,
      },
      friendCount: friendOnlineCount,
      walletStats: {
        totalSpent: Math.round(walletStats.totalSpent),
        pendingAmount: Math.round(walletStats.pendingAmount),
        transactions: walletStats.transactions,
      },
    };
  },
});
