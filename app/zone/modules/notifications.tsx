import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query, updateDoc, where, doc, getDocs, writeBatch } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import Screen from "../../../src/components/Screen";
import { db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { respondToMatchJoinRequest } from "../../../src/services/matchService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./notifications.styles";

type AdminNotification = {
    id: string;
    type: string;
    title?: string;
    message?: string;
    status?: string;
    createdAt?: any;
    fromUid?: string;
    fromUsername?: string;
    toUid?: string;
    meta?: Record<string, any>;
};

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

const formatTime = (value: any) => {
    const ms = toMillis(value);
    if (!ms) return "Now";
    return new Date(ms).toLocaleString();
};

const getTypeLabel = (value?: string) =>
    String(value || "notification")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getTypeIcon = (value?: string): keyof typeof MaterialIcons.glyphMap => {
    const type = String(value || "").toLowerCase();
    if (type.includes("booking")) return "event-available";
    if (type.includes("resource")) return "dns";
    if (type.includes("security")) return "security";
    if (type.includes("match")) return "sports-esports";
    if (type.includes("admin")) return "admin-panel-settings";
    return "notifications-active";
};

export default function ZoneNotificationsModule() {
    const router = useRouter();
    const { user } = useAuth();

    const [items, setItems] = useState<AdminNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "seen">("all");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [clearing, setClearing] = useState(false);

    useEffect(() => {
        if (!user?.uid) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "notifications"),
            where("toUid", "==", user.uid),
        );

        const unsub = onSnapshot(
            q,
            (snapshot: any) => {
                const rows = snapshot.docs
                    .map((item: any) => ({ id: item.id, ...item.data() } as AdminNotification))
                    .filter((item: AdminNotification) => {
                        const type = String(item.type || "").toLowerCase();
                        return type.includes("booking") || type.includes("resource") || type.includes("admin") || type.includes("match");
                    })
                    .sort((a: AdminNotification, b: AdminNotification) => toMillis(b.createdAt) - toMillis(a.createdAt));
                setItems(rows);
                setLoading(false);
            },
            (error: any) => {
                setLoading(false);
                if (error?.code === "permission-denied") {
                    setErrorText("Notifications access denied by Firestore rules.");
                    return;
                }
                setErrorText("Failed to load notifications.");
            },
        );

        return () => unsub();
    }, [user?.uid]);

    const pendingCount = useMemo(
        () => items.filter((item) => item.status === "pending").length,
        [items],
    );
    const seenCount = useMemo(
        () => items.filter((item) => item.status === "seen").length,
        [items],
    );
    const filteredItems = useMemo(
        () => items.filter((item) => (statusFilter === "all" ? true : item.status === statusFilter)),
        [items, statusFilter],
    );

    const markSeenIfPending = async (item: AdminNotification) => {
        try {
            if (item.status === "pending") {
                await updateDoc(doc(db, "notifications", item.id), {
                    status: "seen",
                });
            }
        } catch (error) {
            Logger.warn("ZoneNotifications", "Unable to mark notification seen", error);
        }
    };

    const openBookings = (params: Record<string, any>) => {
        router.push({
            pathname: "/zone/modules/bookings",
            params,
        } as any);
    };

    const openResources = (params: Record<string, any>) => {
        router.push({
            pathname: "/zone/modules/resources",
            params,
        } as any);
    };

    const handleClearAll = async () => {
        if (!user?.uid || items.length === 0) return;
        Alert.alert(
            "Clear All Notifications",
            "Are you sure? This will mark all notifications as seen.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear All",
                    style: "destructive",
                    onPress: async () => {
                        setClearing(true);
                        try {
                            const batch = writeBatch(db);
                            items.forEach((item) => {
                                if (item.status === "pending") {
                                    batch.update(doc(db, "notifications", item.id), { status: "seen", isRead: true });
                                }
                            });
                            await batch.commit();
                        } catch (e) {
                            Logger.error("ZoneNotifications", "Clear all failed", e);
                        } finally {
                            setClearing(false);
                        }
                    },
                },
            ],
        );
    };

    const handleAcceptReject = async (item: AdminNotification, decision: 'accept' | 'reject') => {
        if (!user?.uid) return;
        setProcessingId(item.id);
        try {
            const res = await respondToMatchJoinRequest(item.id, decision, user.uid);
            if (res.ok) {
                if (decision === 'accept') {
                    Alert.alert("Accepted", `${item.fromUsername || 'Player'} has been added to the room.`);
                } else {
                    Alert.alert("Rejected", "Request has been rejected.");
                }
            } else {
                Alert.alert("Error", res.message);
            }
        } catch (e) {
            Logger.error("ZoneNotifications", "Accept/Reject failed", e);
        } finally {
            setProcessingId(null);
        }
    };

    const openNotification = async (item: AdminNotification) => {
        await markSeenIfPending(item);

        const meta = item.meta || {};
        const type = String(item.type || "").toLowerCase();

        // Match join requests → go directly to matchroom detail page
        if (type.includes("match") && meta.matchroomId) {
            router.push(`/matchrooms/${meta.matchroomId}` as any);
            return;
        }

        if (meta.requestId || meta.matchroomId || type.includes("booking")) {
            openBookings({
                segment: meta.matchroomId ? "matchrooms" : "requests",
                requestId: meta.requestId,
                matchroomId: meta.matchroomId,
            });
            return;
        }

        if (meta.branchId || meta.resourceId || type.includes("resource")) {
            openResources({
                branchId: meta.branchId,
                requestId: meta.requestId,
                resourceId: meta.resourceId,
            });
            return;
        }

        openBookings({});
    };

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader
                title="Notifications Center"
                subtitle={`Pending alerts: ${pendingCount}`}
                onBack={() => router.back()}
                inlineTitle
            />
            <SegmentedTabs
                items={[
                    { key: "all", label: "All", badge: items.length },
                    { key: "pending", label: "Pending", badge: pendingCount },
                    { key: "seen", label: "Seen", badge: seenCount },
                ]}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as "all" | "pending" | "seen")}
                style={styles.segmentTabs}
            />

            {errorText ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorText}</Text>
                </View>
            ) : null}

            {/* Clear All Button */}
            {items.length > 0 && (
                <Pressable
                    onPress={handleClearAll}
                    disabled={clearing || pendingCount === 0}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        opacity: pendingCount === 0 ? 0.4 : 1,
                    }}
                >
                    {clearing ? (
                        <ActivityIndicator size="small" color={COLORS.error} />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialIcons name="delete-sweep" size={18} color={COLORS.error} />
                            <Text style={{ color: COLORS.error, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Clear All</Text>
                        </View>
                    )}
                </Pressable>
            )}

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                ) : filteredItems.length === 0 ? (
                    <Text style={styles.emptyText}>No admin notifications yet.</Text>
                ) : (
                    filteredItems.map((item) => {
                        const meta = item.meta || {};
                        const status = String(item.status || "new").toLowerCase();
                        const typeLabel = getTypeLabel(item.type);
                        const iconName = getTypeIcon(item.type);
                        const isMatchRequest = String(item.type || '').toLowerCase().includes('match');
                        const title = item.title || item.message || "Admin Alert";
                        const message =
                            item.message && item.message !== item.title
                                ? item.message
                                : "";
                        const requestId = String(meta.requestId || meta.requestRef || "").trim();
                        const requestLabel = requestId || "";
                        const matchroomId = String(meta.matchroomId || "").trim();
                        const matchroomLabel = String(meta.matchroomTitle || matchroomId || "").trim();
                        const hasResourceContext = !!meta.resourceId || !!meta.branchId;
                        const resourceLabel = String(meta.resourceName || meta.resourceId || "Resources").trim();
                        const playerLabel = String(meta.userName || meta.playerName || meta.requesterName || "").trim();

                        return (
                            <Pressable
                                key={item.id}
                                onPress={() => openNotification(item)}
                                style={styles.card}
                            >
                                <View style={styles.cardTop}>
                                    <View style={styles.cardIconWrap}>
                                        <MaterialIcons name={iconName} size={18} color={COLORS.accent} />
                                    </View>
                                    <View style={styles.cardHeaderText}>
                                        <Text style={styles.cardTitle} numberOfLines={1}>
                                            {isMatchRequest ? `${item.fromUsername || 'Player'} wants to join` : title}
                                        </Text>
                                        <Text style={styles.cardType}>{typeLabel}</Text>
                                    </View>
                                    <Text style={[styles.cardStatus, status === "pending" ? styles.statusPending : styles.statusSeen]}>
                                        {status}
                                    </Text>
                                </View>
                                {isMatchRequest ? (
                                    <View style={{ marginTop: 6 }}>
                                        <Text style={styles.cardMessage}>
                                            Room: {meta.matchroomTitle || meta.matchroomId || 'Unknown'} • Game: {meta.game || '—'}
                                        </Text>
                                        <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 2 }}>
                                            Role: {meta.role || 'Flex'} • Team: {meta.targetTeam || 'Any'}
                                        </Text>
                                    </View>
                                ) : (
                                    !!message && (
                                        <Text style={styles.cardMessage}>{message}</Text>
                                    )
                                )}
                                <Text style={styles.cardTime}>{formatTime(item.createdAt)}</Text>

                                {!isMatchRequest && (
                                    <View style={styles.metaRow}>
                                        {!!playerLabel && (
                                            <Pressable style={styles.metaChip} onPress={() => openNotification(item)}>
                                                <MaterialIcons name="person-outline" size={12} color={COLORS.accent} />
                                                <Text style={styles.metaChipText} numberOfLines={1}>
                                                    {playerLabel}
                                                </Text>
                                            </Pressable>
                                        )}
                                        {!!requestId && (
                                            <Pressable
                                                style={styles.metaChip}
                                                onPress={async () => {
                                                    await markSeenIfPending(item);
                                                    openBookings({ segment: "requests", requestId });
                                                }}
                                            >
                                                <MaterialIcons name="fact-check" size={12} color={COLORS.accent} />
                                                <Text style={styles.metaChipText} numberOfLines={1}>
                                                    {requestLabel}
                                                </Text>
                                            </Pressable>
                                        )}
                                        {!!matchroomId && (
                                            <Pressable
                                                style={styles.metaChip}
                                                onPress={async () => {
                                                    await markSeenIfPending(item);
                                                    openBookings({ segment: "matchrooms", matchroomId });
                                                }}
                                            >
                                                <MaterialIcons name="sports-esports" size={12} color={COLORS.accent} />
                                                <Text style={styles.metaChipText} numberOfLines={1}>
                                                    {matchroomLabel}
                                                </Text>
                                            </Pressable>
                                        )}
                                        {hasResourceContext && (
                                            <Pressable
                                                style={styles.metaChip}
                                                onPress={async () => {
                                                    await markSeenIfPending(item);
                                                    openResources({
                                                        branchId: meta.branchId,
                                                        requestId: meta.requestId,
                                                        resourceId: meta.resourceId,
                                                    });
                                                }}
                                            >
                                                <MaterialIcons name="dns" size={12} color={COLORS.accent} />
                                                <Text style={styles.metaChipText} numberOfLines={1}>
                                                    {resourceLabel}
                                                </Text>
                                            </Pressable>
                                        )}
                                    </View>
                                )}

                                {/* Action Row */}
                                {isMatchRequest && status === 'pending' ? (
                                    <View style={styles.actionRow}>
                                        <Pressable
                                            style={[styles.primaryAction, { backgroundColor: COLORS.success || '#4CAF50' }]}
                                            onPress={() => handleAcceptReject(item, 'accept')}
                                            disabled={processingId === item.id}
                                        >
                                            {processingId === item.id ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <MaterialIcons name="check" size={14} color="#FFFFFF" />
                                                    <Text style={styles.primaryActionText}>Accept</Text>
                                                </View>
                                            )}
                                        </Pressable>
                                        <Pressable
                                            style={[styles.primaryAction, { backgroundColor: COLORS.error || '#F44336' }]}
                                            onPress={() => handleAcceptReject(item, 'reject')}
                                            disabled={processingId === item.id}
                                        >
                                            {processingId === item.id ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <MaterialIcons name="close" size={14} color="#FFFFFF" />
                                                    <Text style={styles.primaryActionText}>Reject</Text>
                                                </View>
                                            )}
                                        </Pressable>
                                    </View>
                                ) : (
                                    <View style={styles.actionRow}>
                                        <Pressable style={styles.primaryAction} onPress={() => openNotification(item)}>
                                            <MaterialIcons name="open-in-new" size={14} color="#FFFFFF" />
                                            <Text style={styles.primaryActionText}>Open Context</Text>
                                        </Pressable>
                                        {status === "pending" && (
                                            <Pressable
                                                style={styles.secondaryAction}
                                                onPress={() => markSeenIfPending(item)}
                                            >
                                                <MaterialIcons name="done" size={14} color={COLORS.accent} />
                                                <Text style={styles.secondaryActionText}>Mark Seen</Text>
                                            </Pressable>
                                        )}
                                    </View>
                                )}
                            </Pressable>
                        );
                    })
                )}
            </ScrollView>
        </Screen>
    );
}
