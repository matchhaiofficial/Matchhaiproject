// convex/matchroomPricing.ts
//
// SERVER-SIDE authoritative matchroom pricing (P1 security fix).
//
// The per-game pricing formula and the promo/pricing-rule engine historically
// lived only on the client (app/matchrooms/create/hooks/useMatchroomCreatePricing.ts
// and src/services/convex/pricingRuleService.ts). That let a modified client send
// an arbitrary `pricing.perPlayer` / `paymentAmount` and create/pay for a matchroom
// at a price below the venue's configured rate (underpayment).
//
// This module recomputes pricing on the server from the authoritative zone/branch
// pricing buckets + enabled pricing rules. It is intentionally split into two
// numbers so that hard-rejection is false-reject-safe:
//
//   • floorPerPlayer  — the cheapest LEGITIMATE per-player price across every
//     plausible configuration (max possible promo discount, minimum hours, the
//     most generous player divisor, and the cheapest branch when branch is
//     unknown). A client price below this floor is provably underpayment and is
//     hard-rejected. Because the floor is deliberately conservative, branch /
//     timezone / rounding nuances cannot cause a legitimate booking to be rejected.
//
//   • expectedPerPlayer — the server's best estimate of the exact price for the
//     specific configuration (selected branch, series/format/overs, promos
//     evaluated at the scheduled time in Asia/Karachi). Used only to CAP the
//     charge: the server charges min(client, expected), so it never overcharges
//     above what the player was shown and never trusts an inflated client amount.
//
// The pure formula below is ported verbatim from the client hook so the two stay
// in lock-step. If you change one, change the other.

// MatchHai operates in Pakistan (Asia/Karachi, UTC+5, no DST). Promo rules carry
// day-of-week / time-of-day windows that the client evaluates in device-local
// (Karachi) time. The Convex runtime clock is UTC, so we shift timestamps by the
// Karachi offset and read them with getUTC* to match the client's evaluation.
const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

export type ResourceContext = {
  assetType: string;
  tier?: string | null;
  surface?: string | null;
};

export type PricingRuleLike = {
  assetType: string;
  isEnabled: boolean;
  branchId?: string | null;
  tier?: string | null;
  surface?: string | null;
  ruleType?: "percentage_discount" | "fixed_override" | null;
  value?: number | null;
  priceMultiplier?: number | null;
  flatRate?: number | null;
  daysOfWeek?: number[] | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  priority?: number | null;
};

const isCsStyleGame = (gameKey: string | null | undefined) =>
  gameKey === "cs2" || gameKey === "cs16" || gameKey === "valorant";

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeString = (value: unknown) => String(value || "").trim().toLowerCase();

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------------------
// Promo / pricing-rule engine (ported from pricingRuleService pure functions)
// ---------------------------------------------------------------------------

