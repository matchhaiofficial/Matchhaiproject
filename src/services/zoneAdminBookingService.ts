import { getApiClient } from "../api/client";
export type { ZoneBookingAssetType, ZoneBookingQueueItem, ZoneBookingQueueStatus, ZoneMatchroomListItem } from "../repositories/firebase/zoneAdminBookingService";
export const acceptZoneBookingRequest: typeof import("../repositories/firebase/zoneAdminBookingService").acceptZoneBookingRequest = (...args) => getApiClient().zoneAdminBookings.acceptZoneBookingRequest(...args);
export const createZoneWalkInMatchroom: typeof import("../repositories/firebase/zoneAdminBookingService").createZoneWalkInMatchroom = (...args) => getApiClient().zoneAdminBookings.createZoneWalkInMatchroom(...args);
export const rejectZoneBookingRequest: typeof import("../repositories/firebase/zoneAdminBookingService").rejectZoneBookingRequest = (...args) => getApiClient().zoneAdminBookings.rejectZoneBookingRequest(...args);
export const sendZoneCounterOffer: typeof import("../repositories/firebase/zoneAdminBookingService").sendZoneCounterOffer = (...args) => getApiClient().zoneAdminBookings.sendZoneCounterOffer(...args);
export const subscribeZoneBookingQueue: typeof import("../repositories/firebase/zoneAdminBookingService").subscribeZoneBookingQueue = (...args) => getApiClient().zoneAdminBookings.subscribeZoneBookingQueue(...args);
export const subscribeZoneMatchrooms: typeof import("../repositories/firebase/zoneAdminBookingService").subscribeZoneMatchrooms = (...args) => getApiClient().zoneAdminBookings.subscribeZoneMatchrooms(...args);
