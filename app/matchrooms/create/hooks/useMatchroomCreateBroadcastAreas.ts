import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getActiveZones } from "../../../../src/services/convex/zoneService";
import type { UserProfile } from "../../../../src/services/userService";
import Logger from "../../../../src/utils/logger";

type Params = {
  locationMode: "zone" | "broadcast";
  selectedGame: string | null;
  userProfile: UserProfile | null;
};

const normalizeAreaList = (values: unknown[]) =>
  Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

const getZoneAreaLabels = (zone: any) => {
  const labels = new Set<string>();
  const primaryArea = String(zone?.primaryBranch?.areaLabel || "").trim();
  if (primaryArea) labels.add(primaryArea);
  const branches = Array.isArray(zone?.branches) ? zone.branches : [];
  for (const branch of branches) {
    const areaLabel = String(branch?.areaLabel || "").trim();
    if (areaLabel) labels.add(areaLabel);
  }
  return Array.from(labels);
};

export function useMatchroomCreateBroadcastAreas({
  locationMode,
  selectedGame,
  userProfile,
}: Params) {
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastPrefillKey, setLastPrefillKey] = useState<string | null>(null);
  const didManuallyEditRef = useRef(false);

  const preferredAreas = useMemo(
    () => normalizeAreaList(userProfile?.areasPreferred || []),
    [userProfile?.areasPreferred],
  );

  useEffect(() => {
    let cancelled = false;

    const loadAreas = async () => {
      if (!selectedGame) {
        setAvailableAreas([]);
        return;
      }

      setLoading(true);
      try {
        const result = await getActiveZones(selectedGame);
        if (!result.ok || !result.data) {
          if (!cancelled) setAvailableAreas([]);
          return;
        }

        const nextAreas = normalizeAreaList(
          result.data.flatMap((zone) => getZoneAreaLabels(zone)),
        );
        if (!cancelled) {
          setAvailableAreas(nextAreas);
        }
      } catch (error) {
        Logger.error("CreateMatchroom", "Failed to load broadcast areas", error);
        if (!cancelled) {
          setAvailableAreas([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAreas();
    return () => {
      cancelled = true;
    };
  }, [selectedGame]);

  useEffect(() => {
    setSelectedAreas((current) =>
      current.filter((area) => availableAreas.includes(area)),
    );
  }, [availableAreas]);

  useEffect(() => {
    if (locationMode !== "broadcast") return;
    const eligiblePreferredAreas = preferredAreas.filter((area) =>
      availableAreas.includes(area),
    );
    const prefillKey = JSON.stringify({
      eligiblePreferredAreas,
      selectedGame,
    });

    if (didManuallyEditRef.current && lastPrefillKey === prefillKey) {
      return;
    }

    if (!selectedAreas.length) {
      setSelectedAreas(eligiblePreferredAreas);
      setLastPrefillKey(prefillKey);
      didManuallyEditRef.current = false;
    }
  }, [
    availableAreas,
    lastPrefillKey,
    locationMode,
    preferredAreas,
    selectedAreas.length,
    selectedGame,
  ]);

  const setBroadcastAreas = useCallback((areas: string[]) => {
    didManuallyEditRef.current = true;
    setSelectedAreas(normalizeAreaList(areas));
  }, []);

  const toggleArea = useCallback((area: string) => {
    const normalizedArea = String(area || "").trim();
    if (!normalizedArea) return;
    didManuallyEditRef.current = true;
    setSelectedAreas((current) =>
      current.includes(normalizedArea)
        ? current.filter((value) => value !== normalizedArea)
        : normalizeAreaList([...current, normalizedArea]),
    );
  }, []);

  return {
    availableAreas,
    loading,
    preferredAreas,
    selectedAreas,
    setBroadcastAreas,
    toggleArea,
  };
}
