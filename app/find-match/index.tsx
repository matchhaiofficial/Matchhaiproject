import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../src/context/AuthContext";
import { createBookingRequest } from "../../src/services/bookingRequestService";
import { COLORS } from "../../src/theme";

export default function FindMatch() {
    const router = useRouter();
    const { user } = useAuth();
    const [game, setGame] = useState("CS2");
    const [time, setTime] = useState(new Date().toISOString());
    const [area, setArea] = useState("Gulshan-e-Iqbal");
    const [submitting, setSubmitting] = useState(false);

    const handleFind = async () => {
        if (!user) return;
        setSubmitting(true);

        const gameKeyMap: Record<string, string> = {
            "CS2": "cs2",
            "FC25": "fc26",
            "Tekken 8": "tekken8",
            "Futsal": "futsal",
            "Indoor Cricket": "indoor_cricket",
            "Padel": "padel",
        };
        const gameKey = gameKeyMap[game] || "cs2";

        const res = await createBookingRequest({
            userId: user.uid,
            userName: user.displayName || "Player",
            gameKey,
            title: `${game} Request`,
            description: "",
            maxPlayers: 10,
            format: undefined,
            teamMode: "solo",
            flexibilityWindow: "Exact time",
            preferredDate: new Date(time),
            preferredTime: new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            preferredAreas: [area],
            budgetPerPlayer: 0,
            currency: "PKR",
        });

        setSubmitting(false);

        if (res.ok) {
            Alert.alert("Request Sent!", "Zone admins will be notified. Waiting for offers...");
            router.push({ pathname: "/find-match/offers", params: { requestId: res.id! } });
        } else {
            Alert.alert("Error", "Failed to send request");
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={{ padding: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: COLORS.divider }}>
                <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                </Pressable>
                <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "bold" }}>Find a Match</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text style={{ color: COLORS.muted, marginBottom: 24 }}>
                    Tell us what you want to play, and we'll find the best zone for you.
                </Text>

                {/* Game Selection */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "bold", marginBottom: 12 }}>1. Select Game</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                        {['CS2', 'FC25', 'Tekken 8', 'Futsal', 'Indoor Cricket', 'Padel'].map(g => (
                            <Pressable
                                key={g}
                                onPress={() => setGame(g)}
                                style={{
                                    backgroundColor: game === g ? COLORS.accent : COLORS.cardBackground,
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    borderColor: game === g ? COLORS.accent : COLORS.divider
                                }}
                            >
                                <Text style={{ color: game === g ? '#fff' : COLORS.text, fontWeight: "600" }}>{g}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Time Selection (Mock) */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "bold", marginBottom: 12 }}>2. Preferred Time</Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable style={{ backgroundColor: COLORS.cardBackground, padding: 12, borderRadius: 8, flex: 1, alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent }}>
                            <Text style={{ color: COLORS.text }}>Now (ASAP)</Text>
                        </Pressable>
                        <Pressable style={{ backgroundColor: COLORS.cardBackground, padding: 12, borderRadius: 8, flex: 1, alignItems: 'center', borderWidth: 1, borderColor: COLORS.divider }}>
                            <Text style={{ color: COLORS.muted }}>Later Today</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Location Selection (Mock) */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "bold", marginBottom: 12 }}>3. Preferred Area</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                        {['Gulshan-e-Iqbal', 'DHA', 'North Nazimabad', 'PECHS', 'Johar'].map(a => (
                            <Pressable
                                key={a}
                                onPress={() => setArea(a)}
                                style={{
                                    backgroundColor: area === a ? COLORS.accent : COLORS.cardBackground,
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: area === a ? COLORS.accent : COLORS.divider
                                }}
                            >
                                <Text style={{ color: area === a ? '#fff' : COLORS.text }}>{a}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <Pressable
                    onPress={handleFind}
                    disabled={submitting}
                    style={({ pressed }) => ({
                        backgroundColor: COLORS.accent,
                        padding: 16,
                        borderRadius: 12,
                        alignItems: "center",
                        marginTop: 20,
                        opacity: (pressed || submitting) ? 0.7 : 1
                    })}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold" }}>Find Zones</Text>
                    )}
                </Pressable>

            </ScrollView>
        </SafeAreaView>
    );
}
