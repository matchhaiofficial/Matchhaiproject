/**
 * Standardized, privacy-safe share copy for MatchHai surfaces.
 *
 * Every formatter returns WhatsApp/DM-friendly text: a headline, a blank line,
 * a details block (one item per line), a blank line, then the clickable link.
 *
 * Hard rules (enforced by keeping these formatters the single source of truth):
 * - Never include matchCode / QR / check-in codes.
 * - Never include payment, payout, settlement, or order references.
 * - Never include phone / email / CNIC / KYC / authId / raw provider IDs.
 * - The only internal id that may appear is the deep-link path segment.
 */
import { getCanonicalGameLabel } from "./gameLabels";
import { parseScheduledDateTime } from "./matchroomTime";

export const APP_SCHEME = "matchhai://";
export const APP_WEB_URL =
  (process.env.EXPO_PUBLIC_APP_WEB_URL || "https://matchhai.com").replace(/\/+$/, "");

export const buildDeepLink = (path: string): string =>
  `${APP_SCHEME}${path.replace(/^\/+/, "")}`;

export const buildShareLink = (path: string): string =>
  `${APP_WEB_URL}/${path.replace(/^\/+/, "")}`;

/** "Sat, Jun 6, 2026" (device-local, matching how scheduled strings are stored). */
export function formatShareDate(date: Date | null | undefined): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "3:00 PM" */
export function formatShareTime(date: Date | null | undefined): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const clean = (value: unknown): string => String(value ?? "").trim();

const joinLines = (lines: Array<string | null | undefined>): string =>
  lines.filter((line) => clean(line) !== "").join("\n");

/** Sections are separated by a blank line for readability in chat apps. */
const joinSections = (sections: Array<string | null | undefined>): string =>
  sections.filter((section) => clean(section) !== "").join("\n\n");

const linkSection = (label: string, path: string): string =>
  joinLines([label, buildShareLink(path)]);

// ---------------------------------------------------------------------------
// Matchroom
// ---------------------------------------------------------------------------
export type MatchroomShareInput = {
  id: string;
  game?: string | null;
  title?: string | null;
  venue?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  maxPlayers?: number | null;
  currentPlayers?: number | null;
  status?: string | null;
};

export function formatMatchroomShare(input: MatchroomShareInput): string {
  const gameLabel = getCanonicalGameLabel(input.game) || "match";
  const date = parseScheduledDateTime(
    input.scheduledDate || undefined,
    input.scheduledTime || undefined,
  );
  const dateLine = formatShareDate(date);
  const timeLine = formatShareTime(date);

  const venue = clean(input.venue);
  const maxPlayers = Number(input.maxPlayers || 0);
  const currentPlayers = Number(input.currentPlayers || 0);
  const seatsRemaining = Math.max(0, maxPlayers - currentPlayers);

  let seatsLine: string | null = null;
  if (maxPlayers > 0) {
    seatsLine =
      seatsRemaining <= 0
        ? "🎟️ Lobby full"
        : `🎟️ ${seatsRemaining} seat${seatsRemaining === 1 ? "" : "s"} left`;
  }

  const details = joinLines([
    clean(input.title) || null,
    `📍 ${venue || "Venue TBC"}`,
    dateLine ? `🗓️ ${dateLine}` : null,
    timeLine ? `⏰ ${timeLine}` : null,
    seatsLine,
  ]);

  return joinSections([
    `Join my ${gameLabel} matchroom on MatchHai 🎮`,
    details,
    linkSection("Open in MatchHai:", `matchrooms/${input.id}`),
  ]);
}

// ---------------------------------------------------------------------------
// Venue / Zone
// ---------------------------------------------------------------------------
export type VenueShareInput = {
  id: string;
  name?: string | null;
  areaCity?: string | null;
  games?: Array<string | null | undefined> | null;
  startingPriceLabel?: string | null;
};

