// src/services/zoneBranchMigrationService.ts
// Re-exports from Convex zone branch migration service for backwards compatibility
// Original Firebase implementation replaced with Convex backend

export {
    type MigratedBranch,
    type BranchResource,
    getZoneBranchesFromSubcollection,
    migrateZoneBranchesToSubcollection,
} from "./convex/zoneBranchMigrationService";
