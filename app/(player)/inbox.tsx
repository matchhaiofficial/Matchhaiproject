import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../src/config/firebaseConfig";
import { useAuth } from "../../src/context/AuthContext";
import { claimSeatTransaction } from "../../src/services/bookingService";
import { respondFriendRequest, respondToJoinRequest, respondToTeamInvite } from "../../src/services/functions";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import styles from "./inbox.styles";

interface Notification {
    id: string;
    type: 'friend_request' | 'team_invite' | 'team_join_request' | 'team_join_decision' | 'match_booking_captain_approval' | 'match_seat_invitation';
    fromUid: string;
    fromUsername: string;
    status: 'pending' | 'accepted' | 'declined' | 'rejected';
    createdAt: any;
    expiresAt?: any;
    meta?: {
        teamId?: string;
        teamName?: string;
        game?: string;
        requesterSnapshot?: {
            city?: string;
            skillTier?: Record<string, string>;
            linked?: { steam?: boolean; faceit?: boolean; psn?: boolean; xbox?: boolean };
        };
        matchroomId?: string;
        intentId?: string;
        side?: string;
        role?: string;
    };
}

const getTimeAgo = (timestamp: any): string => {
    if (!timestamp?.toDate) return 'Just now';
    const now = new Date();
    const then = timestamp.toDate();
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
};

