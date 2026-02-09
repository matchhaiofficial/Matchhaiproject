// src/services/bookingRequestService.ts
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import Logger from '../utils/logger';

export interface BookingRequest {
    id?: string;
    userId: string;
    userName: string;
    gameKey: string;
    title: string;
    description?: string;

    // Match details
    maxPlayers: number;
    format?: string;
    seriesType?: string | null;
    durationHours?: number | null;
    selectedMaps?: string[];
    skillLevel?: string;
    overs?: string | null;

    // Skill Info (placeholder for routing / matching)
    hostSkillScore?: number | null;
    hostSkillTier?: string | null;
    hostSkillContext?: {
        gameKey: string;
        answers: Record<string, any>;
    };

    // Team details (if team mode)
    teamMode: 'team' | 'solo';
    teamId?: string | null;
    reservedSlots?: number;

    // Timing & Flexibility
    preferredDate?: any;
    preferredTime?: string;
    flexibilityWindow: string; // "Exact time" | "Within 2hrs" | "Within 4hrs" | "Anytime today"

    // Location
    locationMode?: 'zone' | 'broadcast';
    zoneId?: string;
    preferredAreas: string[]; // From user profile

    // Pricing
    budgetPerPlayer?: number;
    currency: string;

    // Status
    status: 'open' | 'pending_payment' | 'accepted' | 'expired' | 'cancelled';
    acceptedOfferId?: string;

    // Payment placeholder (production)
    paymentStatus?: 'paid' | 'unpaid';
    paymentAmount?: number;
    paymentReservedSlots?: number;

    createdAt: any;
    expiresAt?: any;
}

export interface ZoneOffer {
    id?: string;
    requestId: string;
    requestOwnerUid: string;
    zoneId: string;
    zoneName: string;
    zoneOwnerUid: string;
    zoneAdminId?: string; // legacy alias (kept for backward compatibility)
    branchId?: string;
    branchName?: string;

    // Offer details
    proposedDate: any;
    proposedTime: string;
    pricePerPlayer: number;
    currency: string;
    location: string;

    // Additional info
    message?: string;

    // Status
    status: 'pending' | 'accepted' | 'rejected';

    createdAt: any;
    updatedAt?: any;
}

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    return 0;
};

const normalizeZoneOffer = (id: string, data: any): ZoneOffer => {
    const zoneOwnerUid = data.zoneOwnerUid || data.zoneAdminId || '';
    return {
        id,
        requestId: data.requestId,
        requestOwnerUid: data.requestOwnerUid || '',
        zoneId: data.zoneId,
        zoneName: data.zoneName,
        zoneOwnerUid,
        zoneAdminId: data.zoneAdminId || zoneOwnerUid || undefined,
        branchId: data.branchId,
        branchName: data.branchName,
        proposedDate: data.proposedDate,
        proposedTime: data.proposedTime,
        pricePerPlayer: data.pricePerPlayer,
        currency: data.currency,
        location: data.location,
        message: data.message,
        status: data.status || 'pending',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
};

const chunk = <T,>(arr: T[], size: number) => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
};

const toAreaChunks = (areas: string[]) =>
    chunk(
        Array.from(
            new Set(
                (areas || [])
                    .map((area) => String(area || "").trim())
                    .filter(Boolean),
            ),
        ),
        10,
    );

const bookingAssetTypeFromGame = (gameKey: string) => {
    const key = String(gameKey || "").toLowerCase();
    if (["cs2", "fc25", "fc26", "tekken8"].includes(key)) return "pc";
    if (["futsal", "indoor_cricket", "padel", "pickleball"].includes(key)) return "court";
    return "mixed";
};

