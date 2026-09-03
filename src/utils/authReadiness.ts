type AuthenticatedProfileReadiness = {
  authLoading: boolean;
  convexAuthLoading: boolean;
  isAuthenticated: boolean;
  authUserId?: string | null;
  profileAuthId?: string | null;
  profileUserId?: string | null;
};

export function isAuthenticatedProfileReady({
  authLoading,
  convexAuthLoading,
  isAuthenticated,
  authUserId,
  profileAuthId,
  profileUserId,
}: AuthenticatedProfileReadiness) {
  if (authLoading || convexAuthLoading || !isAuthenticated) return false;
  if (!authUserId || !profileUserId) return false;
  if (profileAuthId && String(authUserId) !== String(profileAuthId)) return false;
  return true;
}
