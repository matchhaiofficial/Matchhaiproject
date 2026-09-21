/** Server-authoritative rules for manual KYC review actions. */
export function assertCanManuallyVerifyKyc(adminUserId: string, targetUserId: string) {
  if (String(adminUserId) === String(targetUserId)) {
    throw new Error("Super admins cannot manually approve their own KYC.");
  }
}
