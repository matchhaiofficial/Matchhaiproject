type MatchroomParticipant = {
  uid?: unknown;
} | null | undefined;

type MatchroomParticipantSource = {
  accessLevel?: unknown;
  players?: MatchroomParticipant[] | null;
} | null | undefined;

export function normalizeMatchroomParticipantIds(
  values: readonly unknown[] | null | undefined,
): string[] {
  const uniqueIds = new Set<string>();

  for (const value of values || []) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (normalized) {
      uniqueIds.add(normalized);
    }
  }

  return Array.from(uniqueIds);
}

export function getMatchroomSkillLookupUserIds(
  room: MatchroomParticipantSource,
): string[] {
  if (!room || room.accessLevel === "public") {
    return [];
  }

  return normalizeMatchroomParticipantIds(
    room.players?.map((player) => player?.uid) || [],
  );
}
