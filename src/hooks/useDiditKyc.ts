import { useAction, useMutation } from "convex/react";
import { useCallback } from "react";
import { Linking } from "react-native";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../context/AuthContext";
import { authClient } from "../lib/auth-client";
import { getUserFacingErrorMessage } from "../utils/userFacingErrors";

export type KycRole = "player" | "zone_owner" | "venue_admin";

const ACCOUNT_EMAIL_REQUIRED_MESSAGE =
  "Your account email is missing or invalid. Please update your account email before starting verification.";

function isValidAccountEmail(value?: string | null) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());
}

export function useStartDiditKyc() {
  const { user } = useAuth();
  const createIntent = useMutation(api.kyc.createDiditKycStartIntent);
  const startSession = useAction(api.kyc.startDiditKycSessionFromIntent);

  return useCallback(async (role: KycRole): Promise<
    | { ok: true; verificationId: Id<"identityVerifications">; status: string; verificationUrl: string }
    | { ok: false; message: string }
  > => {
    try {
      if (!isValidAccountEmail(user?.email)) {
        return { ok: false, message: ACCOUNT_EMAIL_REQUIRED_MESSAGE };
      }
      const session = await authClient.getSession();
      const sessionToken = session.data?.session?.token;
      const intent = await createIntent({ role, sessionToken });
      const result = await startSession({
        verificationId: intent.verificationId,
        startToken: intent.startToken,
      });
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
  }, [createIntent, startSession, user?.email]);
}
