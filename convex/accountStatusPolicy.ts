export function isAccountSuspensionActive(
  profile?: {
    accountStatus?: string | null;
    suspendedUntil?: number | null;
  } | null,
  now = Date.now(),
): boolean {
  if (profile?.accountStatus !== "suspended") return false;
  return typeof profile.suspendedUntil !== "number" || profile.suspendedUntil > now;
}

export function accountDeletionLocksReactivation(
  status?: string | null,
): boolean {
  return status === "queued"
    || status === "running"
    || status === "failed"
    || status === "completed";
}
