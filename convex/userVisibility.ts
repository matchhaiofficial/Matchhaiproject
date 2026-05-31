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
export function isUserHiddenFromPublic(user: any): boolean {
  if (!user) return false;
  return (
    isSuperAdminRole(user.role) ||
    user.accountType === "super_admin" ||
    user.isSystemAdminAccount === true ||
    user.hiddenFromPublic === true ||
    user.isHiddenFromDiscovery === true
  );
}

export function canViewerAccessPublicUser(viewer: any, target: any): boolean {
  if (!target) return false;
  if (!isUserHiddenFromPublic(target)) return true;
  // Hidden accounts are only visible to themselves or to a Super Admin.
  if (!viewer) return false;
  return String(viewer._id) === String(target._id) || isUserHiddenFromPublic(viewer);
}