const createAdminBookingNotifications = async (
    requestId: string,
    requestData: Omit<BookingRequest, 'id' | 'createdAt' | 'status'> & { status?: BookingRequest['status'] },
) => {
    const targetOwnerUids = new Set<string>();
    const preferredAreas = Array.isArray(requestData.preferredAreas) ? requestData.preferredAreas : [];

    if (requestData.zoneId) {
        try {
            const zoneSnap = await getDoc(doc(db, "zones", requestData.zoneId));
            if (zoneSnap.exists()) {
                const ownerUid = zoneSnap.data()?.ownerUid;
                if (ownerUid) targetOwnerUids.add(ownerUid);
            }
        } catch {
            // Ignore and continue area-based matching.
        }
    }

    const areaChunks = toAreaChunks(preferredAreas);
    for (const areaChunk of areaChunks) {
        try {
            const zonesQuery = query(
                collection(db, "zones"),
                where("status", "==", "active"),
                where("primaryBranch.areaLabel", "in", areaChunk),
            );
            const zoneSnap = await getDocs(zonesQuery);
            zoneSnap.docs.forEach((zoneDoc: any) => {
                const ownerUid = zoneDoc.data()?.ownerUid;
                if (ownerUid) targetOwnerUids.add(ownerUid);
            });
        } catch (error) {
            Logger.warn("bookingRequestService", "Area notification lookup failed", {
                areas: areaChunk,
                error: (error as any)?.message || "query_error",
            });
        }
    }

    const ownerUids = Array.from(targetOwnerUids).filter((uid) => uid && uid !== requestData.userId);
    if (!ownerUids.length) return;

    await Promise.all(
        ownerUids.map(async (ownerUid) => {
            const notificationId = `admin_booking_request_${requestId}_${ownerUid}`;
            await setDoc(doc(db, "notifications", notificationId), {
                type: "admin_booking_request",
                fromUid: requestData.userId,
                fromUsername: requestData.userName || "Player",
                toUid: ownerUid,
                status: "pending",
                title: requestData.title || "New booking request",
                message: `${requestData.userName || "Player"} requested ${requestData.gameKey}`,
                createdAt: serverTimestamp(),
                meta: {
                    requestId,
                    gameKey: requestData.gameKey,
                    assetType: bookingAssetTypeFromGame(requestData.gameKey),
                    preferredAreas,
                    preferredDate: requestData.preferredDate || null,
                    preferredTime: requestData.preferredTime || null,
                    budgetPerPlayer: requestData.budgetPerPlayer || null,
                },
            }, { merge: true });
        }),
    );
};

/**
 * Create a new booking request (broadcast mode)
 */
export const createBookingRequest = async (
    data: Omit<BookingRequest, 'id' | 'createdAt' | 'status'>,
    options?: { status?: BookingRequest['status'] }
): Promise<{ ok: boolean; id?: string; message?: string }> => {
    try {
        const requestData = {
            ...data,
            status: (options?.status || 'open') as BookingRequest['status'],
            createdAt: serverTimestamp(),
            expiresAt: serverTimestamp(), // TODO: Add 24hrs or configurable expiry
        };

        const docRef = await addDoc(collection(db, 'booking_requests'), requestData);
        if (requestData.status === 'open') {
            await createAdminBookingNotifications(docRef.id, requestData);
        }
        Logger.info('bookingRequestService', 'Created booking request', { id: docRef.id });

        return { ok: true, id: docRef.id };
    } catch (error) {
        Logger.error('bookingRequestService', 'Error creating booking request', error);
        return { ok: false, message: 'Failed to create booking request' };
    }
};

/**
 * Get booking requests for zone admin (matching their areas)
 */
export const getRequestsForZoneAdmin = async (
    zoneAreas: string[]
): Promise<{ ok: boolean; data?: BookingRequest[]; message?: string }> => {
    try {
        // Get all open requests
        const q = query(
            collection(db, 'booking_requests'),
            where('status', '==', 'open')
        );

        const snapshot = await getDocs(q);
        const allRequests = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
        } as BookingRequest));

        // Filter in-memory for requests matching zone areas
        const matchingRequests = allRequests.filter((request: BookingRequest) =>
            request.preferredAreas.some((area: string) => zoneAreas.includes(area))
        );

        return { ok: true, data: matchingRequests };
    } catch (error) {
        Logger.error('bookingRequestService', 'Error fetching requests for zone', error);
        return { ok: false, message: 'Failed to fetch requests' };
    }
};

/**
 * Get all requests created by a user
 */
export const getUserRequests = async (
    userId: string
): Promise<{ ok: boolean; data?: BookingRequest[]; message?: string }> => {
    try {
        const q = query(
            collection(db, 'booking_requests'),
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);
        const toMillis = (value: any) => {
            if (!value) return 0;
            if (typeof value?.toMillis === 'function') return value.toMillis();
            if (typeof value?.seconds === 'number') return value.seconds * 1000;
            if (value instanceof Date) return value.getTime();
            if (typeof value === 'number') return value;
            return 0;
        };

        const requests = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
        } as BookingRequest)).sort((a: BookingRequest, b: BookingRequest) => toMillis(b.createdAt) - toMillis(a.createdAt));

        return { ok: true, data: requests };
    } catch (error) {
        Logger.error('bookingRequestService', 'Error fetching user requests', error);
        return { ok: false, message: 'Failed to fetch your requests' };
    }
};

/**
 * Create an offer for a booking request (zone admin)
 */
