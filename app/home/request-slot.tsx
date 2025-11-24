import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../../src/context/AuthContext";
import {
  BookingRequestPayload,
  submitBookingRequest,
} from "../../src/services/requestService";
import { useRequestStore } from "../../src/store/requestStore";
import { COLORS } from "../../src/theme";

const PARTY_TYPES: BookingRequestPayload["partyType"][] = [
  "solo",
  "duo",
  "trio",
  "quad",
  "team",
];

export default function RequestSlot() {
  const { user } = useAuth();
  const [sport, setSport] = useState("futsal");
  const [timeWindow, setTimeWindow] = useState("This weekend");
  const [partyType, setPartyType] = useState<BookingRequestPayload["partyType"]>(
    "duo"
  );
  const [preferredAreas, setPreferredAreas] = useState("DHA, Clifton");
  const [preferredZones, setPreferredZones] = useState("Zone A, Zone B");
  const [submitting, setSubmitting] = useState(false);

  const { setActiveRequest, setOffers, setStatus } = useRequestStore();

  const parsedAreas = useMemo(
    () =>
      preferredAreas
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    [preferredAreas]
  );
  const parsedZones = useMemo(
    () =>
      preferredZones
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    [preferredZones]
  );

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      const payload: BookingRequestPayload = {
        sport,
        timeWindow,
        partyType,
        preferredAreas: parsedAreas,
        preferredZones: parsedZones,
        requester: {
          uid: user?.uid,
          name: user?.displayName || user?.email || "Guest",
          email: user?.email || undefined,
        },
      };

      const request = await submitBookingRequest(payload);
      setActiveRequest(request);
      setOffers([]);
      setStatus((request.status as any) || "pending");
      Alert.alert("Request sent", "We are notifying zones now.");
      router.push("/home/offers");
    } catch (err: any) {
      Alert.alert("Could not submit", err?.message || "Please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: 20, gap: 12 }}
    >
      <Text style={{ fontSize: 22, color: COLORS.text, fontFamily: "Montserrat_700Bold" }}>
        Request a slot
      </Text>
      <Text style={{ color: COLORS.muted, marginBottom: 8 }}>
        Tell us your sport, time window, party type, and where you want to play.
        We will ping eligible zones and surface offers here.
      </Text>

      <View style={{ gap: 6 }}>
        <Text style={{ color: COLORS.text }}>Sport</Text>
        <TextInput
          value={sport}
          onChangeText={setSport}
          placeholder="e.g. futsal"
          style={{
            borderWidth: 1,
            borderColor: COLORS.card,
            borderRadius: 10,
            padding: 12,
            color: COLORS.text,
          }}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ color: COLORS.text }}>Time window</Text>
        <TextInput
          value={timeWindow}
          onChangeText={setTimeWindow}
          placeholder="Tonight 8-10pm"
          style={{
            borderWidth: 1,
            borderColor: COLORS.card,
            borderRadius: 10,
            padding: 12,
            color: COLORS.text,
          }}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ color: COLORS.text }}>Party type</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {PARTY_TYPES.map((type) => {
            const selected = partyType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setPartyType(type)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: selected ? COLORS.accent : COLORS.card,
                }}
              >
                <Text
                  style={{
                    color: selected ? COLORS.text : COLORS.muted,
                    fontFamily: "Montserrat_700Bold",
                  }}
                >
                  {type.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ color: COLORS.text }}>Preferred areas</Text>
        <TextInput
          value={preferredAreas}
          onChangeText={setPreferredAreas}
          placeholder="Comma separated areas"
          style={{
            borderWidth: 1,
            borderColor: COLORS.card,
            borderRadius: 10,
            padding: 12,
            color: COLORS.text,
          }}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ color: COLORS.text }}>Preferred zones</Text>
        <TextInput
          value={preferredZones}
          onChangeText={setPreferredZones}
          placeholder="Comma separated zones"
          style={{
            borderWidth: 1,
            borderColor: COLORS.card,
            borderRadius: 10,
            padding: 12,
            color: COLORS.text,
          }}
        />
      </View>

      <View style={{
        backgroundColor: COLORS.card,
        padding: 12,
        borderRadius: 12,
        gap: 6,
      }}>
        <Text style={{ color: COLORS.text, fontFamily: "Montserrat_700Bold" }}>
          Fallback tips
        </Text>
        <Text style={{ color: COLORS.muted }}>
          If you don't see offers quickly, consider widening the time window or
          nearby areas. We'll keep your request active for 30 minutes.
        </Text>
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        style={{
          backgroundColor: COLORS.accent,
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: "center",
          marginTop: 6,
          opacity: submitting ? 0.7 : 1,
        }}
      >
        <Text style={{ color: COLORS.text, fontFamily: "Montserrat_700Bold" }}>
          {submitting ? "Sending..." : "Send request"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
