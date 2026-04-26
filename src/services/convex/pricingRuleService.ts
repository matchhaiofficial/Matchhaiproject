// src/services/convex/pricingRuleService.ts
// Convex-based pricing rule service that wraps Convex queries/mutations
// Maintains the same interface as the Firebase pricing rule service

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Logger from "../../utils/logger";

export type PricingRuleAssetType =
    | "pc"
    | "console"
    | "futsal"
    | "indoor_cricket"
    | "padel"
    | "pickleball";

export type PricingRuleType = "percentage_discount" | "fixed_override";

export interface PricingRule {
    id: string;
    zoneId: string;
    name: string;
    isEnabled: boolean;
    assetType: PricingRuleAssetType;
    branchId?: string | null;
    tier?: string | null;
    surface?: string | null;
    ruleType: PricingRuleType;
    value: number;
    daysOfWeek: number[];
    timeStart: string;
    timeEnd: string;
    validFrom?: string | null;
    validTo?: string | null;
    priority: number;
    createdByUid?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface PricingRuleInput {
    name: string;
    assetType: PricingRuleAssetType;
    branchId?: string | null;
    tier?: string | null;
    surface?: string | null;
    ruleType: PricingRuleType;
    value: number;
    daysOfWeek: number[];
    timeStart: string;
    timeEnd: string;
    validFrom?: string | null;
    validTo?: string | null;
    priority?: number;
}

export interface PricingResolveContext {
    at?: Date;
    assetType: PricingRuleAssetType;
    branchId?: string | null;
    tier?: string | null;
    surface?: string | null;
}

export interface PricingResolveResult {
    rate: number;
    appliedRule: PricingRule | null;
}

// ============================================
// PURE UTILITY FUNCTIONS (no Firebase/Convex dependency)
// ============================================

const RULE_CACHE_TTL_MS = 60 * 1000;
const zoneRulesCache = new Map<string, { fetchedAt: number; rules: PricingRule[] }>();

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

const normalizeString = (value: unknown) =>
    String(value || "").trim().toLowerCase();

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

const toDateOnlyKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeRule = (
    zoneId: string,
    id: string,
    data: Record<string, any>,
): PricingRule => ({
    id,
    zoneId,
    name: data.name || "Pricing Rule",
    isEnabled: data.isEnabled !== false,
    assetType: data.assetType,
    branchId: data.branchId || null,
    tier: data.tier || null,
    surface: data.surface || null,
    ruleType: data.ruleType || (data.flatRate != null ? "fixed_override" : "percentage_discount"),
    value: toNumber(data.value ?? (data.flatRate != null ? data.flatRate : ((1 - Number(data.priceMultiplier || 1)) * 100))),
    daysOfWeek: Array.isArray(data.daysOfWeek)
        ? data.daysOfWeek.map((item: any) => Number(item)).filter((item: number) => Number.isFinite(item))
        : [],
    timeStart: data.timeStart || "00:00",
    timeEnd: data.timeEnd || "23:59",
    validFrom: data.validFrom || null,
    validTo: data.validTo || null,
    priority: Number.isFinite(data.priority) ? Number(data.priority) : 0,
    createdByUid: data.createdByUid,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
});

const isRuleDateMatch = (rule: PricingRule, at: Date) => {
    const currentDate = toDateOnlyKey(at);
    if (rule.validFrom && currentDate < rule.validFrom) return false;
    if (rule.validTo && currentDate > rule.validTo) return false;
    return true;
};

const isRuleDayMatch = (rule: PricingRule, at: Date) => {
    if (!rule.daysOfWeek?.length) return true;
    return rule.daysOfWeek.includes(at.getDay());
};

const isRuleTimeMatch = (rule: PricingRule, at: Date) => {
    const start = parseTimeMinutes(rule.timeStart);
    const end = parseTimeMinutes(rule.timeEnd);
    if (start == null || end == null) return false;

    const current = at.getHours() * 60 + at.getMinutes();
    if (start <= end) {
        return current >= start && current <= end;
    }
    return current >= start || current <= end;
};

const doesRuleMatchContext = (rule: PricingRule, context: PricingResolveContext, at: Date) => {
    if (!rule.isEnabled) return false;
    if (rule.assetType !== context.assetType) return false;

    if (rule.branchId && normalizeString(rule.branchId) !== normalizeString(context.branchId)) {
        return false;
    }
    if (rule.tier && normalizeString(rule.tier) !== normalizeString(context.tier)) {
        return false;
    }
    if (rule.surface && normalizeString(rule.surface) !== normalizeString(context.surface)) {
        return false;
    }

    if (!isRuleDateMatch(rule, at)) return false;
    if (!isRuleDayMatch(rule, at)) return false;
    if (!isRuleTimeMatch(rule, at)) return false;

    return true;
};

const sortRules = (rules: PricingRule[]) =>
    [...rules].sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (a.ruleType !== b.ruleType) {
            if (a.ruleType === "fixed_override") return -1;
            if (b.ruleType === "fixed_override") return 1;
        }
        return 0;
    });

