// app/super-admin/request/[id].tsx
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../src/config/firebaseConfig";
import { approveZone, rejectZone } from "../../../src/services/superAdminService";
import { Zone } from "../../../src/services/zoneService";
import { COLORS, FONTS, SPACING, RADII } from "../../../src/theme";
import { useToast } from "../../../src/hooks/useToast";

export default function RequestDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [request, setRequest] = useState<Zone | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        async function fetchRequest() {
            if (!id) return;
            try {
                const docRef = doc(db, "zones", id);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setRequest({ id: snap.id, ...snap.data() } as Zone);
                }
            } catch (error) {
                console.error("Error fetching request detail:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchRequest();
    }, [id]);

    const handleApprove = async () => {
        if (!id) return;
        Alert.alert(
            "Approve Request",
            "Are you sure you want to approve this zone registration?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Approve",
                    onPress: async () => {
                        setProcessing(true);
                        const res = await approveZone(id);
                        setProcessing(false);
                        if (res.ok) {
                            showToast({ type: "success", title: "Approved", message: "Zone is now active." });
                            router.back();
                        } else {
                            showToast({ type: "error", title: "Error", message: res.message });
                        }
                    }
                }
            ]
        );
    };

    const handleReject = () => {
        Alert.prompt(
            "Reject Request",
            "Please provide a reason for rejection:",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reject",
                    style: "destructive",
                    onPress: async (reason: string | undefined) => {
                        if (!id || !reason) return;
                        setProcessing(true);
                        const res = await rejectZone(id, reason);
                        setProcessing(false);
                        if (res.ok) {
                            showToast({ type: "success", title: "Rejected", message: "Zone registration has been rejected." });
                            router.back();
                        } else {
                            showToast({ type: "error", title: "Error", message: res.message });
                        }
                    },
                },
            ],
            "plain-text"
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (!request) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Request not found.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.brandName}>{request.venueBrandName}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{request.type.toUpperCase()}</Text>
                    </View>
                </View>

                <Section title="Account Details" icon="person">
                    <InfoRow label="Owner Name" value={request.ownerFullName} />
                    <InfoRow label="Contact Email" value={request.contactEmail} />
                    <InfoRow label="Contact Phone" value={request.contactPhone || "N/A"} />
                </Section>

                <Section title={`Branches (${request.branches?.length || 0})`} icon="location-on">
                    {request.branches?.length > 0 ? (
                        request.branches.map((branch, idx) => (
                            <View key={branch.id} style={{ marginBottom: idx < request.branches.length - 1 ? 20 : 0, paddingBottom: idx < request.branches.length - 1 ? 20 : 0, borderBottomWidth: idx < request.branches.length - 1 ? 1 : 0, borderBottomColor: COLORS.divider }}>
                                <Text style={{ color: COLORS.accent, fontWeight: 'bold', marginBottom: 8 }}>{branch.branchDisplayName}</Text>
                                <InfoRow label="Address" value={branch.addressLine1 || "N/A"} />
                                <InfoRow label="Area" value={branch.areaLabel || "N/A"} />
                                <InfoRow label="City" value={branch.city || "N/A"} />
                            </View>
                        ))
                    ) : (
                        <View>
                            <InfoRow label="Address" value={request.primaryBranch.addressLine1 || "N/A"} />
                            <InfoRow label="Area" value={request.primaryBranch.areaLabel || "N/A"} />
                            <InfoRow label="City" value={request.primaryBranch.city || "N/A"} />
                        </View>
                    )}
                </Section>

                <Section title="Inventory Summary" icon="inventory">
                    {request.games.supportsCs2 && <Text style={styles.summaryItem}>• PC Gaming (CS2 Support)</Text>}
                    {(request.games.supportsFc25 || request.games.supportsTekken8) && <Text style={styles.summaryItem}>• Console Gaming (FC/Tekken Support)</Text>}
                    {request.games.supportsFutsal && <Text style={styles.summaryItem}>• Futsal Courts</Text>}
                    {request.games.supportsIndoorCricket && <Text style={styles.summaryItem}>• Indoor Cricket Nets</Text>}
                    {request.games.supportsPadel && <Text style={styles.summaryItem}>• Padel Courts</Text>}
                    {request.games.supportsPickleball && <Text style={styles.summaryItem}>• Pickleball Courts</Text>}
                </Section>

                <View style={styles.buttonRow}>
                    <Pressable
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={handleReject}
                        disabled={processing}
                    >
                        <Text style={styles.buttonText}>Reject</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={handleApprove}
                        disabled={processing}
                    >
                        {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Approve</Text>}
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}

function Section({ title, icon, children }: { title: string, icon: any, children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <MaterialIcons name={icon} size={20} color={COLORS.accent} />
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <View style={styles.sectionContent}>
                {children}
            </View>
        </View>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    errorText: {
        color: COLORS.error,
        fontFamily: FONTS.body,
    },
    scrollContent: {
        padding: SPACING.screenPadding,
        paddingBottom: 60,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: SPACING.xxl,
    },
    brandName: {
        fontFamily: FONTS.heading,
        fontSize: 24,
        color: COLORS.text,
        flex: 1,
    },
    badge: {
        backgroundColor: COLORS.accent + "20",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: RADII.xs,
        marginLeft: 12,
    },
    badgeText: {
        color: COLORS.accent,
        fontSize: 10,
        fontFamily: FONTS.bold,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: SPACING.sm,
    },
    sectionTitle: {
        fontFamily: FONTS.bold,
        fontSize: 16,
        color: COLORS.text,
        marginLeft: 8,
    },
    sectionContent: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.md,
        padding: SPACING.md,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    infoLabel: {
        fontFamily: FONTS.body,
        fontSize: 13,
        color: COLORS.muted,
    },
    infoValue: {
        fontFamily: FONTS.body,
        fontSize: 13,
        color: COLORS.text,
        textAlign: "right",
        flex: 1,
        marginLeft: 20,
    },
    summaryItem: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: 14,
        marginBottom: 4,
    },
    buttonRow: {
        flexDirection: "row",
        marginTop: SPACING.xxl,
    },
    actionButton: {
        flex: 1,
        height: 50,
        borderRadius: RADII.lg,
        justifyContent: "center",
        alignItems: "center",
    },
    rejectButton: {
        backgroundColor: "#444",
        marginRight: 10,
    },
    approveButton: {
        backgroundColor: COLORS.accent,
        marginLeft: 10,
    },
    buttonText: {
        color: "#fff",
        fontFamily: FONTS.bold,
        fontSize: 16,
    },
});
