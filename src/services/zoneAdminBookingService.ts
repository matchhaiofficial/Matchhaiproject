import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";

import { db } from "../config/firebaseConfig";
import { createMatchroom, type Matchroom } from "./matchService";
import Logger from "../utils/logger";

export type ZoneBookingAssetType = "pc" | "court" | "mixed" | "unknown";
export type ZoneBookingQueueStatus =
    | "open"
    | "pending_payment"
    | "accepted"
    | "expired"
    | "cancelled";

export interface ZoneBookingQueueItem {
    id: string;
    userId: string;
    userName: string;
    title: string;
    gameKey: string;
    maxPlayers: number;
    reservedSlots?: number;
    teamMode?: "solo" | "team";
    preferredDate?: any;
    preferredTime?: string;
    preferredAreas: string[];
    budgetPerPlayer?: number;
    currency?: string;
    status: ZoneBookingQueueStatus | string;
    paymentStatus?: "paid" | "unpaid" | string;
    locationMode?: "zone" | "broadcast" | string;
    zoneId?: string;
    lifecycleStatus?: string;
    createdAt?: any;
    updatedAt?: any;
    assetType: ZoneBookingAssetType;
    priorityFlags: string[];
    raw: Record<string, any>;
}

export interface ZoneMatchroomListItem {
    id: string;
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
}

interface BookingRequestDoc {
    id: string;
    data: Record<string, any>;
}

const ACTIVE_QUEUE_STATUSES = new Set([
    "open",
    "pending_payment",
    "accepted",
]);

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

const toDateString = (value: any) => {
    if (!value) return undefined;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length >= 8) return trimmed;
    }
    const millis = toMillis(value);
    if (!millis) return undefined;
    return new Date(millis).toISOString().slice(0, 10);
};

