// src/services/zoneAdminBookingService.ts
// Re-exports from Convex zone admin booking service for backwards compatibility
// Original Firebase implementation replaced with Convex backend

export {
    type ZoneBookingAssetType,
    type ZoneBookingQueueStatus,
    type ZoneBookingQueueItem,
    type ZoneMatchroomListItem,
    subscribeZoneBookingQueue,
    subscribeZoneMatchrooms,
    acceptZoneBookingRequest,
    rejectZoneBookingRequest,
    sendZoneCounterOffer,
    createZoneWalkInMatchroom,
} from "./convex/zoneAdminBookingService";