export default function Inbox() {
    const router = useRouter();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, "notifications"),
            where("toUid", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: Notification[] = [];
            snapshot.forEach(doc => {
                list.push({ id: doc.id, ...doc.data() } as Notification);
            });
            list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setNotifications(list);
            setLoading(false);
        }, (error) => {
            Logger.error("Inbox", "Error listening to notifications", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleFriendResponse = async (notifId: string, decision: 'accept' | 'decline') => {
        if (processing) return;
        setProcessing(notifId);
        try {
            const res = await respondFriendRequest({ notificationId: notifId, decision });
            if (!res.ok) alert(res.message);
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(null);
        }
    };

    const handleJoinResponse = async (notifId: string, decision: 'accept' | 'reject') => {
        if (processing) return;
        setProcessing(notifId);
        try {
            const res = await respondToJoinRequest({ notificationId: notifId, decision });
            if (!res.ok) alert(res.message || 'Failed to respond.');
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(null);
        }
    };

    const handleInviteResponse = async (notifId: string, decision: 'accept' | 'decline') => {
        if (processing) return;
        setProcessing(notifId);
        try {
            const res = await respondToTeamInvite({ notificationId: notifId, decision });
            if (!res.ok) alert(res.message || 'Failed to respond.');
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(null);
        }
    };

    const handleBookingApproval = async (notifId: string, intentId: string, decision: 'approved' | 'rejected') => {
        if (processing) return;
        setProcessing(notifId);
        try {
            // Update the intent
            const intentRef = doc(db, "booking_intents", intentId);
            await updateDoc(intentRef, {
                'approvals.captain.status': decision,
                'approvals.captain.decidedBy': user?.uid,
                'approvals.captain.decidedAt': serverTimestamp(),
                // If rejected, update overall status
                ...(decision === 'rejected' ? { status: 'rejected' } : {})
            });

            // Update notification
            await updateDoc(doc(db, "notifications", notifId), {
                status: decision === 'approved' ? 'accepted' : 'rejected'
            });

        } catch (e) {
            Logger.error("Inbox", "Error handling booking approval", e);
            alert("Failed to update approval.");
        } finally {
            setProcessing(null);
        }
    };

    const handleSeatInvitation = async (notifId: string, matchroomId: string, intentId: string, side: string, role: string, decision: 'accept' | 'decline') => {
        if (processing) return;
        setProcessing(notifId);
        try {
            if (decision === 'accept') {
                // Find the slotId for this user in the intent
                const intentSnap = await getDoc(doc(db, "booking_intents", intentId));
                if (intentSnap.exists()) {
                    const data = intentSnap.data();
                    const slotIds = data.selectedSlots as string[];
                    const invitees = data.invitees as any[];
                    const myIdx = invitees.findIndex(i => i.uid === user?.uid);
                    if (myIdx !== -1) {
                        const mySlotId = slotIds[myIdx];
                        const res = await claimSeatTransaction(matchroomId, intentId, mySlotId);
                        if (!res.ok) {
                            alert(res.message);
                            setProcessing(null);
                            return;
                        }
                    }
                }
            }

            // Update notification
            await updateDoc(doc(db, "notifications", notifId), {
                status: decision === 'accept' ? 'accepted' : 'rejected'
            });

        } catch (e) {
            Logger.error("Inbox", "Error handling seat invitation", e);
            alert("Failed to respond to invitation.");
        } finally {
            setProcessing(null);
        }
    };

    const filtered = notifications.filter(n => {
        const isPending = n.status === 'pending';

        // Expiration check for pending items
        if (isPending && n.expiresAt) {
            const expiresMs = n.expiresAt?.toMillis ? n.expiresAt.toMillis() : (n.expiresAt instanceof Date ? n.expiresAt.getTime() : n.expiresAt);
            if (expiresMs < Date.now()) {
                return false; // Hide expired pending items
            }
        }

        if (activeTab === 'pending') return isPending;
        return !isPending;
    });

    const renderItem = ({ item }: { item: Notification }) => {
        const isRequest = item.type === 'friend_request';
        const isJoinRequest = item.type === 'team_join_request';
        const isTeamInvite = item.type === 'team_invite';
        const isDecision = item.type === 'team_join_decision';
        const isBookingApproval = item.type === 'match_booking_captain_approval';
        const isSeatInv = item.type === 'match_seat_invitation';
        const isPending = item.status === 'pending';
        const isProcessing = processing === item.id;

        const iconColor = (isJoinRequest || isTeamInvite || isBookingApproval || isSeatInv) ? COLORS.accent : COLORS.success;
        const iconBg = (isJoinRequest || isTeamInvite || isBookingApproval || isSeatInv) ? 'rgba(66, 165, 245, 0.1)' : 'rgba(76, 175, 80, 0.1)';

        return (
            <View style={styles.notificationCard}>
                <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
                        <MaterialIcons
                            name={isRequest ? "person-add" : (isJoinRequest || isTeamInvite ? "group" : (isBookingApproval ? "gavel" : (isSeatInv ? "event-seat" : "info")))}
                            size={20}
                            color={iconColor}
                        />
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.typeText}>
                            {isRequest ? "Friend Request" :
                                (isJoinRequest ? "Team Join Request" :
                                    (isTeamInvite ? "Team Invitation" :
                                        (isBookingApproval ? "Booking Approval" :
                                            (isSeatInv ? "Seat Invitation" : "Team Update"))))}
                        </Text>
                        <Text style={styles.timeText}>{getTimeAgo(item.createdAt)}</Text>
                    </View>
                    {!isPending && (
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: (item.status === 'accepted') ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)' }
                        ]}>
                            <Text style={[
                                styles.statusText,
                                { color: (item.status === 'accepted') ? COLORS.success : COLORS.error }
                            ]}>
                                {item.status.toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.cardBody}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                        <Pressable onPress={() => router.push(`/(player)/profile/${item.fromUid}` as any)}>
                            <Text style={styles.highlightText}>{item.fromUsername}</Text>
                        </Pressable>
                        <Text style={styles.messageText}>
                            {isRequest && " wants to connect with you."}
                            {isTeamInvite && (
                                <>
                                    {" invited you to join "}
                                    <Text style={{ color: COLORS.text, fontWeight: '600' }}>{item.meta?.teamName}</Text>
                                </>
                            )}
                            {isJoinRequest && (
                                <>
                                    {" wants to join "}
                                    <Text style={{ color: COLORS.text, fontWeight: '600' }}>{item.meta?.teamName}</Text>
                                </>
                            )}
                            {isDecision && (
                                <>
                                    {item.status === 'accepted' ? " accepted your request to join " : " declined your request for "}
                                    <Text style={{ color: COLORS.text, fontWeight: '600' }}>{item.meta?.teamName}</Text>
                                </>
                            )}
                            {isBookingApproval && (
                                <>
                                    {" requested to book multiple seats in your matchroom."}
                                </>
                            )}
                            {isSeatInv && (
                                <>
                                    {" invited you to join a squad for a "}
                                    <Text style={{ color: COLORS.text, fontWeight: '600' }}>{item.meta?.game}</Text>
                                    {" match."}
                                </>
                            )}
                        </Text>
                    </View>

                    {isJoinRequest && isPending && item.meta?.requesterSnapshot && (
                        <View style={{ marginTop: 8, padding: 8, backgroundColor: COLORS.background, borderRadius: 4 }}>
                            <Text style={{ fontSize: 12, color: COLORS.muted }}>
                                City: {item.meta.requesterSnapshot.city || 'N/A'} •
                                Tier: {item.meta.requesterSnapshot.skillTier?.[item.meta.game || ''] || 'No rank'}
                            </Text>
                        </View>
                    )}
                </View>

                {isPending && (isRequest || isJoinRequest || isTeamInvite || isBookingApproval || isSeatInv) && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            disabled={!!processing}
                            onPress={() => {
                                if (isRequest) handleFriendResponse(item.id, 'accept');
                                else if (isJoinRequest) handleJoinResponse(item.id, 'accept');
                                else if (isTeamInvite) handleInviteResponse(item.id, 'accept');
                                else if (isBookingApproval) handleBookingApproval(item.id, item.meta!.intentId!, 'approved');
                                else if (isSeatInv) handleSeatInvitation(item.id, item.meta!.matchroomId!, item.meta!.intentId!, item.meta!.side!, item.meta!.role!, 'accept');
                            }}
                            style={styles.acceptButton}
                        >
                            {isProcessing ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <Text style={styles.buttonText}>
                                    {isSeatInv ? "Claim Seat" : "Approve"}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            disabled={!!processing}
                            onPress={() => {
                                if (isRequest) handleFriendResponse(item.id, 'decline');
                                else if (isJoinRequest) handleJoinResponse(item.id, 'reject');
                                else if (isTeamInvite) handleInviteResponse(item.id, 'decline');
                                else if (isBookingApproval) handleBookingApproval(item.id, item.meta!.intentId!, 'rejected');
                                else if (isSeatInv) handleSeatInvitation(item.id, item.meta!.matchroomId!, item.meta!.intentId!, item.meta!.side!, item.meta!.role!, 'decline');
                            }}
                            style={styles.declineButton}
                        >
                            <Text style={styles.declineButtonText}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.background }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Inbox</Text>
                </View>
            </SafeAreaView>

            <View style={styles.tabContainer}>
                <Pressable
                    onPress={() => setActiveTab('pending')}
                    style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
                >
                    <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
                        Pending {notifications.filter(n => n.status === 'pending').length > 0 ? `(${notifications.filter(n => n.status === 'pending').length})` : ''}
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() => setActiveTab('resolved')}
                    style={[styles.tab, activeTab === 'resolved' && styles.activeTab]}
                >
                    <Text style={[styles.tabText, activeTab === 'resolved' && styles.activeTabText]}>
                        History
                    </Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContent}>
                            <View style={styles.emptyIconContainer}>
                                <MaterialIcons name="inbox" size={40} color={COLORS.muted} />
                            </View>
                            <Text style={styles.emptyTitle}>
                                All Caught Up!
                            </Text>
                            <Text style={styles.emptySubtitle}>
                                {activeTab === 'pending'
                                    ? "No new requests right now."
                                    : "You haven't resolved any notifications yet."}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
