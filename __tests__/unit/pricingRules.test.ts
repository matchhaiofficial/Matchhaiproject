// Phase 1E — pricing rule derivation (pure functions, no network).
import {
  applyPricingRulesToRate,
  resolveEffectiveRateForGame,
  type PricingRule,
} from "../../src/services/pricingRuleService";

function rule(overrides: Partial<PricingRule>): PricingRule {
  return {
    id: "r1",
    zoneId: "zone_main",
    name: "Rule",
    isEnabled: true,
    assetType: "pc",
    branchId: null,
    tier: null,
    surface: null,
    ruleType: "percentage_discount",
    value: 0,
    daysOfWeek: [], // empty => matches any day
    timeStart: "00:00",
    timeEnd: "23:59",
    validFrom: null,
    validTo: null,
    priority: 0,
    ...overrides,
  };
}

const at = new Date("2026-06-10T12:00:00"); // local noon, within 00:00-23:59

describe("applyPricingRulesToRate", () => {
  it("returns the base rate untouched when no rules match", () => {
    const res = applyPricingRulesToRate(250, [], { assetType: "pc", at });
    expect(res.rate).toBe(250);
    expect(res.appliedRule).toBeNull();
  });

  it("applies a percentage discount", () => {
    const res = applyPricingRulesToRate(250, [rule({ ruleType: "percentage_discount", value: 20 })], {
      assetType: "pc",
      at,
    });
    expect(res.rate).toBe(200); // 250 * 0.8
    expect(res.appliedRule).not.toBeNull();
  });

  it("applies a fixed override", () => {
    const res = applyPricingRulesToRate(250, [rule({ ruleType: "fixed_override", value: 99 })], {
      assetType: "pc",
      at,
    });
    expect(res.rate).toBe(99);
  });

  it("ignores rules whose assetType does not match", () => {
    const res = applyPricingRulesToRate(250, [rule({ assetType: "console", value: 50 })], {
      assetType: "pc",
      at,
    });
    expect(res.rate).toBe(250);
  });

  it("ignores disabled rules", () => {
    const res = applyPricingRulesToRate(250, [rule({ isEnabled: false, value: 50 })], { assetType: "pc", at });
    expect(res.rate).toBe(250);
  });

  it("higher priority wins; fixed_override preferred on tie", () => {
    const rules = [
      rule({ id: "low", priority: 1, ruleType: "percentage_discount", value: 50 }),
      rule({ id: "high", priority: 5, ruleType: "fixed_override", value: 100 }),
    ];
    const res = applyPricingRulesToRate(250, rules, { assetType: "pc", at });
    expect(res.appliedRule?.id).toBe("high");
    expect(res.rate).toBe(100);
  });

  it("guards against invalid base rates", () => {
    expect(applyPricingRulesToRate(0, [], { assetType: "pc", at }).rate).toBe(0);
    expect(applyPricingRulesToRate(-5, [], { assetType: "pc", at }).rate).toBe(0);
  });
});

describe("resolveEffectiveRateForGame", () => {
  it("maps cs2 -> pc and applies a matching rule", () => {
    const res = resolveEffectiveRateForGame({
      gameKey: "cs2",
      baseRate: 300,
      baseLabel: "300 PKR/hr",
      rules: [rule({ assetType: "pc", ruleType: "fixed_override", value: 150 })],
      at,
    });
    expect(res.rate).toBe(150);
    expect(res.label).toMatch(/150 PKR\/hr/);
  });

  it("returns base rate for games with no asset mapping (e.g. valorant)", () => {
    const res = resolveEffectiveRateForGame({
      gameKey: "valorant",
      baseRate: 300,
      baseLabel: "300 PKR/hr",
      rules: [rule({ assetType: "pc", ruleType: "fixed_override", value: 150 })],
      at,
    });
    expect(res.rate).toBe(300);
    expect(res.appliedRule).toBeNull();
  });

  it("free/zero base rate passes through (free flow)", () => {
    const res = resolveEffectiveRateForGame({
      gameKey: "cs2",
      baseRate: 0,
      baseLabel: "Free",
      rules: [rule({ assetType: "pc", ruleType: "fixed_override", value: 150 })],
      at,
    });
    expect(res.rate).toBe(0);
    expect(res.label).toBe("Free");
  });
});
