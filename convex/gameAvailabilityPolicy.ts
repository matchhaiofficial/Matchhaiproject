import { isPhysicalGameDisabled } from "../constants/gameAvailability";

export function isNewGameEntityCreationAllowed(gameKey: unknown): boolean {
  return !isPhysicalGameDisabled(gameKey == null ? undefined : String(gameKey));
}

export function assertNewGameEntityCreationAllowed(gameKey: unknown) {
  if (!isNewGameEntityCreationAllowed(gameKey)) {
    throw new Error("This game is temporarily unavailable for new teams and matchrooms.");
  }
}
