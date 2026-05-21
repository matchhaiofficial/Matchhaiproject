// src/services/convex/bookingRequestService.ts
// Convex-based booking request service for reverse bidding flow

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Perf } from "../../utils/perfInstrumentation";
import { getUserFacingErrorMessage } from "../../utils/userFacingErrors";

export interface BookingRequest {
  id?: string;
  _id?: string;
  userId: string;
  userName?: string;
  gameKey: string;
  title?: string;
  description?: string;
  maxPlayers?: number;
  playerCount?: number;
  format?: string;
  seriesType?: string | null;
  durationHours?: number | null;
  selectedMaps?: string[];
  skillLevel?: string;
  overs?: string | null;
  hostSkillScore?: number | null;
  hostSkillTier?: string | null;
  hostSkillContext?: Record<string, any> | null;
  teamMode?: "team" | "solo";
  teamId?: string | null;
  reservedSlots?: number;
  preferredDate?: number;
  preferredTime?: string;
  flexibilityWindow?: string;
  locationMode?: "zone" | "broadcast";
  zoneId?: string;
  preferredAreas?: string[];
  budgetPerPlayer?: number;
  currency?: string;
  notes?: string;
  status: "open" | "pending_payment" | "accepted" | "expired" | "cancelled";
  acceptedOfferId?: string;
  matchroomId?: string;
  paymentStatus?: "paid" | "unpaid";
  paymentAmount?: number;
  paymentReservedSlots?: number;
  requestedResourceAssetType?: string;
  requestedResourceSurface?: string;
  requestedResourceTier?: string;
  selectedZoneRateKey?: string;
  lifecycleStatus?: string;
  createdAt: number;
  expiresAt?: number;
  updatedAt?: number;
}

export interface ZoneOffer {
  id?: string;
  _id?: string;
  requestId: string;
  requestOwnerUid?: string;
  zoneId: string;
  zoneName?: string;
  zoneOwnerUid?: string;
  offerType?: "standard_accept" | "counter_offer";
  requestKind?: "direct_zone" | "broadcast_fanout";
  zoneAdminId?: string;
  branchId?: string;
  branchName?: string;
  proposedDate?: number;
  proposedTime?: string;
  scheduleOptions?: Array<{
    date: string;
    time: string;
  }>;
  recipientUids?: string[];
  responses?: Array<{
    uid: string;
    decision: "accepted" | "rejected";
    respondedAt: number;
    selectedOptionIndex?: number;
  }>;
  selectedOptionIndex?: number;
  resolvedMatchroomId?: string;
  expiresAt?: number;
  responseExpiresAt?: number;
  proposedPrice: number;
  pricePerPlayer?: number;
  currency?: string;
  location?: string;
  message?: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  createdAt: number;
  updatedAt?: number;
}

type SuccessResult<T> = { ok: true; data?: T; id?: string; message?: string };
type ErrorResult = { ok: false; message: string };
type Result<T = void> = SuccessResult<T> | ErrorResult;

/**
 * Get booking request by ID
 */
export async function getBookingRequest(
  requestId: string
): Promise<Result<BookingRequest>> {
  try {
    const request = await convex.query(api.bookings.getRequestById, {
      requestId: requestId as Id<"bookingRequests">,
    });

    if (!request) {
      return { ok: false, message: "Request not found" };
    }

    return {
      ok: true,
      data: {
        ...request,
        id: request._id,
      } as BookingRequest,
    };
  } catch (error: any) {
    console.error("[bookingRequestService] getBookingRequest error:", error);
    return { ok: false, message: "Failed to fetch booking request" };
  }
}

/**
 * Get user's booking requests
 */
export async function getUserRequests(
  userId: string
): Promise<Result<BookingRequest[]>> {
  try {
    const requests = await Perf.measureAsync("BookingRequests.ListByUser", () =>
      convex.query(api.bookings.listRequestsByUser, {
        userId: userId as Id<"users">,
      }),
    );

    return {
      ok: true,
      data: requests.map((r: any) => ({ ...r, id: r._id })) as BookingRequest[],
    };
  } catch (error: any) {
    console.error("[bookingRequestService] getUserRequests error:", error);
    return { ok: false, message: "Failed to fetch booking requests" };
  }
}

/**
 * Get requests for a specific zone
 */
