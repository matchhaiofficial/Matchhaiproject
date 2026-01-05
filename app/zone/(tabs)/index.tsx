import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../../src/context/AuthContext";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { signOutUser } from "../../../src/services/authService";
import { BookingRequest, createZoneOffer, getRequestsForZoneAdmin } from "../../../src/services/bookingRequestService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./_zone-dashboard.styles";

// Mock data types
interface AlertItem {
    id: string;
    type: 'urgent' | 'warning' | 'info';
    icon: string;
    message: string;
    time: string;
    action?: string;
}

interface Match {
    id: string;
    time: string;
    game: string;
    players: string;
    status: 'upcoming' | 'checkin' | 'live' | 'finished';
    court: string;
}



export default function ZoneDashboard() {
    const { zone, loading } = useZoneData();
    const { user } = useAuth();
    const router = useRouter();
    const [signingOut, setSigningOut] = useState(false);

    // Mock data
    const [alerts] = useState<AlertItem[]>([
        { id: '1', type: 'urgent', icon: 'person-add', message: 'New matchroom request from Ahmad', time: '2m ago', action: 'View' },
        { id: '2', type: 'warning', icon: 'schedule', message: 'Match starting in 15 minutes - check-in required', time: '5m ago' },
        { id: '3', type: 'info', icon: 'payment', message: 'Payment confirmed for tonights CS2 match', time: '10m ago' },
    ]);

    const [todayMatches] = useState<Match[]>([
        { id: '1', time: '10:00 AM', game: 'CS2 5v5', players: '8/10', status: 'checkin', court: 'PC Room 1' },
        { id: '2', time: '12:00 PM', game: 'Futsal', players: '10/10', status: 'live', court: 'Court A' },
        { id: '3', time: '3:00 PM', game: 'Padel Doubles', players: '4/4', status: 'upcoming', court: 'Padel 1' },
        { id: '4', time: '6:00 PM', game: 'FC25', players: '6/8', status: 'upcoming', court: 'PC Room 2' },
        { id: '5', time: '9:00 PM', game: 'CS2 10v10', players: '20/20', status: 'upcoming', court: 'Full Arena' },
    ]);

    const [incomingRequests, setIncomingRequests] = useState<BookingRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(false);

    // Offer Modal State
    const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
    const [offerPrice, setOfferPrice] = useState('');
    const [offerMessage, setOfferMessage] = useState('');
    const [sendingOffer, setSendingOffer] = useState(false);

    useEffect(() => {
        if (zone?.primaryBranch?.areaLabel) {
            fetchRequests();
        }
    }, [zone]);

    const fetchRequests = async () => {
        if (!zone?.primaryBranch?.areaLabel) return;
        setLoadingRequests(true);
        try {
            // Fetch requests for the zone's area
            // TODO: If zone has multiple branches/areas, include them all
            const res = await getRequestsForZoneAdmin([zone.primaryBranch.areaLabel]);
            if (res.ok && res.data) {
                setIncomingRequests(res.data);
            }
        } catch (e) {
            Logger.error("ZoneDashboard", "Error fetching requests", e);
        } finally {
            setLoadingRequests(false);
        }
    };

    const openOfferModal = (req: BookingRequest) => {
        setSelectedRequest(req);
        setOfferPrice(req.budgetPerPlayer ? String(req.budgetPerPlayer) : '');
        setOfferMessage('');
    };

    const closeOfferModal = () => {
        setSelectedRequest(null);
        setOfferPrice('');
        setOfferMessage('');
    };

    const handleSendOffer = async () => {
        if (!selectedRequest || !zone || !user) return;
        if (!offerPrice) {
            Alert.alert("Error", "Please enter a price per player");
            return;
        }

        setSendingOffer(true);
        try {
            const res = await createZoneOffer({
                requestId: selectedRequest.id!,
                zoneId: zone.id,
                branchId: 'primary', // TODO: Handle multiple branches
                zoneName: zone.venueBrandName,
                branchName: zone.primaryBranch.branchDisplayName || zone.venueBrandName,
                zoneAdminId: user.uid,
                proposedDate: selectedRequest.preferredDate || new Date(), // Default to requested date
                proposedTime: selectedRequest.preferredTime || 'Flexible',
                pricePerPlayer: parseInt(offerPrice),
                currency: 'PKR',
                location: `${zone.primaryBranch.addressLine1}, ${zone.primaryBranch.areaLabel}`,
                message: offerMessage.trim(),

            });

            if (res.ok) {
                Alert.alert("Success", "Offer sent to player!");
                closeOfferModal();
                // Optionally refresh requests or mark this one as 'offered' locally
            } else {
                Alert.alert("Error", res.message || "Failed to send offer");
            }
        } catch (e) {
            Logger.error("ZoneDashboard", "Error sending offer", e);
            Alert.alert("Error", "Something went wrong");
        } finally {
            setSendingOffer(false);
        }
    };

    // Mock data for other sections (keep for now)


    const [courts] = useState([
        { id: '1', name: 'PC 1', status: 'free', color: COLORS.successBright },
        { id: '2', name: 'PC 2', status: 'in-use', color: '#FFC107' },
        { id: '3', name: 'Court A', status: 'in-use', color: '#FFC107' },
        { id: '4', name: 'Court B', status: 'free', color: COLORS.successBright },
        { id: '5', name: 'Padel 1', status: 'reserved', color: COLORS.accent },
        { id: '6', name: 'Padel 2', status: 'maintenance', color: COLORS.error },
    ]);

    const handleLogout = async () => {
        setSigningOut(true);
        const res = await signOutUser();
        setSigningOut(false);
        if (!res.ok) {
            Alert.alert("Logout Failed", res.message);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'live': return COLORS.successBright;
            case 'checkin': return '#FFC107';
            case 'upcoming': return COLORS.accent;
            case 'finished': return COLORS.textSecondary;
            default: return COLORS.muted;
        }
    };

    if (loading) {
        return (
            <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (!zone) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={[styles.emptyState, { flex: 1, justifyContent: 'center' }]}>
                    <MaterialIcons name="business" size={48} color={COLORS.muted} style={styles.emptyStateIcon} />
                    <Text style={[styles.emptyStateText, { fontSize: 16 }]}>No zone found</Text>
                    <Text style={styles.emptyStateText}>Register a zone to get started</Text>
                    <TouchableOpacity
                        onPress={() => router.replace("/auth/zone-register")}
                        style={[styles.requestActionPrimary, { marginTop: 20 }]}
                    >
                        <Text style={styles.requestActionPrimaryText}>Register Zone</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* 🔵 SECTION: Zone Overview Header */}
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <View style={styles.zoneNameContainer}>
                            <Text style={styles.zoneLabel}>ZONE ADMIN</Text>
                            <Text style={styles.zoneName}>{zone.venueBrandName}</Text>
                        </View>
                        <TouchableOpacity onPress={handleLogout} disabled={signingOut}>
                            {signingOut ? (
                                <ActivityIndicator size="small" color={COLORS.accent} />
                            ) : (
                                <MaterialIcons name="exit-to-app" size={24} color={COLORS.muted} />
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.statusBadge, { borderColor: COLORS.successBright + '50' }]}>
                        <View style={[styles.statusDot, { backgroundColor: COLORS.successBright }]} />
                        <Text style={styles.statusText}>Open</Text>
                    </View>

                    <View style={styles.quickStatsRow}>
                        <View style={styles.quickStatItem}>
                            <Text style={styles.quickStatLabel}>Today's Bookings</Text>
                            <Text style={styles.quickStatValue}>5</Text>
                        </View>
                        <View style={styles.quickStatItem}>
                            <Text style={styles.quickStatLabel}>Pending Approvals</Text>
                            <Text style={styles.quickStatValue}>2</Text>
                        </View>
                        <View style={styles.quickStatItem}>
                            <Text style={styles.quickStatLabel}>Courts Available</Text>
                            <Text style={styles.quickStatValue}>2/6</Text>
                        </View>
                    </View>
                </View>

                {/* 🔔 SECTION 1: Critical Alerts */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Critical Alerts</Text>
                        <Text style={styles.seeAllText}>View All</Text>
                    </View>
                    {alerts.slice(0, 3).map((alert) => (
                        <TouchableOpacity
                            key={alert.id}
                            style={[
                                styles.alertCard,
                                { borderLeftColor: alert.type === 'urgent' ? COLORS.error : alert.type === 'warning' ? '#FFC107' : COLORS.accent }
                            ]}
                        >
                            <MaterialIcons name={alert.icon as any} size={20} color={COLORS.accent} style={styles.alertIcon} />
                            <View style={styles.alertContent}>
                                <Text style={styles.alertText}>{alert.message}</Text>
                                <Text style={styles.alertTime}>{alert.time}</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color={COLORS.muted} style={styles.alertAction} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* 📅 SECTION 2: Today's Matches Timeline */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Today's Matches</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timelineContainer} contentContainerStyle={styles.timelineScroll}>
                        {todayMatches.map((match) => (
                            <TouchableOpacity key={match.id} style={styles.matchTimelineCard}>
                                <View style={styles.matchTimeHeader}>
                                    <Text style={styles.matchTime}>{match.time}</Text>
                                    <View style={[styles.matchStatusBadge, { backgroundColor: getStatusColor(match.status) + '20', borderWidth: 1, borderColor: getStatusColor(match.status) }]}>
                                        <Text style={[styles.matchStatusText, { color: getStatusColor(match.status) }]}>{match.status}</Text>
                                    </View>
                                </View>
                                <Text style={styles.matchGameTitle}>{match.game}</Text>
                                <Text style={styles.matchDetail}>{match.players} Players • {match.court}</Text>
                                <View style={styles.matchActions}>
                                    <TouchableOpacity style={styles.matchActionBtn}>
                                        <Text style={styles.matchActionText}>View</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.matchActionBtn}>
                                        <Text style={styles.matchActionText}>Edit</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* 💬 SECTION 3: Incoming Matchroom Requests */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Incoming Requests</Text>
                        <Text style={styles.seeAllText}>{incomingRequests.length} New</Text>
                    </View>
                    {loadingRequests ? (
                        <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 20 }} />
                    ) : incomingRequests.length === 0 ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Text style={{ color: COLORS.textSecondary }}>No new requests in your area.</Text>
                        </View>
                    ) : (
                        incomingRequests.map((req) => (
                            <View key={req.id} style={styles.requestCard}>
                                <View style={styles.requestHeader}>
                                    <View style={styles.requestUserInfo}>
                                        <Text style={styles.requestUserName}>{req.userName}</Text>
                                        <Text style={styles.requestUserRole}>{req.skillLevel || 'Any Level'}</Text>
                                    </View>
                                </View>
                                <View style={styles.requestDetailRow}>
                                    <MaterialIcons name="sports-esports" size={14} color={COLORS.textSecondary} />
                                    <Text style={styles.requestDetailText}>{req.gameKey.toUpperCase()} • {req.maxPlayers} players</Text>
                                </View>
                                <View style={styles.requestDetailRow}>
                                    <MaterialIcons name="schedule" size={14} color={COLORS.textSecondary} />
                                    <Text style={styles.requestDetailText}>{req.preferredTime || req.flexibilityWindow}</Text>
                                </View>
                                <View style={styles.requestDetailRow}>
                                    <MaterialIcons name="location-on" size={14} color={COLORS.textSecondary} />
                                    <Text style={styles.requestDetailText}>{req.preferredAreas.join(', ')}</Text>
                                </View>
                                {req.description ? (
                                    <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4, fontStyle: 'italic' }} numberOfLines={2}>
                                        "{req.description}"
                                    </Text>
                                ) : null}
                                <View style={styles.requestActions}>
                                    <TouchableOpacity
                                        style={styles.requestActionPrimary}
                                        onPress={() => openOfferModal(req)}
                                    >
                                        <Text style={styles.requestActionPrimaryText}>
                                            Send Offer {req.budgetPerPlayer ? `(Target: ₨${req.budgetPerPlayer})` : ''}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.requestActionSecondary}
                                        onPress={() => Alert.alert("Not Implemented", "Hiding requests will be available soon.")}
                                    >
                                        <Text style={styles.requestActionSecondaryText}>Reject</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* 🔴 SECTION 5: Live Matches */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Live Matches</Text>
                    </View>
                    <View style={styles.liveMatchCard}>
                        <View style={styles.liveMatchHeader}>
                            <View style={styles.livePulse} />
                            <Text style={styles.liveMatchTitle}>Futsal • Court A</Text>
                        </View>
                        <View style={styles.liveMatchStats}>
                            <View style={styles.liveStatItem}>
                                <Text style={styles.liveStatLabel}>Checked In</Text>
                                <Text style={styles.liveStatValue}>10/10</Text>
                            </View>
                            <View style={styles.liveStatItem}>
                                <Text style={styles.liveStatLabel}>Time Left</Text>
                                <Text style={styles.liveStatValue}>45m</Text>
                            </View>
                        </View>
                        <View style={styles.requestActions}>
                            <TouchableOpacity style={[styles.requestActionPrimary, { flex: 1 }]}>
                                <Text style={styles.requestActionPrimaryText}>View Details</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.requestActionSecondary}>
                                <Text style={styles.requestActionSecondaryText}>Extend</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* 🖥️ SECTION 6: Court/PC Management */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Court Status</Text>
                    </View>
                    <View style={styles.courtGrid}>
                        {courts.map((court) => (
                            <TouchableOpacity key={court.id} style={[styles.courtCard, { borderColor: court.color }]}>
                                <MaterialIcons
                                    name={court.status === 'free' ? 'check-circle' : court.status === 'in-use' ? 'sports-esports' : court.status === 'reserved' ? 'schedule' : 'build'}
                                    size={32}
                                    color={court.color}
                                />
                                <Text style={styles.courtName}>{court.name}</Text>
                                <Text style={[styles.courtStatus, { color: court.color }]}>{court.status.toUpperCase()}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* 💳 SECTION 7: Payments Dashboard */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Today's Earnings</Text>
                    </View>
                    <View style={styles.paymentWidget}>
                        <View style={styles.paymentRow}>
                            <Text style={styles.paymentLabel}>Total Revenue</Text>
                            <Text style={styles.paymentValue}>₨12,500</Text>
                        </View>
                        <View style={styles.paymentRow}>
                            <Text style={styles.paymentLabel}>MatchHai Commission (10%)</Text>
                            <Text style={[styles.paymentValue, { color: COLORS.error }]}>-₨1,250</Text>
                        </View>
                        <View style={styles.paymentDivider} />
                        <View style={styles.paymentRow}>
                            <Text style={[styles.paymentLabel, { fontSize: 14, fontWeight: '700' }]}>Your Earnings</Text>
                            <Text style={styles.paymentTotal}>₨11,250</Text>
                        </View>
                    </View>
                </View>

                {/* 📊 SECTION 8: Analytics */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Analytics</Text>
                    </View>
                    <View style={styles.analyticsCard}>
                        <View style={styles.analyticsMetric}>
                            <Text style={styles.metricLabel}>Occupancy Rate (Today)</Text>
                            <Text style={styles.metricValue}>75%</Text>
                        </View>
                        <View style={styles.analyticsMetric}>
                            <Text style={styles.metricLabel}>Most Popular Game</Text>
                            <Text style={styles.metricValue}>CS2</Text>
                        </View>
                        <View style={styles.analyticsMetric}>
                            <Text style={styles.metricLabel}>Peak Hours</Text>
                            <Text style={styles.metricValue}>6 PM - 10 PM</Text>
                        </View>
                        <View style={styles.analyticsMetric}>
                            <Text style={styles.metricLabel}>Repeat Users</Text>
                            <Text style={styles.metricValue}>68%</Text>
                        </View>
                    </View>
                    <View style={styles.aiInsightCard}>
                        <MaterialIcons name="lightbulb" size={16} color={COLORS.accent} />
                        <Text style={[styles.aiInsightText, { marginTop: 8 }]}>
                            💡 Your Tuesday slots have low bookings. Consider offering a 20% discount to boost occupancy.
                        </Text>
                    </View>
                </View>

                {/* 🧾 SECTION 9: Quick Settings */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Quick Settings</Text>
                    </View>
                    <TouchableOpacity style={styles.requestCard} onPress={() => router.push("/zone/(tabs)/branches")}>
                        <View style={[styles.requestHeader, { marginBottom: 0 }]}>
                            <View style={styles.requestUserInfo}>
                                <Text style={styles.requestUserName}>Zone Settings</Text>
                                <Text style={styles.requestDetailText}>Manage pricing, hours, and availability</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={COLORS.muted} />
                        </View>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* Offer Modal */}
            <Modal
                visible={!!selectedRequest}
                transparent
                animationType="slide"
                onRequestClose={closeOfferModal}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: COLORS.cardBackground, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
                        <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
                            Send Offer to {selectedRequest?.userName}
                        </Text>

                        <Text style={{ color: COLORS.textSecondary, marginBottom: 8 }}>Price Per Player (₨)</Text>
                        <TextInput
                            style={{
                                backgroundColor: COLORS.inputBackground,
                                color: COLORS.text,
                                padding: 12,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: COLORS.inputBorder,
                                marginBottom: 16
                            }}
                            placeholder="e.g. 500"
                            placeholderTextColor={COLORS.muted}
                            keyboardType="number-pad"
                            value={offerPrice}
                            onChangeText={setOfferPrice}
                        />

                        <Text style={{ color: COLORS.textSecondary, marginBottom: 8 }}>Message (Optional)</Text>
                        <TextInput
                            style={{
                                backgroundColor: COLORS.inputBackground,
                                color: COLORS.text,
                                padding: 12,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: COLORS.inputBorder,
                                marginBottom: 24,
                                height: 80,
                                textAlignVertical: 'top'
                            }}
                            placeholder="e.g. We have a private room available..."
                            placeholderTextColor={COLORS.muted}
                            multiline
                            value={offerMessage}
                            onChangeText={setOfferMessage}
                        />

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: 'center' }}
                                onPress={closeOfferModal}
                            >
                                <Text style={{ color: COLORS.textSecondary, fontWeight: '600' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center' }}
                                onPress={handleSendOffer}
                                disabled={sendingOffer}
                            >
                                {sendingOffer ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Send Offer</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
