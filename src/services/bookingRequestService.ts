import { getApiClient } from "../api/client";
export type { BookingRequest, ZoneOffer } from "../repositories/firebase/bookingRequestService";
export const acceptOffer: typeof import("../repositories/firebase/bookingRequestService").acceptOffer = (...args) => getApiClient().bookingRequests.acceptOffer(...args);
export const createBookingRequest: typeof import("../repositories/firebase/bookingRequestService").createBookingRequest = (...args) => getApiClient().bookingRequests.createBookingRequest(...args);
export const createZoneOffer: typeof import("../repositories/firebase/bookingRequestService").createZoneOffer = (...args) => getApiClient().bookingRequests.createZoneOffer(...args);
export const getOffersForRequest: typeof import("../repositories/firebase/bookingRequestService").getOffersForRequest = (...args) => getApiClient().bookingRequests.getOffersForRequest(...args);
export const getOffersForUser: typeof import("../repositories/firebase/bookingRequestService").getOffersForUser = (...args) => getApiClient().bookingRequests.getOffersForUser(...args);
export const getRequestsForZoneAdmin: typeof import("../repositories/firebase/bookingRequestService").getRequestsForZoneAdmin = (...args) => getApiClient().bookingRequests.getRequestsForZoneAdmin(...args);
export const getUserRequests: typeof import("../repositories/firebase/bookingRequestService").getUserRequests = (...args) => getApiClient().bookingRequests.getUserRequests(...args);
