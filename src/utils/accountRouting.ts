import type { UserProfile } from "../context/AuthContext";
import { APP_ROUTES } from "../navigation/routes";

const SUPER_ADMIN_EMAIL = (process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL || "superadmin@matchhai.com").toLowerCase();
const LEGACY_SUPER_ADMIN_ID = process.env.EXPO_PUBLIC_SUPER_ADMIN_ID || "jM2JZrPNNNahPb844rHmr0MQKYo1";

export function isSuperAdminProfile(user: Pick<UserProfile, "_id" | "email" | "role"> | null | undefined) {
  if (!user) return false;
  return user.role === "super-admin"
    || String(user.email || "").toLowerCase() === SUPER_ADMIN_EMAIL
    || String(user._id || "") === LEGACY_SUPER_ADMIN_ID;
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
