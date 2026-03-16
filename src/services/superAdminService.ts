// src/services/superAdminService.ts
// Re-exports from Convex super admin service for backwards compatibility
// Original Firebase implementation replaced with Convex backend

export {
    getPendingZones,
    approveZone,
    rejectZone,
} from "./convex/superAdminService";
