export const DISABLED_PHYSICAL_GAME_KEYS = [
  "futsal",
  "indoor_cricket",
  "padel",
  "pickleball",
] as const;

export const DISABLED_PHYSICAL_GAME_KEY_SET = new Set<string>(
  DISABLED_PHYSICAL_GAME_KEYS,
);

export function isPhysicalGameDisabled(gameKey: string | null | undefined) {
  return DISABLED_PHYSICAL_GAME_KEY_SET.has(String(gameKey || "").trim().toLowerCase());
}

export function isEnabledGameKey(gameKey: string | null | undefined) {
  return !isPhysicalGameDisabled(gameKey);
}