const toTimeString = (value: any) => {
    if (!value) return undefined;
    if (typeof value === "string") return value.trim();
    const millis = toMillis(value);
    if (!millis) return undefined;
    return new Date(millis).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    if (gameKey === "cs2") {
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

const normalizeGameKey = (value: unknown) =>
    String(value || "").trim().toLowerCase();

const computeAssetTypeFromGame = (gameKey: string): ZoneBookingAssetType => {
    if (["cs2", "fc25", "fc26", "tekken8"].includes(gameKey)) return "pc";
    if (["futsal", "indoor_cricket", "padel", "pickleball"].includes(gameKey)) return "court";
    return "unknown";
};

const parseRequestDateTime = (request: Record<string, any>) => {
    const preferredDate = request.preferredDate;
    const preferredTime = String(request.preferredTime || "").trim();
    if (!preferredDate || !preferredTime) return null;

    const date = new Date(
        preferredDate?.seconds
            ? preferredDate.seconds * 1000
            : preferredDate,
    );
    if (Number.isNaN(date.getTime())) return null;

    const timeMatch = preferredTime.match(/^(\d{1,2}):(\d{2})/);
    if (!timeMatch) return null;

    const hours = Number.parseInt(timeMatch[1], 10);
    const minutes = Number.parseInt(timeMatch[2], 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

    date.setHours(hours, minutes, 0, 0);
    return date;
};

const computePriorityFlags = (request: Record<string, any>) => {
    const flags: string[] = [];

    if ((request.budgetPerPlayer || 0) >= 1500) {
        flags.push("high_value");
    }
    if (request.teamMode === "team" && (request.reservedSlots || 1) > 1) {
        flags.push("recurring");
    }
    if (request.isVipRequest === true || request.priority === "vip") {
        flags.push("vip");
    }

    const startsAt = parseRequestDateTime(request);
    if (startsAt) {
        const deltaMs = startsAt.getTime() - Date.now();
        if (deltaMs > 0 && deltaMs <= 2 * 60 * 60 * 1000) {
            flags.push("starting_soon");
        }
    }

    return flags;
};

const normalizeBookingRequest = ({ id, data }: BookingRequestDoc): ZoneBookingQueueItem => {
    const gameKey = normalizeGameKey(data.gameKey);

    return {
        id,
        userId: data.userId || "",
        userName: data.userName || "Player",
        title: data.title || "Booking Request",
        gameKey,
        maxPlayers: Number(data.maxPlayers || 0),
        reservedSlots: Number(data.reservedSlots || 0) || undefined,
        teamMode: data.teamMode,
        preferredDate: data.preferredDate,
        preferredTime: data.preferredTime,
        preferredAreas: Array.isArray(data.preferredAreas) ? data.preferredAreas : [],
        budgetPerPlayer: Number(data.budgetPerPlayer || 0) || undefined,
        currency: data.currency || "PKR",
        status: data.status || "open",
        paymentStatus: data.paymentStatus || "unpaid",
        locationMode: data.locationMode,
        zoneId: data.zoneId,
        lifecycleStatus: data.lifecycleStatus,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        assetType: computeAssetTypeFromGame(gameKey),
        priorityFlags: computePriorityFlags(data),
        raw: data,
    };
};

const mergeAndSortDocs = (
    areaDocs: Record<string, BookingRequestDoc>,
    directDocs: Record<string, BookingRequestDoc>,
) => {
    const merged = new Map<string, BookingRequestDoc>();
    Object.values(areaDocs).forEach((item) => merged.set(item.id, item));
    Object.values(directDocs).forEach((item) => merged.set(item.id, item));

    return Array.from(merged.values())
        .map(normalizeBookingRequest)
        .filter((item) => ACTIVE_QUEUE_STATUSES.has(item.status))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export function subscribeZoneBookingQueue(
    zoneId: string,
    branchAreas: string[],
    onData: (rows: ZoneBookingQueueItem[]) => void,
    onError: (error: any) => void,
) {
    const normalizedAreas = Array.from(
        new Set(
            (branchAreas || [])
                .map((area) => String(area || "").trim())
                .filter(Boolean),
        ),
    ).slice(0, 10);

    const unsubscribers: Array<() => void> = [];
    let areaDocs: Record<string, BookingRequestDoc> = {};
    let directDocs: Record<string, BookingRequestDoc> = {};

    const emit = () => {
        onData(mergeAndSortDocs(areaDocs, directDocs));
    };

    if (normalizedAreas.length > 0) {
        const byArea = query(
            collection(db, "booking_requests"),
            where("preferredAreas", "array-contains-any", normalizedAreas),
        );

        unsubscribers.push(
            onSnapshot(
                byArea,
                (snapshot: any) => {
                    const next: Record<string, BookingRequestDoc> = {};
                    snapshot.docs.forEach((item: any) => {
                        next[item.id] = { id: item.id, data: item.data() as Record<string, any> };
                    });
                    areaDocs = next;
                    emit();
                },
                (error: any) => {
                    if (error?.code === "permission-denied") {
                        Logger.warn("zoneAdminBooking", "Queue listener (area) permission denied");
                    } else {
                        Logger.error("zoneAdminBooking", "Queue listener (area) failed", error);
                    }
                    onError(error);
                },
            ),
        );
    }

    const byDirectZone = query(
        collection(db, "booking_requests"),
        where("zoneId", "==", zoneId),
    );

    unsubscribers.push(
        onSnapshot(
            byDirectZone,
            (snapshot: any) => {
                const next: Record<string, BookingRequestDoc> = {};
                snapshot.docs.forEach((item: any) => {
                    next[item.id] = { id: item.id, data: item.data() as Record<string, any> };
                });
                directDocs = next;
                emit();
            },
            (error: any) => {
                if (error?.code === "permission-denied") {
                    Logger.warn("zoneAdminBooking", "Queue listener (direct) permission denied");
                } else {
                    Logger.error("zoneAdminBooking", "Queue listener (direct) failed", error);
                }
                onError(error);
            },
        ),
    );

    if (normalizedAreas.length === 0) {
        emit();
    }

    return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
}

export function subscribeZoneMatchrooms(
    zoneId: string,
    ownerUid: string | undefined,
    onData: (rows: ZoneMatchroomListItem[]) => void,
    onError: (error: any) => void,
    options?: {
        locationHints?: string[];
    },
) {
    const unsubscribers: Array<() => void> = [];
    let byZoneDocs: Record<string, Record<string, any>> = {};
    let byOwnerDocs: Record<string, Record<string, any>> = {};
    let byLocationDocs: Record<string, Record<string, any>> = {};

    const emit = () => {
        const merged = new Map<string, Record<string, any>>();
        Object.values(byZoneDocs).forEach((item: any) => merged.set(item.id, item));
        Object.values(byOwnerDocs).forEach((item: any) => merged.set(item.id, item));
        Object.values(byLocationDocs).forEach((item: any) => merged.set(item.id, item));

        const rows = Array.from(merged.values())
            .map((row: any) => {
                const data = row.data as Record<string, any>;
                const perPlayer = Number(data.pricing?.perPlayer ?? data.pricePerPlayer ?? 0);
                const playersForAmount = Number(data.currentPlayers || data.maxPlayers || 0);
                const fallbackTotal = perPlayer > 0 && playersForAmount > 0 ? perPlayer * playersForAmount : 0;
                const totalAmountRaw = Number(data.pricing?.total ?? data.totalAmount ?? fallbackTotal ?? 0);
                const durationMinutesRaw = Number(
                    data.durationMinutes ??
                    ((Number(data.durationHours || 0) > 0 ? Number(data.durationHours) * 60 : 0)),
                );
                return {
                    id: row.id,
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
                    branchId: data.branchId || data.allocationSnapshot?.branchId || data.walkIn?.branchId || null,
                    durationMinutes: Number.isFinite(durationMinutesRaw) ? durationMinutesRaw : 0,
                    pricePerPlayer: Number.isFinite(perPlayer) ? perPlayer : 0,
                    totalAmount: Number.isFinite(totalAmountRaw) ? totalAmountRaw : 0,
                    currency: data.pricing?.currency || data.currency || "PKR",
                    zoneId: data.zoneId || null,
                    zoneOwnerUid: data.zoneOwnerUid || null,
                    createdAt: data.createdAt,
                } as ZoneMatchroomListItem;
            })
            .sort((a: ZoneMatchroomListItem, b: ZoneMatchroomListItem) => toMillis(b.createdAt) - toMillis(a.createdAt));
        onData(rows);
    };

    const byZoneQuery = query(
        collection(db, "matchrooms"),
        where("zoneId", "==", zoneId),
    );
    unsubscribers.push(
        onSnapshot(
            byZoneQuery,
            (snapshot: any) => {
                const next: Record<string, Record<string, any>> = {};
                snapshot.docs.forEach((item: any) => {
                    next[item.id] = { id: item.id, data: item.data() as Record<string, any> };
                });
                byZoneDocs = next;
                emit();
            },
            (error: any) => {
                if (error?.code !== "permission-denied") {
                    Logger.error("zoneAdminBooking", "Matchroom listener (zoneId) failed", error);
                }
                onError(error);
            },
        ),
    );

    if (ownerUid) {
        const byOwnerQuery = query(
            collection(db, "matchrooms"),
            where("zoneOwnerUid", "==", ownerUid),
        );
        unsubscribers.push(
            onSnapshot(
                byOwnerQuery,
                (snapshot: any) => {
                    const next: Record<string, Record<string, any>> = {};
                    snapshot.docs.forEach((item: any) => {
                        next[item.id] = { id: item.id, data: item.data() as Record<string, any> };
                    });
                    byOwnerDocs = next;
                    emit();
                },
                (error: any) => {
                    if (error?.code !== "permission-denied") {
                        Logger.error("zoneAdminBooking", "Matchroom listener (ownerUid) failed", error);
                    }
                },
            ),
        );
    } else {
        emit();
    }

    const locationHints = Array.from(
        new Set(
            (options?.locationHints || [])
                .map((value) => String(value || "").trim())
                .filter(Boolean),
        ),
    ).slice(0, 10);

    if (locationHints.length > 0) {
        const byLocationQuery = query(
            collection(db, "matchrooms"),
            where("location", "in", locationHints),
        );
        unsubscribers.push(
            onSnapshot(
                byLocationQuery,
                (snapshot: any) => {
                    const next: Record<string, Record<string, any>> = {};
                    snapshot.docs.forEach((item: any) => {
                        next[item.id] = { id: item.id, data: item.data() as Record<string, any> };
                    });
                    byLocationDocs = next;
                    emit();
                },
                (error: any) => {
                    if (error?.code !== "permission-denied") {
                        Logger.error("zoneAdminBooking", "Matchroom listener (location) failed", error);
                    }
                },
            ),
        );
    }

    return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
}

export async function acceptZoneBookingRequest(input: {
    requestId: string;
    adminUid: string;
    zoneId: string;
    requestOwnerUid?: string;
    note?: string;
    branchId?: string;
    branchName?: string;
    location?: string;
    zoneName?: string;
}) {
    try {
        const requestSnap = await getDoc(doc(db, "booking_requests", input.requestId));
        if (!requestSnap.exists()) {
            return { ok: false as const, message: "Booking request not found." };
        }

        const request = requestSnap.data() as Record<string, any>;
        const requestOwnerUid = request.userId || input.requestOwnerUid;
        if (!requestOwnerUid) {
            return { ok: false as const, message: "Request owner missing." };
        }
        const scheduledDate = toDateString(request.preferredDate);
        const scheduledTime = toTimeString(request.preferredTime);
        const paymentSlots = Number(request.paymentReservedSlots || request.reservedSlots || 1);
        const paymentAmount = Math.max(0, Number(request.budgetPerPlayer || 0) * paymentSlots);

        const matchroomData: Matchroom = {
            hostUid: requestOwnerUid,
            hostName: request.userName || "Player",
            game: request.gameKey || "unknown",
            title: request.title || "Zone Booking",
            description: request.description || "Accepted zone booking request",
            status: "open",
            maxPlayers: Number(request.maxPlayers || 10),
            currentPlayers: 1,
            players: [{
                uid: requestOwnerUid,
                username: request.userName || "Player",
                joinedAt: new Date(),
                role: "Host",
            }],
            playerUids: [requestOwnerUid],
            createdAt: new Date(),
            locationMode: "zone",
            zoneId: input.zoneId,
            location: input.location || input.branchName || input.zoneName || request.preferredAreas?.[0] || "Zone Venue",
            scheduledDate,
            scheduledTime,
            durationMinutes: toDurationMinutes(request),
            pricing: {
                perPlayer: Number(request.budgetPerPlayer || 0),
                currency: request.currency || "PKR",
            },
            format: request.format,
            seriesType: request.seriesType || null,
            durationHours: request.durationHours || null,
            selectedMaps: request.selectedMaps || [],
            skillLevel: request.skillLevel,
            hostSkillScore: request.hostSkillScore ?? null,
            hostSkillTier: request.hostSkillTier ?? "Any",
            hostSkillContext: request.hostSkillContext,
            overs: request.overs ? Number(request.overs) : null,
            teamMode: request.teamMode,
            teamId: request.teamId || null,
            reservedSlots: request.reservedSlots,
            flexibility: request.flexibilityWindow,
            paymentStatus: request.paymentStatus || "unpaid",
            paymentAmount,
            paymentReservedSlots: paymentSlots,
            paymentCurrency: request.currency || "PKR",
            isLocked: request.paymentStatus !== "paid",
            zoneAdminApproved: true,
            slotsA: [],
            slotsB: [],
        };

        const matchroomResult = await createMatchroom(matchroomData);
        if (!matchroomResult.ok) {
            return { ok: false as const, message: matchroomResult.message || "Failed to create matchroom." };
        }

        await updateDoc(doc(db, "booking_requests", input.requestId), {
            status: "accepted",
            lifecycleStatus: "confirmed",
            matchroomId: matchroomResult.id,
            decision: {
                type: "accepted",
                note: input.note || null,
                zoneId: input.zoneId,
                branchId: input.branchId || null,
                adminUid: input.adminUid,
                decidedAt: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
        });
        if (input.requestOwnerUid) {
            await addDoc(collection(db, "notifications"), {
                type: "booking_request_accepted",
                fromUid: input.adminUid,
                toUid: input.requestOwnerUid,
                status: "pending",
                createdAt: serverTimestamp(),
                title: "Booking request accepted",
                message: "Your booking request was accepted by the venue.",
                meta: {
                    requestId: input.requestId,
                    zoneId: input.zoneId,
                    branchId: input.branchId || null,
                    matchroomId: matchroomResult.id,
                },
            });
        }
        return { ok: true as const };
    } catch (error: any) {
        Logger.error("zoneAdminBooking", "Failed to accept request", error);
        return { ok: false as const, message: error?.message || "Failed to accept request." };
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
}) {
    try {
        await updateDoc(doc(db, "booking_requests", input.requestId), {
            status: "cancelled",
            lifecycleStatus: "closed",
            decision: {
                type: "rejected",
                reason: input.reason,
                note: input.note || null,
                alternative: input.alternative || null,
                zoneId: input.zoneId,
                adminUid: input.adminUid,
                decidedAt: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
        });
        if (input.requestOwnerUid) {
            await addDoc(collection(db, "notifications"), {
                type: "booking_request_rejected",
                fromUid: input.adminUid,
                toUid: input.requestOwnerUid,
                status: "pending",
                createdAt: serverTimestamp(),
                title: "Booking request declined",
                message: input.alternative
                    ? `Reason: ${input.reason}. Alternative: ${input.alternative}`
                    : `Reason: ${input.reason}`,
                meta: {
                    requestId: input.requestId,
                    zoneId: input.zoneId,
                },
            });
        }
        return { ok: true as const };
    } catch (error: any) {
        Logger.error("zoneAdminBooking", "Failed to reject request", error);
        return { ok: false as const, message: error?.message || "Failed to reject request." };
    }
}

export async function sendZoneCounterOffer(input: {
    requestId: string;
    requestOwnerUid: string;
    zoneId: string;
    zoneName: string;
    zoneOwnerUid: string;
    branchId?: string;
    branchName?: string;
    proposedDate: string;
    proposedTime: string;
    pricePerPlayer: number;
    currency?: string;
    location?: string;
    message?: string;
    expiresInMinutes?: number;
}) {
    try {
        const expiresInMinutes = Math.max(1, Math.min(120, input.expiresInMinutes || 10));
        const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

        await addDoc(collection(db, "booking_offers"), {
            requestId: input.requestId,
            requestOwnerUid: input.requestOwnerUid,
            zoneId: input.zoneId,
            zoneName: input.zoneName,
            zoneOwnerUid: input.zoneOwnerUid,
            zoneAdminId: input.zoneOwnerUid,
            branchId: input.branchId || null,
            branchName: input.branchName || null,
            proposedDate: input.proposedDate,
            proposedTime: input.proposedTime,
            pricePerPlayer: input.pricePerPlayer,
            currency: input.currency || "PKR",
            location: input.location || "",
            message: input.message || "",
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            expiresAt,
        });

        await updateDoc(doc(db, "booking_requests", input.requestId), {
            lifecycleStatus: "offer_sent",
            latestCounterOfferAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        await addDoc(collection(db, "notifications"), {
            type: "booking_counter_offer",
            fromUid: input.zoneOwnerUid,
            toUid: input.requestOwnerUid,
            status: "pending",
            createdAt: serverTimestamp(),
            title: "Counter-offer received",
            message: `New offer: ${input.currency || "PKR"} ${input.pricePerPlayer} per player`,
            meta: {
                requestId: input.requestId,
                zoneId: input.zoneId,
                proposedDate: input.proposedDate,
                proposedTime: input.proposedTime,
                branchId: input.branchId || null,
            },
        });

        return { ok: true as const };
    } catch (error: any) {
        Logger.error("zoneAdminBooking", "Failed to send counter offer", error);
        return { ok: false as const, message: error?.message || "Failed to send counter-offer." };
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
    seatCount: number;
    paymentMode: "venue_pay" | "guest_pay" | "mixed";
    pricePerPlayer?: number;
    currency?: string;
    knownPlayers?: Array<{ uid: string; username: string }>;
}) {
    try {
        const knownPlayers = Array.isArray(input.knownPlayers) ? input.knownPlayers : [];
        const pricePerPlayer = Number.isFinite(input.pricePerPlayer)
            ? Math.max(0, Number(input.pricePerPlayer))
            : 0;

        const paymentStatus =
            input.paymentMode === "venue_pay"
                ? "paid"
                : input.paymentMode === "mixed"
                    ? "partial"
                    : "unpaid";

        const created = await addDoc(collection(db, "matchrooms"), {
            hostUid: input.adminUid,
            hostName: input.adminName || "Zone Admin",
            game: input.gameKey,
            title: input.title.trim() || "Walk-in Matchroom",
            description: "Created from admin walk-in flow",
            status: "open",
            bookingSource: "walkin",
            maxPlayers: Math.max(1, Math.floor(input.seatCount)),
            currentPlayers: knownPlayers.length,
            players: knownPlayers.map((player) => ({
                uid: player.uid,
                username: player.username,
                joinedAt: serverTimestamp(),
                role: "Player",
            })),
            playerUids: knownPlayers.map((player) => player.uid),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            locationMode: "zone",
            zoneId: input.zoneId,
            zoneOwnerUid: input.zoneOwnerUid,
            scheduledDate: input.scheduledDate,
            scheduledTime: input.scheduledTime,
            durationMinutes: Math.max(30, Math.floor(input.durationMinutes)),
            pricing: {
                perPlayer: pricePerPlayer,
                currency: input.currency || "PKR",
            },
            paymentStatus,
            walkIn: {
                paymentMode: input.paymentMode,
                seatCount: Math.max(1, Math.floor(input.seatCount)),
                knownPlayerCount: knownPlayers.length,
                unknownSeatCount: Math.max(0, Math.floor(input.seatCount) - knownPlayers.length),
                branchId: input.branchId || null,
                branchName: input.branchName || null,
                createdBy: input.adminUid,
                createdAt: serverTimestamp(),
            },
        });

        return { ok: true as const, id: created.id };
    } catch (error: any) {
        Logger.error("zoneAdminBooking", "Failed to create walk-in matchroom", error);
        return { ok: false as const, message: error?.message || "Failed to create walk-in booking." };
    }
}
