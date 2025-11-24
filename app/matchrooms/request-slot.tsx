// app/matchrooms/request-slot.tsx
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "../../src/context/AuthContext";
import {
  acceptOffer,
  buildPayloadFromForm,
  createBroadcastRequest,
  fetchRequestOffers,
} from "../../src/services/matchRequestService";
import {
  useMatchRequestStore,
  PartyType,
  SportCode,
} from "../../src/store/matchRequestStore";
import { COLORS, SPACING, TEXT_SIZES } from "../../src/theme";
import styles from "./request.styles";

const SPORT_OPTIONS: { code: SportCode; label: string }[] = [
  { code: "cs2", label: "CS2" },
  { code: "fc25", label: "FC25 / FIFA" },
  { code: "tekken8", label: "Tekken 8" },
  { code: "futsal", label: "Futsal" },
  { code: "indoorCricket", label: "Indoor Cricket" },
  { code: "padel", label: "Padel" },
  { code: "pickleball", label: "Pickleball" },
];

const PARTY_OPTIONS: { code: PartyType; label: string }[] = [
  { code: "solo", label: "Solo" },
  { code: "duo", label: "Duo" },
  { code: "trio", label: "Trio" },
  { code: "quad", label: "Quad" },
  { code: "team", label: "Team" },
];

