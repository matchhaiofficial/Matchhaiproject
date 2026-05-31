import type { UserProfile } from "../context/AuthContext";
import { APP_ROUTES } from "../navigation/routes";

// No hardcoded super-admin email or id fallback (CR-03). These are routing hints
// only; the actual authorization boundary is the server-side gate in convex/admin.ts.
const SUPER_ADMIN_EMAIL = (process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL || "").toLowerCase();
const LEGACY_SUPER_ADMIN_ID = String(process.env.EXPO_PUBLIC_SUPER_ADMIN_ID || "").trim();
const SUPER_ADMIN_EMAILS = [
  SUPER_ADMIN_EMAIL,
  process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL_JUNAID,
  process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL_EHTESHAN,
  process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL_ZEERAK,
  process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL_MUBEEN,
  process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL_SAAD,
  process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL_OVAIS,
  ...(process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAILS || "").split(","),
]
  .map((value) => String(value || "").trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdminProfile(user: Pick<UserProfile, "_id" | "email" | "role"> | null | undefined) {
  if (!user) return false;
  // PRIMARY signal: the DB role from the user's profile (loaded server-side via
  // users.getByAuthId). Canonical "super_admin" + legacy "super-admin" (CR-05).
  // A DB-role Super Admin routes correctly even when NO EXPO_PUBLIC env is set,
  // so partners onboarded via admin.grantSuperAdmin need no app rebuild.
  const role = String(user.role || "");
  const hasAdminRole = role === "super_admin" || role === "super-admin";
  if (hasAdminRole) return true;
  // Separate Super Admin account type is also a routing hint (backend remains
  // authoritative). These accounts always carry the super_admin role too, but
  // this keeps routing correct if a hint loads before the role is hydrated.
  if ((user as any).accountType === "super_admin") return true;
  // FALLBACK only: public-env email/id hints for env-allowlist admins. These are
  // routing hints, never the security boundary — the backend re-checks every
  // Super Admin call (convex/admin.ts getAuthenticatedAdmin / requireSuperAdmin).
  return SUPER_ADMIN_EMAILS.includes(String(user.email || "").toLowerCase())
    || (Boolean(LEGACY_SUPER_ADMIN_ID) && String(user._id || "") === LEGACY_SUPER_ADMIN_ID);
}

export function isZoneAccount(user: Pick<UserProfile, "accountType"> | null | undefined) {
  return user?.accountType === "zone";
}

export function getDefaultSignedInRoute(user: Pick<UserProfile, "_id" | "email" | "role" | "accountType"> | null | undefined) {
  if (!user) return APP_ROUTES.authLogin;
  if (isSuperAdminProfile(user as any)) return APP_ROUTES.superAdminHome;
  if (isZoneAccount(user as any)) return APP_ROUTES.zoneHome;
  return APP_ROUTES.playerHome;
}
