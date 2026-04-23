// src/services/convex/zoneAdminBookingService.ts
// Convex-based zone admin booking service

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Logger from "../../utils/logger";
import { recordRateMetric } from "../../utils/perfInstrumentation";
import {
    createSharedPollingState,
    PollingSubscriptionCallback,
    publishPollingRows,
    releasePollingSubscription,
    replayPollingRows,
    SharedPollingState,
} from "./sharedPollingRegistry";

export type ZoneBookingAssetType = "pc" | "court" | "mixed" | "unknown";
export type ZoneBookingQueueStatus =
    | "open"
    | "pending_payment"
    | "accepted"
    | "expired"
    | "cancelled";

export interface ZoneBookingQueueItem {
    id: string;
    requestId?: string;
    matchroomId?: string;
    requestKind?: "direct_zone" | "broadcast_fanout" | string;
    userId: string;
    userName: string;
    title: string;
    gameKey: string;
    maxPlayers: number;
    playerCount?: number;
    reservedSlots?: number;
    teamMode?: "solo" | "team";
    preferredDate?: any;
    preferredTime?: string;
    preferredAreas: string[];
    responseExpiresAt?: any;
    targetAreaLabel?: string;
    budgetPerPlayer?: number;
    currency?: string;
    status: ZoneBookingQueueStatus | string;
    paymentStatus?: "paid" | "unpaid" | string;
    locationMode?: "zone" | "broadcast" | string;
    zoneId?: string;
    lifecycleStatus?: string;
    allocatedBranchId?: string;
    allocatedResourceIds?: string[];
    allocatedAt?: any;
    allocatedByUid?: string;
    createdAt?: any;
    updatedAt?: any;
    assetType: ZoneBookingAssetType;
    priorityFlags: string[];
    raw: Record<string, any>;
}

export interface ZoneMatchroomListItem {
    id: string;
    hostUid?: string | null;
    hostName?: string | null;
    title: string;
    game: string;
    status: string;
    scheduledDate?: string;
    scheduledTime?: string;
    maxPlayers: number;
    currentPlayers: number;
    paymentStatus?: string;
    bookingSource?: string;
    walkInPaymentMode?: string;
    location?: string;
    branchId?: string | null;
    durationMinutes?: number;
    pricePerPlayer?: number;
    totalAmount?: number;
    currency?: string;
    zoneId?: string | null;
    zoneOwnerUid?: string | null;
    createdAt?: any;
    hostSkillTier?: string;
    hostSkillScore?: number | null;
    format?: string;
    seriesType?: string | null;
    durationHours?: number | null;
    overs?: number | null;
    slotsA?: any[];
    slotsB?: any[];
}

const POLL_INTERVAL_MS = 5000;
const queuePollingState = new Map<string, SharedPollingState<ZoneBookingQueueItem>>();
const matchroomPollingState = new Map<string, SharedPollingState<ZoneMatchroomListItem>>();

