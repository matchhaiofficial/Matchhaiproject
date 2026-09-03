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
  date?: string;
  time?: string;
};

type Params<T extends FormDataShape> = {
  selectedZoneId: string | null;
  selectedZone: Zone | null;
  selectedBranchId?: string | null;
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

const resolvePricingDate = (formData: FormDataShape) => {
  const date = String(formData.date || "").trim();
  const time = String(formData.time || "00:00").trim();
  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return new Date();
  const normalizedTime = time.match(/^\d{1,2}:\d{2}$/) ? time : "00:00";
  const parsed = new Date(`${date}T${normalizedTime}`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const setPricePerPlayerIfChanged = <T extends FormDataShape>(
  setFormData: React.Dispatch<React.SetStateAction<T>>,
  nextPrice: number,
) => {
  setFormData((prev) => {
    if (prev.pricePerPlayer === nextPrice) return prev;
    return { ...prev, pricePerPlayer: nextPrice };
  });
};

const zoneRateOptionsEqual = (
  left: ZoneRateOption[],
  right: ZoneRateOption[],
) => {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return (
      other &&
      item.key === other.key &&
      item.label === other.label &&
      item.price === other.price &&
      item.detailLabel === other.detailLabel &&
      item.resourceContext.assetType === other.resourceContext.assetType &&
      item.resourceContext.tier === other.resourceContext.tier &&
      item.resourceContext.surface === other.resourceContext.surface
    );
  });
};

export function useMatchroomCreatePricing<T extends FormDataShape>({
  selectedZoneId,
  selectedZone,
  selectedBranchId,
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
      setPricePerPlayerIfChanged(setFormData, zoneRate * hours);
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
      setPricePerPlayerIfChanged(setFormData, totalConsoleCost / divisor);
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
      setPricePerPlayerIfChanged(setFormData, totalConsoleCost / divisor);
      return;
    }

    if (selectedGame === "futsal" && zoneRate > 0) {
      const totalCourtCost = zoneRate * duration;
      const pricePerPlayer =
        formData.maxPlayers > 0 ? totalCourtCost / formData.maxPlayers : 0;
      setPricePerPlayerIfChanged(setFormData, Math.ceil(pricePerPlayer));
      return;
    }

    if (selectedGame === "indoor_cricket" && zoneRate > 0) {
      const calcDuration = formData.overs === "6" ? 2.5 : 2;
      const totalCourtCost = zoneRate * calcDuration;
      const pricePerPlayer =
        formData.maxPlayers > 0 ? totalCourtCost / formData.maxPlayers : 0;
      setPricePerPlayerIfChanged(setFormData, Math.ceil(pricePerPlayer));
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
      setPricePerPlayerIfChanged(setFormData, Math.ceil((zoneRate * hours) / 4));
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
      setPricePerPlayerIfChanged(setFormData, Math.ceil((zoneRate * hours) / players));
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

    const selectedBranch =
      selectedBranchId && Array.isArray(selectedZone.branches)
        ? (selectedZone.branches as any[]).find((branch) => String(branch?.id || "") === String(selectedBranchId))
        : null;
    const pricingBranch = selectedBranch || (selectedZone.branches?.[0] as any) || null;
    const pricingSources = [
      pricingBranch?.pricing,
      selectedZone.pricing,
    ].filter(Boolean);
    const options: ZoneRateOption[] = [];
    const branchId = pricingBranch?.id || selectedBranchId || null;
    const pricingDate = resolvePricingDate(formData);

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
        at: pricingDate,
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
        surface: "5v5",
      });
      addOption("pc:premium", "Premium", pc?.premium?.price, {
        assetType: "pc",
        tier: "premium",
        surface: "5v5",
      });
      addOption("pc:elite", "Elite", pc?.elite?.price, {
        assetType: "pc",
        tier: "elite",
        surface: "5v5",
      });
    } else if (selectedGame === "fc26" || selectedGame === "tekken8") {
      const console = getPricingBucket("console");
      const regular = console.regular || {};
      const premium = console.premium || {};
      const elite = console.elite || {};
      const ps5 = console.ps5 || {};
      const xbox = console.xbox || {};

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
      const ps5Price = getFirstPositivePrice(
        ps5?.[priceKey],
        ps5?.[otherPriceKey],
        ps5?.price,
      );
      const xboxPrice = getFirstPositivePrice(
        xbox?.[priceKey],
        xbox?.[otherPriceKey],
        xbox?.price,
      );
      const consoleSurface = formData.format === "2v2" ? "2v2" : "1v1";

      addOption("console:regular", `Regular (${formatLabel})`, regularPrice, {
        assetType: "console",
        tier: "regular",
        surface: consoleSurface,
      });
      addOption("console:premium", `Premium (${formatLabel})`, premiumPrice, {
        assetType: "console",
        tier: "premium",
        surface: consoleSurface,
      });
      addOption("console:elite", `Elite (${formatLabel})`, elitePrice, {
        assetType: "console",
        tier: "elite",
        surface: consoleSurface,
      });
      addOption("console:ps5", `PS5 (${formatLabel})`, ps5Price, {
        assetType: "console",
        tier: "ps5",
        surface: consoleSurface,
      });
      addOption("console:xbox", `Xbox (${formatLabel})`, xboxPrice, {
        assetType: "console",
        tier: "xbox",
        surface: consoleSurface,
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

    setZoneRateOptions((prev) => (zoneRateOptionsEqual(prev, options) ? prev : options));
    if (options.length === 0) {
      setSelectedZoneRateKey((prev) => (prev === null ? prev : null));
      setZoneRate((prev) => (prev === 0 ? prev : 0));
      return;
    }

    if (selectedZoneRateKey) {
      const match = options.find((opt) => opt.key === selectedZoneRateKey);
      if (match) {
        setZoneRate((prev) => (prev === match.price ? prev : match.price));
        return;
      }
    }

    if (options.length === 1) {
      setSelectedZoneRateKey((prev) => (prev === options[0].key ? prev : options[0].key));
      setZoneRate((prev) => (prev === options[0].price ? prev : options[0].price));
      return;
    }

    setSelectedZoneRateKey((prev) => (prev === null ? prev : null));
    setZoneRate((prev) => (prev === 0 ? prev : 0));
  }, [
    formData.format,
    formData.date,
    formData.time,
    selectedGame,
    selectedZone,
    selectedBranchId,
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