const mapGameToAssetType = (gameKey: string): PricingRuleAssetType | null => {
    const normalized = normalizeString(gameKey);
    if (normalized === "cs2") return "pc";
    if (["fc25", "fc26", "tekken8"].includes(normalized)) return "console";
    if (normalized === "futsal") return "futsal";
    if (normalized === "indoor_cricket") return "indoor_cricket";
    if (normalized === "padel") return "padel";
    if (normalized === "pickleball") return "pickleball";
    return null;
};

// ============================================
// EXPORTED PURE FUNCTIONS
// ============================================

export function applyPricingRulesToRate(
    baseRate: number,
    rules: PricingRule[],
    context: PricingResolveContext,
): PricingResolveResult {
    const rate = Number(baseRate || 0);
    if (!Number.isFinite(rate) || rate <= 0) {
        return { rate: 0, appliedRule: null };
    }

    const at = context.at || new Date();
    const matching = sortRules(rules.filter((rule) => doesRuleMatchContext(rule, context, at)));
    if (!matching.length) {
        return { rate, appliedRule: null };
    }

    const selected = matching[0];
    let nextRate = rate;
    if (selected.ruleType === "fixed_override") {
        nextRate = clamp(selected.value, 0, 999999);
    } else {
        const discount = clamp(selected.value, 0, 100);
        nextRate = rate * (1 - discount / 100);
    }

    return {
        rate: Math.max(0, Math.round(nextRate)),
        appliedRule: selected,
    };
}

export function resolveEffectiveRateForGame(input: {
    gameKey: string;
    baseRate: number | null;
    baseLabel: string | null;
    rules: PricingRule[];
    branchId?: string | null;
    at?: Date;
}) {
    if (!input.baseRate || input.baseRate <= 0) {
        return {
            rate: input.baseRate,
            label: input.baseLabel,
            appliedRule: null as PricingRule | null,
        };
    }

    const assetType = mapGameToAssetType(input.gameKey);
    if (!assetType) {
        return {
            rate: input.baseRate,
            label: input.baseLabel,
            appliedRule: null as PricingRule | null,
        };
    }

    const resolved = applyPricingRulesToRate(input.baseRate, input.rules, {
        at: input.at,
        assetType,
        branchId: input.branchId || null,
    });

    const suffix = resolved.appliedRule ? ` (${resolved.appliedRule.name})` : "";
    return {
        rate: resolved.rate,
        label: resolved.rate ? `${resolved.rate} PKR/hr${suffix}` : input.baseLabel,
        appliedRule: resolved.appliedRule,
    };
}

// ============================================
// CONVEX DATA FUNCTIONS
// ============================================

export async function getEnabledPricingRulesForZone(
    zoneId: string,
    options?: { forceRefresh?: boolean },
): Promise<PricingRule[]> {
    const cache = zoneRulesCache.get(zoneId);
    const now = Date.now();
    if (
        !options?.forceRefresh &&
        cache &&
        now - cache.fetchedAt < RULE_CACHE_TTL_MS
    ) {
        return cache.rules;
    }

    try {
        const docs = await convex.query(api.zones.listPricingRules, {
            zoneId: zoneId as Id<"zones">,
        });
        const rules = docs.map((item: any) =>
            normalizeRule(zoneId, item._id, item as Record<string, any>),
        );
        const sorted = sortRules(rules);
        zoneRulesCache.set(zoneId, { fetchedAt: now, rules: sorted });
        return sorted;
    } catch (error) {
        Logger.error("pricingRuleService", "Failed to fetch enabled rules", error);
        return [];
    }
}