export async function getRequestsForZone(
  zoneId: string
): Promise<Result<BookingRequest[]>> {
  try {
    const requests = await convex.query(api.bookings.listRequestsByZone, {
      zoneId: zoneId as Id<"zones">,
    });

    return {
      ok: true,
      data: requests.map((r: any) => ({ ...r, id: r._id })) as BookingRequest[],
    };
  } catch (error: any) {
    console.error("[bookingRequestService] getRequestsForZone error:", error);
    return { ok: false, message: "Failed to fetch booking requests" };
  }
}

/**
 * Get open requests by game
 */
export async function getOpenRequestsByGame(
  gameKey: string
): Promise<Result<BookingRequest[]>> {
  try {
    const requests = await convex.query(api.bookings.listOpenRequestsByGame, {
      gameKey,
    });

    return {
      ok: true,
      data: requests
        .filter((r: any) => r.status === "open")
        .map((r: any) => ({ ...r, id: r._id })) as BookingRequest[],
    };
  } catch (error: any) {
    console.error("[bookingRequestService] getOpenRequestsByGame error:", error);
    return { ok: false, message: "Failed to fetch open requests" };
  }
}

/**
 * Create a booking request.
 * Accepts the full BookingRequest-like data shape (Firebase-compatible) or a simplified shape.
 */
export async function createBookingRequest(
  data: Omit<BookingRequest, "id" | "createdAt" | "status" | "_id"> & {
    userAuthId?: string;
    playerCount?: number;
    notes?: string;
  },
  options?: { status?: BookingRequest["status"] }
): Promise<{ ok: boolean; id?: string; message?: string }> {
  try {
    // Resolve the userId - it may already be a Convex user ID
    const userId = data.userId;
    if (!userId) {
      return { ok: false, message: "User ID is required" };
    }

    const requestId = await convex.mutation(api.bookings.createRequest, {
      userId: userId as Id<"users">,
      gameKey: data.gameKey,
      zoneId: data.zoneId as Id<"zones"> | undefined,
      userName: data.userName,
      title: data.title,
      description: data.description,
      maxPlayers: data.maxPlayers,
      format: data.format,
      seriesType: data.seriesType ?? undefined,
      durationHours: data.durationHours ?? undefined,
      selectedMaps: data.selectedMaps,
      skillLevel: data.skillLevel,
      hostSkillScore: data.hostSkillScore ?? undefined,
      hostSkillTier: data.hostSkillTier ?? undefined,
      hostSkillContext: (data as any).hostSkillContext,
      overs: data.overs ?? undefined,
      teamMode: data.teamMode,
      teamId: data.teamId ?? undefined,
      reservedSlots: data.reservedSlots,
      preferredDate: data.preferredDate,
      preferredTime: data.preferredTime,
      flexibilityWindow: data.flexibilityWindow,
      locationMode: data.locationMode,
      preferredAreas: data.preferredAreas,
      budgetPerPlayer: data.budgetPerPlayer,
      currency: data.currency,
      playerCount: data.playerCount || data.maxPlayers || 10,
      paymentStatus: data.paymentStatus,
      paymentAmount: data.paymentAmount,
      paymentReservedSlots: (data as any).paymentReservedSlots,
      requestedResourceAssetType: (data as any).requestedResourceAssetType,
      requestedResourceSurface: (data as any).requestedResourceSurface,
      requestedResourceTier: (data as any).requestedResourceTier,
      selectedZoneRateKey: (data as any).selectedZoneRateKey,
      matchroomId: data.matchroomId as Id<"matchrooms"> | undefined,
      lifecycleStatus: (data as any).lifecycleStatus,
      notes: data.notes || data.description,
    });

    return { ok: true, id: requestId };
  } catch (error: any) {
    console.error("[bookingRequestService] createBookingRequest error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to create booking request") };
  }
}

/**
 * Update booking request status
 */