function normalizeHintList(values?: string[]) {
    return (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .slice(0, 10)
        .sort();
}

function normalizeAreaList(values: string[]) {
    return values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .sort();
}

function makeQueueSubscriptionKey(zoneId: string, branchAreas: string[]) {
    return JSON.stringify({
        zoneId,
        branchAreas: normalizeAreaList(branchAreas),
    });
}

function makeMatchroomSubscriptionKey(zoneId: string, ownerUid?: string, locationHints?: string[]) {
    return JSON.stringify({
        zoneId,
        ownerUid: ownerUid || "",
        locationHints: normalizeHintList(locationHints),
    });
}

const ACTIVE_QUEUE_STATUSES = new Set([
    "open",
    "pending_payment",
    "accepted",
]);

const normalizeGameKey = (value: unknown) =>
    String(value || "").trim().toLowerCase();

const computeAssetTypeFromGame = (gameKey: string): ZoneBookingAssetType => {
    if (["cs2", "cs16", "valorant", "fc25", "fc26", "tekken8"].includes(gameKey)) return "pc";
    if (["futsal", "indoor_cricket", "padel", "pickleball"].includes(gameKey)) return "court";
    return "unknown";
};

const computePriorityFlags = (data: Record<string, any>) => {
    const flags: string[] = [];
    if ((data.budgetPerPlayer || 0) >= 1500) flags.push("high_value");
    if (data.teamMode === "team" && (data.reservedSlots || 1) > 1) flags.push("recurring");
    if (data.isVipRequest === true || data.priority === "vip") flags.push("vip");
    return flags;
};

const toDurationMinutes = (request: Record<string, any>) => {
    const gameKey = String(request.gameKey || "").toLowerCase();
    const seriesType = String(request.seriesType || "").toUpperCase();
    const overs = String(request.overs || "").trim();

    if (gameKey === "futsal") {
        const hours = Number(request.durationHours || 0);
        if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60);
        return 60;
    }
    if (gameKey === "indoor_cricket") {
        if (overs === "6") return 150;
        if (overs === "5") return 120;
        return 120;
    }
    if (gameKey === "cs2" || gameKey === "cs16" || gameKey === "valorant") {
        if (seriesType === "BO1") return 60;
        if (seriesType === "BO3") return 180;
        if (seriesType === "BO5") return 300;
        if (seriesType === "BO10") return 600;
        return 60;
    }
    if (gameKey === "fc26") {
        if (seriesType === "BO1") return 30;
        if (seriesType === "BO3") return 60;
        if (seriesType === "BO5") return 120;
        if (seriesType === "BO10") return 180;
        return 60;
    }
    if (gameKey === "tekken8") {
        if (seriesType === "BO7") return 60;
        if (seriesType === "BO20") return 120;
        if (seriesType === "BO40") return 180;
        return 60;
    }
    if (gameKey === "padel" || gameKey === "pickleball") {
        if (seriesType === "BO5") return 120;
        if (seriesType === "BO10") return 180;
        return 60;
    }
    return 60;
};

const toDateString = (value: any) => {
    if (!value) return undefined;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length >= 8) return trimmed;
    }
    if (typeof value === "number") {
        return new Date(value).toISOString().slice(0, 10);
    }
    return undefined;
};

const toTimeString = (value: any) => {
    if (!value) return undefined;
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") {
        return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return undefined;
};

const normalizeBookingRequest = (data: Record<string, any>): ZoneBookingQueueItem => {
    const gameKey = normalizeGameKey(data.gameKey);
    const id = data.id || data._id || "";

    return {
        id: String(id),
        requestId: String(data.requestId || id),
        matchroomId: data.matchroomId ? String(data.matchroomId) : undefined,
        userId: data.userId || "",
        userName: data.userName || "Player",
        title: data.title || "Booking Request",
        gameKey,
        maxPlayers: Number(data.maxPlayers || data.playerCount || 0),
        playerCount: Number(data.playerCount || data.maxPlayers || 0) || undefined,
        reservedSlots: Number(data.reservedSlots || 0) || undefined,
        teamMode: data.teamMode,
        preferredDate: data.preferredDate,
        preferredTime: data.preferredTime,
        preferredAreas: Array.isArray(data.preferredAreas) ? data.preferredAreas : [],
        requestKind: data.requestKind || "direct_zone",
        responseExpiresAt: data.responseExpiresAt,
        targetAreaLabel: data.targetAreaLabel || undefined,
        budgetPerPlayer: Number(data.budgetPerPlayer || 0) || undefined,
        currency: data.currency || "PKR",
        status: data.status || "open",
        paymentStatus: data.paymentStatus || "unpaid",
        locationMode: data.locationMode,
        zoneId: data.zoneId ? String(data.zoneId) : undefined,
        lifecycleStatus: data.lifecycleStatus,
        allocatedBranchId: data.allocatedBranchId || undefined,
        allocatedResourceIds: Array.isArray(data.allocatedResourceIds)
            ? data.allocatedResourceIds.map((resourceId: any) => String(resourceId))
            : undefined,
        allocatedAt: data.allocatedAt,
        allocatedByUid: data.allocatedByUid || undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        assetType: computeAssetTypeFromGame(gameKey),
        priorityFlags: computePriorityFlags(data),
        raw: data,
    };
};

/**
 * Subscribe to zone booking queue using polling.
 * For real-time reactivity, use useQuery(api.zoneAdminBooking.listBookingQueueForZone) in components.
 */