export function formatVenueShare(input: VenueShareInput): string {
  const name = clean(input.name) || "this venue";
  const games = (input.games || [])
    .map((game) => clean(game))
    .filter(Boolean)
    .join(", ");
  const price = clean(input.startingPriceLabel);
  const areaCity = clean(input.areaCity);

  const details = joinLines([
    areaCity ? `📍 ${areaCity}` : null,
    games ? `🎮 Games: ${games}` : null,
    price ? `💸 ${price}` : null,
  ]);

  return joinSections([
    `Book a slot at ${name} on MatchHai 🎮`,
    details,
    linkSection("Open venue:", `zones/${input.id}`),
  ]);
}

// ---------------------------------------------------------------------------
// Player profile
// ---------------------------------------------------------------------------
export type PlayerShareInput = {
  uid: string;
  displayName?: string | null;
  gameLabels?: Array<string | null | undefined> | null;
  rating?: number | null;
  faceitLevel?: number | null;
};

export function formatPlayerProfileShare(input: PlayerShareInput): string {
  const name = clean(input.displayName) || "this player";
  const games = (input.gameLabels || [])
    .map((game) => clean(game))
    .filter(Boolean)
    .join(" / ");
  const rating =
    typeof input.rating === "number" && Number.isFinite(input.rating)
      ? Math.round(input.rating)
      : null;
  const faceit =
    typeof input.faceitLevel === "number" && Number.isFinite(input.faceitLevel)
      ? Math.round(input.faceitLevel)
      : null;

  const details = joinLines([
    games ? `${games} player` : null,
    rating != null ? `⭐ MatchHai Rating: ${rating}` : null,
    faceit != null ? `🏆 FACEIT Level ${faceit}` : null,
  ]);

  return joinSections([
    `Check out ${name} on MatchHai 🎮`,
    details,
    linkSection("Open profile:", `profile/${input.uid}`),
  ]);
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export type TeamShareInput = {
  id: string;
  name?: string | null;
  game?: string | null;
  memberCount?: number | null;
  captainName?: string | null;
};

export function formatTeamShare(input: TeamShareInput): string {
  const name = clean(input.name) || "this team";
  const gameLabel = getCanonicalGameLabel(input.game);
  const memberCount = Number(input.memberCount || 0);
  const captain = clean(input.captainName);

  const details = joinLines([
    gameLabel ? `Game: ${gameLabel}` : null,
    memberCount > 0 ? `Members: ${memberCount}` : null,
    captain ? `Captain: ${captain}` : null,
  ]);

  return joinSections([
    `Check out Team ${name} on MatchHai 🎮`,
    details,
    linkSection("Open team:", `teams/${input.id}`),
  ]);
}

// ---------------------------------------------------------------------------
// Team Challenge
// ---------------------------------------------------------------------------
export type TeamChallengeShareInput = {
  id: string;
  teamAName?: string | null;
  teamBName?: string | null;
  game?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  venue?: string | null;
};

export function formatTeamChallengeShare(input: TeamChallengeShareInput): string {
  const gameLabel = getCanonicalGameLabel(input.game);
  const teamA = clean(input.teamAName) || "Team A";
  const teamB = clean(input.teamBName) || "Team B";
  const date = parseScheduledDateTime(
    input.scheduledDate || undefined,
    input.scheduledTime || undefined,
  );
  const dateLine = formatShareDate(date);
  const timeLine = formatShareTime(date);
  const venue = clean(input.venue);

  const details = joinLines([
    `${teamA} vs ${teamB}`,
    gameLabel ? `🎮 ${gameLabel}` : null,
    dateLine ? `🗓️ ${dateLine}` : null,
    timeLine ? `⏰ ${timeLine}` : null,
    `📍 ${venue || "Venue TBC"}`,
  ]);

  return joinSections([
    "Team Challenge on MatchHai ⚔️",
    details,
    linkSection("Open challenge:", `teams/challenge?id=${input.id}`),
  ]);
}
