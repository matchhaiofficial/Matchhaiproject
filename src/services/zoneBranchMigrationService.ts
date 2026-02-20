import { getApiClient } from "../api/client";
export type { BranchResource, MigratedBranch } from "../repositories/firebase/zoneBranchMigrationService";
export const getZoneBranchesFromSubcollection: typeof import("../repositories/firebase/zoneBranchMigrationService").getZoneBranchesFromSubcollection = (...args) => getApiClient().zoneBranchMigration.getZoneBranchesFromSubcollection(...args);
export const migrateZoneBranchesToSubcollection: typeof import("../repositories/firebase/zoneBranchMigrationService").migrateZoneBranchesToSubcollection = (...args) => getApiClient().zoneBranchMigration.migrateZoneBranchesToSubcollection(...args);
