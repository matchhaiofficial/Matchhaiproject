// src/services/convex/zoneService.ts
// Convex-based zone service that maintains the same interface as the Firebase version

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ZoneLifecycleStatus, ZoneMigrationState } from "../../utils/zoneLifecycle";

export interface EffectiveRateResult {
  rate: number | null;
  label: string | null;
  source: "root_pricing" | "branch_pricing" | "none";
}

export interface Zone {
  id: string;
  _id?: string;
  ownerUid: string;
  ownerFullName?: string;
  venueBrandName: string;
  contactEmail?: string;
  contactPhone?: string | null;

  // Business Type
  type?: "gaming" | "sports" | "hybrid";

  primaryBranch?: {
    branchDisplayName?: string | null;
    city?: string | null;
    areaLabel?: string | null;
    addressLine1?: string | null;
    googleMapsUrl?: string | null;
  };

  branches?: any[];

  games?: {
    supportsCs2?: boolean;
    supportsCs16?: boolean;
    supportsValorant?: boolean;
    supportsFc25?: boolean;
    supportsFc26?: boolean;
    supportsTekken8?: boolean;
    supportsFutsal?: boolean;
    supportsIndoorCricket?: boolean;
    supportsPadel?: boolean;
    supportsPickleball?: boolean;
  };

  // Detailed Pricing & Capacity
  pricing?: {
    pc?: {
      regular?: { count: number; price: number };
      premium?: { count: number; price: number };
      elite?: { count: number; price: number };
    };
    console?: {
      ps5?: {
        count: number;
        price1v1: number;
        price2v2: number;
      };
      xbox?: {
        count: number;
        price1v1: number;
        price2v2: number;
      };
    };
    futsal?: Record<string, { count: number; price: number }>;
    indoorCricket?: Record<string, { count: number; price: number }>;
    padel?: Record<string, { count: number; price: number }>;
    pickleball?: Record<string, { count: number; price: number }>;
  };

  capacity?: {
    pcSeats?: number | null;
    consoleSeats?: number | null;
    consolePlatform?: string | null;
    futsalCourts?: number;
    indoorCricketNets?: number;
    padelCourts?: number;
    pickleballCourts?: number;
  };

  hourlyRate?: number;
  ps5HourlyRate?: number;

  status: ZoneLifecycleStatus;
  rejectionReason?: string;
  migration?: ZoneMigrationState;
  createdAt: any;
  updatedAt: any;
  onboardingStep?: number;

  // Computed fields (for UI)
  effectiveRate?: number | null;
  effectiveRateLabel?: string | null;
  effectiveRateRuleName?: string | null;
}

export type PlayerVenueStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export type PlayerVenueActionParams = {
  zoneId: string;
  zoneName: string;
  zoneSupportedGames: string;
  branchId?: string;
};

export type PlayerVenueResourceItem = {
  key: string;
  label: string;
  count: number;
  countLabel: string;
  icon:
    | "sports-esports"
    | "sports"
    | "videogame-asset"
    | "sports-soccer"
    | "sports-cricket"
    | "sports-tennis";
};

export type PlayerVenuePricingRow = {
  label: string;
  priceLabel: string;
  countLabel?: string;
  sortOrder: number;
  priceValue: number;
};

export type PlayerVenuePricingGroup = {
  key: string;
  title: string;
  rows: PlayerVenuePricingRow[];
};

export type PlayerVenueInfoItem = {
  key: string;
  label: string;
  value: string;
  icon:
    | "verified"
    | "email"
    | "phone"
    | "storefront"
    | "location-on";
};

export interface PlayerVenueViewModel {
  id: string;
  venueBrandName: string;
  branchCount: number;
  branchCountLabel: string;
  subtitle: string;
  subtitleFallbackLabel: string;
  subtitleIsFallback: boolean;
  typeLabel: string;
  statusLabel: string;
  statusTone: PlayerVenueStatusTone;
  showStatus: boolean;
  supportedGameKeys: string[];
  supportedGameLabels: string[];
  selectedBranch: {
    id?: string;
    displayName: string;
    formattedAddress: string;
    areaCityLabel: string;
    addressLine1?: string;
    areaLabel?: string;
    city?: string;
    googleMapsUrl?: string | null;
    phone?: string | null;
    hasMap: boolean;
    hasPhone: boolean;
  };
  resources: PlayerVenueResourceItem[];
  pricingGroups: PlayerVenuePricingGroup[];
  hasPricing: boolean;
  startingPriceLabel?: string;
  infoItems: PlayerVenueInfoItem[];
  locationSummary: string;
  contactEmail?: string;
  contactPhone?: string | null;
  hasContactInfo: boolean;
  createMatchroomParams: PlayerVenueActionParams;
}