const parseTimeMinutes = (timeHHmm: string) => {
  const match = String(timeHHmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number.parseInt(match[1], 10);
  const mm = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return hh * 60 + mm;
};

const karachiParts = (atMs: number) => {
  const shifted = new Date(atMs + KARACHI_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return {
    dateKey: `${y}-${m}-${d}`,
    dayOfWeek: shifted.getUTCDay(),
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
};

const ruleValue = (rule: PricingRuleLike): number => {
  if (Number.isFinite(Number(rule.value))) return Number(rule.value);
  if (rule.flatRate != null) return Number(rule.flatRate);
  return (1 - Number(rule.priceMultiplier ?? 1)) * 100;
};

const ruleType = (rule: PricingRuleLike): "percentage_discount" | "fixed_override" =>
  rule.ruleType || (rule.flatRate != null ? "fixed_override" : "percentage_discount");

const isRuleResourceMatch = (rule: PricingRuleLike, ctx: ResourceContext, branchId?: string | null) => {
  if (!rule.isEnabled) return false;
  if (normalizeString(rule.assetType) !== normalizeString(ctx.assetType)) return false;
  if (rule.branchId && normalizeString(rule.branchId) !== normalizeString(branchId)) return false;
  if (rule.tier && normalizeString(rule.tier) !== normalizeString(ctx.tier)) return false;
  if (rule.surface && normalizeString(rule.surface) !== normalizeString(ctx.surface)) return false;
  return true;
};

const isRuleTimeWindowMatch = (rule: PricingRuleLike, atMs: number) => {
  const { dateKey, dayOfWeek, minutesOfDay } = karachiParts(atMs);
  if (rule.validFrom && dateKey < rule.validFrom) return false;
  if (rule.validTo && dateKey > rule.validTo) return false;
  if (rule.daysOfWeek && rule.daysOfWeek.length && !rule.daysOfWeek.includes(dayOfWeek)) return false;

  const start = parseTimeMinutes(rule.timeStart || "00:00");
  const end = parseTimeMinutes(rule.timeEnd || "23:59");
  if (start == null || end == null) return false;
  if (start <= end) return minutesOfDay >= start && minutesOfDay <= end;
  return minutesOfDay >= start || minutesOfDay <= end;
};

const applyRuleToRate = (baseRate: number, rule: PricingRuleLike): number => {
  if (ruleType(rule) === "fixed_override") {
    return clamp(ruleValue(rule), 0, 999999);
  }
  const discount = clamp(ruleValue(rule), 0, 100);
  return baseRate * (1 - discount / 100);
};

const sortByPriority = (rules: PricingRuleLike[]) =>
  [...rules].sort((a, b) => {
    const pa = Number(a.priority || 0);
    const pb = Number(b.priority || 0);
    if (pb !== pa) return pb - pa;
    if (ruleType(a) !== ruleType(b)) {
      if (ruleType(a) === "fixed_override") return -1;
      if (ruleType(b) === "fixed_override") return 1;
    }
    return 0;
  });

// Effective hourly rate for the EXACT configuration: highest-priority rule that
// matches the resource AND the scheduled-time window (mirrors applyPricingRulesToRate).
const resolveExpectedHourlyRate = (
  baseRate: number,
  rules: PricingRuleLike[],
  ctx: ResourceContext,
  branchId: string | null | undefined,
  atMs: number,
): number => {
  if (!Number.isFinite(baseRate) || baseRate <= 0) return 0;
  const matching = sortByPriority(
    rules.filter((rule) => isRuleResourceMatch(rule, ctx, branchId) && isRuleTimeWindowMatch(rule, atMs)),
  );
  if (!matching.length) return baseRate;
  return Math.max(0, Math.round(applyRuleToRate(baseRate, matching[0])));
};

// Cheapest hourly rate this resource could legitimately ever cost: the minimum of
// the base rate and every enabled resource rule's result, IGNORING time windows so
// a promo that only applies at certain hours can never push a legit booking below
// the floor. Used for the underpayment floor only.
const resolveFloorHourlyRate = (
  baseRate: number,
  rules: PricingRuleLike[],
  ctx: ResourceContext,
): number => {
  if (!Number.isFinite(baseRate) || baseRate <= 0) return 0;
  let floor = baseRate;
  for (const rule of rules) {
    // Match resource only; ignore branch + time so the floor is the global cheapest.
    if (!rule.isEnabled) continue;
    if (normalizeString(rule.assetType) !== normalizeString(ctx.assetType)) continue;
    if (rule.tier && normalizeString(rule.tier) !== normalizeString(ctx.tier)) continue;
    if (rule.surface && normalizeString(rule.surface) !== normalizeString(ctx.surface)) continue;
    floor = Math.min(floor, Math.max(0, applyRuleToRate(baseRate, rule)));
  }
  return floor;
};

// ---------------------------------------------------------------------------
// Base hourly-rate extraction from zone/branch pricing buckets
// (mirrors the addOption/getPricingBucket logic in useMatchroomCreatePricing.ts)
// ---------------------------------------------------------------------------

const getBucket = (pricingSources: any[], bucketKey: string) =>
  pricingSources.find((source: any) => source?.[bucketKey])?.[bucketKey] || {};

const firstPositive = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = toPositiveNumber(value);
    if (parsed) return parsed;
  }
  return null;
};

// Returns the base hourly rate for a resource context from a single pricing
// source set (e.g. [branch.pricing, zone.pricing]). null when not configured.
const extractBaseRateFromSources = (
  pricingSources: any[],
  game: string,
  ctx: ResourceContext,
  format: string | null | undefined,
): number | null => {
  const tier = normalizeString(ctx.tier);
  const surface = String(ctx.surface || "");
  const priceKey = format === "2v2" ? "price2v2" : "price1v1";
  const otherPriceKey = priceKey === "price1v1" ? "price2v2" : "price1v1";

  if (isCsStyleGame(game)) {
    const pc = getBucket(pricingSources, "pc");
    return toPositiveNumber(pc?.[tier]?.price);
  }
  if (game === "fc26" || game === "fc25" || game === "tekken8") {
    const cons = getBucket(pricingSources, "console");
    const bucket = cons?.[tier] || {};
    return firstPositive(bucket?.[priceKey], bucket?.[otherPriceKey], bucket?.price);
  }
  if (game === "futsal") {
    const futsal = getBucket(pricingSources, "futsal");
    return toPositiveNumber(futsal?.[surface]?.price);
  }
  if (game === "indoor_cricket") {
    const cricket =
      pricingSources.find((s: any) => s?.indoorCricket)?.indoorCricket ||
      pricingSources.find((s: any) => s?.indoor_cricket)?.indoor_cricket ||
      {};
    return toPositiveNumber(cricket?.[surface]?.price);
  }
  if (game === "padel") {
    const padel = getBucket(pricingSources, "padel");
    return toPositiveNumber(padel?.[surface]?.price);
  }
  if (game === "pickleball") {
    const pickleball = getBucket(pricingSources, "pickleball");
    return toPositiveNumber(pickleball?.[surface]?.price);
  }
  return null;
};

const branchPricingList = (zoneDoc: any): any[] => {
  const branches = Array.isArray(zoneDoc?.branches) ? zoneDoc.branches : [];
  return branches.map((b: any) => b?.pricing).filter(Boolean);
};

const branchPricingById = (zoneDoc: any, branchId: string | null | undefined): any | null => {
  if (!branchId) return null;
  const branches = Array.isArray(zoneDoc?.branches) ? zoneDoc.branches : [];
  const match = branches.find((b: any) => String(b?.id || "") === String(branchId));
  return match?.pricing || null;
};

// ---------------------------------------------------------------------------
// Per-game per-player formula (ported verbatim from useMatchroomCreatePricing.ts)
// ---------------------------------------------------------------------------

const CS_HOURS: Record<string, number> = { BO1: 1, BO3: 3, BO5: 5, BO10: 10 };
const FC_HOURS: Record<string, number> = { BO1: 0.5, BO3: 1, BO5: 2, BO10: 3 };
const TEKKEN_HOURS: Record<string, number> = { BO1: 1, BO3: 2, BO5: 3, BO7: 1, BO20: 2, BO40: 3 };
const RACKET_HOURS: Record<string, number> = { BO1: 1, BO3: 2, BO5: 3, BO10: 3 };

const computeExpectedPerPlayer = (
  game: string,
  hourlyRate: number,
  opts: {
    seriesType?: string | null;
    overs?: string | number | null;
    format?: string | null;
    maxPlayers?: number | null;
    durationMinutes?: number | null;
    durationHours?: number | null;
  },
): number | null => {
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return null;
  const series = String(opts.seriesType || "");
  const format = opts.format === "2v2" ? "2v2" : "1v1";
  const maxPlayers = Math.max(1, Number(opts.maxPlayers || 0));

  if (isCsStyleGame(game)) {
    const hours = CS_HOURS[series] || 1;
    return hourlyRate * hours;
  }
  if (game === "fc26" || game === "fc25") {
    const hours = FC_HOURS[series] || 1;
    const divisor = format === "2v2" ? 4 : 2;
    return (hourlyRate * hours) / divisor;
  }
  if (game === "tekken8") {
    const hours = TEKKEN_HOURS[series] || 1;
    const divisor = format === "2v2" ? 4 : 2;
    return (hourlyRate * hours) / divisor;
  }
  if (game === "futsal") {
    const hours = Number(opts.durationHours) > 0
      ? Number(opts.durationHours)
      : Math.max(1, Number(opts.durationMinutes || 60) / 60);
    return Math.ceil((hourlyRate * hours) / maxPlayers);
  }
  if (game === "indoor_cricket") {
    const calcDuration = String(opts.overs || "") === "6" ? 2.5 : 2;
    return Math.ceil((hourlyRate * calcDuration) / maxPlayers);
  }
  if (game === "padel") {
    const hours = RACKET_HOURS[series] || 1;
    return Math.ceil((hourlyRate * hours) / 4);
  }
  if (game === "pickleball") {
    const hours = RACKET_HOURS[series] || 1;
    const players = format === "2v2" ? 4 : 2;
    return Math.ceil((hourlyRate * hours) / players);
  }
  return null;
};

// Smallest legitimate per-player price for the floor: minimum hours, most generous
// (largest) player divisor. Player-divisor games cap the divisor at a sane bound so
// a client claiming an absurd maxPlayers cannot drag the floor toward zero.
const computeFloorPerPlayer = (
  game: string,
  floorHourlyRate: number,
  maxPlayers: number,
): number | null => {
  if (!Number.isFinite(floorHourlyRate) || floorHourlyRate <= 0) return null;
  const players = Math.max(1, Number(maxPlayers || 0));

  if (isCsStyleGame(game)) {
    return floorHourlyRate * 1; // BO1
  }
  if (game === "fc26" || game === "fc25") {
    return (floorHourlyRate * 0.5) / 4; // BO1, 2v2 divisor
  }
  if (game === "tekken8") {
    return (floorHourlyRate * 1) / 4; // BO1, 2v2 divisor
  }
  if (game === "futsal") {
    const divisor = Math.min(players, 14);
    return (floorHourlyRate * 1) / divisor; // 1 hour minimum
  }
  if (game === "indoor_cricket") {
    const divisor = Math.min(players, 16);
    return (floorHourlyRate * 2) / divisor; // 2-hour minimum (overs !== 6)
  }
  if (game === "padel") {
    return (floorHourlyRate * 1) / 4;
  }
  if (game === "pickleball") {
    return (floorHourlyRate * 1) / 4;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export type AuthoritativePricingInput = {
  zoneDoc: any;
  rules: PricingRuleLike[];
  game: string;
  resourceContext: ResourceContext | null;
  branchId?: string | null;
  seriesType?: string | null;
  overs?: string | number | null;
  format?: string | null;
  maxPlayers?: number | null;
  durationMinutes?: number | null;
  durationHours?: number | null;
  scheduledStartAt?: number | null;
};

export type AuthoritativePricingResult = {
  // false when pricing could not be resolved authoritatively (missing config,
  // unknown resource, unpriced game). Callers MUST skip validation when false to
  // avoid false-rejecting legitimate flows.
  resolved: boolean;
  expectedPerPlayer: number | null;
  floorPerPlayer: number | null;
};

export function computeAuthoritativeMatchroomPricing(
  input: AuthoritativePricingInput,
): AuthoritativePricingResult {
  const unresolved: AuthoritativePricingResult = {
    resolved: false,
    expectedPerPlayer: null,
    floorPerPlayer: null,
  };

  const ctx = input.resourceContext;
  if (!input.zoneDoc || !ctx || !ctx.assetType) return unresolved;

  const rules = Array.isArray(input.rules) ? input.rules : [];
  const atMs = Number(input.scheduledStartAt) > 0 ? Number(input.scheduledStartAt) : Date.now();

  // EXPECTED: prefer the selected branch's bucket, fall back to zone-level.
  const selectedBranchPricing = branchPricingById(input.zoneDoc, input.branchId);
  const expectedSources = [selectedBranchPricing, input.zoneDoc?.pricing].filter(Boolean);
  const expectedBaseRate = extractBaseRateFromSources(expectedSources, input.game, ctx, input.format);

  let expectedPerPlayer: number | null = null;
  if (expectedBaseRate && expectedBaseRate > 0) {
    const expectedHourly = resolveExpectedHourlyRate(expectedBaseRate, rules, ctx, input.branchId, atMs);
    expectedPerPlayer = computeExpectedPerPlayer(input.game, expectedHourly, {
      seriesType: input.seriesType,
      overs: input.overs,
      format: input.format,
      maxPlayers: input.maxPlayers,
      durationMinutes: input.durationMinutes,
      durationHours: input.durationHours,
    });
  }

  // FLOOR: cheapest base rate across the selected branch, every branch, and the
  // zone level (conservative — never above the legitimate price for any branch).
  const candidateSources: any[][] = [
    expectedSources,
    ...branchPricingList(input.zoneDoc).map((p) => [p]),
    [input.zoneDoc?.pricing].filter(Boolean),
  ];
  let cheapestBaseRate: number | null = null;
  for (const sources of candidateSources) {
    if (!sources.length) continue;
    const rate = extractBaseRateFromSources(sources, input.game, ctx, input.format);
    if (rate && rate > 0) {
      cheapestBaseRate = cheapestBaseRate === null ? rate : Math.min(cheapestBaseRate, rate);
    }
  }

  let floorPerPlayer: number | null = null;
  if (cheapestBaseRate && cheapestBaseRate > 0) {
    const floorHourly = resolveFloorHourlyRate(cheapestBaseRate, rules, ctx);
    floorPerPlayer = computeFloorPerPlayer(input.game, floorHourly, Number(input.maxPlayers || 0));
  }

  if (expectedPerPlayer === null && floorPerPlayer === null) return unresolved;

  return {
    resolved: true,
    expectedPerPlayer,
    floorPerPlayer,
  };
}
