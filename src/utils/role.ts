export type UserRole = "player" | "zoneAdmin" | "superAdmin";

export function normalizeRole(
  role?: string | null,
  accountType?: string | null,
  email?: string | null
): UserRole {
  const roleRaw = (role ?? "").toLowerCase().trim();
  const accountRaw = (accountType ?? "").toLowerCase().trim();
  const emailLower = (email ?? "").toLowerCase().trim();

  if (emailLower === "admin@matchhai.com") return "superAdmin";
  if (roleRaw === "super-admin" || roleRaw === "superadmin" || roleRaw === "super_admin") {
    return "superAdmin";
  }
  if (accountRaw === "super-admin" || accountRaw === "superadmin" || accountRaw === "super_admin") {
    return "superAdmin";
  }
  if (
    accountRaw === "zone" ||
    accountRaw === "zone-admin" ||
    accountRaw === "zoneadmin" ||
    roleRaw === "zone" ||
    roleRaw === "zone-admin" ||
    roleRaw === "zoneadmin"
  ) {
    return "zoneAdmin";
  }
  return "player";
}

export function getUserRole(user?: { role?: string | null; accountType?: string | null; email?: string | null } | null): UserRole {
  if (!user) return "player";
  return normalizeRole(user.role ?? null, user.accountType ?? null, user.email ?? null);
}
