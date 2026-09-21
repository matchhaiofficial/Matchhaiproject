import type { Id } from "./_generated/dataModel";
import { checkBranchOperatingHours } from "../constants/branchOperatingHours";

export function getBranchOperatingHoursAvailability(input: {
  zone: any;
  branchId?: string | null;
  scheduledStartAt: number;
  durationMinutes: number;
}) {
  const branches = [
    ...(Array.isArray(input.zone?.branches) ? input.zone.branches : []),
    ...(input.zone?.primaryBranch ? [input.zone.primaryBranch] : []),
  ];
  const requestedBranchId = String(input.branchId || "").trim();
  const branch = requestedBranchId
    ? branches.find((candidate: any, index: number) =>
        String(candidate?.id || candidate?.branchId || `branch_${index + 1}`) === requestedBranchId,
      )
    : branches[0];

  if (requestedBranchId && !branch) {
    return {
      available: false,
      configured: true,
      message: "The selected branch no longer exists. Please choose a branch again.",
      reason: "invalid_operating_hours" as const,
    };
  }
  if (!branch) {
    return { available: true, configured: false, message: null, reason: null };
  }

  return checkBranchOperatingHours({
    operatingHours: branch.operatingHours,
    scheduledStartAt: input.scheduledStartAt,
    durationMinutes: input.durationMinutes,
    branchLabel: branch.branchDisplayName || branch.name || "This branch",
  });
}

export async function assertBranchOperatingHoursAvailable(ctx: any, input: {
  zoneId: string | Id<"zones">;
  zone?: any;
  branchId?: string | null;
  scheduledStartAt?: number | null;
  durationMinutes?: number | null;
}) {
  const scheduledStartAt = Number(input.scheduledStartAt || 0);
  if (!Number.isFinite(scheduledStartAt) || scheduledStartAt <= 0) return;
  const zone = input.zone || await ctx.db.get(input.zoneId as Id<"zones">);
  if (!zone) throw new Error("Venue not found.");
  const result = getBranchOperatingHoursAvailability({
    zone,
    branchId: input.branchId,
    scheduledStartAt,
    durationMinutes: Math.max(1, Math.floor(Number(input.durationMinutes || 60))),
  });
  if (!result.available) throw new Error(result.message || "The selected branch is closed at that time.");
}
