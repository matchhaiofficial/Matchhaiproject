import { Redirect } from "expo-router";

import { useAuth } from "../src/context/AuthContext";
import { APP_ROUTES } from "../src/navigation/routes";
import { isSuperAdminProfile, isZoneAccount } from "../src/utils/accountRouting";

export default function NotificationsDeepLinkAlias() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href={APP_ROUTES.authLogin} />;
  if (isSuperAdminProfile(user)) {
    return <Redirect href="/super-admin/notifications" />;
  }
  if (isZoneAccount(user)) {
    return <Redirect href="/zone/modules/notifications" />;
  }
  return <Redirect href="/inbox" />;
}
