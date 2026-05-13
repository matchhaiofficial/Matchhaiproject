import { useAction, useMutation } from "convex/react";
import { useCallback } from "react";
import { Linking } from "react-native";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { authClient } from "../lib/auth-client";

export type KycRole = "player" | "zone_owner" | "venue_admin";

export function useStartDiditKyc() {
  const createIntent = useMutation(api.kyc.createDiditKycStartIntent);
  const startSession = useAction(api.kyc.startDiditKycSessionFromIntent);

  return useCallback(async (role: KycRole): Promise<
    | { ok: true; verificationId: Id<"identityVerifications">; status: string; verificationUrl: string }
    | { ok: false; message: string }
  > => {
    try {
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
      return { ok: false, message: error?.message || "Could not start identity verification." };
    }
  }, [createIntent, startSession]);
}
