import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  acceptOffer,
  loadRequestWithOffers,
  RequestOffer,
} from "../../src/services/requestService";
import { useRequestStore } from "../../src/store/requestStore";
import { COLORS } from "../../src/theme";

export default function OffersScreen() {
  const router = useRouter();
  const { activeRequest, offers, setActiveRequest, setOffers, status, setStatus } =
    useRequestStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const expiresInMinutes = useMemo(() => {
    if (!activeRequest?.expiresAt) return null;
    const diff = activeRequest.expiresAt - Date.now();
    return diff > 0 ? Math.ceil(diff / 60000) : 0;
  }, [activeRequest]);

  const refresh = useCallback(async () => {
    if (!activeRequest?.id) return;
    try {
      setLoading(true);
      setError(undefined);
      const { request, offers } = await loadRequestWithOffers(activeRequest.id);
      setActiveRequest(request);
      setOffers(offers);
      setStatus(request.status as any);
    } catch (err: any) {
      setError(err?.message || "Unable to load offers");
    } finally {
      setLoading(false);
    }
  }, [activeRequest?.id, setActiveRequest, setOffers, setStatus]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onAccept = async (offer: RequestOffer) => {
    if (!activeRequest?.id) return;
    try {
      setLoading(true);
      const { request, offers } = await acceptOffer(activeRequest.id, offer.id);
      setActiveRequest(request);
      setOffers(offers);
      setStatus("offer-accepted");
    } catch (err: any) {
      setError(err?.message || "Could not accept offer");
    } finally {
      setLoading(false);
    }
  };

  if (!activeRequest) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}
      >
        <Text style={{ color: COLORS.text, marginBottom: 12 }}>
          No request found. Start by requesting a slot.
        </Text>
        <Pressable
          onPress={() => router.replace("/home/request-slot")}
          style={{
            backgroundColor: COLORS.accent,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: COLORS.text, fontFamily: "Montserrat_700Bold" }}>
            Request a slot
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{ padding: 20, gap: 12 }}
    >
      <Text style={{ fontSize: 22, color: COLORS.text, fontFamily: "Montserrat_700Bold" }}>
        Pending offers
      </Text>
      <Text style={{ color: COLORS.muted }}>
        Sport: {activeRequest.sport} • {activeRequest.partyType.toUpperCase()} • {" "}
        {activeRequest.timeWindow}
      </Text>
      {expiresInMinutes !== null && (
        <Text style={{ color: COLORS.muted }}>
          Expires in ~{expiresInMinutes} minutes. Loosen time/areas if nothing comes in.
        </Text>
      )}

      {loading && (
        <View style={{ paddingVertical: 10 }}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      )}

      {error && <Text style={{ color: "tomato" }}>{error}</Text>}

      {offers.length === 0 && !loading && (
        <View
          style={{ backgroundColor: COLORS.card, padding: 12, borderRadius: 12, gap: 6 }}
        >
          <Text style={{ color: COLORS.text, fontFamily: "Montserrat_700Bold" }}>
            Waiting for offers
          </Text>
          <Text style={{ color: COLORS.muted }}>
            We pinged zones in your preferred areas. If nothing arrives soon, try widening
            your time window or add a nearby area.
          </Text>
          <Pressable
            onPress={() => router.push("/home/request-slot")}
            style={{
              backgroundColor: COLORS.accent,
              paddingVertical: 10,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: COLORS.text }}>Adjust request</Text>
          </Pressable>
        </View>
      )}

      {offers.map((offer) => (
        <View
          key={offer.id}
          style={{
            backgroundColor: COLORS.card,
            borderRadius: 12,
            padding: 12,
            gap: 6,
          }}
        >
          <Text style={{ color: COLORS.text, fontFamily: "Montserrat_700Bold" }}>
            {offer.zoneName || offer.zoneId}
          </Text>
          <Text style={{ color: COLORS.text }}>
            Slot: {offer.slotTime || "TBD"} | Price: {offer.price ? `PKR ${offer.price}` : "Quote"}
          </Text>
          {offer.notes ? (
            <Text style={{ color: COLORS.muted }}>{offer.notes}</Text>
          ) : null}
          <Text style={{ color: COLORS.muted }}>Contact: {offer.adminContact}</Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              disabled={status === "offer-accepted" || offer.status === "accepted"}
              onPress={() => onAccept(offer)}
              style={{
                backgroundColor: COLORS.accent,
                paddingVertical: 10,
                borderRadius: 10,
                flex: 1,
                alignItems: "center",
                opacity:
                  status === "offer-accepted" || offer.status === "accepted" ? 0.7 : 1,
              }}
            >
              <Text style={{ color: COLORS.text }}>
                {offer.status === "accepted" ? "Accepted" : "Accept"}
              </Text>
            </Pressable>
            <Pressable
              disabled
              style={{
                backgroundColor: COLORS.background,
                paddingVertical: 10,
                borderRadius: 10,
                flex: 1,
                alignItems: "center",
                borderWidth: 1,
                borderColor: COLORS.card,
              }}
            >
              <Text style={{ color: COLORS.muted }}>
                {offer.status === "rejected" ? "Rejected" : "Waiting"}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable
        onPress={refresh}
        style={{
          backgroundColor: COLORS.card,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: "center",
          marginTop: 4,
        }}
      >
        <Text style={{ color: COLORS.text }}>Refresh offers</Text>
      </Pressable>
    </ScrollView>
  );
}
