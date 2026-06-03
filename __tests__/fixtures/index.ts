// __tests__/fixtures/index.ts
// Shared, deterministic test fixtures used across unit, UI, and security tests.
// These are intentionally loosely typed (`any`) so they can stand in for Convex
// documents without importing the generated data model. Field names mirror the
// real schema / helper expectations (slotsA/slotsB, status, scheduledDate, etc).
//
// All factories accept overrides so tests can tweak a single field without
// re-declaring the whole object. Keep these pure (no Date.now() at module load
// where it would make tests non-deterministic — use FIXED_NOW).

export const FIXED_NOW = new Date("2026-06-03T12:00:00.000Z");
export const ONE_HOUR = 60 * 60 * 1000;
export const ONE_DAY = 24 * ONE_HOUR;

function iso(offsetMs: number): string {
  return new Date(FIXED_NOW.getTime() + offsetMs).toISOString();
}

function ymd(offsetMs: number): string {
  return new Date(FIXED_NOW.getTime() + offsetMs).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */
export type TestRole = "player" | "zone_admin" | "super_admin";

export function makeUser(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    _id: "user_generic",
    uid: "user_generic",
    name: "Generic Player",
    username: "generic",
    email: "generic@test.matchhai.com",
    role: "player",
    isSuperAdmin: false,
    isDeleted: false,
    deletedAt: null,
    isHidden: false,
    kycStatus: "verified",
    selectedGames: ["valorant", "cs2"],
    elo: 1000,
    ...overrides,
  };
}

export const playerA = makeUser({
  _id: "user_playerA",
  uid: "user_playerA",
  name: "Player A",
  username: "player_a",
  email: "player.a@test.matchhai.com",
  elo: 1000,
});

export const playerB = makeUser({
  _id: "user_playerB",
  uid: "user_playerB",
  name: "Player B",
  username: "player_b",
  email: "player.b@test.matchhai.com",
  elo: 1000,
});

export const captainA = makeUser({
  _id: "user_captainA",
  uid: "user_captainA",
  name: "Captain A",
  username: "captain_a",
  email: "captain.a@test.matchhai.com",
  elo: 1200,
});

export const captainB = makeUser({
  _id: "user_captainB",
  uid: "user_captainB",
  name: "Captain B",
  username: "captain_b",
  email: "captain.b@test.matchhai.com",
  elo: 1150,
});

export const zoneAdmin = makeUser({
  _id: "user_zoneAdmin",
  uid: "user_zoneAdmin",
  name: "Zone Admin",
  username: "zone_admin",
  email: "zone.admin@test.matchhai.com",
  role: "zone_admin",
  ownedZoneId: "zone_main",
});

export const otherZoneAdmin = makeUser({
  _id: "user_otherZoneAdmin",
  uid: "user_otherZoneAdmin",
  name: "Other Zone Admin",
  username: "other_zone_admin",
  email: "other.zone.admin@test.matchhai.com",
  role: "zone_admin",
  ownedZoneId: "zone_other",
});

export const superAdmin = makeUser({
  _id: "user_superAdmin",
  uid: "user_superAdmin",
  name: "Super Admin",
  username: "super_admin",
  email: "superadmin@matchhai.com",
  role: "super_admin",
  isSuperAdmin: true,
});

export const deletedUser = makeUser({
  _id: "user_deleted",
  uid: "user_deleted",
  name: "Deleted User",
  username: "deleted_user",
  email: "deleted@test.matchhai.com",
  isDeleted: true,
  deletedAt: iso(-ONE_DAY),
});

/* -------------------------------------------------------------------------- */
/* Zones & branches                                                           */
/* -------------------------------------------------------------------------- */
export function makeZone(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    _id: "zone_main",
    name: "Main Zone",
    ownerUserId: "user_zoneAdmin",
    status: "active",
    perPlayerRate: 250,
    branchId: "branch_main",
    isAvailable: true,
    ...overrides,
  };
}

export const activeZone = makeZone();
export const pendingZone = makeZone({ _id: "zone_pending", name: "Pending Zone", status: "pending-review" });
export const unavailableZone = makeZone({ _id: "zone_unavailable", name: "Unavailable Zone", isAvailable: false });

export function makeBranch(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    _id: "branch_main",
    zoneId: "zone_main",
    name: "Main Branch",
    perPlayerRate: 250,
    isActive: true,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Matchroom slots & rooms                                                    */
/* -------------------------------------------------------------------------- */
export function makeSlot(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    slotId: "slot_1",
    team: "A",
    uid: null,
    status: "open", // open | reserved | confirmed
    ...overrides,
  };
}

export function confirmedSlot(uid: string, overrides: Record<string, any> = {}) {
  return makeSlot({ uid, status: "confirmed", slotId: `slot_${uid}`, ...overrides });
}

/**
 * Base matchroom. scheduledStartAt defaults to +2 days so the room is open
 * (lock is 24h before start). Override status/slots/timestamps for variants.
 */
