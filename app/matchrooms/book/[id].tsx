import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../../src/context/AuthContext";
import { createBookingIntentDetailed } from "../../../src/services/bookingService";
import { getMatchroom, Matchroom } from "../../../src/services/matchService";
import { getTeamById, getUserTeamsForGame, Team } from "../../../src/services/teamService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import FriendPicker from "../components";
import styles from "./book.styles";

export default function BookSlotsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';

    const [room, setRoom] = useState<Matchroom | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Booking State
    const [selectedSide, setSelectedSide] = useState<'A' | 'B'>('B');
    // Selections mapped by slotId
    const [selections, setSelections] = useState<Record<string, { uid: string; username: string; roleForGame: string; skillScore?: number }>>({});

    // Team Booking State
    const [userTeams, setUserTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

    // Friend Picker State
    const [showFriendPicker, setShowFriendPicker] = useState(false);
    const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

    useEffect(() => {
        const fetchRoom = async () => {
            if (!id || typeof id !== 'string') return;
            try {
                const res = await getMatchroom(id);
                if (res.ok && res.data) {
                    let roomData = res.data;

                    // Initialize slots if missing (backward compatibility)
                    if (!roomData.slotsA || roomData.slotsA.length === 0) {
                        roomData.slotsA = Array.from({ length: 5 }, (_, i) => ({
                            slotId: `A_slot_${i}`,
                            status: 'open' as const,
                        }));
                    }
                    if (!roomData.slotsB || roomData.slotsB.length === 0) {
                        roomData.slotsB = Array.from({ length: 5 }, (_, i) => ({
                            slotId: `B_slot_${i}`,
                            status: 'open' as const,
                        }));
                    }

                    setRoom(roomData);
                } else {
                    Alert.alert("Error", "Matchroom not found");
                    router.back();
                }
            } catch (e) {
                Logger.error("BookSlots", "Error fetching room", e);
            } finally {
                setLoading(false);
            }
        };
        fetchRoom();
    }, [id]);

    useEffect(() => {
        const fetchTeams = async () => {
            if (!user || !room?.game) return;
            try {
                const res = await getUserTeamsForGame(user.uid, room.game);
                if (res.ok && res.data) {
                    setUserTeams(res.data);
                }
            } catch (e) {
                Logger.error("BookSlots", "Error fetching teams", e);
            }
        };
        fetchTeams();
    }, [user, room?.game]);

    const handleTeamSelect = async (teamId: string) => {
        let team = userTeams.find(t => t.id === teamId);
        if (!team || !room) return;

        setSelectedTeamId(teamId);

        // If members are missing, try to fetch the full team
        if (!team.members || team.members.length === 0) {
            try {
                const res = await getTeamById(teamId);
                if (res.ok && res.data) {
                    team = res.data;
                    // Update userTeams state with the fetched data so we don't fetch again
                    setUserTeams(prev => prev.map(t => t.id === teamId ? res.data! : t));
                }
            } catch (e) {
                Logger.error("BookSlots", "Error fetching missing team members", e);
            }
        }

        if (!team?.members) {
            Alert.alert("Error", "Could not load team members.");
            return;
        }

        // Auto-fill slots
        const currentSlots = (selectedSide === 'A' ? room.slotsA : room.slotsB) || [];
        const newSelections: Record<string, any> = {};

        // Members to add (excluding ones already in the list)
        const existingUids = new Set(room.playerUids || []);
        // Also exclude the current user if they are already in the room
        const toAdd = team.members.filter(m => !existingUids.has(m.uid) && m.uid !== user?.uid).slice(0, 5);

        // Find open slot IDs
        const openSlotIds = currentSlots
            .filter(s => s.status === 'open' && !s.uid && !s.reservedForUid)
            .map(s => s.slotId);

        if (openSlotIds.length === 0) {
            Alert.alert("No Slots", "There are no open slots on this side.");
            return;
        }

        toAdd.forEach((member, index) => {
            if (openSlotIds[index]) {
                newSelections[openSlotIds[index]] = {
                    uid: member.uid,
                    username: member.username,
                    roleForGame: member.role === 'captain' ? 'IGL' : 'Rifler',
                    skillScore: 50
                };
            }
        });

        if (Object.keys(newSelections).length > 0) {
            setSelections(newSelections);
            Alert.alert("Team Selected", `Prefilled ${Object.keys(newSelections).length} members from "${team.name}"`);
        } else {
            setSelections({}); // Reset if nothing added
            Alert.alert("Note", "No team members were added. They might already be in the lobby.");
        }
    };

    const handleSlotPress = (slotId: string) => {
        setActiveSlotId(slotId);
        setShowFriendPicker(true);
    };

    const handleFriendSelect = (friend: { uid: string; username: string; skillScore?: number }, role: string) => {
        if (!activeSlotId) return;

        setSelections(prev => ({
            ...prev,
            [activeSlotId]: {
                uid: friend.uid,
                username: friend.username,
                roleForGame: role,
                skillScore: friend.skillScore
            }
        }));

        setShowFriendPicker(false);
        setActiveSlotId(null);
    };

    const handleSubmitBooking = async () => {
        if (!room || !user || !id) return;
        const selectionList = Object.values(selections);
        if (selectionList.length === 0) {
            Alert.alert("Selection Required", "Please select at least one teammate to book.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await createBookingIntentDetailed({
                matchroom: room,
                side: selectedSide,
                selectedSlots: Object.keys(selections),
                invitees: selectionList,
                roomAvgSkill: room.avgSkillScoreLive ?? room.hostSkillScore ?? 50
            });

            if (res.ok) {
                router.push({
                    pathname: "/matchrooms/book/status/[intentId]",
                    params: { intentId: res.data }
                } as any);
            } else {
                Alert.alert("Booking Failed", (res as any).message || "Something went wrong.");
            }
        } catch (e) {
            Logger.error("BookSlots", "Submission error", e);
            Alert.alert("Error", "Failed to create booking request.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.accent} size="large" />
            </View>
        );
    }

    if (!room) return null;

    const currentSlots = (selectedSide === 'A' ? room.slotsA : room.slotsB) || [];
    const selectionList = Object.values(selections);
    const perPlayerPrice = room.pricing?.perPlayer || 0;
    const totalPrice = perPlayerPrice * selectionList.length;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Select Teammates</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Side Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Pick Your Side</Text>
                    <View style={styles.sideContainer}>
                        <TouchableOpacity
                            style={[styles.sideCard, selectedSide === 'A' && styles.sideCardActive]}
                            onPress={() => {
                                setSelectedSide('A');
                                setSelections({});
                                setSelectedTeamId(null);
                            }}
                        >
                            <Text style={styles.sideLabel}>Team</Text>
                            <Text style={[styles.sideName, selectedSide === 'A' && styles.sideNameActive]}>Side A</Text>
                            {selectedSide === 'A' && <View style={styles.activeDot} />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.sideCard, selectedSide === 'B' && styles.sideCardActive]}
                            onPress={() => {
                                setSelectedSide('B');
                                setSelections({});
                                setSelectedTeamId(null);
                            }}
                        >
                            <Text style={styles.sideLabel}>Team</Text>
                            <Text style={[styles.sideName, selectedSide === 'B' && styles.sideNameActive]}>Side B</Text>
                            {selectedSide === 'B' && <View style={styles.activeDot} />}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Team Pre-fill (Optional) */}
                {userTeams.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Book as Team (Optional)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                            {userTeams.map(team => (
                                <TouchableOpacity
                                    key={team.id}
                                    activeOpacity={0.7}
                                    style={[
                                        styles.sideCard,
                                        { width: 160, marginRight: 12, height: 90 },
                                        selectedTeamId === team.id && styles.sideCardActive
                                    ]}
                                    onPress={() => handleTeamSelect(team.id!)}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 4 }}>
                                        <Text style={[styles.sideName, { fontSize: 16 }]} numberOfLines={1}>{team.name}</Text>
                                        <MaterialIcons
                                            name={selectedTeamId === team.id ? "check-circle" : "group"}
                                            size={18}
                                            color={selectedTeamId === team.id ? COLORS.accent : COLORS.textSecondary}
                                        />
                                    </View>
                                    <Text style={styles.sideLabel}>{team.memberCount} Members • {team.game.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Slots Grid */}
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text style={styles.sectionTitle}>Reserve Slots</Text>
                        {selectionList.length > 0 && (
                            <View style={{ backgroundColor: COLORS.accent + '20', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
                                <Text style={{ color: COLORS.accent, fontWeight: 'bold', fontSize: 12 }}>{selectionList.length} Selected</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.slotGrid}>
                        {currentSlots.map((slot, index) => {
                            const isOccupied = slot.status === 'confirmed' || slot.status === 'reserved';
                            const selection = selections[slot.slotId];
                            const isSelected = !!selection;

                            // Find teammate if already occupied
                            const occupantUid = slot.uid || slot.reservedFor?.uid || slot.reservedForUid;
                            const occupantName = slot.user?.username || slot.reservedFor?.username;
                            const occupant = occupantName ? { username: occupantName, role: slot.role } : (room.players || []).find(p => p.uid === occupantUid);

                            return (
                                <TouchableOpacity
                                    key={slot.slotId}
                                    style={[
                                        styles.slotItem,
                                        isOccupied && styles.slotOccupied,
                                        isSelected && styles.slotSelected
                                    ]}
                                    onPress={() => {
                                        if (isOccupied && occupantUid) {
                                            router.push(`/(player)/profile/${occupantUid}` as any);
                                        } else if (!isOccupied) {
                                            handleSlotPress(slot.slotId);
                                        }
                                    }}
                                >
                                    <MaterialIcons
                                        name={isOccupied ? "person" : isSelected ? "check-circle" : "add-circle-outline"}
                                        size={22}
                                        color={isSelected ? COLORS.accent : isOccupied ? COLORS.disabled : COLORS.textSecondary}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.slotText, isSelected && styles.slotTextSelected]} numberOfLines={1}>
                                            {selection ? selection.username : (isOccupied && occupant ? occupant.username : isOccupied ? "Reserved" : `Slot ${index + 1}`)}
                                        </Text>
                                        {(selection || (isOccupied && occupant)) && (
                                            <Text style={{ fontSize: 10, color: COLORS.textSecondary }} numberOfLines={1}>
                                                {selection?.roleForGame || occupant?.role || 'Teammate'}
                                            </Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
                <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Total to pay</Text>
                    <Text style={styles.priceValue}>{room.pricing?.currency} {totalPrice}</Text>
                </View>

                <TouchableOpacity
                    style={[styles.primaryButton, selectionList.length === 0 && styles.primaryButtonDisabled]}
                    onPressIn={() => {
                        if (touchDebugEnabled) {
                            Logger.debug("TouchDebug", "pressIn", { tag: "book_slots_proceed" });
                        }
                    }}
                    onPress={handleSubmitBooking}
                    disabled={submitting || selectionList.length === 0}
                    activeOpacity={0.85}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <Text style={styles.primaryButtonText}>Proceed to Approval</Text>
                            <MaterialIcons name="chevron-right" size={24} color="#FFF" />
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <FriendPicker
                visible={showFriendPicker}
                onClose={() => setShowFriendPicker(false)}
                onSelect={handleFriendSelect}
                game={room.game}
            />
        </SafeAreaView>
    );
}
