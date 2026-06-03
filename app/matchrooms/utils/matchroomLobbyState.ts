import { Matchroom } from "../../../src/services/convex/matchService";
import { SkillTier } from "../../../src/services/skillRatingService";

const WALKIN_SKILL_TIERS: SkillTier[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Pro",
  "Elite",
];

export const normalizeWalkInSkillTier = (value: unknown): SkillTier | null => {
  if (typeof value !== "string") return null;
  const match = WALKIN_SKILL_TIERS.find((tier) => tier === value);
  return match || null;
};

export const getSlotUserId = (slot: any) =>
  slot?.user?._id || slot?.user?.uid || slot?.uid || null;

type LobbySlot = {
  slotId: string;
  status: "open" | "confirmed" | "reserved";
  role: string;
  uid?: string;
  user?: { uid: string; username: string; skillTier?: SkillTier; _id?: string };
};

function buildWalkInSlots(room: Matchroom) {
  let totalSeats = Math.max(1, Number(room?.maxPlayers || 0));
  if (room?.game === "cs2" && totalSeats === 5) {
    totalSeats = 10;
  }

  const bookedSeats = Math.min(
    totalSeats,
    Math.max(
      Number((room as any)?.currentPlayers || 0),
      (room?.players || []).length,
    ),
  );
  const knownPlayers = (room?.players || []).slice(0, totalSeats);
  const walkInRosterRaw = Array.isArray((room as any)?.walkIn?.roster)
    ? (room as any).walkIn.roster
    : [];

  if (knownPlayers.length === 0 && walkInRosterRaw.length > 0) {
    walkInRosterRaw
      .slice(0, totalSeats)
      .forEach((entry: any, idx: number) => {
        knownPlayers.push({
          uid: String(entry?.uid || `walkin_guest_${idx + 1}`),
          username:
            String(entry?.username || "").trim() || `Player ${idx + 1}`,
          role: "Player",
          skillTier:
            normalizeWalkInSkillTier(entry?.skillTier) || undefined,
        } as any);
      });
  }

  const createSlot = (slotId: string): LobbySlot => ({
    slotId,
    status: "open",
    role: "Player",
  });

  const displaySlotsA =
    totalSeats % 2 === 0
      ? Array.from({ length: Math.max(1, totalSeats / 2) }, (_, idx) =>
          createSlot(`A${idx + 1}`),
        )
      : Array.from({ length: totalSeats }, (_, idx) =>
          createSlot(`A${idx + 1}`),
        );
  const displaySlotsB =
    totalSeats % 2 === 0
      ? Array.from({ length: Math.max(1, totalSeats / 2) }, (_, idx) =>
          createSlot(`B${idx + 1}`),
        )
      : [];

  const allSlots = [...displaySlotsA, ...displaySlotsB];
  for (let index = 0; index < allSlots.length; index += 1) {
    const slot = allSlots[index];
    if (index < knownPlayers.length) {
      const player = knownPlayers[index];
      slot.status = "confirmed";
      slot.uid = player.uid;
      slot.user = {
        uid: player.uid,
        username: player.username,
        skillTier:
          normalizeWalkInSkillTier((player as any)?.skillTier) || undefined,
      };
      slot.role = player.role || "Player";
    } else if (index < bookedSeats) {
      slot.status = "reserved";
      slot.role = "Booked";
    }
  }

  return { displaySlotsA, displaySlotsB };
}

function buildStructuredSlots(room: Matchroom) {
  const totalPlayers = room?.maxPlayers || 0;
  if (!(totalPlayers > 0 && totalPlayers % 2 === 0)) {
    return {
      displaySlotsA: room?.slotsA || [],
      displaySlotsB: room?.slotsB || [],
    };
  }

  const teamSize = totalPlayers / 2;
  const localSlotsA = Array.from({ length: teamSize }, (_, idx) => ({
    slotId: `A${idx + 1}`,
    status: "open" as const,
    role: "Player",
  }));
  const localSlotsB = Array.from({ length: teamSize }, (_, idx) => ({
    slotId: `B${idx + 1}`,
    status: "open" as const,
    role: "Player",
  }));

  const players = room?.players || [];
  const fillSlots = (slots: any[], startIndex: number) =>
    slots.map((slot, idx) => {
      const player = players[startIndex + idx];
      if (!player) {
        return slot;
      }
      return {
        ...slot,
        uid: player.uid,
        user: { _id: player.uid, uid: player.uid, username: player.username },
        status: "confirmed" as const,
        role: player.role || "Player",
      };
    });

  return {
    displaySlotsA: fillSlots(localSlotsA, 0),
    displaySlotsB: fillSlots(localSlotsB, teamSize),
  };
}

