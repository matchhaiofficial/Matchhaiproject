import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { respondFriendRequest, sendFriendRequest } from "../../../src/services/functions";
import { getUserProfile, UserProfile } from "../../../src/services/userService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./profile.styles";

const GAMES = [
    { key: 'cs2', label: 'CS2' },
    { key: 'tekken8', label: 'Tekken 8' },
    { key: 'fc26', label: 'FC 26' },
    { key: 'futsal', label: 'Futsal' },
    { key: 'indoor_cricket', label: 'Cricket' },
    { key: 'padel', label: 'Padel' },
    { key: 'pickleball', label: 'Pickleball' },
];

const getFaceitLevel = (elo: number): number => {
    if (elo < 801) return 1;
    if (elo < 951) return 2;
    if (elo < 1101) return 3;
    if (elo < 1251) return 4;
    if (elo < 1401) return 5;
    if (elo < 1551) return 6;
    if (elo < 1701) return 7;
    if (elo < 1851) return 8;
    if (elo < 2001) return 9;
    return 10;
};

export default function PlayerProfile() {
    const { uid } = useLocalSearchParams<{ uid: string }>();
    const router = useRouter();
    const { user } = useAuth();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedGame, setSelectedGame] = useState<string | null>(null);
    const [isFriend, setIsFriend] = useState(false);
    const [isPending, setIsPending] = useState(false); // Outgoing request
    const [hasIncomingRequest, setHasIncomingRequest] = useState(false); // Incoming request
    const [incomingRequestId, setIncomingRequestId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        loadProfile();
        checkFriendStatus();
    }, [uid]);

    const loadProfile = async () => {
        if (!uid) return;
        try {
            const res = await getUserProfile(uid);
            if (res.ok) {
                setProfile(res.data);
                const userGames = getPlayerGames(res.data);
                if (userGames.length > 0) {
                    setSelectedGame(userGames[0]);
                }
            }
        } catch (error) {
            Logger.error("PlayerProfile", "Error loading profile", error);
        } finally {
            setLoading(false);
        }
    };

    const checkFriendStatus = async () => {
        if (!user || !uid) return;
        try {
            const friendsSnap = await getDocs(collection(db, "users", user.uid, "friends"));
            const friends = new Set<string>();
            friendsSnap.forEach(doc => friends.add(doc.id));
            setIsFriend(friends.has(uid));

            if (!friends.has(uid)) {
                // Check for outgoing request (I sent to them)
                const outgoingQ = query(
                    collection(db, "notifications"),
                    where("fromUid", "==", user.uid),
                    where("toUid", "==", uid),
                    where("type", "==", "friend_request"),
                    where("status", "==", "pending")
                );
                const outgoingSnap = await getDocs(outgoingQ);
                setIsPending(!outgoingSnap.empty);

                // Check for incoming request (they sent to me)
                const incomingQ = query(
                    collection(db, "notifications"),
                    where("fromUid", "==", uid),
                    where("toUid", "==", user.uid),
                    where("type", "==", "friend_request"),
                    where("status", "==", "pending")
                );
                const incomingSnap = await getDocs(incomingQ);
                if (!incomingSnap.empty) {
                    setHasIncomingRequest(true);
                    setIncomingRequestId(incomingSnap.docs[0].id);
                } else {
                    setHasIncomingRequest(false);
                    setIncomingRequestId(null);
                }
            }
        } catch (error) {
            Logger.error("PlayerProfile", "Error checking friend status", error);
        }
    };

    const handleAddFriend = async () => {
        if (!uid || actionLoading) return;
        setActionLoading(true);
        try {
            const res = await sendFriendRequest({ toUid: uid });
            if (res.ok) {
                setIsPending(true);
            } else {
                alert(res.message);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setActionLoading(false);
        }
    };

    const getPlayerGames = (profile: UserProfile): string[] => {
        const games: string[] = [];
        if (profile.cs2Role) games.push('cs2');
        if (profile.tekkenFavorites && profile.tekkenFavorites.length > 0) games.push('tekken8');
        if (profile.fcTeam) games.push('fc26');
        if (profile.futsalPosition) games.push('futsal');
        if (profile.indoorCricketRole) games.push('indoor_cricket');
        if (profile.padelRole) games.push('padel');
        if (profile.pickleballRole) games.push('pickleball');
        return games;
    };

    const renderGameStats = () => {
        if (!profile || !selectedGame) return null;

        const skillData = profile.skillScores?.[selectedGame as keyof NonNullable<UserProfile['skillScores']>];
        const tier = skillData?.tier || 'N/A';
        const rating = skillData?.rating !== undefined ? skillData.rating.toString() : 'Unranked';

        // MatchHai Stats
        const wins = skillData?.wins || 0;
        const losses = skillData?.losses || 0;
        const totalMatches = skillData?.matchesPlayed || 0;
        const winPercentage = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

        // Color coding for Win %
        let winRateColor = COLORS.muted;
        if (totalMatches > 0) {
            if (winPercentage >= 60) winRateColor = COLORS.success;
            else if (winPercentage >= 45) winRateColor = COLORS.warning;
            else winRateColor = COLORS.error;
        }

        return (
            <View style={styles.statsCard}>
                <View style={styles.statsHeader}>
                    <Text style={styles.statsHeaderTitle}>PERFORMANCE</Text>
                    <View style={styles.tierBadge}>
                        <Text style={styles.tierText}>{tier}</Text>
                    </View>
                </View>

                <StatRow icon="star" label="MatchHai Rating" value={rating} />
                <StatRow icon="trending-up" label="Skill Tier" value={tier} />

                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
                    <StatRow icon="assessment" label="Total Matches" value={totalMatches.toString()} />
                    <StatRow icon="check-circle" label="Wins" value={wins.toString()} />
                    <StatRow icon="cancel" label="Losses" value={losses.toString()} />
                    <StatRow
                        icon="pie-chart"
                        label="Win Rate"
                        value={`${winPercentage}%`}
                        valueStyle={{ color: winRateColor }}
                    />
                </View>

                {selectedGame === 'cs2' && (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
                        <StatRow icon="person" label="Role" value={profile.cs2Role || 'N/A'} />
                        {profile.faceitElo && (
                            <StatRow icon="emoji-events" label="Faceit Level" value={`Level ${getFaceitLevel(profile.faceitElo)}`} />
                        )}
                        {profile.steamCs2Hours && (
                            <StatRow icon="schedule" label="Playtime" value={`${profile.steamCs2Hours.toLocaleString()}h`} />
                        )}
                    </View>
                )}

                {selectedGame === 'tekken8' && (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
                        <StatRow icon="groups" label="Favorites" value={profile.tekkenFavorites?.slice(0, 3).join(', ') || 'N/A'} />
                    </View>
                )}

                {selectedGame === 'fc26' && (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
                        <StatRow icon="shield" label="Team" value={profile.fcTeam || 'N/A'} />
                        <StatRow icon="grid-view" label="Formation" value={profile.fcFormation || 'N/A'} />
                        {profile.steamFc26Hours && (
                            <StatRow icon="schedule" label="Playtime" value={`${profile.steamFc26Hours.toLocaleString()}h`} />
                        )}
                    </View>
                )}

                {selectedGame === 'futsal' && (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
                        <StatRow icon="place" label="Position" value={profile.futsalPosition || 'N/A'} />
                    </View>
                )}

                {selectedGame === 'indoor_cricket' && (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
                        <StatRow icon="person" label="Role" value={profile.indoorCricketRole || 'N/A'} />
                        {profile.indoorCricketBattingStyle && <StatRow icon="sports-cricket" label="Batting" value={profile.indoorCricketBattingStyle} />}
                        {profile.indoorCricketBowlingStyle && <StatRow icon="sports-cricket" label="Bowling" value={profile.indoorCricketBowlingStyle} />}
                    </View>
                )}

                {selectedGame === 'padel' && (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
                        <StatRow icon="sports-tennis" label="Position" value={profile.padelRole || 'N/A'} />
                    </View>
                )}

                {selectedGame === 'pickleball' && (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
                        <StatRow icon="sports-tennis" label="Position" value={profile.pickleballRole || 'N/A'} />
                    </View>
                )}
            </View>
        );
    };

    const openLink = (url?: string) => {
        if (url) {
            Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </SafeAreaView>
        );
    }

    if (!profile) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <MaterialIcons name="person-off" size={64} color={COLORS.textSecondary} />
                    <Text style={{ color: COLORS.text, fontSize: 18, marginTop: 16 }}>Profile not found</Text>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                        <Text style={{ color: COLORS.accent, fontSize: 16 }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const playerGames = getPlayerGames(profile);
    const avatarUrl = `https://ui-avatars.com/api/?name=${profile.username || 'Player'}&background=42a5f5&color=fff&size=200`;

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.background }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Player Profile</Text>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Profile Summary Card (Matching Profile Tab) */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                        {profile.isOnline && <View style={styles.onlineBadge} />}
                    </View>

                    <Text style={styles.profileName}>{profile.fullName || 'Player'}</Text>
                    <Text style={styles.profileUsername}>@{profile.username}</Text>

                    {/* Meta info: City */}
                    <View style={styles.profileMeta}>
                        {profile.city && (
                            <View style={styles.profileMetaItem}>
                                <MaterialIcons name="location-on" size={14} color={COLORS.muted} />
                                <Text style={styles.profileMetaText}>{profile.city}</Text>
                            </View>
                        )}
                        <View style={styles.profileMetaItem}>
                            <MaterialIcons name="security" size={14} color={COLORS.muted} />
                            <Text style={styles.profileMetaText}>
                                {Math.round((profile.trustScore || 0.5) * 100)}% Trust
                            </Text>
                        </View>
                    </View>

                    {user?.uid !== uid && (
                        <View style={styles.actionContainer}>
                            {isFriend ? (
                                <View style={[styles.statusBadge, styles.friendBadge]}>
                                    <MaterialIcons name="check-circle" size={18} color={COLORS.success} />
                                    <Text style={[styles.statusBadgeText, { color: COLORS.success }]}>Connected</Text>
                                </View>
                            ) : hasIncomingRequest ? (
                                // Show Accept/Reject for incoming requests
                                <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                                    <TouchableOpacity
                                        onPress={async () => {
                                            if (!incomingRequestId) return;
                                            setActionLoading(true);
                                            try {
                                                const res = await respondFriendRequest({ notificationId: incomingRequestId, decision: 'accept' });
                                                if (res.ok) {
                                                    setIsFriend(true);
                                                    setHasIncomingRequest(false);
                                                } else {
                                                    alert(res.message);
                                                }
                                            } catch (error) {
                                                console.error(error);
                                            } finally {
                                                setActionLoading(false);
                                            }
                                        }}
                                        disabled={actionLoading}
                                        style={[styles.mainButton, { flex: 1, backgroundColor: COLORS.success }]}
                                    >
                                        {actionLoading ? (
                                            <ActivityIndicator color="#FFF" size="small" />
                                        ) : (
                                            <>
                                                <MaterialIcons name="check" size={18} color="#FFF" />
                                                <Text style={styles.mainButtonText}>Accept</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={async () => {
                                            if (!incomingRequestId) return;
                                            setActionLoading(true);
                                            try {
                                                const res = await respondFriendRequest({ notificationId: incomingRequestId, decision: 'decline' });
                                                if (res.ok) {
                                                    setHasIncomingRequest(false);
                                                    setIncomingRequestId(null);
                                                } else {
                                                    alert(res.message);
                                                }
                                            } catch (error) {
                                                console.error(error);
                                            } finally {
                                                setActionLoading(false);
                                            }
                                        }}
                                        disabled={actionLoading}
                                        style={[styles.mainButton, { flex: 1, backgroundColor: COLORS.surfaceHighlight, borderWidth: 1, borderColor: COLORS.divider }]}
                                    >
                                        <MaterialIcons name="close" size={18} color={COLORS.text} />
                                        <Text style={[styles.mainButtonText, { color: COLORS.text }]}>Decline</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : isPending ? (
                                <View style={[styles.statusBadge, styles.pendingBadge]}>
                                    <MaterialIcons name="schedule" size={18} color={COLORS.warning} />
                                    <Text style={[styles.statusBadgeText, { color: COLORS.warning }]}>Request Sent</Text>
                                </View>
                            ) : (
                                <TouchableOpacity onPress={handleAddFriend} disabled={actionLoading} style={styles.mainButton}>
                                    {actionLoading ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <>
                                            <MaterialIcons name="person-add" size={18} color="#FFF" />
                                            <Text style={styles.mainButtonText}>Add Friend</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                {/* Shared Games Section */}
                {playerGames.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Shared Games</Text>
                        <View style={styles.chipRow}>
                            {playerGames.map(gameKey => {
                                const gameObj = GAMES.find(g => g.key === gameKey);
                                const isSelected = selectedGame === gameKey;
                                return (
                                    <TouchableOpacity
                                        key={gameKey}
                                        onPress={() => setSelectedGame(gameKey)}
                                        style={[styles.optionChip, isSelected && styles.optionChipActive]}
                                    >
                                        <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
                                            {gameObj?.label || gameKey}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Game Stats Card */}
                        {renderGameStats()}
                    </View>
                )}

                {/* Platforms Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Connected Platforms</Text>

                    {profile.steamProfileUrl && (
                        <TouchableOpacity onPress={() => openLink(profile.steamProfileUrl)} style={styles.platformCard}>
                            <View style={[styles.platformIcon, { backgroundColor: 'rgba(102, 192, 244, 0.1)', borderColor: COLORS.steamBorder, borderWidth: 1 }]}>
                                <FontAwesome5 name="steam" size={20} color={COLORS.steamBorder} />
                            </View>
                            <View style={styles.platformInfo}>
                                <Text style={styles.platformName}>Steam</Text>
                                <Text style={styles.platformValue}>View Profile</Text>
                            </View>
                            <MaterialIcons name="open-in-new" size={18} color={COLORS.muted} />
                        </TouchableOpacity>
                    )}

                    {profile.faceitProfileUrl && (
                        <TouchableOpacity onPress={() => openLink(profile.faceitProfileUrl)} style={styles.platformCard}>
                            <View style={[styles.platformIcon, { backgroundColor: 'rgba(255, 85, 0, 0.1)', borderColor: COLORS.faceitBorder, borderWidth: 1 }]}>
                                <MaterialIcons name="verified" size={20} color={COLORS.faceitBorder} />
                            </View>
                            <View style={styles.platformInfo}>
                                <Text style={styles.platformName}>Faceit</Text>
                                <Text style={styles.platformValue}>View Profile</Text>
                            </View>
                            <MaterialIcons name="open-in-new" size={18} color={COLORS.muted} />
                        </TouchableOpacity>
                    )}

                    {profile.psnOnlineId && (
                        <View style={styles.platformCard}>
                            <View style={[styles.platformIcon, { backgroundColor: 'rgba(0, 48, 135, 0.1)', borderColor: '#003087', borderWidth: 1 }]}>
                                <FontAwesome5 name="playstation" size={20} color="#003791" />
                            </View>
                            <View style={styles.platformInfo}>
                                <Text style={styles.platformName}>PlayStation</Text>
                                <Text style={styles.platformValue}>{profile.psnOnlineId}</Text>
                            </View>
                        </View>
                    )}

                    {!profile.steamProfileUrl && !profile.faceitProfileUrl && !profile.psnOnlineId && (
                        <Text style={styles.emptyPlatformsText}>No platforms connected</Text>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const StatRow = ({ icon, label, value, valueStyle }: { icon: string; label: string; value: string; valueStyle?: any }) => (
    <View style={styles.statRow}>
        <View style={styles.statLabelGroup}>
            <MaterialIcons name={icon as any} size={18} color={COLORS.accent} />
            <Text style={styles.statLabel}>{label}</Text>
        </View>
        <Text style={[styles.statValue, valueStyle]}>{value}</Text>
    </View>
);
