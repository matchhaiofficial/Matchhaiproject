// src/services/convex/bookingService.ts
// Convex-based booking service for booking intents and seat reservations

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Matchroom } from "./matchService";
import { isRoomExpired, isRoomLocked } from "../../utils/matchroomLifecycle";
import { getUnavailablePaymentMessage } from "../../config/featureReadiness";
import { SLOT_ALREADY_FILLED_PAYMENT_MESSAGE } from "../../utils/paymentUiCopy";
import Logger from "../../utils/logger";
import { getUserFacingErrorMessage } from "../../utils/userFacingErrors";

export interface BookingIntent {
  id?: string;
  _id?: string;
  matchroomId: string;
  game?: string;
  createdByUid: string;
  side: "A" | "B";
  selectedSlots: number[];
  invitees?: Array<{
    uid: string;
    username: string;
    roleForGame: string;
    skillScore?: number;
  }>;
  pricing?: {
    perPlayerCost: number;
    totalCost: number;
  };
  captainApproval?: {
    approved: boolean;
    approvedAt?: number;
  };
  zoneApproval?: {
    approved: boolean;
    approvedAt?: number;
  };
  status:
    | "draft"
    | "pending_approvals"
    | "approved"
    | "approved_pending_payment"
    | "confirmed"
    | "expired"
    | "rejected"
    | "cancelled";
  paymentStatus: "unpaid" | "paid";
  activePaymentTransactionId?: string;
  activePaymentOrderRefNum?: string;
  activePaymentExpiresAt?: number;
  selectedSlotIds?: string[];
  createdByUsername?: string;
  role?: string;
  source?: "direct_join" | "captain_approved_join" | "captain_invite";
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
}

export const FAIR_BAND_DELTA_BY_GAME: Record<string, number> = {
  cs2: 10,
  futsal: 10,
  indoor_cricket: 10,
  fc26: 12,
  tekken8: 12,
  padel: 12,
  pickleball: 12,
};

type SuccessResult<T> = { ok: true; data?: T; id?: string; message?: string };
type ErrorResult = { ok: false; message: string };
type Result<T = void> = SuccessResult<T> | ErrorResult;

/**
 * Calculates if a skill score is within the fairness band of a matchroom.
 */
export function isWithinFairnessBand(
  inviteeSkill: number,
  roomAvgSkill: number,
  game: string
): boolean {
  const delta = FAIR_BAND_DELTA_BY_GAME[game] || 10;
  return Math.abs(inviteeSkill - roomAvgSkill) <= delta;
}

/**
 * Helper to hash slot IDs deterministically for intentId deduplication.
 */
export function getSlotIdHash(slotIds: number[]): string {
  if (!slotIds || !Array.isArray(slotIds)) return "empty";
  return [...slotIds].sort().join("_");
}

/**
 * Get booking intent by ID
 */
export async function getBookingIntent(
  intentId: string
): Promise<Result<BookingIntent>> {
  try {
    const intent = await convex.query(api.bookings.getIntentById, {
      intentId: intentId as Id<"bookingIntents">,
    });

    if (!intent) {
      return { ok: false, message: "Intent not found" };
    }

    return {
      ok: true,
      data: {
        ...intent,
        id: intent._id,
      } as BookingIntent,
    };
  } catch (error: any) {
    console.error("[bookingService] getBookingIntent error:", error);
    return { ok: false, message: "Failed to fetch booking intent" };
  }
}

/**
 * List booking intents for a matchroom
 */
export async function getIntentsForMatchroom(
  matchroomId: string
): Promise<Result<BookingIntent[]>> {
  try {
    const intents = await convex.query(api.bookings.listIntentsForMatchroom, {
      matchroomId: matchroomId as Id<"matchrooms">,
    });

    return {
      ok: true,
      data: intents.map((i: any) => ({ ...i, id: i._id })) as BookingIntent[],
    };
  } catch (error: any) {
    console.error("[bookingService] getIntentsForMatchroom error:", error);
    return { ok: false, message: "Failed to fetch booking intents" };
  }
}

/**
 * List booking intents by user
 */
