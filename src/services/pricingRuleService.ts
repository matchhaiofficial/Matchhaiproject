// src/services/pricingRuleService.ts
// Re-exports from Convex pricing rule service for backwards compatibility
// Original Firebase implementation replaced with Convex backend

export {
    // Types
    type PricingRuleAssetType,
    type PricingRuleType,
    type PricingRule,
    type PricingRuleInput,
    type PricingResolveContext,
    type PricingResolveResult,

    // Pure utility functions
    applyPricingRulesToRate,
    resolveEffectiveRateForGame,

    // Convex data functions
    getEnabledPricingRulesForZone,
    subscribeZonePricingRules,
    createZonePricingRule,
    setZonePricingRuleEnabled,
    deleteZonePricingRule,
} from "./convex/pricingRuleService";
