import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { convex } from "../../lib/convex";
import Logger from "../../utils/logger";

export async function requestZoneWithdrawal(input: {
  userId: string;
  zoneId?: string;
  branchId: string;
  branchName: string;
  amount: number;
  ownerName?: string;
  ownerEmail?: string;
  venueName?: string;
}) {
  try {
    const result = await convex.action(api.zoneWithdrawals.requestZoneWithdrawal, {
      userId: input.userId as Id<"users">,
      zoneId: input.zoneId,
      branchId: input.branchId,
      branchName: input.branchName,
      amount: input.amount,
      ownerName: input.ownerName,
      ownerEmail: input.ownerEmail,
      venueName: input.venueName,
    });
    return { ok: true as const, reference: result.reference as string };
  } catch (error: any) {
    Logger.error("zoneWithdrawalService", "Failed to request withdrawal", error);
    return {
      ok: false as const,
      message: error?.message || "Failed to send withdrawal request.",
    };
  }
}
