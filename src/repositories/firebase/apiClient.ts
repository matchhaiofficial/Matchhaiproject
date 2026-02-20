import * as auth from "./authService";
import * as bookingRequests from "./bookingRequestService";
import * as bookings from "./bookingService";
import * as firestore from "./firestoreService";
import * as functions from "./functions";
import * as matchrooms from "./matchService";
import * as pricingRules from "./pricingRuleService";
import * as reports from "./reportService";
import * as skillRatings from "./skillRatingService";
import * as superAdmin from "./superAdminService";
import * as teamMatch from "./teamMatchService";
import * as teams from "./teamService";
import * as users from "./userService";
import * as zoneAdminBookings from "./zoneAdminBookingService";
import * as zoneAdminResources from "./zoneAdminResourceService";
import * as zoneBranchMigration from "./zoneBranchMigrationService";
import * as zones from "./zoneService";

export function createFirebaseApiClient() {
  return {
    auth,
    bookingRequests,
    bookings,
    firestore,
    functions,
    matchrooms,
    pricingRules,
    reports,
    skillRatings,
    superAdmin,
    teamMatch,
    teams,
    users,
    zoneAdminBookings,
    zoneAdminResources,
    zoneBranchMigration,
    zones,
  } as const;
}
