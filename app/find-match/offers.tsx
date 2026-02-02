import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { acceptOffer, getOffersForRequest, ZoneOffer } from "../../src/services/bookingRequestService";
import { COLORS } from "../../src/theme";

export default function OffersScreen() {
    const { requestId } = useLocalSearchParams();
    const router = useRouter();
    const [offers, setOffers] = useState<ZoneOffer[]>([]);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);

    useEffect(() => {
        if (requestId) {
            fetchOffers();
        }
    }, [requestId]);

    const fetchOffers = async () => {
        if (!requestId || typeof requestId !== 'string') return;
        setLoading(true);
        const res = await getOffersForRequest(requestId);
        if (res.ok && res.data) {
            setOffers(res.data);
        }
        setLoading(false);
    };

    const handleAccept = async (offer: ZoneOffer) => {
        if (!offer.id) return;
        setAccepting(true);
        const res = await acceptOffer(offer.id, offer.requestId);
        setAccepting(false);

        if (res.ok) {
            Alert.alert("Success", "Booking Confirmed! Redirecting to lobby...");
            // Create a matchroom from this booking (logic to be added)
            // For now, go to home
            router.replace('/home');
        } else {
            Alert.alert("Error", "Failed to accept offer");
        }
    };

    const renderItem = ({ item }: { item: ZoneOffer }) => (
        <View style={{
            backgroundColor: COLORS.cardBackground,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: COLORS.accent
        }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: 'bold' }}>{item.zoneName}</Text>
                <Text style={{ color: COLORS.accent, fontWeight: 'bold', fontSize: 16 }}>{item.pricePerPlayer} PKR</Text>
            </View>
            <Text style={{ color: COLORS.muted, marginBottom: 12 }}>{item.branchName}</Text>

            {item.message && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 8, marginBottom: 12 }}>
                    <Text style={{ color: COLORS.text, fontStyle: 'italic' }}>"{item.message}"</Text>
                </View>
            )}

            <Pressable
                onPress={() => handleAccept(item)}
                disabled={accepting}
                style={({ pressed }) => ({
                    backgroundColor: COLORS.success,
                    padding: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: (pressed || accepting) ? 0.7 : 1
                })}
            >
                {accepting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Accept Offer</Text>}
            </Pressable>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={{ padding: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: COLORS.divider }}>
                <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                </Pressable>
                <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "bold" }}>Offers</Text>
            </View>

            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={COLORS.accent} />
                    <Text style={{ color: COLORS.muted, marginTop: 16 }}>Looking for offers...</Text>
                </View>
            ) : (
                <FlatList
                    data={offers}
                    renderItem={renderItem}
                    keyExtractor={item => item.id!}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 40 }}>
                            <Text style={{ color: COLORS.muted, textAlign: 'center' }}>No offers yet.</Text>
                            <Text style={{ color: COLORS.muted, textAlign: 'center', marginTop: 8 }}>Zone admins are reviewing your request.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