export function makeMatchroom(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    _id: "room_open",
    matchCode: "MH-OPEN",
    game: "valorant",
    format: "5v5",
    hostUid: "user_captainA",
    captainUid: "user_captainA",
    status: "open",
    visibility: "public",
    maxPlayers: 10,
    currentPlayers: 1,
    scheduledStartAt: iso(2 * ONE_DAY),
    scheduledDate: ymd(2 * ONE_DAY),
    scheduledTime: "18:00",
    createdAt: iso(-ONE_HOUR),
    zoneId: "zone_main",
    slotsA: [confirmedSlot("user_captainA", { team: "A" })],
    slotsB: [],
    players: ["user_captainA"],
    ...overrides,
  };
}

export const openRoom = makeMatchroom();

export const fullRoom = makeMatchroom({
  _id: "room_full",
  matchCode: "MH-FULL",
  currentPlayers: 2,
  maxPlayers: 2,
  slotsA: [confirmedSlot("user_captainA", { team: "A" })],
  slotsB: [confirmedSlot("user_captainB", { team: "B" })],
  players: ["user_captainA", "user_captainB"],
});

// A FULL room scheduled in the future: join-locked (no free seats) but NOT
// expired. Per matchroomLifecycle semantics an *unfilled* room past its lock
// time is treated as expired, not locked — only fullness yields locked-not-expired.
export const lockedRoom = makeMatchroom({
  _id: "room_locked",
  matchCode: "MH-LOCK",
  currentPlayers: 2,
  maxPlayers: 2,
  scheduledStartAt: iso(2 * ONE_DAY),
  scheduledDate: ymd(2 * ONE_DAY),
  scheduledTime: "18:00",
  slotsA: [confirmedSlot("user_captainA", { team: "A" })],
  slotsB: [confirmedSlot("user_captainB", { team: "B" })],
  players: ["user_captainA", "user_captainB"],
});

// An unfilled room whose join-lock time has passed => expired (cannot fill).
export const pastLockUnfilledRoom = makeMatchroom({
  _id: "room_pastlock",
  matchCode: "MH-PASTLOCK",
  scheduledStartAt: iso(ONE_HOUR),
  scheduledDate: ymd(ONE_HOUR),
  scheduledTime: "13:00",
  currentPlayers: 1,
});

export const expiredRoom = makeMatchroom({
  _id: "room_expired",
  matchCode: "MH-EXP",
  status: "open",
  // Start already passed and room never filled => expired.
  scheduledStartAt: iso(-2 * ONE_DAY),
  scheduledDate: ymd(-2 * ONE_DAY),
  scheduledTime: "10:00",
  currentPlayers: 1,
});

export const completedRoom = makeMatchroom({
  _id: "room_completed",
  matchCode: "MH-DONE",
  status: "completed",
  completedAt: iso(-2 * ONE_HOUR),
  currentPlayers: 2,
  maxPlayers: 2,
  slotsA: [confirmedSlot("user_captainA", { team: "A" })],
  slotsB: [confirmedSlot("user_captainB", { team: "B" })],
  players: ["user_captainA", "user_captainB"],
});

export const privateRoom = makeMatchroom({
  _id: "room_private",
  matchCode: "MH-PRIV",
  visibility: "private",
});

/* -------------------------------------------------------------------------- */
/* Teams                                                                      */
/* -------------------------------------------------------------------------- */
export function makeTeam(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    _id: "team_a",
    name: "Team Alpha",
    game: "valorant",
    captainUid: "user_captainA",
    memberUids: ["user_captainA", "user_playerA"],
    members: [
      { uid: "user_captainA", role: "captain" },
      { uid: "user_playerA", role: "member" },
    ],
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Bookings & payments                                                        */
/* -------------------------------------------------------------------------- */
export function makeBookingIntent(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    _id: "booking_1",
    matchroomId: "room_open",
    zoneId: "zone_main",
    createdByUid: "user_captainA",
    status: "pending_approvals", // pending_approvals | approved_pending_payment | confirmed | rejected | cancelled | expired
    perPlayerRate: 250,
    playerCount: 10,
    totalAmount: 2500,
    paymentStatus: "unpaid",
    idempotencyKey: "idem-booking-1",
    createdAt: iso(-ONE_HOUR),
    ...overrides,
  };
}

export function makePayment(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    _id: "payment_1",
    bookingId: "booking_1",
    orderId: "ORDER-0001",
    amount: 250,
    status: "pending", // pending | paid | failed | expired | refunded
    provider: "easypaisa",
    providerRef: null,
    createdAt: iso(-10 * 60 * 1000),
    expiresAt: iso(5 * 60 * 1000),
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Convenience bundles                                                        */
/* -------------------------------------------------------------------------- */
export const users = {
  playerA,
  playerB,
  captainA,
  captainB,
  zoneAdmin,
  otherZoneAdmin,
  superAdmin,
  deletedUser,
};

export const rooms = {
  openRoom,
  fullRoom,
  lockedRoom,
  expiredRoom,
  completedRoom,
  privateRoom,
};