export function subscribeZoneBookingQueue(
    zoneId: string,
    branchAreas: string[],
    onData: (rows: ZoneBookingQueueItem[]) => void,
    onError: (error: any) => void,
) {
    const key = makeQueueSubscriptionKey(zoneId, branchAreas);
    const callbackRef: PollingSubscriptionCallback<ZoneBookingQueueItem> = { onData, onError };
    let state = queuePollingState.get(key);

    if (!state) {
        state = createSharedPollingState();
        queuePollingState.set(key, state);
    }

    state.callbacks.add(callbackRef);
    replayPollingRows(state, callbackRef);

    const poll = async (currentState: SharedPollingState<ZoneBookingQueueItem>) => {
        if (currentState.inFlight) return;
        currentState.inFlight = true;
        try {
            const results = await convex.query(api.zoneAdminBooking.listBookingQueueForZone, {
                zoneId,
                branchAreas: normalizeAreaList(branchAreas),
            });

            const normalized = results
                .map((r: any) => normalizeBookingRequest(r))
                .filter((item: ZoneBookingQueueItem) => ACTIVE_QUEUE_STATUSES.has(item.status));
            recordRateMetric("zone_admin.booking_queue_reads_per_minute", normalized.length, {
                zoneId,
            });

            publishPollingRows(currentState, normalized);
        } catch (error: any) {
            Logger.error("zoneAdminBooking", "Queue poll failed", error);
            currentState.callbacks.forEach((callback) => callback.onError(error));
        } finally {
            currentState.inFlight = false;
        }
    };

    if (!state.interval) {
        void poll(state);
        state.interval = setInterval(() => {
            void poll(state!);
        }, POLL_INTERVAL_MS);
    }

    return () => {
        releasePollingSubscription(queuePollingState, key, callbackRef);
    };
}

/**
 * Subscribe to zone matchrooms using polling.
 * For real-time reactivity, use useQuery(api.zoneAdminBooking.listMatchroomsForZone) in components.
 */
export function subscribeZoneMatchrooms(
    zoneId: string,
    ownerUid: string | undefined,
    onData: (rows: ZoneMatchroomListItem[]) => void,
    onError: (error: any) => void,
    options?: {
        locationHints?: string[];
    },
) {
    const key = makeMatchroomSubscriptionKey(zoneId, ownerUid, options?.locationHints);
    const callbackRef: PollingSubscriptionCallback<ZoneMatchroomListItem> = { onData, onError };
    let state = matchroomPollingState.get(key);

    if (!state) {
        state = createSharedPollingState();
        matchroomPollingState.set(key, state);
    }

    state.callbacks.add(callbackRef);
    replayPollingRows(state, callbackRef);

    const poll = async (currentState: SharedPollingState<ZoneMatchroomListItem>) => {
        if (currentState.inFlight) return;
        currentState.inFlight = true;
        try {
            const results = await convex.query(api.zoneAdminBooking.listMatchroomsForZone, {
                zoneId,
                ownerUid: ownerUid || undefined,
                locationHints: normalizeHintList(options?.locationHints),
            });

            const rows: ZoneMatchroomListItem[] = results.map((data: any) => {
                const perPlayer = Number(data.pricing?.perPlayer ?? data.pricePerPlayer ?? 0);
                const playersForAmount = Number(data.currentPlayers || data.maxPlayers || 0);
                const fallbackTotal = perPlayer > 0 && playersForAmount > 0 ? perPlayer * playersForAmount : 0;
                const totalAmountRaw = Number(data.pricing?.total ?? data.totalAmount ?? fallbackTotal ?? 0);
                const durationMinutesRaw = Number(
                    data.durationMinutes ??
                    ((Number(data.durationHours || 0) > 0 ? Number(data.durationHours) * 60 : 0)),
                );

                return {
                    id: String(data.id || data._id),
                    hostUid: data.hostUid || null,
                    hostName: data.hostName || null,
                    title: data.title || "Matchroom",
                    game: data.game || "unknown",
                    status: data.status || "open",
                    scheduledDate: data.scheduledDate,
                    scheduledTime: data.scheduledTime,
                    maxPlayers: Number(data.maxPlayers || 0),
                    currentPlayers: Number(data.currentPlayers || 0),
                    paymentStatus: data.paymentStatus || "unpaid",
                    bookingSource: data.bookingSource || "standard",
                    walkInPaymentMode: data.walkIn?.paymentMode || null,
                    location: data.location || null,
                    branchId: data.branchId || data.walkIn?.branchId || null,
                    durationMinutes: Number.isFinite(durationMinutesRaw) ? durationMinutesRaw : 0,
                    pricePerPlayer: Number.isFinite(perPlayer) ? perPlayer : 0,
                    totalAmount: Number.isFinite(totalAmountRaw) ? totalAmountRaw : 0,
                    currency: data.pricing?.currency || data.currency || "PKR",
                    zoneId: data.zoneId || null,
                    zoneOwnerUid: data.zoneOwnerUid || null,
                    createdAt: data.createdAt,
                    hostSkillTier: data.hostSkillTier || "Any",
                    hostSkillScore: data.hostSkillScore ?? null,
                    format: data.format,
                    seriesType: data.seriesType || null,
                    durationHours: data.durationHours || null,
                    overs: data.overs ? Number(data.overs) : null,
                    slotsA: data.slotsA || [],
                    slotsB: data.slotsB || [],
                };
            });

            recordRateMetric("zone_admin.matchroom_reads_per_minute", rows.length, {
                zoneId,
            });

            publishPollingRows(currentState, rows);
        } catch (error: any) {
            Logger.error("zoneAdminBooking", "Matchroom poll failed", error);
            currentState.callbacks.forEach((callback) => callback.onError(error));
        } finally {
            currentState.inFlight = false;
        }
    };

    if (!state.interval) {
        void poll(state);
        state.interval = setInterval(() => {
            void poll(state!);
        }, POLL_INTERVAL_MS);
    }

    return () => {
        releasePollingSubscription(matchroomPollingState, key, callbackRef);
    };
}

