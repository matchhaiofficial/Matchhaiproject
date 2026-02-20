import { getApiClient } from "../api/client";
export type { ZoneBranch, ZoneBranchResource } from "../repositories/firebase/zoneAdminResourceService";
export const allocateResourcesToBookingRequest: typeof import("../repositories/firebase/zoneAdminResourceService").allocateResourcesToBookingRequest = (...args) => getApiClient().zoneAdminResources.allocateResourcesToBookingRequest(...args);
export const subscribeBranchResources: typeof import("../repositories/firebase/zoneAdminResourceService").subscribeBranchResources = (...args) => getApiClient().zoneAdminResources.subscribeBranchResources(...args);
export const subscribeZoneBranches: typeof import("../repositories/firebase/zoneAdminResourceService").subscribeZoneBranches = (...args) => getApiClient().zoneAdminResources.subscribeZoneBranches(...args);
export const updateBranchResourceStatus: typeof import("../repositories/firebase/zoneAdminResourceService").updateBranchResourceStatus = (...args) => getApiClient().zoneAdminResources.updateBranchResourceStatus(...args);
