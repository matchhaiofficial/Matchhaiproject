export type PublicResourceCapacitySnapshot = {
  capacityByKey: Record<string, number>;
  complete: boolean;
} | null | undefined;

const normalizeToken = (value: unknown) =>
  String(value || "").trim().toLowerCase();

export function getMinimumResourceCountForGame(gameKey: string | null | undefined) {
  const normalized = normalizeToken(gameKey).replace(/\s+/g, "");
  return ["cs2", "cs16", "cs1.6", "valorant"].includes(normalized) ? 10 : 1;
}

export function getResourceCapacityKey(context: {
  assetType: string;
  tier?: string;
  surface?: string;
}) {
  const assetType = normalizeToken(context.assetType);
  const qualifier = normalizeToken(context.tier || context.surface);
  return qualifier ? `${assetType}:${qualifier}` : assetType;
}

export function hasMinimumResourceCapacity(
  snapshot: PublicResourceCapacitySnapshot,
  gameKey: string | null | undefined,
  context: { assetType: string; tier?: string; surface?: string },
) {
  // Preserve the existing options while the bounded query is loading, or if a
  // very large venue exceeded the snapshot limit. Submission remains guarded
  // by the time-specific server capacity check in both cases.
  if (snapshot === undefined || snapshot?.complete === false) return true;
  if (!snapshot) return false;

  const key = getResourceCapacityKey(context);
  const count = Number(snapshot.capacityByKey[key] || 0);
  return count >= getMinimumResourceCountForGame(gameKey);
}