export async function acceptZoneBookingRequest(input: {
    requestId: string;
    adminUid: string;
    zoneId: string;
    branchId: string;
    resourceIds: string[];
    requestOwnerUid?: string;
    note?: string;
    branchName?: string;
    location?: string;
    zoneName?: string;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
    try {
        // Get the booking request to build matchroom data
        const request = await convex.query(api.bookings.getRequestById, {
            requestId: input.requestId as Id<"bookingRequests">,
        });

        if (!request) {
            return { ok: false, message: "Booking request not found." };
        }

        if (!input.resourceIds.length) {
            return { ok: false, message: "Select at least one resource." };
        }

        const requestData = request as any;
        const requestOwnerUid = String(requestData.userId || input.requestOwnerUid || "");
        if (!requestOwnerUid) {
            return { ok: false, message: "Request owner missing." };
        }

        const scheduledDate = toDateString(requestData.preferredDate);
        const scheduledTime = toTimeString(requestData.preferredTime);
        const paymentSlots = Number(requestData.paymentReservedSlots || requestData.reservedSlots || 1);
        const paymentAmount = Math.max(0, Number(requestData.budgetPerPlayer || 0) * paymentSlots);

        const matchroomData = {
            hostUid: requestOwnerUid,
            hostName: requestData.userName || "Player",
            game: requestData.gameKey || "unknown",
            title: requestData.title || "Zone Booking",
            description: requestData.description || "Accepted zone booking request",
            maxPlayers: Number(requestData.maxPlayers || requestData.playerCount || 10),
            players: [{
                uid: requestOwnerUid,
                username: requestData.userName || "Player",
                joinedAt: Date.now(),
                role: "Host",
            }],
            playerUids: [requestOwnerUid],
            location: input.location || input.branchName || input.zoneName || "Zone Venue",
            locationMode: "zone" as const,
            scheduledDate,
            scheduledTime,
            durationMinutes: toDurationMinutes(requestData),
            pricing: {
                perPlayer: Number(requestData.budgetPerPlayer || 0),
                currency: requestData.currency || "PKR",
            },
            slotsA: [] as any[],
            slotsB: [] as any[],
            format: requestData.format,
            seriesType: requestData.seriesType || undefined,
            selectedMaps: requestData.selectedMaps || [],
            skillLevel: requestData.skillLevel,
            hostSkillTier: requestData.hostSkillTier ?? "Any",
            hostSkillScore: requestData.hostSkillScore ?? undefined,
            hostSkillContext: requestData.hostSkillContext,
            teamMode: requestData.teamMode,
            teamId: requestData.teamId || undefined,
            reservedSlots: requestData.reservedSlots,
            paymentStatus: (requestData.paymentStatus || "unpaid") as "paid" | "unpaid",
            paymentAmount,
            paymentReservedSlots: paymentSlots,
            paymentCurrency: requestData.currency || "PKR",
            isLocked: requestData.paymentStatus !== "paid",
            zoneAdminApproved: true,
            overs: requestData.overs ? Number(requestData.overs) : undefined,
            durationHours: requestData.durationHours || undefined,
            flexibility: requestData.flexibilityWindow,
        };

        const result = await convex.mutation(api.zoneAdminBooking.acceptBookingRequest, {
            requestId: input.requestId as Id<"bookingRequests">,
            adminUid: input.adminUid,
            zoneId: input.zoneId,
            branchId: input.branchId,
            resourceIds: input.resourceIds as Id<"zoneResources">[],
            requestOwnerUid: input.requestOwnerUid,
            note: input.note,
            branchName: input.branchName,
            location: input.location,
            zoneName: input.zoneName,
            matchroomData,
        });

        return { ok: true };
    } catch (error: any) {
        Logger.error("zoneAdminBooking", "Failed to accept request", error);
        return { ok: false, message: error?.message || "Failed to accept request." };
    }
}

export async function rejectZoneBookingRequest(input: {
    requestId: string;
    adminUid: string;
    zoneId: string;
    requestOwnerUid?: string;
    reason: string;
    note?: string;
    alternative?: string;
}): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
    try {
        await convex.mutation(api.zoneAdminBooking.rejectBookingRequest, {
            requestId: input.requestId as Id<"bookingRequests">,
            adminUid: input.adminUid,
            zoneId: input.zoneId,
            requestOwnerUid: input.requestOwnerUid,
            reason: input.reason,
            note: input.note,
            alternative: input.alternative,
        });

        return { ok: true };
    } catch (error: any) {
        Logger.error("zoneAdminBooking", "Failed to reject request", error);
        return { ok: false, message: error?.message || "Failed to reject request." };
    }
}