export function subscribeZonePricingRules(
    zoneId: string,
    onData: (rules: PricingRule[]) => void,
    onError: (error: any) => void,
) {
    // Convex subscriptions are handled via useQuery in components.
    // This function provides a polling fallback for imperative usage.
    let active = true;

    const poll = async () => {
        try {
            const docs = await convex.query(api.zones.listPricingRules, {
                zoneId: zoneId as Id<"zones">,
            });
            if (!active) return;
            const rules = sortRules(
                docs.map((item: any) =>
                    normalizeRule(zoneId, item._id, item as Record<string, any>),
                ),
            );
            zoneRulesCache.set(zoneId, { fetchedAt: Date.now(), rules });
            onData(rules);
        } catch (error: any) {
            if (!active) return;
            Logger.error("pricingRuleService", "Rules poll failed", error);
            onError(error);
        }
    };

    // Initial fetch
    poll();

    // Poll periodically (Convex useQuery is preferred in components)
    const interval = setInterval(poll, RULE_CACHE_TTL_MS);

    // Return unsubscribe function
    return () => {
        active = false;
        clearInterval(interval);
    };
}

export async function createZonePricingRule(
    zoneId: string,
    input: PricingRuleInput,
    createdByUid: string,
) {
    try {
        await convex.mutation(api.zones.createPricingRule, {
            zoneId: zoneId as Id<"zones">,
            name: input.name.trim(),
            assetType: input.assetType,
            branchId: input.branchId || undefined,
            isEnabled: true,
            priority: Number.isFinite(input.priority) ? Number(input.priority) : 0,
            tier: input.tier || undefined,
            surface: input.surface || undefined,
            ruleType: input.ruleType,
            value: clamp(input.value, 0, 999999),
            timeStart: input.timeStart || "00:00",
            timeEnd: input.timeEnd || "23:59",
            daysOfWeek: (input.daysOfWeek || []).filter((value) => value >= 0 && value <= 6),
            validFrom: input.validFrom || undefined,
            validTo: input.validTo || undefined,
            priceMultiplier: input.ruleType === "percentage_discount" ? (1 - clamp(input.value, 0, 100) / 100) : undefined,
            flatRate: input.ruleType === "fixed_override" ? clamp(input.value, 0, 999999) : undefined,
            createdByUid,
        });
        zoneRulesCache.delete(zoneId);
        return { ok: true as const };
    } catch (error: any) {
        Logger.error("pricingRuleService", "Failed to create rule", error);
        return { ok: false as const, message: error?.message || "Failed to create pricing rule." };
    }
}

export async function setZonePricingRuleEnabled(
    zoneId: string,
    ruleId: string,
    isEnabled: boolean,
    updatedByUid?: string,
) {
    try {
        await convex.mutation(api.zones.updatePricingRule, {
            ruleId: ruleId as Id<"pricingRules">,
            updatedByUid,
            isEnabled,
        });
        zoneRulesCache.delete(zoneId);
        return { ok: true as const };
    } catch (error: any) {
        Logger.error("pricingRuleService", "Failed to update rule toggle", error);
        return { ok: false as const, message: error?.message || "Failed to update rule." };
    }
}

export async function deleteZonePricingRule(zoneId: string, ruleId: string, deletedByUid?: string) {
    try {
        await convex.mutation(api.zones.deletePricingRule, {
            ruleId: ruleId as Id<"pricingRules">,
            deletedByUid,
        });
        zoneRulesCache.delete(zoneId);
        return { ok: true as const };
    } catch (error: any) {
        Logger.error("pricingRuleService", "Failed to delete rule", error);
        return { ok: false as const, message: error?.message || "Failed to delete rule." };
    }
}
