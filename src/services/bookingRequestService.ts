// src/services/bookingRequestService.ts
// Re-exports from Convex booking request service for backwards compatibility
// Original Firebase implementation replaced during Convex migration

export {
  // Types
  type BookingRequest,
  type ZoneOffer,

  // Request CRUD
  getBookingRequest,
  getUserRequests,
  getRequestsForZone,
  getOpenRequestsByGame,
  createBookingRequest,
  updateRequestStatus,

  // Offer CRUD
  getOffer,
  getOffersForRequest,
  getOffersForUser,
  getOffersByZone,
  createOffer,
  updateOfferStatus,
  acceptOffer,
  rejectOffer,
} from "./convex/bookingRequestService";