export const createZoneOffer = async (
    data: Omit<ZoneOffer, 'id' | 'createdAt' | 'status'>
): Promise<{ ok: boolean; id?: string; message?: string }> => {
    try {
        const zoneOwnerUid = data.zoneOwnerUid || data.zoneAdminId;
        if (!zoneOwnerUid) {
            return { ok: false, message: 'Missing zone owner for this offer' };
        }
        if (!data.requestOwnerUid) {
            return { ok: false, message: 'Missing request owner for this offer' };
        }

        const offerData = {
            ...data,
            zoneOwnerUid,
            zoneAdminId: data.zoneAdminId || zoneOwnerUid, // keep legacy field for old readers
            status: 'pending' as const,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, 'booking_offers'), offerData);
        Logger.info('bookingRequestService', 'Created zone offer', { id: docRef.id });

        return { ok: true, id: docRef.id };
    } catch (error) {
        Logger.error('bookingRequestService', 'Error creating offer', error);
        return { ok: false, message: 'Failed to create offer' };
    }
};

/**
 * Get all offers for a specific booking request
 */
export const getOffersForRequest = async (
    requestId: string
): Promise<{ ok: boolean; data?: ZoneOffer[]; message?: string }> => {
    try {
        const q = query(
            collection(db, 'booking_offers'),
            where('requestId', '==', requestId)
        );

        const snapshot = await getDocs(q);
        const offers = snapshot.docs
            .map((docSnap: any) => normalizeZoneOffer(docSnap.id, docSnap.data()))
            .sort((a: ZoneOffer, b: ZoneOffer) => toMillis(b.createdAt) - toMillis(a.createdAt));

        return { ok: true, data: offers };
    } catch (error) {
        Logger.error('bookingRequestService', 'Error fetching offers', error);
        return { ok: false, message: 'Failed to fetch offers' };
    }
};

/**
 * Get all offers visible to a requesting player.
 * Phase 1 contract fallback:
 * - primary: requestOwnerUid
 * - fallback: offers linked to player's own requestIds (legacy docs may not have requestOwnerUid)
 */
export const getOffersForUser = async (
    userId: string
): Promise<{ ok: boolean; data?: ZoneOffer[]; message?: string }> => {
    try {
        const offersById = new Map<string, ZoneOffer>();

        const directQuery = query(
            collection(db, 'booking_offers'),
            where('requestOwnerUid', '==', userId)
        );
        const directSnap = await getDocs(directQuery);
        directSnap.docs.forEach((docSnap: any) => {
            offersById.set(docSnap.id, normalizeZoneOffer(docSnap.id, docSnap.data()));
        });

        const requestsResult = await getUserRequests(userId);
        const requestIds = (requestsResult.ok && requestsResult.data)
            ? requestsResult.data.map((r) => r.id).filter(Boolean) as string[]
            : [];

        if (requestIds.length > 0) {
            const idChunks = chunk(Array.from(new Set(requestIds)), 10);
            const chunkSnaps = await Promise.all(
                idChunks.map((ids) => getDocs(query(
                    collection(db, 'booking_offers'),
                    where('requestId', 'in', ids)
                )))
            );

            chunkSnaps.forEach((snap) => {
                snap.docs.forEach((docSnap: any) => {
                    const normalized = normalizeZoneOffer(docSnap.id, docSnap.data());
                    if (!normalized.requestOwnerUid) {
                        normalized.requestOwnerUid = userId;
                    }
                    offersById.set(docSnap.id, normalized);
                });
            });
        }

        const offers = Array.from(offersById.values())
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

        return { ok: true, data: offers };
    } catch (error) {
        Logger.error('bookingRequestService', 'Error fetching user offers', error);
        return { ok: false, message: 'Failed to fetch your offers' };
    }
};

/**
 * Accept a zone offer and create matchroom
 */
export const acceptOffer = async (
    offerId: string,
    requestId: string
): Promise<{ ok: boolean; matchroomId?: string; message?: string }> => {
    try {
        // Update offer status
        const offerRef = doc(db, 'booking_offers', offerId);
        await updateDoc(offerRef, {
            status: 'accepted',
            updatedAt: serverTimestamp(),
        });

        // Update request status
        const requestRef = doc(db, 'booking_requests', requestId);
        await updateDoc(requestRef, {
            status: 'accepted',
            acceptedOfferId: offerId,
            updatedAt: serverTimestamp(),
        });

        // TODO: Reject all other offers for this request
        const offersResult = await getOffersForRequest(requestId);
        if (offersResult.ok && offersResult.data) {
            const otherOffers = offersResult.data.filter(o => o.id !== offerId);
            await Promise.all(
                otherOffers.map(offer =>
                    updateDoc(doc(db, 'booking_offers', offer.id!), {
                        status: 'rejected',
                        updatedAt: serverTimestamp(),
                    })
                )
            );
        }

        // TODO: Create matchroom from accepted offer
        // This would call createMatchroom() with data from request + accepted offer
        // For MVP, returning success - actual matchroom creation can be done separately

        Logger.info('bookingRequestService', 'Accepted offer', { offerId, requestId });
        return { ok: true };
    } catch (error) {
        Logger.error('bookingRequestService', 'Error accepting offer', error);
        return { ok: false, message: 'Failed to accept offer' };
    }
};
