// src/services/bookingRequestService.ts
import {
    addDoc,
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
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
    selectedMaps?: string[];
    skillLevel?: string;

    // Team details (if team mode)
    teamMode: 'team' | 'solo';
    teamId?: string | null;
    reservedSlots?: number;

    // Timing & Flexibility
    preferredDate?: any;
    preferredTime?: string;
    flexibilityWindow: string; // "Exact time" | "Within 2hrs" | "Within 4hrs" | "Anytime today"

    // Location
    preferredAreas: string[]; // From user profile

    // Pricing
    budgetPerPlayer?: number;
    currency: string;

    // Status
    status: 'open' | 'accepted' | 'expired' | 'cancelled';
    acceptedOfferId?: string;

    createdAt: any;
    expiresAt?: any;
}

export interface ZoneOffer {
    id?: string;
    requestId: string;
    zoneId: string;
    zoneName: string;
    zoneAdminId: string;
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
}

/**
 * Create a new booking request (broadcast mode)
 */
export const createBookingRequest = async (
    data: Omit<BookingRequest, 'id' | 'createdAt' | 'status'>
): Promise<{ ok: boolean; id?: string; message?: string }> => {
    try {
        const requestData = {
            ...data,
            status: 'open' as const,
            createdAt: serverTimestamp(),
            expiresAt: serverTimestamp(), // TODO: Add 24hrs or configurable expiry
        };

        const docRef = await addDoc(collection(db, 'booking_requests'), requestData);
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
            where('status', '==', 'open'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const allRequests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as BookingRequest));

        // Filter in-memory for requests matching zone areas
        const matchingRequests = allRequests.filter(request =>
            request.preferredAreas.some(area => zoneAreas.includes(area))
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
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as BookingRequest));

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
        const offerData = {
            ...data,
            status: 'pending' as const,
            createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, 'zone_offers'), offerData);
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
            collection(db, 'zone_offers'),
            where('requestId', '==', requestId),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const offers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as ZoneOffer));

        return { ok: true, data: offers };
    } catch (error) {
        Logger.error('bookingRequestService', 'Error fetching offers', error);
        return { ok: false, message: 'Failed to fetch offers' };
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
        const offerRef = doc(db, 'zone_offers', offerId);
        await updateDoc(offerRef, {
            status: 'accepted',
        });

        // Update request status
        const requestRef = doc(db, 'booking_requests', requestId);
        await updateDoc(requestRef, {
            status: 'accepted',
            acceptedOfferId: offerId,
        });

        // TODO: Reject all other offers for this request
        const offersResult = await getOffersForRequest(requestId);
        if (offersResult.ok && offersResult.data) {
            const otherOffers = offersResult.data.filter(o => o.id !== offerId);
            await Promise.all(
                otherOffers.map(offer =>
                    updateDoc(doc(db, 'zone_offers', offer.id!), { status: 'rejected' })
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
