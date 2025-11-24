// app/matchrooms/create-flow.tsx
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { KARACHI_AREAS } from "../../constants/profileOptions";
import {
  AREA_PLACEHOLDERS,
  DEFAULT_PLACEHOLDER,
} from "../../constants/zonePlaceholders";
import { useMatchRequestStore } from "../../src/store/matchRequestStore";
import { COLORS } from "../../src/theme";
import styles from "./create-flow.styles";

const SPORT_OPTIONS = [
  { key: "cs2", label: "CS2" },
  { key: "fc25", label: "FC25 / FIFA" },
  { key: "tekken8", label: "Tekken 8" },
  { key: "futsal", label: "Futsal" },
  { key: "indoorCricket", label: "Indoor Cricket" },
  { key: "padel", label: "Padel" },
  { key: "pickleball", label: "Pickleball" },
];

const PARTY_OPTIONS = [
  { key: "solo", label: "Solo" },
  { key: "duo", label: "Duo" },
  { key: "trio", label: "Trio" },
  { key: "quad", label: "Quad" },
  { key: "team", label: "Team" },
];

type SportKey = (typeof SPORT_OPTIONS)[number]["key"];
type PartyKey = (typeof PARTY_OPTIONS)[number]["key"];

type ZonePick = { label: string; type: "gaming" | "court" };

export default function CreateFlow() {
  const { setForm } = useMatchRequestStore();

  const [selectedSport, setSelectedSport] = useState<SportKey>("cs2");
  const [selectedParty, setSelectedParty] = useState<PartyKey>("solo");
  const [timePreference, setTimePreference] = useState("10:00 PM");
  const [selectedArea, setSelectedArea] = useState<string>(KARACHI_AREAS[0]);
  const [selectedZone, setSelectedZone] = useState<ZonePick | null>(null);

  const areaListing = AREA_PLACEHOLDERS[selectedArea] || DEFAULT_PLACEHOLDER;

  const combinedZones = useMemo<ZonePick[]>(
    () => [
      ...areaListing.gamingZones.map((label) => ({ label, type: "gaming" as const })),
      ...areaListing.courts.map((label) => ({ label, type: "court" as const })),
    ],
    [areaListing.courts, areaListing.gamingZones]
  );

  const handleContinue = () => {
    setForm({
      sport: selectedSport as any,
      partyType: selectedParty as any,
      timePreference,
      preferredAreas: [selectedArea],
      preferredZones: selectedZone ? [selectedZone.label] : [],
      notes: selectedZone ? `${selectedZone.label} (${selectedZone.type})` : "",
    });

    router.push("/matchrooms/request-slot");
  };

  const isContinueDisabled = !selectedArea || !timePreference.trim();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Create a matchroom</Text>
            <Text style={styles.sub}>
              Choose your area, pick a sport, and see partner zones before you broadcast a request.
            </Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.secondaryLink}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Where do you want to play?</Text>
          <View style={styles.chipRow}>
            {KARACHI_AREAS.map((area) => {
              const active = area === selectedArea;
              return (
                <Pressable
                  key={area}
                  onPress={() => {
                    setSelectedArea(area);
                    setSelectedZone(null);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{area}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Sport / game</Text>
          <View style={styles.chipRow}>
            {SPORT_OPTIONS.map((sport) => {
              const active = sport.key === selectedSport;
              return (
                <Pressable
                  key={sport.key}
                  onPress={() => setSelectedSport(sport.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{sport.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Party type</Text>
          <View style={styles.chipRow}>
            {PARTY_OPTIONS.map((party) => {
              const active = party.key === selectedParty;
              return (
                <Pressable
                  key={party.key}
                  onPress={() => setSelectedParty(party.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{party.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Preferred time</Text>
          <TextInput
            value={timePreference}
            onChangeText={setTimePreference}
            placeholder="e.g. 10:00 PM"
            placeholderTextColor={COLORS.muted}
            style={styles.inputBox}
          />
          <Text style={styles.helperText}>We’ll broadcast this slot to partner zones.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.label}>Zones & courts in {selectedArea}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Placeholder list</Text>
            </View>
          </View>
          <Text style={styles.helperText}>
            Pick a preferred spot or leave unselected to let offers come in.
          </Text>
          <View style={styles.zoneList}>
            {combinedZones.map((zone) => {
              const active = selectedZone?.label === zone.label;
              return (
                <Pressable
                  key={`${zone.type}-${zone.label}`}
                  onPress={() =>
                    setSelectedZone((prev) =>
                      prev?.label === zone.label ? null : { label: zone.label, type: zone.type }
                    )
                  }
                  style={[styles.zoneRow, active && styles.zoneRowActive]}
                >
                  <View>
                    <Text style={styles.zoneTitle}>{zone.label}</Text>
                    <Text style={styles.zoneMeta}>{zone.type === "gaming" ? "Gaming zone" : "Court"}</Text>
                  </View>
                  {active && <Text style={styles.zoneMeta}>Selected</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.buttonShadowWrapper}>
          <Pressable
            style={[styles.primaryBtn, isContinueDisabled && styles.primaryBtnDisabled]}
            onPress={handleContinue}
            disabled={isContinueDisabled}
          >
            <Text style={styles.primaryBtnText}>Continue to request</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
