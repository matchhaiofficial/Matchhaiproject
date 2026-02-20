import { getApiClient } from "../api/client";
export type { PricingResolveContext, PricingResolveResult, PricingRule, PricingRuleAssetType, PricingRuleInput, PricingRuleType } from "../repositories/firebase/pricingRuleService";
export const applyPricingRulesToRate: typeof import("../repositories/firebase/pricingRuleService").applyPricingRulesToRate = (...args) => getApiClient().pricingRules.applyPricingRulesToRate(...args);
export const createZonePricingRule: typeof import("../repositories/firebase/pricingRuleService").createZonePricingRule = (...args) => getApiClient().pricingRules.createZonePricingRule(...args);
export const deleteZonePricingRule: typeof import("../repositories/firebase/pricingRuleService").deleteZonePricingRule = (...args) => getApiClient().pricingRules.deleteZonePricingRule(...args);
export const getEnabledPricingRulesForZone: typeof import("../repositories/firebase/pricingRuleService").getEnabledPricingRulesForZone = (...args) => getApiClient().pricingRules.getEnabledPricingRulesForZone(...args);
export const resolveEffectiveRateForGame: typeof import("../repositories/firebase/pricingRuleService").resolveEffectiveRateForGame = (...args) => getApiClient().pricingRules.resolveEffectiveRateForGame(...args);
export const setZonePricingRuleEnabled: typeof import("../repositories/firebase/pricingRuleService").setZonePricingRuleEnabled = (...args) => getApiClient().pricingRules.setZonePricingRuleEnabled(...args);
export const subscribeZonePricingRules: typeof import("../repositories/firebase/pricingRuleService").subscribeZonePricingRules = (...args) => getApiClient().pricingRules.subscribeZonePricingRules(...args);