export async function updateRequestStatus(
  requestId: string,
  status: BookingRequest["status"]
): Promise<Result> {
  try {
    await convex.mutation(api.bookings.updateRequestStatus, {
      requestId: requestId as Id<"bookingRequests">,
      status,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[bookingRequestService] updateRequestStatus error:", error);
    return { ok: false, message: "Failed to update request status" };
  }
}

// ============================================
// ZONE OFFERS
// ============================================

/**
 * Get zone offer by ID
 */
export async function getOffer(offerId: string): Promise<Result<ZoneOffer>> {
  try {
    const offer = await convex.query(api.bookings.getOfferById, {
      offerId: offerId as Id<"zoneOffers">,
    });

    if (!offer) {
      return { ok: false, message: "Offer not found" };
    }

    return {
      ok: true,
      data: {
        ...offer,
        id: offer._id,
      } as ZoneOffer,
    };
  } catch (error: any) {
    console.error("[bookingRequestService] getOffer error:", error);
    return { ok: false, message: "Failed to fetch offer" };
  }
}

/**
 * Get offers for a booking request
 */
export async function getOffersForRequest(
  requestId: string
): Promise<Result<ZoneOffer[]>> {
  try {
    const offers = await Perf.measureAsync("ZoneOffers.ListForRequest", () =>
      convex.query(api.bookings.listOffersForRequest, {
        requestId: requestId as Id<"bookingRequests">,
      }),
    );

    return {
      ok: true,
      data: offers.map((o: any) => ({ ...o, id: o._id })) as ZoneOffer[],
    };
  } catch (error: any) {
    console.error("[bookingRequestService] getOffersForRequest error:", error);
    return { ok: false, message: "Failed to fetch offers" };
  }
}

/**
 * Get offers for user's requests
 */
export async function getOffersForUser(
  userId: string
): Promise<Result<ZoneOffer[]>> {
  try {
    const offers = await Perf.measureAsync("ZoneOffers.ListForUser", () =>
      convex.query(api.bookings.listOffersForUser, {
        userId: userId as Id<"users">,
      }),
    );

    return {
      ok: true,
      data: offers.map((offer: any) => ({ ...offer, id: offer._id })) as ZoneOffer[],
    };
  } catch (error: any) {
    console.error("[bookingRequestService] getOffersForUser error:", error);
    return { ok: false, message: "Failed to fetch offers" };
  }
}

/**
 * Get offers by zone
 */
export async function getOffersByZone(
  zoneId: string
): Promise<Result<ZoneOffer[]>> {
  try {
    const offers = await convex.query(api.bookings.listOffersByZone, {
      zoneId: zoneId as Id<"zones">,
    });

    return {
      ok: true,
      data: offers.map((o: any) => ({ ...o, id: o._id })) as ZoneOffer[],
    };
  } catch (error: any) {
    console.error("[bookingRequestService] getOffersByZone error:", error);
    return { ok: false, message: "Failed to fetch offers" };
  }
}

/**
 * Create a zone offer
 */
export async function createOffer(data: {
  requestId: string;
  zoneId: string;
  proposedPrice: number;
  proposedDate?: number;
  proposedTime?: string;
  message?: string;
}): Promise<Result<{ id: string }>> {
  try {
    const offerId = await convex.mutation(api.bookings.createOffer, {
      requestId: data.requestId as Id<"bookingRequests">,
      zoneId: data.zoneId as Id<"zones">,
      proposedPrice: data.proposedPrice,
      proposedDate: data.proposedDate,
      proposedTime: data.proposedTime,
      message: data.message,
    });

    return { ok: true, data: { id: offerId } };
  } catch (error: any) {
    console.error("[bookingRequestService] createOffer error:", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to create offer") };
  }
}

/**
 * Update zone offer status
 */
export async function updateOfferStatus(
  offerId: string,
  status: ZoneOffer["status"]
): Promise<Result> {
  try {
    await convex.mutation(api.bookings.updateOfferStatus, {
      offerId: offerId as Id<"zoneOffers">,
      status,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[bookingRequestService] updateOfferStatus error:", error);
    return { ok: false, message: "Failed to update offer status" };
  }
}

/**
 * Accept a zone offer
 */
export async function acceptOffer(
  requestId: string,
  offerId: string
): Promise<Result> {
  try {
    // Update offer status to accepted
    await convex.mutation(api.bookings.updateOfferStatus, {
      offerId: offerId as Id<"zoneOffers">,
      status: "accepted",
    });

    // Update request status
    await convex.mutation(api.bookings.updateRequestStatus, {
      requestId: requestId as Id<"bookingRequests">,
      status: "accepted",
    });

    return { ok: true };
  } catch (error: any) {
    console.error("[bookingRequestService] acceptOffer error:", error);
    return { ok: false, message: "Failed to accept offer" };
  }
}

/**
 * Reject a zone offer
 */
export async function rejectOffer(offerId: string): Promise<Result> {
  try {
    await convex.mutation(api.bookings.updateOfferStatus, {
      offerId: offerId as Id<"zoneOffers">,
      status: "rejected",
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[bookingRequestService] rejectOffer error:", error);
    return { ok: false, message: "Failed to reject offer" };
  }
}
