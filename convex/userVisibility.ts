import { isSuperAdminRole } from "./superAdminAccess";

// Central authority for "is this account hidden from all player/zone-facing
// surfaces?". Super Admin / system-admin accounts are SEPARATE operational
// accounts and must never appear in Discover, Friends, Teams, Matchroom invites,
// leaderboards, public profiles, player search, or zone-admin user views.
//
// Any one of these signals hides the account:
//   - role is super_admin (canonical) or super-admin (legacy)
//   - accountType is "super_admin" (separate admin account type)
//   - isSystemAdminAccount === true (provisioned admin account)
//   - hiddenFromPublic === true (explicit kill switch)
//   - isHiddenFromDiscovery === true (legacy/manual hide flag)
//   - the account has been soft-deleted (anonymized "Deleted User")
export function isUserHiddenFromPublic(user: any): boolean {
  if (!user) return false;
  return (
    isSuperAdminRole(user.role) ||
    user.accountType === "super_admin" ||
    user.isSystemAdminAccount === true ||
    user.hiddenFromPublic === true ||
    user.isHiddenFromDiscovery === true ||
    isUserDeleted(user)
  );
}

// Central authority for "has this account been soft-deleted?". Account deletion
// anonymizes the user record (see convex/admin.ts applyAccountDeletion):
// accountStatus -> "suspended" with suspensionReason
// "account_deletion_processed", username/email rewritten to deleted_<id>, and
// fullName set to "Deleted User". A deleted account must never be a selectable
// invite/search/discover target. Historical references may still render a
// neutral "Deleted User" label, but this gate keeps them out of actionable
// player-facing lists.
export function isUserDeleted(user: any): boolean {
  if (!user) return false;
  if (user.suspensionReason === "account_deletion_processed") return true;
  // Defensive fallbacks for any record anonymized by the deletion flow.
  if (typeof user.username === "string" && user.username.startsWith("deleted_")) {
    return true;
  }
  if (user.fullName === "Deleted User") return true;
  return false;
}

export function canViewerAccessPublicUser(viewer: any, target: any): boolean {
  if (!target) return false;
  if (!isUserHiddenFromPublic(target)) return true;
  // Hidden accounts are only visible to themselves or to a Super Admin.
  if (!viewer) return false;
  return String(viewer._id) === String(target._id) || isUserHiddenFromPublic(viewer);
}