const toList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function RequestSlot() {
  const { user } = useAuth();
  const {
    form,
    setForm,
    requestId,
    offers,
    selectedOfferId,
    status,
    lastError,
    expiresAt,
    setStatus,
    setRequestResult,
    setSelectedOffer,
    setOffers,
    setError,
    resetAll,
  } = useMatchRequestStore();

  const [areasInput, setAreasInput] = useState(
    form.preferredAreas.length > 0 ? form.preferredAreas.join(", ") : ""
  );
  const [zonesInput, setZonesInput] = useState(
    form.preferredZones.length > 0 ? form.preferredZones.join(", ") : ""
  );

  const isSubmitting = status === "submitting";
  const isAccepting = status === "accepting";
  const hasOffers = offers.length > 0;

  const isFormValid = useMemo(() => {
    const hasArea = toList(areasInput).length > 0 || form.preferredAreas.length > 0;
    return (
      !!form.sport &&
      !!form.partyType &&
      (form.timePreference?.trim()?.length || 0) > 0 &&
      hasArea
    );
  }, [areasInput, form.partyType, form.preferredAreas.length, form.sport, form.timePreference]);

  const syncInputsToForm = () => {
    setForm({
      preferredAreas: toList(areasInput),
      preferredZones: toList(zonesInput),
    });
  };

  const handleSubmit = async () => {
    syncInputsToForm();
    setStatus("submitting");
    setError(undefined);

    const payload = buildPayloadFromForm(
      {
        ...form,
        preferredAreas: toList(areasInput),
        preferredZones: toList(zonesInput),
      },
      user
    );

    const res = await createBroadcastRequest(payload);

    if (!res.ok) {
      setStatus("idle");
      setError(res.message);
      Alert.alert("Could not create request", res.message);
      return;
    }

    setRequestResult({
      requestId: res.data.requestId,
      offers: res.data.offers,
      expiresAt: res.data.expiresAt,
      status: res.data.offers.length > 0 ? "offers_ready" : "awaiting_offers",
    });
  };

  const handleRefreshOffers = async () => {
    if (!requestId) return;
    setStatus("awaiting_offers");
    setError(undefined);

    const res = await fetchRequestOffers(requestId);

    if (!res.ok) {
      setStatus("offers_ready");
      setError(res.message);
      Alert.alert("Could not refresh offers", res.message);
      return;
    }

    setOffers(res.data);
    setStatus("offers_ready");
  };

  const handleAcceptOffer = async (offerId: string) => {
    if (!requestId) return;
    setStatus("accepting");
    setError(undefined);

    const res = await acceptOffer(requestId, offerId);

    if (!res.ok) {
      setStatus("offers_ready");
      setError(res.message);
      Alert.alert("Could not accept offer", res.message);
      return;
    }

    const updated = offers.map((offer) =>
      offer.id === offerId
        ? { ...offer, status: "accepted" as const }
        : { ...offer, status: offer.status === "accepted" ? "declined" : offer.status || "declined" }
    );

    setOffers(updated);
    setSelectedOffer(res.data.id);
    setStatus("offers_ready");
  };

  const handleReset = () => {
    resetAll();
    setAreasInput("");
    setZonesInput("");
  };

  const buttonShadow = isFormValid ? styles.buttonShadowWrapperActive : undefined;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Request a slot</Text>
            <Text style={styles.sub}>
              Broadcast a 10pm-style request to partner zones and pick the best offer.
            </Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.secondaryLink}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.label}>Sport / game</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Step 1 of 2</Text>
            </View>
          </View>
          <View style={styles.chipRow}>
            {SPORT_OPTIONS.map((option) => {
              const active = form.sport === option.code;
              return (
                <Pressable
                  key={option.code}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setForm({ sport: option.code })}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: SPACING.lg }}>
            <Text style={styles.label}>Party type</Text>
            <View style={styles.chipRow}>
              {PARTY_OPTIONS.map((option) => {
                const active = form.partyType === option.code;
                return (
                  <Pressable
                    key={option.code}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setForm({ partyType: option.code })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ marginTop: SPACING.lg }}>
            <Text style={styles.label}>Preferred areas</Text>
            <TextInput
              value={areasInput}
              onChangeText={(text) => {
                setAreasInput(text);
              }}
              onBlur={() => setForm({ preferredAreas: toList(areasInput) })}
              placeholder="Federal B Area, Tariq Road, Defence"
              placeholderTextColor={COLORS.muted}
              style={styles.inputBox}
              autoCapitalize="words"
            />
            <Text style={styles.helperText}>
              We’ll alert partner zones in these areas. Add at least one.
            </Text>
          </View>

          <View style={{ marginTop: SPACING.lg }}>
            <Text style={styles.label}>Preferred zones (optional)</Text>
            <TextInput
              value={zonesInput}
              onChangeText={(text) => setZonesInput(text)}
              onBlur={() => setForm({ preferredZones: toList(zonesInput) })}
              placeholder="O2, Nuke Town, Velocity"
              placeholderTextColor={COLORS.muted}
              style={styles.inputBox}
              autoCapitalize="words"
            />
            <Text style={styles.helperText}>
              Leave blank to broadcast to all eligible zones in your areas.
            </Text>
          </View>

          <View style={{ marginTop: SPACING.lg }}>
            <Text style={styles.label}>Time preference</Text>
            <TextInput
              value={form.timePreference}
              onChangeText={(text) => setForm({ timePreference: text })}
              placeholder="10:00 PM"
              placeholderTextColor={COLORS.muted}
              style={styles.inputBox}
              autoCapitalize="none"
            />
            <Text style={styles.helperText}>
              Zones can reply with the closest slot if 10pm isn’t open.
            </Text>
          </View>

          <View style={{ marginTop: SPACING.lg }}>
            <Text style={styles.label}>Notes for zones (optional)</Text>
            <TextInput
              value={form.notes}
              onChangeText={(text) => setForm({ notes: text })}
              placeholder="We’re a duo, need PCs side by side."
              placeholderTextColor={COLORS.muted}
              style={[styles.inputBox, { minHeight: 80 }]}
              multiline
            />
          </View>

          {lastError ? (
            <Text style={[styles.helperText, { color: COLORS.error }]}>{lastError}</Text>
          ) : null}

          <View style={[styles.buttonShadowWrapper, buttonShadow]}>
            <Pressable
              onPress={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              style={({ pressed }) => [
                styles.primaryBtn,
                (!isFormValid || isSubmitting) && styles.primaryBtnDisabled,
                pressed && isFormValid && { opacity: 0.9 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {requestId ? "Update request" : "Broadcast request"}
                </Text>
              )}
            </Pressable>
          </View>
          <View style={{ marginTop: SPACING.sm }}>
            <Pressable onPress={handleReset} hitSlop={6}>
              <Text style={styles.secondaryLink}>Reset</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.label}>Offers from zones</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {requestId ? `Request #${requestId.slice(-6)}` : "No request yet"}
              </Text>
            </View>
          </View>

          {!requestId && (
            <Text style={styles.helperText}>
              Broadcast your time and preferred areas to let nearby zones bid for the slot.
            </Text>
          )}

          {requestId ? (
            <View>
              {expiresAt ? (
                <Text style={[styles.helperText, { marginBottom: SPACING.sm }]}>Offer window ends at {expiresAt}</Text>
              ) : null}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: SPACING.sm,
                }}
              >
                <Pressable onPress={handleRefreshOffers} hitSlop={6}>
                  <Text style={styles.secondaryLink}>Refresh offers</Text>
                </Pressable>
                {status === "awaiting_offers" && (
                  <Text style={[styles.muted, { marginLeft: SPACING.md }]}>Waiting for zone responses…</Text>
                )}
              </View>

              {hasOffers ? (
                offers.map((offer) => {
                  const isSelected = selectedOfferId === offer.id || offer.status === "accepted";
                  return (
                    <View key={offer.id} style={styles.offerCard}>
                      <View style={styles.offerHeader}>
                        <View>
                          <Text style={styles.offerTitle}>{offer.zoneName}</Text>
                          <Text style={styles.offerMeta}>
                            {offer.areaLabel} • {offer.sport.toUpperCase()} • {offer.time || form.timePreference}
                          </Text>
                        </View>
                        <View style={styles.offerBadge}>
                          <Text style={styles.offerBadgeText}>
                            {offer.currency || "PKR"} {offer.pricePerPlayer || 0} / player
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.helperText}>{offer.message}</Text>

                      <View style={styles.offerFooter}>
                        <Text style={styles.offerMeta}>
                          {offer.slotsSummary || "Slots"} • ETA {offer.responseEtaMinutes || 5} min
                        </Text>
                        <Pressable
                          onPress={() => handleAcceptOffer(offer.id)}
                          disabled={isAccepting || isSelected}
                          style={({ pressed }) => [
                            styles.primaryBtn,
                            (isAccepting || isSelected) && styles.primaryBtnDisabled,
                            { paddingVertical: SPACING.sm },
                            pressed && !isSelected && { opacity: 0.9 },
                          ]}
                        >
                          {isAccepting && selectedOfferId === offer.id ? (
                            <ActivityIndicator color={COLORS.text} />
                          ) : (
                            <Text style={[styles.primaryBtnText, { fontSize: TEXT_SIZES.label }]}>
                              {isSelected ? "Accepted" : "Accept"}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.helperText}>
                  No offers yet. Hit refresh after a minute to check for new bids.
                </Text>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
