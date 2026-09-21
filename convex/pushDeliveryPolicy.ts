import { isRuntimeFlagEnabled } from "./runtimeEnv";

const MAX_DEVICES_PER_USER = 20;

export function isPushDeliveryEnabled() {
  return isRuntimeFlagEnabled("MATCHHAI_ENABLE_PUSH_DELIVERY");
}

export async function hasActivePushDevice(ctx: any, userId: any) {
  if (!isPushDeliveryEnabled()) return false;
  const devices = await ctx.db
    .query("pushDevices")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .take(MAX_DEVICES_PER_USER);
  return devices.some(
    (device: any) => device.isActive === true && Boolean(device.pushToken || device.expoPushToken),
  );
}

export async function filterActivePushRecipients(ctx: any, userIds: any[]) {
  if (!isPushDeliveryEnabled() || userIds.length === 0) return [];
  const checks = await Promise.all(
    userIds.map(async (userId) => ({ userId, active: await hasActivePushDevice(ctx, userId) })),
  );
  return checks.filter(({ active }) => active).map(({ userId }) => userId);
}
