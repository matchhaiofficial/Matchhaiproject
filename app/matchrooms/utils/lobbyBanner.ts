// Lifecycle-aware lobby status banner derivation.
//
// Returns the single banner that should appear at the top of a matchroom
// detail screen, based on priority order. Returns null when no banner
// should be shown.
//
// Priority (highest first):
//   1. cancelled / expired / unavailable
//   2. completed
//   3. awaiting captain approval (zone counter-offer pending captain action)
//   4. awaiting zone admin response
//   5. full and locked
//   6. locked but not full
//   7. full but not locked
//   8. waiting for players (default open state)

export type LobbyBannerTone =
  | "danger"
  | "warning"
  | "action"
  | "success"
  | "info"
  | "accent";

export type LobbyBannerKey =
  | "unavailable"
  | "completed"
  | "awaiting_captain"
  | "awaiting_zone"
  | "full_locked"
  | "locked"
  | "full"
  | "waiting"
  | "confirmed";

export type LobbyBanner = {
  key: LobbyBannerKey;
  title: string;
  body?: string;
  tone: LobbyBannerTone;
  icon: "warning" | "lock" | "people" | "check-circle" | "schedule" | "info";
};

type DeriveInput = {
  isExpired: boolean;
  isFull: boolean;
  isTimeLocked: boolean;
};

const TERMINAL_BAD = new Set(["cancelled", "expired"]);

function isAwaitingCaptain(room: any): boolean {
  // Zone sent an offer (counter-offer or standard) and the matchroom is still
  // waiting for the captain/host to accept it. Broadcast flow exposes
  // `broadcastRequestStatus === "offers_received"`.
  return String(room?.broadcastRequestStatus || "") === "offers_received";
}

function isAwaitingZone(room: any): boolean {
  if (String(room?.broadcastRequestStatus || "") === "waiting_for_zones") {
    return true;
  }
  // Direct booking awaiting zone admin acceptance: room targets a zone but
  // venue has not yet confirmed.
  const hasZone = Boolean(room?.zoneId);
  const confirmed =
    Boolean(room?.venueConfirmedAt) ||
    Boolean(room?.confirmedZoneId) ||
    room?.zoneAdminApproved === true;
  const pendingDirectBooking =
    hasZone &&
    !confirmed &&
    room?.bookingApprovalStatus &&
    String(room.bookingApprovalStatus).toLowerCase() === "pending";
  return Boolean(pendingDirectBooking);
}

function isConfirmed(room: any): boolean {
  return (
    Boolean(room?.venueConfirmedAt) ||
    Boolean(room?.confirmedZoneId) ||
    room?.zoneAdminApproved === true
  );
}

export function deriveLobbyBanner(
  room: any,
  { isExpired, isFull, isTimeLocked }: DeriveInput,
): LobbyBanner | null {
  if (!room) return null;

  const status = String(room.status || "").toLowerCase();

  // 1. Cancelled / expired
  if (isExpired || TERMINAL_BAD.has(status)) {
    return {
      key: "unavailable",
      title: "Matchroom unavailable",
      body: "This matchroom is no longer available.",
      tone: "danger",
      icon: "warning",
    };
  }

  // 2. Completed
  if (status === "completed") {
    return {
      key: "completed",
      title: "Match completed",
      body: "Results are finalized for this matchroom.",
      tone: "success",
      icon: "check-circle",
    };
  }

  // 3. Awaiting captain approval (counter-offer pending)
  if (isAwaitingCaptain(room)) {
    return {
      key: "awaiting_captain",
      title: "Awaiting captain approval",
      body: "The venue suggested an update. The captain must approve it to continue.",
      tone: "action",
      icon: "schedule",
    };
  }

  // 4. Awaiting zone admin response
  if (isAwaitingZone(room)) {
    return {
      key: "awaiting_zone",
      title: "Awaiting zone response",
      body: "The venue needs to confirm this booking before the matchroom is finalized.",
      tone: "warning",
      icon: "schedule",
    };
  }

  // 5. Full and locked
  if (isFull && isTimeLocked) {
    return {
      key: "full_locked",
      title: "Matchroom is full and locked",
      body: "Players can no longer leave because the match starts within 24 hours.",
      tone: "warning",
      icon: "lock",
    };
  }

  // 6. Locked but not full
  if (isTimeLocked) {
    return {
      key: "locked",
      title: "Matchroom is locked",
      body: "This matchroom is locked because kickoff is near.",
      tone: "warning",
      icon: "lock",
    };
  }

  // 7. Full but not locked
  if (isFull) {
    return {
      key: "full",
      title: "Matchroom is full",
      body: "All player slots are filled. Players can still leave until the 24-hour lock time.",
      tone: "accent",
      icon: "people",
    };
  }

  // 8. Waiting for players (default open state) or confirmed but open
  if (isConfirmed(room)) {
    return {
      key: "confirmed",
      title: "Booking confirmed",
      body: "The venue accepted this matchroom. Players can prepare for kickoff.",
      tone: "success",
      icon: "check-circle",
    };
  }

  return {
    key: "waiting",
    title: "Waiting for players",
    body: "Share this lobby or invite friends to complete the matchroom.",
    tone: "info",
    icon: "people",
  };
}
