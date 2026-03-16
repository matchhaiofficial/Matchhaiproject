// src/services/zoneAdminResourceService.ts
// Re-exports from Convex zone admin resource service for backwards compatibility
// Original Firebase implementation replaced with Convex backend

export {
    type ZoneBranch,
    type ZoneBranchResource,
    subscribeZoneBranches,
    subscribeBranchResources,
    updateBranchResourceStatus,
    allocateResourcesToBookingRequest,
} from "./convex/zoneAdminResourceService";
