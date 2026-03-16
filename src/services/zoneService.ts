// src/services/zoneService.ts
// Re-exports from Convex zone service for backwards compatibility
// Original Firebase implementation replaced during Convex migration

export {
  // Types
  type EffectiveRateResult,
  type Zone,

  // Zone queries
  getActiveZones,
  getZoneById,
  getZoneByOwner,
  getPendingReviewZones,

  // Zone mutations
  saveZoneRegistration,
  updateZone,
  addBranch,
  approveZone,
  rejectZone,
  suspendZone,

  // Utility
  deriveZoneRate,
} from "./convex/zoneService";
