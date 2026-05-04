import { useEffect, useState } from "react";
import {
  applyPricingRulesToRate,
  getEnabledPricingRulesForZone,
  type PricingRule,
} from "../../../../src/services/pricingRuleService";
import type { Zone } from "../../../../src/services/convex/zoneService";

export type ZoneRateOption = {
  key: string;
  label: string;
  price: number;
  detailLabel: string;
  resourceContext: {
    assetType: string;
    tier?: string;
    surface?: string;
  };
};

type FormDataShape = {
  format: string;
  maxPlayers: number;
  overs: string;
  seriesType: string;
  pricePerPlayer: number;
};

type Params<T extends FormDataShape> = {
  selectedZoneId: string | null;
  selectedZone: Zone | null;
  selectedGame: string | null;
  seriesType: string;
  duration: number;
  formData: T;
  isZoneWalkInAdmin: boolean;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
};

const isCsStyleGame = (gameKey: string | null | undefined) =>
  gameKey === "cs2" || gameKey === "cs16" || gameKey === "valorant";

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const formatCategoryLabel = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export function useMatchroomCreatePricing<T extends FormDataShape>({
  selectedZoneId,
  selectedZone,
  selectedGame,
  seriesType,
  duration,
  formData,
  isZoneWalkInAdmin,
  setFormData,
}: Params<T>) {
  const [zonePricingRules, setZonePricingRules] = useState<PricingRule[]>([]);
  const [zoneRate, setZoneRate] = useState<number>(0);
  const [zoneRateOptions, setZoneRateOptions] = useState<ZoneRateOption[]>([]);
  const [selectedZoneRateKey, setSelectedZoneRateKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    const loadPricingRules = async () => {
      if (!selectedZoneId) {
        setZonePricingRules([]);
        return;
      }

      const rules = await getEnabledPricingRulesForZone(selectedZoneId);
      if (!cancelled) {
        setZonePricingRules(rules);
      }
    };

    void loadPricingRules();
    return () => {
      cancelled = true;
    };
  }, [selectedZoneId]);

  useEffect(() => {
    if (isCsStyleGame(selectedGame) && zoneRate > 0) {
      const hoursMap: Record<string, number> = {
        BO1: 1,
        BO3: 3,
        BO5: 5,
        BO10: 10,
      };
      const hours = hoursMap[seriesType] || 1;
      setFormData((prev) => ({ ...prev, pricePerPlayer: zoneRate * hours }));
      return;
    }

    if (selectedGame === "fc26" && zoneRate > 0) {
      const hoursMap: Record<string, number> = {
        BO1: 0.5,
        BO3: 1,
        BO5: 2,
        BO10: 3,
      };
      const hours = hoursMap[seriesType] || 1;
      const totalConsoleCost = zoneRate * hours;
      const divisor = formData.format === "2v2" ? 4 : 2;
      setFormData((prev) => ({
        ...prev,
        pricePerPlayer: totalConsoleCost / divisor,
      }));
      return;
    }

    if (selectedGame === "tekken8" && zoneRate > 0) {
      const hoursMap: Record<string, number> = {
        BO1: 1,
        BO3: 2,
        BO5: 3,
        BO7: 1,
        BO20: 2,
        BO40: 3,
      };
      const hours = hoursMap[seriesType] || 1;
      const totalConsoleCost = zoneRate * hours;
      const divisor = formData.format === "2v2" ? 4 : 2;
      setFormData((prev) => ({
        ...prev,
        pricePerPlayer: totalConsoleCost / divisor,
      }));
      return;
    }

    if (selectedGame === "futsal" && zoneRate > 0) {
      const totalCourtCost = zoneRate * duration;
      const pricePerPlayer =
        formData.maxPlayers > 0 ? totalCourtCost / formData.maxPlayers : 0;
      setFormData((prev) => ({
        ...prev,
        pricePerPlayer: Math.ceil(pricePerPlayer),
      }));
      return;
    }

    if (selectedGame === "indoor_cricket" && zoneRate > 0) {
      const calcDuration = formData.overs === "6" ? 2.5 : 2;
      const totalCourtCost = zoneRate * calcDuration;
      const pricePerPlayer =
        formData.maxPlayers > 0 ? totalCourtCost / formData.maxPlayers : 0;
      setFormData((prev) => ({
        ...prev,
        pricePerPlayer: Math.ceil(pricePerPlayer),
      }));
      return;
    }

    if (selectedGame === "padel" && zoneRate > 0) {
      const seriesKey = isZoneWalkInAdmin ? seriesType : formData.seriesType;
      const hoursMap: Record<string, number> = {
        BO1: 1,
        BO3: 2,
        BO5: 3,
        BO10: 3,
      };
      const hours = hoursMap[seriesKey || ""] || 1;
      setFormData((prev) => ({
        ...prev,
        pricePerPlayer: Math.ceil((zoneRate * hours) / 4),
      }));
      return;
    }

    if (selectedGame === "pickleball" && zoneRate > 0) {
      const seriesKey = isZoneWalkInAdmin ? seriesType : formData.seriesType;
      const hoursMap: Record<string, number> = {
        BO1: 1,
        BO3: 2,
        BO5: 3,
        BO10: 3,
      };
      const hours = hoursMap[seriesKey || ""] || 1;
      const players = formData.format === "2v2" ? 4 : 2;
      setFormData((prev) => ({
        ...prev,
        pricePerPlayer: Math.ceil((zoneRate * hours) / players),
      }));
    }
  }, [
    duration,
    formData.format,
    formData.maxPlayers,
    formData.overs,
    formData.seriesType,
    isZoneWalkInAdmin,
    selectedGame,
    seriesType,
    setFormData,
    zoneRate,
  ]);

  useEffect(() => {
    if (!selectedZone || !selectedGame) {
      setZoneRateOptions([]);
      setSelectedZoneRateKey(null);
      setZoneRate(0);
      return;
    }

    const pricingSources = [
      (selectedZone.branches?.[0] as any)?.pricing,
      selectedZone.pricing,
    ].filter(Boolean);
    const options: ZoneRateOption[] = [];
    const branchId = selectedZone.branches?.[0]?.id || null;

    const formatLabel = formData.format === "2v2" ? "2v2" : "1v1";
    const priceKey = formData.format === "2v2" ? "price2v2" : "price1v1";
    const otherPriceKey = priceKey === "price1v1" ? "price2v2" : "price1v1";

    const getFirstPositivePrice = (...values: unknown[]) => {
      for (const value of values) {
        const parsed = toPositiveNumber(value);
        if (parsed) return parsed;
      }
      return null;
    };

    const addOption = (
      key: string,
      label: string,
      rawPrice: unknown,
      context: { assetType: any; tier?: string; surface?: string },
    ) => {
      const price = toPositiveNumber(rawPrice);
      if (!price) return;

      const resolved = applyPricingRulesToRate(price, zonePricingRules, {
        at: new Date(),
        assetType: context.assetType,
        branchId,
        tier: context.tier || null,
        surface: context.surface || null,
      });

      const hasPromo = Boolean(resolved.appliedRule);
      options.push({
        key,
        label,
        price: resolved.rate,
        detailLabel: hasPromo
          ? `${label} | PKR ${resolved.rate}/hr | Promo`
          : `${label} | PKR ${resolved.rate}/hr`,
        resourceContext: context,
      });
    };

    const getPricingBucket = (bucketKey: string) =>
      pricingSources.find((source: any) => source?.[bucketKey])?.[bucketKey] ||
      {};

    if (isCsStyleGame(selectedGame)) {
      const pc = getPricingBucket("pc");
      addOption("pc:regular", "Regular", pc?.regular?.price, {
        assetType: "pc",
        tier: "regular",
      });
      addOption("pc:premium", "Premium", pc?.premium?.price, {
        assetType: "pc",
        tier: "premium",
      });
      addOption("pc:elite", "Elite", pc?.elite?.price, {
        assetType: "pc",
        tier: "elite",
      });
    } else if (selectedGame === "fc26" || selectedGame === "tekken8") {
      const console = getPricingBucket("console");
      const regular = console.regular || {};
      const premium = console.premium || {};
      const elite = console.elite || {};

      const regularPrice = getFirstPositivePrice(
        regular?.[priceKey],
        regular?.[otherPriceKey],
        regular?.price,
      );
      const premiumPrice = getFirstPositivePrice(
        premium?.[priceKey],
        premium?.[otherPriceKey],
        premium?.price,
      );
      const elitePrice = getFirstPositivePrice(
        elite?.[priceKey],
        elite?.[otherPriceKey],
        elite?.price,
      );

      addOption("console:regular", `Regular (${formatLabel})`, regularPrice, {
        assetType: "console",
        tier: "regular",
      });
      addOption("console:premium", `Premium (${formatLabel})`, premiumPrice, {
        assetType: "console",
        tier: "premium",
      });
      addOption("console:elite", `Elite (${formatLabel})`, elitePrice, {
        assetType: "console",
        tier: "elite",
      });
    } else if (selectedGame === "futsal") {
      const futsal = getPricingBucket("futsal");
      Object.entries(futsal).forEach(([key, val]: any) => {
        const label = formatCategoryLabel(String(key));
        addOption(`futsal:${key}`, label, val?.price, {
          assetType: "futsal",
          surface: key,
        });
      });
    } else if (selectedGame === "indoor_cricket") {
      const cricket =
        pricingSources.find((source: any) => source?.indoorCricket)
          ?.indoorCricket ||
        pricingSources.find((source: any) => source?.indoor_cricket)
          ?.indoor_cricket ||
        {};
      Object.entries(cricket || {}).forEach(([key, val]: any) => {
        const label = formatCategoryLabel(String(key));
        addOption(`cricket:${key}`, label, val?.price, {
          assetType: "indoor_cricket",
          surface: key,
        });
      });
    } else if (selectedGame === "padel") {
      const padel = getPricingBucket("padel");
      Object.entries(padel).forEach(([key, val]: any) => {
        const label = formatCategoryLabel(String(key));
        addOption(`padel:${key}`, label, val?.price, {
          assetType: "padel",
          surface: key,
        });
      });
    } else if (selectedGame === "pickleball") {
      const pickleball = getPricingBucket("pickleball");
      Object.entries(pickleball).forEach(([key, val]: any) => {
        const label = formatCategoryLabel(String(key));
        addOption(`pickleball:${key}`, label, val?.price, {
          assetType: "pickleball",
          surface: key,
        });
      });
    }

    setZoneRateOptions(options);
    if (options.length === 0) {
      setSelectedZoneRateKey(null);
      setZoneRate(0);
      return;
    }

    if (selectedZoneRateKey) {
      const match = options.find((opt) => opt.key === selectedZoneRateKey);
      if (match) {
        setZoneRate(match.price);
        return;
      }
    }

    if (options.length === 1) {
      setSelectedZoneRateKey(options[0].key);
      setZoneRate(options[0].price);
      return;
    }

    setSelectedZoneRateKey(null);
    setZoneRate(0);
  }, [
    formData.format,
    selectedGame,
    selectedZone,
    selectedZoneRateKey,
    zonePricingRules,
  ]);

  const selectZoneRateOption = (key: string, price: number) => {
    setSelectedZoneRateKey(key);
    setZoneRate(price);
  };

  const resetZoneRateSelection = () => {
    setSelectedZoneRateKey(null);
    setZoneRate(0);
  };

  return {
    zonePricingRules,
    zoneRate,
    zoneRateOptions,
    selectedZoneRateKey,
    setZoneRate,
    setSelectedZoneRateKey,
    selectZoneRateOption,
    resetZoneRateSelection,
  };
}
