import type { Id } from "./_generated/dataModel";

// The chat screen renders a single flat list and has no cursor UI. Keep each
// source bounded to a recent window so one reactive subscription cannot scan
// an unbounded membership history. The window is intentionally generous for
// ordinary accounts while allowing the client to merge four chat types.
export const CHAT_LIST_LIMIT = 100;
export const MAX_CHATROOM_MEMBER_ROWS = 100;

export function assertChatroomMemberRowsBounded(rows: any[]) {
  if (rows.length > MAX_CHATROOM_MEMBER_ROWS) {
    throw new Error("Chat membership data exceeds the supported safety bound.");
  }
  return rows;
}

type ParticipantProfile = {
  uid: string;
  label: string;
  photoURL: string | null;
};

/**
 * Cache profile reads for the lifetime of one list query. Chatrooms often
 * share participants; deduplicating in-flight reads avoids a nested
 * chatrooms × participants read explosion while retaining the existing
 * participant/avatar payload shape.
 */
export function createParticipantProfileCache(ctx: any) {
  const cache = new Map<string, Promise<any | null>>();

  const get = (value: unknown) => {
    const key = String(value || "");
    if (!key) return Promise.resolve(null);
    const existing = cache.get(key);
    if (existing) return existing;
    const pending = Promise.resolve(ctx.db.get(key as Id<"users">)).catch(() => null);
    cache.set(key, pending);
    return pending;
  };

  return async function loadParticipantProfiles(
    participantUids: unknown[],
    fallbackLabel: string,
  ): Promise<ParticipantProfile[]> {
    const uniqueUids = Array.from(new Set((participantUids || []).map((uid) => String(uid || "")).filter(Boolean)));
    const profiles = await Promise.all(uniqueUids.map(async (uid) => {
      const participant = await get(uid);
      if (!participant) return null;
      return {
        uid: String(participant._id),
        label: participant.username || participant.fullName || fallbackLabel,
        photoURL: participant.photoURL || null,
      } satisfies ParticipantProfile;
    }));
    return profiles.filter((profile): profile is ParticipantProfile => profile !== null);
  };
}