function fillUnassignedPlayers(room: Matchroom) {
  const slotsA = room?.slotsA || [];
  const slotsB = room?.slotsB || [];
  const assigned = new Set<string>();

  slotsA.forEach((slot: any) => {
    const uid = getSlotUserId(slot);
    if (uid) assigned.add(uid);
  });
  slotsB.forEach((slot: any) => {
    const uid = getSlotUserId(slot);
    if (uid) assigned.add(uid);
  });

  const unassigned = (room?.players || []).filter(
    (player: any) => !assigned.has(player.uid),
  );
  let idx = 0;

  const fill = (slots: any[]) =>
    slots.map((slot) => {
      if (slot.user || slot.uid) return slot;
      if (idx < unassigned.length) {
        const player = unassigned[idx++];
        return {
          ...slot,
          uid: player.uid,
          user: { _id: player.uid, uid: player.uid, username: player.username },
          status: "confirmed",
          role: slot.role || player.role || "Player",
        };
      }
      return slot;
    });

  return {
    displaySlotsA: fill(slotsA),
    displaySlotsB: fill(slotsB),
  };
}

export function deriveMatchroomLobbyState(
  room: Matchroom | null,
  currentIdentityValues: Array<string | null | undefined>,
) {
  const isWalkInRoom =
    String((room as any)?.bookingSource || "").toLowerCase() === "walkin";

  const slots = [...(room?.slotsA || []), ...(room?.slotsB || [])];
  const slotUids = slots
    .map((slot: any) => slot?.user?._id || slot?.uid)
    .filter(Boolean);
  const participantUids = new Set<string>(
    [
      ...(room?.playerUids || []),
      ...slotUids,
      room?.hostUid,
    ].filter(Boolean) as string[],
  );
  const isJoined = currentIdentityValues.some(
    (value) => value != null && participantUids.has(String(value)),
  );

  const slotsA = room?.slotsA || [];
  const slotsB = room?.slotsB || [];
  const hasStoredSlots = slotsA.length > 0 || slotsB.length > 0;

  let displaySlotsA: any[] = slotsA;
  let displaySlotsB: any[] = slotsB;

  if (!hasStoredSlots && isWalkInRoom && (room?.maxPlayers || 0) > 0) {
    const walkInSlots = buildWalkInSlots(room as Matchroom);
    displaySlotsA = walkInSlots.displaySlotsA;
    displaySlotsB = walkInSlots.displaySlotsB;
  } else if (!hasStoredSlots) {
    const structuredSlots = buildStructuredSlots(room as Matchroom);
    displaySlotsA = structuredSlots.displaySlotsA;
    displaySlotsB = structuredSlots.displaySlotsB;
  } else if (room) {
    const filledSlots = fillUnassignedPlayers(room);
    displaySlotsA = filledSlots.displaySlotsA;
    displaySlotsB = filledSlots.displaySlotsB;
  }

  const allSlots = [...displaySlotsA, ...displaySlotsB];
  const occupiedSeatCount =
    allSlots.length > 0
      ? allSlots.filter((slot: any) => {
          const state = String(slot?.status || "").toLowerCase();
          return Boolean(
            slot?.user ||
              slot?.uid ||
              state === "confirmed" ||
              state === "reserved",
          );
        }).length
      : Math.max(
          Number((room as any)?.currentPlayers || 0),
          (room?.players || []).length,
        );

  const isFull = occupiedSeatCount >= (room?.maxPlayers || 0);
  // Only ever surface a check-in code the server explicitly returned. Never
  // synthesize one from the room id — outsiders receive `matchCode: null`, and
  // a code derived from the public id would defeat that server-side gating.
  const matchCode = room?.matchCode || "";
  const qrValue = room?.id ? `matchhai://matchrooms/${room.id}` : "";

  return {
    isWalkInRoom,
    participantUids,
    isJoined,
    displaySlotsA,
    displaySlotsB,
    occupiedSeatCount,
    isFull,
    matchCode,
    qrValue,
  };
}
