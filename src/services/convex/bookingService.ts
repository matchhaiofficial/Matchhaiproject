// src/services/convex/bookingService.ts
// Convex-based booking service for booking intents and seat reservations

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Matchroom } from "./matchService";
import { isRoomExpired, isRoomLocked } from "../../utils/matchroomLifecycle";

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
      side: data.side,
      selectedSlots: data.selectedSlots,
      pricing: data.pricing,
    });

    return { ok: true, data: { id: intentId } };
  } catch (error: any) {
    console.error("[bookingService] createBookingIntent error:", error);
    return { ok: false, message: error?.message || "Failed to create booking intent" };
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
  userAuthId: string,
  paymentMethod: "wallet" | "card" = "wallet"
): Promise<Result> {
  try {
    if (paymentMethod !== "wallet") {
      return { ok: false, message: "Card payments are coming soon. Please pay via wallet." };
    }

    // Update payment status
    await convex.mutation(api.bookings.updateIntentPaymentStatus, {
      intentId: intentId as Id<"bookingIntents">,
      paymentStatus: "paid",
    });

    return { ok: true };
  } catch (error: any) {
    console.error("[bookingService] confirmBookingTransaction error:", error);
    return { ok: false, message: error?.message || "Transaction failed" };
  }
}

/**
 * Claim seat transaction (simplified)
 */
export async function claimSeatTransaction(
  matchroomId: string,
  intentId: string,
  slotIndex: number
): Promise<Result> {
  try {
    // This would need a dedicated Convex mutation for full implementation
    return { ok: false, message: "Not implemented in Convex yet" };
  } catch (error: any) {
    console.error("[bookingService] claimSeatTransaction error:", error);
    return { ok: false, message: "Claim failed" };
  }
}
