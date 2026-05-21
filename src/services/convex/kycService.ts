import { Linking } from "react-native";

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { convex } from "../../lib/convex";
import { getUserFacingErrorMessage } from "../../utils/userFacingErrors";

export type KycRole = "player" | "zone_owner" | "venue_admin";

export async function startDiditKyc(role: KycRole): Promise<
  | { ok: true; verificationId: Id<"identityVerifications">; status: string; verificationUrl: string }
  | { ok: false; message: string }
> {
  try {
    const result = await convex.action(api.kyc.startDiditKycSession, { role });
    await Linking.openURL(result.verificationUrl);
    return {
      ok: true,
      verificationId: result.verificationId,
      status: result.status,
      verificationUrl: result.verificationUrl,
    };
  } catch (error: any) {
    return { ok: false, message: getUserFacingErrorMessage(error, "Could not start identity verification.") };
  }
}

export async function refreshDiditKycStatus(verificationId: Id<"identityVerifications">): Promise<
  | { ok: true; status: string; updatedAt: number }
  | { ok: false; message: string }
> {
  try {
    const result = await convex.action(api.kyc.refreshDiditVerificationStatus, { verificationId });
    return { ok: true, status: result.status, updatedAt: result.updatedAt };
  } catch (error: any) {
    return { ok: false, message: getUserFacingErrorMessage(error, "Could not refresh verification status.") };
  }
}