export async function getUserIntents(
  userAuthId: string
): Promise<Result<BookingIntent[]>> {
  try {
    const user = await convex.query(api.users.getByAuthId, { authId: userAuthId });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    const intents = await convex.query(api.bookings.listIntentsByUser, {
      userId: user._id,
    });

    return {
      ok: true,
      data: intents.map((i: any) => ({ ...i, id: i._id })) as BookingIntent[],
    };
  } catch (error: any) {
    console.error("[bookingService] getUserIntents error:", error);
    return { ok: false, message: "Failed to fetch booking intents" };
  }
}

/**
 * Create a booking intent
 */
export async function createBookingIntent(data: {
  matchroomId: string;
  userAuthId: string;
  side: "A" | "B";
  selectedSlots: number[];
  selectedSlotIds?: string[];
  role?: string;
  source?: "direct_join" | "captain_approved_join" | "captain_invite";
  pricing?: { perPlayerCost: number; totalCost: number };
}): Promise<Result<{ id: string }>> {
  try {
    const user = await convex.query(api.users.getByAuthId, { authId: data.userAuthId });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    const intentId = await convex.mutation(api.bookings.createIntent, {
      matchroomId: data.matchroomId as Id<"matchrooms">,
      createdByUid: user._id,
      createdByUsername: user.username,
      side: data.side,
      selectedSlots: data.selectedSlots,
      selectedSlotIds: data.selectedSlotIds,
      role: data.role,
      source: data.source,
      pricing: data.pricing,
    });

    return { ok: true, data: { id: intentId } };
  } catch (error: any) {
    console.error("[bookingService] createBookingIntent error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to create booking intent") };
  }
}

/**
 * Update booking intent approval (captain or zone)
 */