export async function sendZoneCounterOffer(input: {
    requestId: string;
    requestOwnerUid: string;
    zoneId: string;
    zoneName: string;
    zoneOwnerUid: string;
    adminUid?: string;
    branchId?: string;
    branchName?: string;
    scheduleOptions: Array<{
        date: string;
        time: string;
    }>;
    pricePerPlayer: number;
    currency?: string;
    location?: string;
    message?: string;
    expiresInMinutes?: number;
}): Promise<{ ok: true; id: string; message?: string } | { ok: false; message: string }> {
    try {
        const offerId = await convex.mutation(api.zoneAdminBooking.sendCounterOffer, {
            requestId: input.requestId as Id<"bookingRequests">,
            requestOwnerUid: input.requestOwnerUid,
            zoneId: input.zoneId as Id<"zones">,
            zoneName: input.zoneName,
            zoneOwnerUid: input.zoneOwnerUid,
            adminUid: input.adminUid,
            branchId: input.branchId,
            branchName: input.branchName,
            scheduleOptions: input.scheduleOptions,
            pricePerPlayer: input.pricePerPlayer,
            currency: input.currency,
            location: input.location,
            message: input.message,
            expiresInMinutes: input.expiresInMinutes,
        });

        return { ok: true, id: offerId };
    } catch (error: any) {
        Logger.error("zoneAdminBooking", "Failed to send counter offer", error);
        return { ok: false, message: error?.message || "Failed to send counter-offer." };
    }
}

export async function respondToZoneCounterOffer(input: {
    offerId: string;
    responderUid: string;
    decision: "accepted" | "rejected";
    selectedOptionIndex?: number;
}): Promise<{ ok: true; matchroomId?: string; locked?: boolean } | { ok: false; message: string }> {
    try {
        const result = await convex.mutation(api.zoneAdminBooking.respondToCounterOffer, {
            offerId: input.offerId as Id<"zoneOffers">,
            responderUid: input.responderUid,
            decision: input.decision,
            selectedOptionIndex: input.selectedOptionIndex,
        });

        return {
            ok: true,
            matchroomId: result?.matchroomId,
            locked: result?.locked === true,
        };
    } catch (error: any) {
        Logger.error("zoneAdminBooking", "Failed to respond to counter offer", error);
        return { ok: false, message: error?.message || "Failed to respond to time options." };
    }
}

