import { api } from "../../../convex/_generated/api";
import { convex } from "../../lib/convex";
import Logger from "../../utils/logger";

export async function sendPhoneOtp(phone: string): Promise<
  | { ok: true; phoneE164: string; phoneMasked: string; cooldownSeconds: number }
  | { ok: false; message: string }
> {
  try {
    const result = await convex.action(api.phoneOtp.sendPhoneOtp, { phone });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
      };
    }
    return {
      ok: true,
      phoneE164: result.phoneE164,
      phoneMasked: result.phoneMasked,
      cooldownSeconds: result.cooldownSeconds,
    };
  } catch (error: any) {
    if (__DEV__) {
      Logger.warn("phoneOtpService", "Send phone OTP failed", {
        category: "send_failed",
        message: error?.message,
      });
    }
    return {
      ok: false,
      message: error?.message || "Could not send verification code.",
    };
  }
}

export async function verifyPhoneOtp(
  phone: string,
  otp: string,
): Promise<
  | {
      ok: true;
      phoneE164: string;
      phoneMasked: string;
      phoneHash: string;
      verifiedAt: number;
    }
  | { ok: false; message: string }
> {
  try {
    const result = await convex.action(api.phoneOtp.verifyPhoneOtp, { phone, otp });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
      };
    }
    return {
      ok: true,
      phoneE164: result.phoneE164,
      phoneMasked: result.phoneMasked,
      phoneHash: result.phoneHash,
      verifiedAt: result.verifiedAt,
    };
  } catch (error: any) {
    if (__DEV__) {
      Logger.warn("phoneOtpService", "Verify phone OTP failed", {
        category: "verify_failed",
        message: error?.message,
      });
    }
    return {
      ok: false,
      message: error?.message || "Could not verify code.",
    };
  }
}
