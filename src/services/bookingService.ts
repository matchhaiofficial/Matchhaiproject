// src/services/bookingService.ts
// Re-exports from Convex booking service for backwards compatibility
// Original Firebase implementation replaced during Convex migration

export {
  // Types
  type BookingIntent,

  // Constants
  FAIR_BAND_DELTA_BY_GAME,

  // Utility functions
  isWithinFairnessBand,
  getSlotIdHash,
  generateIntentId,
  getHostCaptainUid,

  // Intent CRUD
  getBookingIntent,
  getIntentsForMatchroom,
  getUserIntents,
  createBookingIntent,
  createBookingIntentDetailed,
  updateBookingIntentStatus,

  // Approvals & Payment
  updateIntentApproval,
  updateIntentPaymentStatus,
  confirmBookingTransaction,

  // Seat claiming
  claimSeatTransaction,

  // Cleanup
  cleanupExpiredIntents,
} from "./convex/bookingService";