type SuccessResult<T> = { ok: true; data?: T; message?: string };
type ErrorResult = { ok: false; message: string };
type Result<T = void> = SuccessResult<T> | ErrorResult;

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const PKR_FORMATTER = new Intl.NumberFormat("en-PK");

function formatPkrPerHour(value: number) {
  return `PKR ${PKR_FORMATTER.format(value)}/hr`;
}

function formatCountLabel(count: number, singular: string, plural?: string) {
  const resolvedPlural = plural || `${singular}s`;
  return `${count} ${count === 1 ? singular : resolvedPlural}`;
}

function pluralize(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

/**
 * Transform Convex zone to Firebase-compatible Zone interface
 */
function transformZone(zone: any): Zone {
  const ownerDisplayName = String(zone.ownerFullName || "").trim();
  const ownerUsername = String(zone.ownerUsername || "").trim();
  const resolvedOwnerName = ownerDisplayName || (ownerUsername.startsWith("user_") ? "" : ownerUsername);

  // Handle games array vs object format
  let gamesObj = zone.games;
  if (Array.isArray(zone.games)) {
    gamesObj = {
      supportsCs2: zone.games.includes("cs2"),
      supportsCs16: zone.games.includes("cs16"),
      supportsValorant: zone.games.includes("valorant"),
      supportsFc25: zone.games.includes("fc25") || zone.games.includes("fc26"),
      supportsFc26: zone.games.includes("fc26") || zone.games.includes("fc25"),
      supportsTekken8: zone.games.includes("tekken8"),
      supportsFutsal: zone.games.includes("futsal"),
      supportsIndoorCricket: zone.games.includes("indoor_cricket"),
      supportsPadel: zone.games.includes("padel"),
      supportsPickleball: zone.games.includes("pickleball"),
    };
  }

  return {
    id: zone._id,
    _id: zone._id,
    ownerUid: zone.ownerUid,
    ownerFullName: resolvedOwnerName || undefined,
    venueBrandName: zone.venueBrandName || zone.name,
    contactEmail: zone.contactEmail,
    contactPhone: zone.contactPhone || zone.phone,
    type: zone.type || "gaming",
    primaryBranch: zone.primaryBranch || (zone.branches?.[0] ? {
      branchDisplayName: zone.branches[0].name || zone.branches[0].branchDisplayName,
      city: zone.branches[0].city || zone.city,
      areaLabel: zone.branches[0].areaLabel,
      addressLine1: zone.branches[0].address || zone.branches[0].addressLine1,
      googleMapsUrl: zone.branches[0].googleMapsUrl,
    } : undefined),
    branches: zone.branches || [],
    games: gamesObj,
    pricing: zone.pricing,
    capacity: zone.capacity,
    hourlyRate: zone.hourlyRate || zone.defaultPricing?.hourlyRate,
    ps5HourlyRate: zone.ps5HourlyRate,
    status: zone.status,
    rejectionReason: zone.rejectionReason,
    migration: zone.migration,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
    onboardingStep: zone.onboardingStep,
  };
}

function getPreferredBranch(zone: Zone) {
  const branches = Array.isArray(zone.branches) ? zone.branches : [];
  if (branches.length > 0) {
    return branches[0];
  }
  return zone.primaryBranch || null;
}

function getBranchDisplayName(branch: any) {
  const label = String(
    branch?.branchDisplayName
    || branch?.name
    || branch?.areaLabel
    || "",
  ).trim();

  if (label) return label;
  return "Primary Branch";
}

export function formatVenueTypeLabel(type?: Zone["type"] | string | null) {
  if (type === "sports") return "Sports";
  if (type === "hybrid") return "Hybrid";
  return "Gaming";
}

export function formatVenueStatusLabel(status?: ZoneLifecycleStatus | string | null) {
  switch (status) {
    case "active":
      return "Live";
    case "approved_pending_migration":
      return "Updating";
    case "pending-review":
      return "Under review";
    case "suspended":
      return "Temporarily unavailable";
    case "rejected":
      return "Unavailable";
    default:
      return "Unavailable";
  }
}

export function getVenueStatusTone(status?: ZoneLifecycleStatus | string | null): PlayerVenueStatusTone {
  switch (status) {
    case "active":
      return "success";
    case "approved_pending_migration":
      return "info";
    case "pending-review":
      return "warning";
    case "suspended":
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export function formatBranchAddress(branch: {
  addressLine1?: string | null;
  address?: string | null;
  areaLabel?: string | null;
  city?: string | null;
}) {
  return [
    String(branch.addressLine1 || branch.address || "").trim(),
    String(branch.areaLabel || "").trim(),
    String(branch.city || "").trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

function getAreaCityLabel(branch: { areaLabel?: string | null; city?: string | null }) {
  const area = String(branch.areaLabel || "").trim();
  const city = String(branch.city || "").trim();
  if (area && city) return `${area}, ${city}`;
  return area || city || "Location details available on open";
}

function getZonePricingSources(zone: Zone): any[] {
  const sources: any[] = [];
  if (zone.pricing) sources.push(zone.pricing);
  (zone.branches || []).forEach((branch: any) => {
    if (branch?.pricing) sources.push(branch.pricing);
  });
  return sources;
}

function resolveSelectedBranchPricing(zone: Zone, branch: any) {
  return branch?.pricing || zone.pricing || null;
}

function getSportCount(bucket?: Record<string, { count: number; price: number }>) {
  return Object.values(bucket || {}).reduce((sum, entry) => sum + Number(entry?.count || 0), 0);
}

export function formatSupportedGameLabels(games?: Zone["games"]) {
  if (!games) return [];

  const flags = Array.isArray(games)
    ? {
        supportsCs2: games.includes("cs2"),
        supportsCs16: games.includes("cs16"),
        supportsValorant: games.includes("valorant"),
        supportsFc25: games.includes("fc25") || games.includes("fc26"),
        supportsFc26: games.includes("fc26") || games.includes("fc25"),
        supportsTekken8: games.includes("tekken8"),
        supportsFutsal: games.includes("futsal"),
        supportsIndoorCricket: games.includes("indoor_cricket"),
        supportsPadel: games.includes("padel"),
        supportsPickleball: games.includes("pickleball"),
      }
    : games;

  const entries = [
    ["cs2", flags?.supportsCs2],
    ["cs16", flags?.supportsCs16],
    ["valorant", flags?.supportsValorant],
    ["fc26", flags?.supportsFc26 || flags?.supportsFc25],
    ["tekken8", flags?.supportsTekken8],
    ["futsal", flags?.supportsFutsal],
    ["indoor_cricket", flags?.supportsIndoorCricket],
    ["padel", flags?.supportsPadel],
    ["pickleball", flags?.supportsPickleball],
  ] as const;

  return entries
    .filter(([, enabled]) => enabled === true)
    .map(([gameKey]) => ({
      key: gameKey,
      label:
        gameKey === "cs2" ? "CS2"
        : gameKey === "cs16" ? "CS 1.6"
        : gameKey === "fc26" ? "FC26"
        : gameKey === "tekken8" ? "Tekken 8"
        : gameKey === "indoor_cricket" ? "Indoor Cricket"
        : gameKey === "pickleball" ? "Pickleball"
        : gameKey.charAt(0).toUpperCase() + gameKey.slice(1),
    }));
}

/**
 * Derives an effective rate for a specific game within a zone.
 */
export function deriveZoneRate(zone: Zone, gameKey: string): EffectiveRateResult {
  const canonicalGameKey = gameKey === "fc25" ? "fc26" : gameKey;
  const branchPricing = zone.branches?.[0]?.pricing;
  const rootPricing = zone.pricing;

  const p = branchPricing || rootPricing;
  const source: EffectiveRateResult["source"] = branchPricing
    ? "branch_pricing"
    : rootPricing
      ? "root_pricing"
      : "none";

  if (!p) return { rate: null, label: null, source: "none" };

  let rate: number | null = null;
  let label: string | null = null;

  switch (canonicalGameKey) {
    case "cs2":
    case "cs16":
    case "valorant":
      rate =
        toPositiveNumber(p.pc?.regular?.price)
        || toPositiveNumber(p.pc?.premium?.price)
        || toPositiveNumber(p.pc?.elite?.price)
        || null;
      if (rate) label = `${rate} PKR/hr (Regular)`;
      break;

    case "fc26":
    case "tekken8":
      const consolePs5 = p.console?.ps5 as any;
      const consoleXbox = p.console?.xbox as any;
      const ps5Rate =
        toPositiveNumber(consolePs5?.price1v1)
        || toPositiveNumber(consolePs5?.price)
        || toPositiveNumber(consolePs5?.price2v2)
        || null;
      const xboxRate =
        toPositiveNumber(consoleXbox?.price1v1)
        || toPositiveNumber(consoleXbox?.price)
        || toPositiveNumber(consoleXbox?.price2v2)
        || null;
      rate = ps5Rate || xboxRate || null;
      if (rate) label = `${rate} PKR/hr (${ps5Rate ? "PS5" : "Xbox"})`;
      break;

    case "futsal":
      const futsal = p.futsal;
      if (futsal) {
        const keys = Object.keys(futsal);
        if (keys.length > 0) {
          const key = futsal["5v5"] ? "5v5" : keys[0];
          rate = toPositiveNumber(futsal[key]?.price) || null;
          if (rate) label = `${rate} PKR/hr (${key})`;
        }
      }
      break;

    case "indoor_cricket":
      const ic = (p as any).indoorCricket || p.indoor_cricket;
      if (ic) {
        const firstKey = Object.keys(ic)[0];
        rate = toPositiveNumber(ic[firstKey]?.price) || null;
        if (rate) label = `${rate} PKR/hr (${firstKey})`;
      }
      break;

    case "padel":
      const padel = p.padel;
      if (padel) {
        const firstKey = Object.keys(padel)[0];
        rate = toPositiveNumber(padel[firstKey]?.price) || null;
        if (rate) label = `${rate} PKR/hr (${firstKey})`;
      }
      break;

    case "pickleball":
      const pickle = p.pickleball;
      if (pickle) {
        const firstKey = Object.keys(pickle)[0];
        rate = toPositiveNumber(pickle[firstKey]?.price) || null;
        if (rate) label = `${rate} PKR/hr (${firstKey})`;
      }
      break;
  }

  return { rate, label, source };
}

function getPcSeatCount(zone: Zone): number {
  const explicit = Number(zone.capacity?.pcSeats || 0);
  if (explicit > 0) return explicit;

  return getZonePricingSources(zone).reduce((sum, pricing) => {
    const pc = pricing?.pc || {};
    return sum
      + Number(pc?.regular?.count || 0)
      + Number(pc?.premium?.count || 0)
      + Number(pc?.elite?.count || 0);
  }, 0);
}

function getConsoleSeatCount(zone: Zone): number {
  const explicit = Number(zone.capacity?.consoleSeats || 0);
  if (explicit > 0) return explicit;

  return getZonePricingSources(zone).reduce((sum, pricing) => {
    const consolePricing = pricing?.console || {};
    return sum
      + Number(consolePricing?.ps5?.count || 0)
      + Number(consolePricing?.xbox?.count || 0);
  }, 0);
}

function buildResourceSummary(zone: Zone, pricing: any): PlayerVenueResourceItem[] {
  const resources: PlayerVenueResourceItem[] = [];
  const pcSeats = Math.max(getPcSeatCount(zone), 0);
  const consoleSeats = Math.max(getConsoleSeatCount(zone), 0);
  const futsalCourts = Math.max(Number(zone.capacity?.futsalCourts || 0), getSportCount(pricing?.futsal));
  const indoorCricketNets = Math.max(
    Number(zone.capacity?.indoorCricketNets || 0),
    getSportCount(pricing?.indoorCricket || pricing?.indoor_cricket),
  );
  const padelCourts = Math.max(Number(zone.capacity?.padelCourts || 0), getSportCount(pricing?.padel));
  const pickleballCourts = Math.max(Number(zone.capacity?.pickleballCourts || 0), getSportCount(pricing?.pickleball));

  if (pcSeats > 0) {
    resources.push({
      key: "pc",
      label: "PC Seats",
      count: pcSeats,
      countLabel: formatCountLabel(pcSeats, "seat"),
      icon: "sports-esports",
    });
  }

  if (consoleSeats > 0) {
    resources.push({
      key: "console",
      label: "Console Seats",
      count: consoleSeats,
      countLabel: formatCountLabel(consoleSeats, "seat"),
      icon: "videogame-asset",
    });
  }

  if (futsalCourts > 0) {
    resources.push({
      key: "futsal",
      label: "Futsal Courts",
      count: futsalCourts,
      countLabel: formatCountLabel(futsalCourts, "court"),
      icon: "sports-soccer",
    });
  }

  if (indoorCricketNets > 0) {
    resources.push({
      key: "indoor_cricket",
      label: "Indoor Cricket Nets",
      count: indoorCricketNets,
      countLabel: formatCountLabel(indoorCricketNets, "net"),
      icon: "sports-cricket",
    });
  }

  if (padelCourts > 0) {
    resources.push({
      key: "padel",
      label: "Padel Courts",
      count: padelCourts,
      countLabel: formatCountLabel(padelCourts, "court"),
      icon: "sports-tennis",
    });
  }

  if (pickleballCourts > 0) {
    resources.push({
      key: "pickleball",
      label: "Pickleball Courts",
      count: pickleballCourts,
      countLabel: formatCountLabel(pickleballCourts, "court"),
      icon: "sports-tennis",
    });
  }

  return resources;
}

function addPricingRow(
  rows: PlayerVenuePricingRow[],
  input: {
    label: string;
    price?: unknown;
    count?: unknown;
    countNoun?: string;
    sortOrder: number;
  },
) {
  const priceValue = toPositiveNumber(input.price);
  if (!priceValue) return;

  const countValue = Number(input.count || 0);
  rows.push({
    label: input.label,
    priceValue,
    priceLabel: formatPkrPerHour(priceValue),
    countLabel: countValue > 0 ? pluralize(countValue, input.countNoun || "unit") : undefined,
    sortOrder: input.sortOrder,
  });
}

function buildPcPricingGroup(pricing: any): PlayerVenuePricingGroup | null {
  const rows: PlayerVenuePricingRow[] = [];
  addPricingRow(rows, {
    label: "Regular PCs",
    price: pricing?.pc?.regular?.price,
    count: pricing?.pc?.regular?.count,
    countNoun: "seat",
    sortOrder: 10,
  });
  addPricingRow(rows, {
    label: "Premium PCs",
    price: pricing?.pc?.premium?.price,
    count: pricing?.pc?.premium?.count,
    countNoun: "seat",
    sortOrder: 20,
  });
  addPricingRow(rows, {
    label: "Elite PCs",
    price: pricing?.pc?.elite?.price,
    count: pricing?.pc?.elite?.count,
    countNoun: "seat",
    sortOrder: 30,
  });

  return rows.length > 0
    ? {
        key: "pc",
        title: "PC Gaming",
        rows: rows.sort((a, b) => a.sortOrder - b.sortOrder),
      }
    : null;
}

function buildConsolePricingGroup(pricing: any): PlayerVenuePricingGroup | null {
  const rows: PlayerVenuePricingRow[] = [];
  addPricingRow(rows, {
    label: "PS5 1v1",
    price: pricing?.console?.ps5?.price1v1,
    count: pricing?.console?.ps5?.count,
    countNoun: "seat",
    sortOrder: 10,
  });
  addPricingRow(rows, {
    label: "PS5 2v2",
    price: pricing?.console?.ps5?.price2v2,
    count: pricing?.console?.ps5?.count,
    countNoun: "seat",
    sortOrder: 20,
  });
  addPricingRow(rows, {
    label: "Xbox 1v1",
    price: pricing?.console?.xbox?.price1v1,
    count: pricing?.console?.xbox?.count,
    countNoun: "seat",
    sortOrder: 30,
  });
  addPricingRow(rows, {
    label: "Xbox 2v2",
    price: pricing?.console?.xbox?.price2v2,
    count: pricing?.console?.xbox?.count,
    countNoun: "seat",
    sortOrder: 40,
  });

  return rows.length > 0
    ? {
        key: "console",
        title: "Console Gaming",
        rows: rows.sort((a, b) => a.sortOrder - b.sortOrder),
      }
    : null;
}

function buildCourtPricingRows(
  rows: PlayerVenuePricingRow[],
  bucket: Record<string, { count: number; price: number }> | undefined,
  prefixLabel: string,
  countNoun: string,
  startSortOrder: number,
) {
  Object.entries(bucket || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, value], index) => {
      addPricingRow(rows, {
        label: `${prefixLabel} ${key.replace(/[_-]+/g, " ").toUpperCase()}`,
        price: value?.price,
        count: value?.count,
        countNoun,
        sortOrder: startSortOrder + index,
      });
    });
}

function buildSportsPricingGroup(pricing: any): PlayerVenuePricingGroup | null {
  const rows: PlayerVenuePricingRow[] = [];
  buildCourtPricingRows(rows, pricing?.futsal, "Futsal", "court", 10);
  buildCourtPricingRows(rows, pricing?.padel, "Padel", "court", 30);
  buildCourtPricingRows(rows, pricing?.pickleball, "Pickleball", "court", 50);
  buildCourtPricingRows(rows, pricing?.indoorCricket || pricing?.indoor_cricket, "Indoor Cricket", "net", 70);

  return rows.length > 0
    ? {
        key: "sports",
        title: "Sports",
        rows: rows.sort((a, b) => a.sortOrder - b.sortOrder),
      }
    : null;
}

function buildPricingGroups(pricing: any): PlayerVenuePricingGroup[] {
  return [
    buildPcPricingGroup(pricing),
    buildConsolePricingGroup(pricing),
    buildSportsPricingGroup(pricing),
  ].filter(Boolean) as PlayerVenuePricingGroup[];
}

export function hasAnyPricing(pricingGroups: PlayerVenuePricingGroup[]) {
  return pricingGroups.some((group) => group.rows.length > 0);
}

export function getStartingPrice(pricingGroups: PlayerVenuePricingGroup[]) {
  const priceValues = pricingGroups.flatMap((group) => group.rows.map((row) => row.priceValue));
  if (priceValues.length === 0) return undefined;
  return formatPkrPerHour(Math.min(...priceValues));
}

export function buildCreateMatchroomParams(zone: Zone, branch?: { id?: string | null }, supportedGameKeys?: string[]) {
  const cleanedGames = (supportedGameKeys || [])
    .filter(Boolean)
    .map((gameKey) => (gameKey === "fc25" ? "fc26" : gameKey));

  return {
    zoneId: zone.id,
    zoneName: zone.venueBrandName,
    zoneSupportedGames: JSON.stringify(Array.from(new Set(cleanedGames))),
  } satisfies PlayerVenueActionParams;
}

function buildVenueInfoItems(input: {
  statusLabel: string;
  contactEmail?: string;
  contactPhone?: string | null;
  branchCount: number;
  locationSummary: string;
}) {
  const items: PlayerVenueInfoItem[] = [
    {
      key: "status",
      label: "Venue status",
      value: input.statusLabel,
      icon: "verified",
    },
    {
      key: "branches",
      label: "Branches",
      value: pluralize(input.branchCount, "branch"),
      icon: "storefront",
    },
    {
      key: "location",
      label: "Location",
      value: input.locationSummary,
      icon: "location-on",
    },
  ];

  if (input.contactEmail) {
    items.push({
      key: "email",
      label: "Contact email",
      value: input.contactEmail,
      icon: "email",
    });
  }

  if (input.contactPhone) {
    items.push({
      key: "phone",
      label: "Contact phone",
      value: input.contactPhone,
      icon: "phone",
    });
  }

  return items;
}

export function toPlayerVenueViewModel(zone: Zone): PlayerVenueViewModel {
  const branch = getPreferredBranch(zone) || {};
  const branchCount = Math.max(Array.isArray(zone.branches) ? zone.branches.length : 0, zone.primaryBranch ? 1 : 0);
  const typeLabel = formatVenueTypeLabel(zone.type);
  const statusLabel = formatVenueStatusLabel(zone.status);
  const supportedGames = formatSupportedGameLabels(zone.games);
  const selectedBranchDisplayName = getBranchDisplayName(branch);
  const rawFormattedAddress = formatBranchAddress(branch);
  const hasLocationText = Boolean(
    rawFormattedAddress
    || String(branch?.areaLabel || "").trim()
    || String(branch?.city || "").trim(),
  );
  const areaCityLabel = getAreaCityLabel(branch);
  const formattedAddress = rawFormattedAddress || (hasLocationText ? areaCityLabel : "Address hasn’t been added yet.");
  const pricing = resolveSelectedBranchPricing(zone, branch);
  const pricingGroups = buildPricingGroups(pricing);
  const locationSummary = formattedAddress !== "Address hasn’t been added yet."
    ? formattedAddress
    : areaCityLabel;
  const contactPhone = String(zone.contactPhone || branch?.phone || "").trim() || null;
  const infoItems = buildVenueInfoItems({
    statusLabel,
    contactEmail: zone.contactEmail,
    contactPhone,
    branchCount,
    locationSummary,
  });

  return {
    id: zone.id,
    venueBrandName: zone.venueBrandName,
    branchCount,
    branchCountLabel: pluralize(branchCount, "branch"),
    subtitle: selectedBranchDisplayName,
    subtitleFallbackLabel: selectedBranchDisplayName,
    subtitleIsFallback: selectedBranchDisplayName === "Primary Branch",
    typeLabel,
    statusLabel,
    statusTone: getVenueStatusTone(zone.status),
    showStatus: zone.status === "active" || zone.status === "approved_pending_migration",
    supportedGameKeys: supportedGames.map((game) => game.key),
    supportedGameLabels: supportedGames.map((game) => game.label),
    selectedBranch: {
      id: branch?.id ? String(branch.id) : undefined,
      displayName: selectedBranchDisplayName,
      formattedAddress,
      areaCityLabel,
      addressLine1: branch?.addressLine1 || branch?.address || undefined,
      areaLabel: branch?.areaLabel || undefined,
      city: branch?.city || undefined,
      googleMapsUrl: branch?.googleMapsUrl || null,
      phone: contactPhone,
      hasMap: Boolean(String(branch?.googleMapsUrl || "").trim() || hasLocationText),
      hasPhone: Boolean(contactPhone),
    },
    resources: buildResourceSummary(zone, pricing),
    pricingGroups,
    hasPricing: hasAnyPricing(pricingGroups),
    startingPriceLabel: getStartingPrice(pricingGroups),
    infoItems,
    locationSummary,
    contactEmail: zone.contactEmail,
    contactPhone,
    hasContactInfo: Boolean(zone.contactEmail || contactPhone),
    createMatchroomParams: buildCreateMatchroomParams(zone, branch, supportedGames.map((game) => game.key)),
  };
}

/**
 * Get active zones, optionally filtered by game
 */
export async function getActiveZones(
  gameKey?: string
): Promise<Result<Zone[]>> {
  try {
    const rawZones = await convex.query(api.zones.listActive, { limit: 200 });
    let zones = rawZones.map(transformZone);

    // Filter by game if specified
    if (gameKey) {
      let normalizedGameKey = gameKey === "fc25" ? "fc26" : gameKey;
      if (normalizedGameKey === "indoor_cricket") {
        normalizedGameKey = "indoorCricket";
      }

      const gameFields =
        normalizedGameKey === "fc26"
          ? ["supportsFc26", "supportsFc25"]
          : [`supports${normalizedGameKey.charAt(0).toUpperCase() + normalizedGameKey.slice(1)}`];
      zones = zones.filter((zone) => gameFields.some((field) => zone.games?.[field as keyof Zone["games"]] === true));

      // Additional filter based on equipment availability
      if (gameKey === "cs2" || gameKey === "cs16" || gameKey === "valorant") {
        zones = zones.filter((zone) => {
          const pcSeats = getPcSeatCount(zone);
          return pcSeats > 0;
        });
      } else if (normalizedGameKey === "fc26" || normalizedGameKey === "tekken8") {
        zones = zones.filter((zone) => {
          const consoleSeats = getConsoleSeatCount(zone);
          return consoleSeats > 0;
        });
      }

      // Compute effective rates
      zones = zones.map((zone) => {
        const derivation = deriveZoneRate(zone, normalizedGameKey);
        zone.effectiveRate = derivation.rate;
        zone.effectiveRateLabel = derivation.label;

        // Legacy compatibility
        if (normalizedGameKey === "fc26" || normalizedGameKey === "tekken8") {
          zone.ps5HourlyRate = zone.effectiveRate || undefined;
          zone.hourlyRate = undefined;
        } else {
          zone.hourlyRate = zone.effectiveRate || undefined;
          zone.ps5HourlyRate = undefined;
        }
        return zone;
      });
    }

    return { ok: true, data: zones };
  } catch (error: any) {
    console.error("[zoneService] getActiveZones error:", error);
    return { ok: false, message: "Failed to fetch zones" };
  }
}

/**
 * Get zone by ID
 */
export async function getZoneById(zoneId: string): Promise<Result<Zone>> {
  try {
    const zone = await convex.query(api.zones.getById, {
      zoneId: zoneId as Id<"zones">,
    });
    if (!zone) {
      return { ok: false, message: "Zone not found" };
    }
    return { ok: true, data: transformZone(zone) };
  } catch (error: any) {
    console.error("[zoneService] getZoneById error:", error);
    return { ok: false, message: "Failed to fetch zone" };
  }
}

export async function getPlayerVenueDetails(zoneId: string): Promise<Result<PlayerVenueViewModel>> {
  const result = await getZoneById(zoneId);
  if (!result.ok || !result.data) {
    return result as Result<PlayerVenueViewModel>;
  }

  return {
    ok: true,
    data: toPlayerVenueViewModel(result.data),
  };
}

/**
 * Get zone by owner UID
 */
export async function getZoneByOwner(ownerUid: string): Promise<Result<Zone>> {
  try {
    // First get the Convex user ID from auth ID
    const user = await convex.query(api.users.getByAuthId, { authId: ownerUid });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    const zone = await convex.query(api.zones.getByOwner, {
      ownerUid: user._id,
    });
    if (!zone) {
      return { ok: false, message: "Zone not found" };
    }
    return { ok: true, data: transformZone(zone) };
  } catch (error: any) {
    console.error("[zoneService] getZoneByOwner error:", error);
    return { ok: false, message: "Failed to fetch zone" };
  }
}

/**
 * Update a zone
 */
export async function updateZone(
  zoneId: string,
  data: Partial<any>
): Promise<Result> {
  try {
    await convex.mutation(api.zones.update, {
      zoneId: zoneId as Id<"zones">,
      ...data,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[zoneService] updateZone error:", error);
    return { ok: false, message: "Failed to update zone" };
  }
}

/**
 * Add a branch to a zone
 */
export async function addBranch(
  zoneId: string,
  branch: any
): Promise<Result<{ id: string }>> {
  try {
    const branchId = await convex.mutation(api.zones.addBranch, {
      zoneId: zoneId as Id<"zones">,
      branch: {
        ...branch,
        id: branch.id || Math.random().toString(36).substring(7),
      },
    });

    return { ok: true, data: { id: branchId } };
  } catch (error: any) {
    console.error("[zoneService] addBranch error:", error);
    return { ok: false, message: "Failed to add branch" };
  }
}

/**
 * Save zone registration (for new zones)
 */
export async function saveZoneRegistration(data: {
  step1: any;
  branches: any[];
}): Promise<Result> {
  try {
    const { step1, branches } = data;
    const primaryBranch = branches[0];

    // Get current user
    const { authClient } = await import("../../lib/auth-client");
    let session = await authClient.getSession();
    if (!session?.data?.user) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        session = await authClient.getSession();
        if (session?.data?.user) break;
      }
    }
    if (!session?.data?.user) {
      return { ok: false, message: "Not signed in" };
    }

    // Get Convex user
    const user = await convex.query(api.users.getByAuthId, {
      authId: session.data.user.id,
    });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    // Create games object
    const games = {
      supportsCs2: branches.some((b) => b.supportsCs2),
      supportsCs16: branches.some((b) => b.supportsCs16),
      supportsValorant: branches.some((b) => b.supportsValorant),
      supportsFc25: branches.some((b) => b.supportsFc25),
      supportsFc26: branches.some((b) => b.supportsFc26 || b.supportsFc25),
      supportsTekken8: branches.some((b) => b.supportsTekken8),
      supportsFutsal: branches.some((b) => b.supportsFutsal),
      supportsIndoorCricket: branches.some((b) => b.supportsIndoorCricket),
      supportsPadel: branches.some((b) => b.supportsPadel),
      supportsPickleball: branches.some((b) => b.supportsPickleball),
    };

    // Convert games object to array for Convex
    const gamesArray = Object.entries(games)
      .filter(([_, supported]) => supported)
      .map(([key]) => {
        if (key === "supportsFc26" || key === "supportsFc25") return "fc26";
        return key.replace("supports", "").toLowerCase();
      })
      .filter((value, index, arr) => arr.indexOf(value) === index);

    await convex.mutation(api.zones.create, {
      ownerUid: user._id,
      ownerUsername: user.username,
      ownerFullName: user.fullName,
      name: step1.venueBrandName,
      venueBrandName: step1.venueBrandName,
      contactEmail: step1.contactEmail,
      contactPhone: step1.contactPhone,
      type: step1.type,
      city: primaryBranch?.city,
      phone: step1.contactPhone,
      games: gamesArray,
      branches: branches.map((b) => ({
        ...b,
        id: b.id || Math.random().toString(36).substring(7),
        isActive: true,
        source: "manual",
        resourceModelVersion: 0,
      })),
    });

    return { ok: true };
  } catch (error: any) {
    console.error("[zoneService] saveZoneRegistration error:", error);
    return { ok: false, message: "Could not save your zone. Please try again." };
  }
}

/**
 * List pending review zones (for super admin)
 */
export async function getPendingReviewZones(): Promise<Result<Zone[]>> {
  try {
    const rawZones = await convex.query(api.zones.listPendingReview, {});
    const zones = rawZones.map(transformZone);
    return { ok: true, data: zones };
  } catch (error: any) {
    console.error("[zoneService] getPendingReviewZones error:", error);
    return { ok: false, message: "Failed to fetch pending zones" };
  }
}

/**
 * Approve a zone
 */
export async function approveZone(zoneId: string): Promise<Result> {
  try {
    await convex.mutation(api.zones.approve, {
      zoneId: zoneId as Id<"zones">,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[zoneService] approveZone error:", error);
    return { ok: false, message: "Failed to approve zone" };
  }
}

/**
 * Reject a zone
 */
export async function rejectZone(
  zoneId: string,
  reason?: string
): Promise<Result> {
  try {
    await convex.mutation(api.zones.reject, {
      zoneId: zoneId as Id<"zones">,
      rejectionReason: reason,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[zoneService] rejectZone error:", error);
    return { ok: false, message: "Failed to reject zone" };
  }
}

/**
 * Suspend a zone
 */
export async function suspendZone(zoneId: string): Promise<Result> {
  try {
    await convex.mutation(api.zones.suspend, {
      zoneId: zoneId as Id<"zones">,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[zoneService] suspendZone error:", error);
    return { ok: false, message: "Failed to suspend zone" };
  }
}