export async function createZoneWalkInMatchroom(input: {
    zoneId: string;
    zoneOwnerUid: string;
    branchId?: string | null;
    branchName?: string | null;
    adminUid: string;
    adminName: string;
    gameKey: string;
    title: string;
    scheduledDate: string;
    scheduledTime: string;
    durationMinutes: number;
    seriesType?: string | null;
    seatCount: number;
    bookedSeatCount?: number;
    paymentMode: "venue_pay" | "guest_pay";
    pricePerPlayer?: number;
    currency?: string;
    captainSeatNumber?: number | null;
        knownPlayers?: Array<{
        uid: string;
        username: string;
        skillTier?: "Beginner" | "Casual" | "Intermediate" | "Advanced" | "Pro" | "Elite";
        seatNumber?: number;
        isCaptain?: boolean;
    }>;
}): Promise<{ ok: true; id: string; message?: string } | { ok: false; message: string }> {
    try {
        const knownPlayersRaw = Array.isArray(input.knownPlayers) ? input.knownPlayers : [];
        const totalSeats = Math.max(1, Math.floor(input.seatCount));
        const allowedSkillTiers = new Set(["Beginner", "Casual", "Intermediate", "Advanced", "Pro", "Elite"]);

        const knownPlayers = knownPlayersRaw.slice(0, totalSeats).map((player, index) => {
            const rawTier = String(player?.skillTier || "").trim();
            const normalizedTier = allowedSkillTiers.has(rawTier) ? rawTier : "Beginner";
            return {
                uid: String(player?.uid || `walkin_guest_${index + 1}`),
                username: String(player?.username || "").trim() || `Player ${index + 1}`,
                skillTier: normalizedTier as "Beginner" | "Casual" | "Intermediate" | "Advanced" | "Pro" | "Elite",
                seatNumber: Number.isFinite(player?.seatNumber)
                    ? Math.max(1, Math.floor(Number(player.seatNumber)))
                    : index + 1,
                isCaptain: Boolean(player?.isCaptain),
            };
        });

        const explicitBookedSeatCount = Number.isFinite(input.bookedSeatCount)
            ? Math.max(0, Math.floor(Number(input.bookedSeatCount)))
            : 0;
        const bookedSeatCount = Math.min(
            totalSeats,
            Math.max(knownPlayers.length, explicitBookedSeatCount),
        );

        const pricePerPlayer = Number.isFinite(input.pricePerPlayer)
            ? Math.max(0, Number(input.pricePerPlayer))
            : 0;

        const paymentStatus: "paid" | "unpaid" =
            input.paymentMode === "venue_pay" ? "paid" : "unpaid";
        const isPaymentSuccessful = paymentStatus === "paid";

        const createOpenSlot = (slotId: string) => ({
            slotId,
            status: "open" as const,
            role: "Player",
        });

        const hydrateSlots = (slotsA: any[], slotsB: any[]) => {
            const allSlots = [...slotsA, ...slotsB];
            for (let index = 0; index < allSlots.length; index += 1) {
                const slot = allSlots[index];
                if (index < knownPlayers.length) {
                    const player = knownPlayers[index];
                    slot.status = isPaymentSuccessful ? "confirmed" : "reserved";
                    slot.uid = player.uid;
                    slot.user = {
                        uid: player.uid,
                        username: player.username,
                        skillTier: player.skillTier,
                    };
                    if (!isPaymentSuccessful) {
                        slot.role = "Booked";
                    }
                } else if (index < bookedSeatCount) {
                    slot.status = "reserved";
                    slot.role = "Booked";
                }
            }
            return { slotsA, slotsB };
        };

        const { slotsA, slotsB } = (() => {
            if (totalSeats % 2 !== 0) {
                const localSlotsA = Array.from({ length: totalSeats }, (_, idx) => createOpenSlot(`A${idx + 1}`));
                return hydrateSlots(localSlotsA, []);
            }
            const teamSize = Math.max(1, totalSeats / 2);
            const localSlotsA = Array.from({ length: teamSize }, (_, idx) => createOpenSlot(`A${idx + 1}`));
            const localSlotsB = Array.from({ length: teamSize }, (_, idx) => createOpenSlot(`B${idx + 1}`));
            return hydrateSlots(localSlotsA, localSlotsB);
        })();

        // Determine captains
        const captainsByFlag = knownPlayers.filter((player) => player.isCaptain);
        let captainUidA: string | undefined = undefined;
        let captainUidB: string | undefined = undefined;

        if (captainsByFlag.length > 0) {
            captainsByFlag.forEach(captain => {
                if (!captain.uid) return;
                const inTeamA = slotsA.some((slot: any) => (slot.user?.uid || slot.uid) === captain.uid);
                const inTeamB = slotsB.some((slot: any) => (slot.user?.uid || slot.uid) === captain.uid);
                if (inTeamA) captainUidA = captain.uid;
                if (inTeamB) captainUidB = captain.uid;
            });
        } else {
            const captainSeatByInput = Number.isFinite(input.captainSeatNumber)
                ? Math.max(1, Math.min(totalSeats, Math.floor(Number(input.captainSeatNumber))))
                : null;
            const captainBySeat = captainSeatByInput ? knownPlayers[captainSeatByInput - 1] || null : null;
            const fallbackCaptain = captainBySeat || knownPlayers[0] || null;

            if (fallbackCaptain?.uid) {
                const inTeamA = slotsA.some((slot: any) => (slot.user?.uid || slot.uid) === fallbackCaptain.uid);
                const inTeamB = slotsB.some((slot: any) => (slot.user?.uid || slot.uid) === fallbackCaptain.uid);
                if (inTeamA || slotsB.length === 0) {
                    captainUidA = fallbackCaptain.uid;
                } else if (inTeamB) {
                    captainUidB = fallbackCaptain.uid;
                }
            }
        }

        const players = knownPlayers.map((player) => ({
            uid: player.uid,
            username: player.username,
            joinedAt: Date.now(),
            role: "Player" as const,
        }));

        const walkInData = {
            paymentMode: input.paymentMode,
            seatCount: totalSeats,
            bookedSeatCount,
            knownPlayerCount: knownPlayers.length,
            unknownSeatCount: Math.max(0, totalSeats - knownPlayers.length),
            captainSeatNumber: captainsByFlag[0]?.seatNumber || null,
            captainUid: captainsByFlag[0]?.uid || null,
            roster: knownPlayers.map((player) => ({
                uid: player.uid,
                username: player.username,
                skillTier: player.skillTier,
                seatNumber: player.seatNumber,
                isCaptain: player.isCaptain,
            })),
            branchId: input.branchId || null,
            branchName: input.branchName || null,
            createdBy: input.adminUid,
            createdAt: Date.now(),
        };

        const matchroomId = await convex.mutation(api.zoneAdminBooking.createWalkInMatchroom, {
            zoneId: input.zoneId,
            zoneOwnerUid: input.zoneOwnerUid,
            branchId: input.branchId || undefined,
            branchName: input.branchName || undefined,
            adminUid: input.adminUid,
            adminName: input.adminName,
            gameKey: input.gameKey,
            title: input.title,
            scheduledDate: input.scheduledDate,
            scheduledTime: input.scheduledTime,
            durationMinutes: input.durationMinutes,
            seriesType: input.seriesType || undefined,
            seatCount: totalSeats,
            bookedSeatCount: bookedSeatCount,
            paymentMode: input.paymentMode,
            pricePerPlayer,
            currency: input.currency,
            captainSeatNumber: input.captainSeatNumber ?? undefined,
            knownPlayers: knownPlayers.map((p) => ({
                uid: p.uid,
                username: p.username,
                skillTier: p.skillTier,
                seatNumber: p.seatNumber,
                isCaptain: p.isCaptain,
            })),
            slotsA,
            slotsB,
            captainUidA,
            captainUidB,
            players,
            playerUids: knownPlayers.map((p) => p.uid),
            currentPlayers: bookedSeatCount,
            paymentStatus,
            walkIn: walkInData,
        });

        return { ok: true, id: matchroomId };
    } catch (error: any) {
        Logger.error("zoneAdminBooking", "Failed to create walk-in matchroom", error);
        return { ok: false, message: error?.message || "Failed to create walk-in booking." };
    }
}
