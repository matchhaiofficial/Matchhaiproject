// app/super-admin/(tabs)/index.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View
} from "react-native";

import { getPendingZones } from "../../../src/services/superAdminService";
import { Zone } from "../../../src/services/convex/zoneService";
import { COLORS, FONTS, SPACING, RADII, SHADOWS } from "../../../src/theme";
import { useToast } from "../../../src/hooks/useToast";

export default function PendingApprovals() {
    const [pending, setPending] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { showToast } = useToast();

    const fetchPending = async () => {
        setLoading(true);
        const res = await getPendingZones();
        if (res.ok) {
            setPending(res.data);
        } else {
            showToast({
                type: "error",
                title: "Fetch failed",
                message: res.message
            });
        }
        setLoading(false);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        const res = await getPendingZones();
        if (res.ok) {
            setPending(res.data);
        } else {
            showToast({
                type: "error",
                title: "Refresh failed",
                message: res.message
            });
        }
        setRefreshing(false);
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const renderItem = ({ item }: { item: Zone }) => (
        <Pressable
            style={styles.card}
            onPress={() => router.push({ pathname: "/super-admin/request/[id]", params: { id: item.id } })}
        >
            <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                    <MaterialIcons name="business" size={24} color={COLORS.accent} />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.venueName}>{item.venueBrandName}</Text>
                    <Text style={styles.typeText}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={COLORS.muted} />
            </View>

            <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                    <MaterialIcons name="person" size={16} color={COLORS.muted} style={styles.miniIcon} />
                    <Text style={styles.infoText}>{item.ownerFullName || "Unknown Owner"}</Text>
                </View>
                <View style={styles.infoRow}>
                    <MaterialIcons name="location-on" size={16} color={COLORS.muted} style={styles.miniIcon} />
                    <Text style={styles.infoText}>
                        {item.primaryBranch?.areaLabel || "N/A"}, {item.primaryBranch?.city || "N/A"}
                    </Text>
                </View>
                <View style={styles.infoRow}>
                    <MaterialIcons name="event" size={16} color={COLORS.muted} style={styles.miniIcon} />
                    <Text style={styles.infoText}>
                        Submitted: {item.createdAt ? item.createdAt.toDate().toLocaleDateString() : "Pending..."}
                    </Text>
                </View>
            </View>
        </Pressable>
    );

    const handleLogout = async () => {
        const { signOutUser } = await import("../../../src/services/authService");
        await signOutUser();
        router.replace("/auth/login");
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={styles.loadingText}>Fetching pending requests...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTopRow}>
                    <View>
                        <Text style={styles.title}>Pending Approvals</Text>
                        <Text style={styles.subtitle}>{pending.length} registrations requiring review</Text>
                    </View>
                    <Pressable
                        onPress={handleLogout}
                        style={styles.logoutBtn}
                        android_ripple={{ color: COLORS.surfaceHighlight, borderless: true }}
                    >
                        <MaterialIcons name="logout" size={24} color={COLORS.error} />
                    </Pressable>
                </View>
            </View>

            <FlatList
                data={pending}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="check-circle-outline" size={64} color={COLORS.muted} />
                        <Text style={styles.emptyTitle}>All caught up!</Text>
                        <Text style={styles.emptySubtitle}>No pending zone registrations to review.</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: SPACING.screenPadding,
        paddingTop: 60,
        backgroundColor: COLORS.surface,
    },
    headerTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    logoutBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(255, 68, 68, 0.1)",
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontFamily: FONTS.heading,
        fontSize: 24,
        color: COLORS.text,
    },
    subtitle: {
        fontFamily: FONTS.subheading,
        fontSize: 14,
        color: COLORS.muted,
        marginTop: 4,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 12,
        color: COLORS.muted,
    },
    listContent: {
        padding: SPACING.md,
        paddingBottom: SPACING.lg,
    },
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.cardSoft,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surfaceHighlight,
        justifyContent: "center",
        alignItems: "center",
        marginRight: SPACING.md,
    },
    headerText: {
        flex: 1,
    },
    venueName: {
        fontFamily: FONTS.bold,
        fontSize: 18,
        color: COLORS.text,
    },
    typeText: {
        fontFamily: FONTS.body,
        fontSize: 12,
        color: COLORS.accent,
        marginTop: 2,
    },
    cardBody: {
        marginTop: SPACING.md,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 6,
    },
    miniIcon: {
        marginRight: 8,
    },
    infoText: {
        fontFamily: FONTS.body,
        fontSize: 13,
        color: COLORS.muted,
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: 100,
    },
    emptyTitle: {
        fontFamily: FONTS.heading,
        fontSize: 20,
        color: COLORS.text,
        marginTop: 16,
    },
    emptySubtitle: {
        fontFamily: FONTS.body,
        fontSize: 14,
        color: COLORS.muted,
        textAlign: "center",
        marginTop: 8,
        paddingHorizontal: 40,
    },
});
