export const DISABLED_PHYSICAL_GAME_KEYS = [
  "futsal",
  "indoor_cricket",
  "padel",
  "pickleball",
] as const;

export const DISABLED_PHYSICAL_GAME_KEY_SET = new Set<string>(
  DISABLED_PHYSICAL_GAME_KEYS,
);

export function canonicalizeGameAvailabilityKey(gameKey: unknown) {
  const normalized = String(gameKey || "").trim().toLowerCase();
  const compact = normalized.replace(/[\s._-]+/g, "");
  if (compact === "futsal") return "futsal";
  if (compact === "indoorcricket" || compact === "cricket") return "indoor_cricket";
  if (compact === "padel") return "padel";
  if (compact === "pickleball") return "pickleball";
  return normalized;
}

export function isPhysicalGameDisabled(gameKey: string | null | undefined) {
  return DISABLED_PHYSICAL_GAME_KEY_SET.has(canonicalizeGameAvailabilityKey(gameKey));
}

export function isEnabledGameKey(gameKey: string | null | undefined) {
  return !isPhysicalGameDisabled(gameKey);
}
