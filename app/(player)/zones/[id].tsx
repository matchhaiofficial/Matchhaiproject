import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { db } from "../../../src/config/firebaseConfig";
import { Zone } from "../../../src/services/zoneService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./zones.styles";

export default function PlayerZoneDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [zone, setZone] = useState<Zone | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchZoneDetails();
        }
    }, [id]);

    const fetchZoneDetails = async () => {
        try {
            const docRef = doc(db, "zones", id as string);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setZone({ id: docSnap.id, ...docSnap.data() } as Zone);
            } else {
                Logger.error("ZoneDetails", "Zone not found", { id });
            }
        } catch (error) {
            Logger.error("ZoneDetails", "Failed to fetch zone details", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (!zone) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Zone Not Found</Text>
                </View>
                <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={64} color={COLORS.muted} />
                    <Text style={styles.errorText}>We couldn't find the details for this zone.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const { primaryBranch, games } = zone;
    const address = [primaryBranch?.addressLine1, primaryBranch?.areaLabel, primaryBranch?.city]
        .filter(Boolean)
        .join(", ");

    // Extract supported games
    const supportedGamesList = Object.entries(games || {})
        .filter(([key, value]) => value === true)
        .map(([key]) => key.replace('supports', '').toUpperCase());

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.background }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Zone Details</Text>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Visual Banner */}
                <View style={styles.banner}>
                    <MaterialIcons name="store" size={80} color="rgba(255,255,255,0.2)" />
                    <View style={styles.bannerOverlay}>
                        <Text style={styles.venueName}>{zone.venueBrandName}</Text>
                    </View>
                </View>

                {/* Location Card */}
                <View style={styles.infoCard}>
                    <View style={styles.locationRow}>
                        <MaterialIcons name="location-on" size={24} color={COLORS.accent} />
                        <Text style={styles.locationText}>{address || "Location unavailable"}</Text>
                    </View>
                    {primaryBranch?.googleMapsUrl && (
                        <TouchableOpacity style={{ marginTop: 8 }}>
                            <Text style={{ color: COLORS.accent, fontSize: 13, fontWeight: '600' }}>
                                View on Google Maps
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Supported Games */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Supported Games</Text>
                    <View style={styles.tagsRow}>
                        {supportedGamesList.map((game) => (
                            <View key={game} style={styles.tag}>
                                <Text style={styles.tagText}>{game}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Pricing Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Pricing</Text>

                    {/* PC Gaming Pricing */}
                    {zone.pricing?.pc && (
                        <View style={styles.infoCard}>
                            <Text style={styles.pricingCategory}>PC GAMING</Text>
                            {zone.pricing.pc.elite && zone.pricing.pc.elite.price > 0 && (
                                <View style={styles.priceRow}>
                                    <Text style={styles.priceLabel}>Elite PCs</Text>
                                    <Text style={styles.priceValue}>₨ {zone.pricing.pc.elite.price}/hr</Text>
                                </View>
                            )}
                            {zone.pricing.pc.premium && zone.pricing.pc.premium.price > 0 && (
                                <View style={styles.priceRow}>
                                    <Text style={styles.priceLabel}>Premium PCs</Text>
                                    <Text style={styles.priceValue}>₨ {zone.pricing.pc.premium.price}/hr</Text>
                                </View>
                            )}
                            {zone.pricing.pc.regular && zone.pricing.pc.regular.price > 0 && (
                                <View style={[styles.priceRow, { borderBottomWidth: 0 }]}>
                                    <Text style={styles.priceLabel}>Regular PCs</Text>
                                    <Text style={styles.priceValue}>₨ {zone.pricing.pc.regular.price}/hr</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Console Gaming Pricing */}
                    {zone.pricing?.console?.ps5 && (
                        <View style={styles.infoCard}>
                            <Text style={styles.pricingCategory}>PLAYSTATION 5</Text>
                            {zone.pricing.console.ps5.price1v1 > 0 && (
                                <View style={styles.priceRow}>
                                    <Text style={styles.priceLabel}>1v1 (2 Controllers)</Text>
                                    <Text style={styles.priceValue}>₨ {zone.pricing.console.ps5.price1v1}/hr</Text>
                                </View>
                            )}
                            {zone.pricing.console.ps5.price2v2 > 0 && (
                                <View style={[styles.priceRow, { borderBottomWidth: 0 }]}>
                                    <Text style={styles.priceLabel}>2v2 (4 Controllers)</Text>
                                    <Text style={styles.priceValue}>₨ {zone.pricing.console.ps5.price2v2}/hr</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Sports Court Pricing */}
                    {[
                        { key: 'futsal', label: 'FUTSAL' },
                        { key: 'padel', label: 'PADEL' },
                        { key: 'pickleball', label: 'PICKLEBALL' },
                        { key: 'indoorCricket', label: 'INDOOR CRICKET' }
                    ].map((sport) => {
                        const pricing = (zone.pricing as any)?.[sport.key];
                        if (!pricing || Object.keys(pricing).length === 0) return null;

                        return (
                            <View key={sport.key} style={styles.infoCard}>
                                <Text style={styles.pricingCategory}>{sport.label}</Text>
                                {Object.entries(pricing).map(([tier, data]: [string, any], index, array) => (
                                    <View key={tier} style={[styles.priceRow, index === array.length - 1 && { borderBottomWidth: 0 }]}>
                                        <Text style={styles.priceLabel}>{tier.toUpperCase()}</Text>
                                        <Text style={styles.priceValue}>₨ {data.price}/hr</Text>
                                    </View>
                                ))}
                            </View>
                        );
                    })}
                </View>

                {/* Create Matchroom CTA */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push({
                        pathname: "/matchrooms/create",
                        params: { zoneId: zone.id, zoneName: zone.venueBrandName }
                    })}
                >
                    <Text style={styles.actionButtonText}>Book Now</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
