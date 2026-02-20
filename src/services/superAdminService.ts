import { getApiClient } from "../api/client";
export const approveZone: typeof import("../repositories/firebase/superAdminService").approveZone = (...args) => getApiClient().superAdmin.approveZone(...args);
export const getPendingZones: typeof import("../repositories/firebase/superAdminService").getPendingZones = (...args) => getApiClient().superAdmin.getPendingZones(...args);
export const rejectZone: typeof import("../repositories/firebase/superAdminService").rejectZone = (...args) => getApiClient().superAdmin.rejectZone(...args);
