export function isUserHiddenFromPublic(user: any): boolean {
  if (!user) return false;
  return user.role === "super-admin" || user.isHiddenFromDiscovery === true;
}

export function canViewerAccessPublicUser(viewer: any, target: any): boolean {
  if (!target) return false;
  if (!isUserHiddenFromPublic(target)) return true;
  if (!viewer) return false;
  return String(viewer._id) === String(target._id) || viewer.role === "super-admin";
}