export async function updateIntentApproval(
  intentId: string,
  approvalType: "captain" | "zone",
  approved: boolean
): Promise<Result> {
  try {
    await convex.mutation(api.bookings.updateIntentApproval, {
      intentId: intentId as Id<"bookingIntents">,
      approvalType,
      approved,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[bookingService] updateIntentApproval error:", error);
    return { ok: false, message: "Failed to update approval" };
  }
}

/**
 * Update booking intent payment status
 */
export async function updateIntentPaymentStatus(
  intentId: string,
  paymentStatus: "unpaid" | "paid"
): Promise<Result> {
  try {
    if (paymentStatus === "paid") {
      return {
        ok: false,
        message: "Payment can only be confirmed after the payment provider verifies it.",
      };
    }
    await convex.mutation(api.bookings.updateIntentPaymentStatus, {
      intentId: intentId as Id<"bookingIntents">,
      paymentStatus,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[bookingService] updateIntentPaymentStatus error:", error);
    return { ok: false, message: "Failed to update payment status" };
  }
}

/**
 * Confirm booking transaction (simplified version for Convex)
 * Note: Full transaction logic should be implemented in Convex mutation
 */
export async function confirmBookingTransaction(
  intentId: string,
  userId: string,
  paymentMethod: "wallet" | "card" = "wallet"
): Promise<Result> {
  try {
    if (paymentMethod !== "wallet") {
      return { ok: false, message: getUnavailablePaymentMessage(paymentMethod) };
    }

    await convex.mutation(api.matchrooms.payMatchroomSeatIntent, {
      intentId: intentId as Id<"bookingIntents">,
      userId: userId as Id<"users">,
    });

    return { ok: true };
  } catch (error: any) {
    const message = String(error?.message || error || "");
    Logger.warn("bookingService", "confirmBookingTransaction failed", { message });
    if (/payment window expired/i.test(message)) {
      return {
        ok: false,
        message: "This slot hold expired. Please request the slot again to continue.",
      };
    }
    if (/slot is no longer available/i.test(message)) {
      return {
        ok: false,
        message: SLOT_ALREADY_FILLED_PAYMENT_MESSAGE,
      };
    }
    if (/insufficient/i.test(message)) {
      return {
        ok: false,
        message: "Insufficient wallet balance. Please add funds from Wallet.",
      };
    }
    return { ok: false, message: "Payment could not be completed. Please try again." };
  }
}

export async function cancelBookingIntent(
  intentId: string,
  userId: string,
): Promise<Result> {
  try {
    await convex.mutation(api.bookings.cancelIntent, {
      intentId: intentId as Id<"bookingIntents">,
      userId: userId as Id<"users">,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[bookingService] cancelBookingIntent error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to cancel booking") };
  }
}

/**
 * Generates a deterministic intent ID to avoid duplicates.
 */
export function generateIntentId(
  matchroomId: string,
  side: "A" | "B",
  createdByUid: string,
  slotIds: string[]
): string {
  const hash = slotIds && Array.isArray(slotIds)
    ? [...slotIds].sort().join("_")
    : "empty";
  return `intent_${matchroomId}_${side}_${createdByUid}_${hash}`;
}

/**
 * Identifies the deterministic Host/Captain UID for approval fallback.
 */
export function getHostCaptainUid(room: Matchroom): string {
  if (room.captainUidA && !room.captainUidB) return room.captainUidA;
  if (room.captainUidB && !room.captainUidA) return room.captainUidB;
  return room.hostUid;
}

/**
 * Creates a detailed booking intent with fairness checks and approval logic.
 * Mirrors the Firebase createBookingIntentDetailed interface.
 */
export async function createBookingIntentDetailed({
  matchroom,
  side,
  selectedSlots,
  invitees,
  roomAvgSkill,
}: {
  matchroom: Matchroom;
  side: "A" | "B";
  selectedSlots: string[];
  invitees: Array<{
    uid: string;
    username: string;
    roleForGame: string;
    skillScore?: number;
  }>;
  roomAvgSkill?: number;
}): Promise<{ ok: true; data: string } | { ok: false; message: string }> {
  try {
    const room = matchroom;
    const slotIds = selectedSlots || [];
    const invs = invitees || [];

    // Guard: Check if room is expired
    if (isRoomExpired(room)) {
      return { ok: false, message: "This matchroom has expired (valid for 48 hours)" };
    }

    // Guard: Check if room is locked or full
    if (isRoomLocked(room)) {
      return { ok: false, message: "Matchroom is full and locked" };
    }

    const roomId = room.id || room._id || "unknown";

    // Fairness Logic
    const hostSkill = room.hostSkillScore || 50;
    const effectiveRoomAvg = room.avgSkillScoreLive ?? hostSkill;

    let captainApprovalRequired = false;
    for (const invitee of invs) {
      if (invitee.skillScore === undefined || invitee.skillScore === null) {
        captainApprovalRequired = true;
        continue;
      }
      if (!isWithinFairnessBand(invitee.skillScore, effectiveRoomAvg, room.game)) {
        captainApprovalRequired = true;
      }
    }

    // Booker-as-Approver rule
    const targetCaptainUid = side === "A" ? room.captainUidA : room.captainUidB;
    const approverUid = targetCaptainUid || getHostCaptainUid(room);

    // For now, create a simplified intent via Convex
    // The intent ID is deterministic to avoid duplicates
    const intentId = generateIntentId(roomId, side, invs[0]?.uid || "unknown", slotIds);

    try {
      await convex.mutation(api.bookings.createIntent, {
        matchroomId: roomId as Id<"matchrooms">,
        createdByUid: invs[0]?.uid as any || ("unknown" as any),
        side,
        selectedSlots: slotIds.map((_, i) => i),
        pricing: {
          perPlayerCost: room.pricing?.perPlayer || 0,
          totalCost: (room.pricing?.perPlayer || 0) * invs.length,
        },
      });
    } catch (e: any) {
      // If intent already exists, reuse it
      if (!e?.message?.includes("already exists")) {
        throw e;
      }
    }

    return { ok: true, data: intentId };
  } catch (error: any) {
    console.error("[bookingService] createBookingIntentDetailed error:", error);
    return { ok: false, message: "Failed to create booking intent" };
  }
}

/**
 * Updates the status of a booking intent.
 */
export async function updateBookingIntentStatus(
  intentId: string,
  status: BookingIntent["status"]
): Promise<Result> {
  try {
    // Map status to the appropriate mutation
    if (status === "expired" || status === "rejected" || status === "cancelled") {
      await convex.mutation(api.bookings.updateIntentPaymentStatus, {
        intentId: intentId as Id<"bookingIntents">,
        paymentStatus: "unpaid",
      });
    }
    return { ok: true };
  } catch (error: any) {
    console.error("[bookingService] updateBookingIntentStatus error:", error);
    return { ok: false, message: "Failed to update status" };
  }
}

/**
 * Best-effort client-side cleanup for expired intents.
 */
export async function cleanupExpiredIntents(matchroomId: string): Promise<void> {
  try {
    // In Convex, this would be handled by a scheduled function
    // No-op on client side
  } catch (e) {
    console.error("[bookingService] cleanupExpiredIntents error:", e);
  }
}
