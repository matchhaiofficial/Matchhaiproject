import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Linking, ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { useToast } from "../../../src/hooks/useToast";
import { respondFriendRequest, sendFriendRequest } from "../../../src/services/functions";
import { getUserProfile, refreshUserStats, UserProfile } from "../../../src/services/userService";
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

const getPlayerGames = (profile: UserProfile): string[] => {
    const games: string[] = [];

    // Check for explicit "plays" flags or existing skill scores
    if (profile.playsCs2 || profile.skillScores?.cs2) games.push('cs2');
    if (profile.playsTekken || profile.skillScores?.tekken8) games.push('tekken8');
    if (profile.playsFc || profile.skillScores?.fc26) games.push('fc26');
    if (profile.playsFutsal || profile.skillScores?.futsal) games.push('futsal');
    if (profile.playsIndoorCricket || profile.skillScores?.indoor_cricket) games.push('indoor_cricket');
    if (profile.playsPadel || profile.skillScores?.padel) games.push('padel');
    if (profile.playsPickleball || profile.skillScores?.pickleball) games.push('pickleball');

    return games;
};

export default function PlayerProfile() {
    const { uid } = useLocalSearchParams<{ uid: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedGame, setSelectedGame] = useState<string | null>(null);
    const [isFriend, setIsFriend] = useState(false);
    const [isPending, setIsPending] = useState(false); // Outgoing request
    const [hasIncomingRequest, setHasIncomingRequest] = useState(false); // Incoming request
    const [incomingRequestId, setIncomingRequestId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';

    // --- Derived Logic Helpers ---

    const { winRate, confidence, activityStatus, trend } = useMemo(() => {
        if (!profile || !selectedGame) return { winRate: 0, confidence: 'Low', activityStatus: 'No data', trend: 'Stable' };

        const skillData = profile.skillScores?.[selectedGame as keyof NonNullable<UserProfile['skillScores']>];

        // 1. Win Rate
        const wins = skillData?.wins || 0;
        const totalMatches = skillData?.matchesPlayed || 0;
        const wr = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

        // 2. Confidence
        let conf = 'Low';
        const isVerified = profile.steamId || profile.faceitId || profile.psnAccountId;
        if (totalMatches >= 10 || (isVerified && totalMatches >= 3)) conf = 'High';
        else if (totalMatches > 0 || isVerified) conf = 'Medium';

        // 3. Activity Status
        let status = 'Inactive';
        const lastMatch = skillData?.lastMatchDate;
        if (lastMatch) {
            const date = lastMatch instanceof Timestamp ? lastMatch.toDate() : new Date(lastMatch);
            status = `Played ${formatDistanceToNow(date)} ago`;
        } else if (profile.isOnline) {
            status = 'Online Now';
        }

        // 4. Trend
        let tr = 'Stable';
        const lastUpdated = skillData?.lastUpdated;
        if (lastUpdated) {
            const updateDate = lastUpdated instanceof Timestamp ? lastUpdated.toDate() : new Date(lastUpdated);
            const daysSinceUpdate = (new Date().getTime() - updateDate.getTime()) / (1000 * 3600 * 24);
            if (daysSinceUpdate < 7 && totalMatches > 0) tr = 'Increasing';
            else if (daysSinceUpdate > 14) tr = 'Decreasing';
        }

        return { winRate: wr, confidence: conf, activityStatus: status, trend: tr };
    }, [profile, selectedGame]);

    const mutualContext = useMemo(() => {
        if (!user || !profile) return [];
        const chips = [];

        // Shared Games
        const myGames = getPlayerGames(user as any); // useAuth user might not have full profile, but typically has some fields
        const sharedGames = getPlayerGames(profile).filter(g => myGames.includes(g));
        if (sharedGames.length > 0) {
            const matchedNames = GAMES.filter(g => sharedGames.includes(g.key)).map(g => g.label);
            chips.push(`Also plays ${matchedNames.join(', ')}`);
        }

        // Shared Areas
        if (!profile.hideAreasPublicly && user && (user as any).areasPreferred && profile.areasPreferred) {
            const sharedAreas = profile.areasPreferred.filter(a => (user as any).areasPreferred.includes(a));
            if (sharedAreas.length > 0) {
                chips.push(`Same areas: ${sharedAreas.slice(0, 2).join(', ')}`);
            }
        }

        return chips;
    }, [user, profile]);

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

    const handleSync = async () => {
        if (!uid || syncing) return;
        setSyncing(true);
        try {
            const res = await refreshUserStats(uid);
            if (res.ok) {
                showToast({ type: "success", title: "Synced", message: "Gaming stats updated successfully" });
                loadProfile();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSyncing(false);
        }
    };

    const renderFriendActions = () => {
        if (!uid || user?.uid === uid) return null;

        if (isFriend) {
            return (
                <View style={[styles.statusBadge, styles.friendBadge]}>
                    <MaterialIcons name="check-circle" size={18} color={COLORS.success} />
                    <Text style={[styles.statusBadgeText, { color: COLORS.success }]}>Connected</Text>
                </View>
            );
        }

        if (hasIncomingRequest) {
            return (
                <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                    <TouchableOpacity
                        onPressIn={() => {
                            if (touchDebugEnabled) {
                                Logger.debug("TouchDebug", "pressIn", { tag: "profile_friend_accept", targetUid: uid });
                            }
                        }}
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
                        activeOpacity={0.85}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                        onPressIn={() => {
                            if (touchDebugEnabled) {
                                Logger.debug("TouchDebug", "pressIn", { tag: "profile_friend_decline", targetUid: uid });
                            }
                        }}
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
                        activeOpacity={0.85}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <MaterialIcons name="close" size={18} color={COLORS.text} />
                        <Text style={[styles.mainButtonText, { color: COLORS.text }]}>Decline</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (isPending) {
            return (
                <View style={[styles.statusBadge, styles.pendingBadge]}>
                    <MaterialIcons name="schedule" size={18} color={COLORS.warning} />
                    <Text style={[styles.statusBadgeText, { color: COLORS.warning }]}>Request Sent</Text>
                </View>
            );
        }

        return (
            <TouchableOpacity
                onPressIn={() => {
                    if (touchDebugEnabled) {
                        Logger.debug("TouchDebug", "pressIn", { tag: "profile_add_friend", targetUid: uid });
                    }
                }}
                onPress={handleAddFriend}
                disabled={actionLoading}
                style={styles.mainButton}
                activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                {actionLoading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                ) : (
                    <>
                        <MaterialIcons name="person-add" size={18} color="#FFF" />
                        <Text style={styles.mainButtonText}>Add Friend</Text>
                    </>
                )}
            </TouchableOpacity>
        );
    };

    const renderSummary = () => {
        if (!profile) return null;
        return (
            <View style={styles.profileCard}>
                <View style={styles.avatar}>
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                    {profile.isOnline && <View style={styles.onlineBadge} />}
                </View>

                <Text style={styles.profileName}>{profile.fullName || 'Player'}</Text>
                <Text style={styles.profileUsername}>@{profile.username}</Text>

                {/* Mutual Context Chips */}
                {mutualContext.length > 0 && (
                    <View style={styles.mutualContextRow}>
                        {mutualContext.map((c, i) => (
                            <View key={i} style={styles.contextChip}>
                                <MaterialIcons name="groups" size={14} color={COLORS.accent} />
                                <Text style={styles.contextText}>{c}</Text>
                            </View>
                        ))}
                    </View>
                )}

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

                {/* Recent Activity Label */}
                <View style={styles.activityCard}>
                    <MaterialIcons
                        name="access-time"
                        size={14}
                        color={activityStatus.includes('ago') || activityStatus === 'Online Now' ? COLORS.success : COLORS.muted}
                    />
                    <Text style={styles.activityText}>{activityStatus}</Text>
                </View>

                {user?.uid !== uid && (
                    <View style={styles.actionContainer}>
                        {renderFriendActions()}
                    </View>
                )}
            </View>
        );
    };

    const renderPrimarySkillCard = () => {
        if (!profile || !selectedGame) return null;
        const skillData = profile.skillScores?.[selectedGame as keyof NonNullable<UserProfile['skillScores']>];
        if (!skillData) return null;

        const sourceLabel = skillData.initialSource === 'faceit' ? 'FACEIT' :
            skillData.initialSource === 'psn' ? 'PSN' :
                skillData.initialSource === 'steam' ? 'Steam' : 'MatchHai';

        return (
            <View style={styles.primarySkillCard}>
                <View style={styles.skillTitleRow}>
                    <Text style={styles.statsHeaderTitle}>{selectedGame} PERFORMANCE</Text>
                    <Text style={styles.skillSource}>Verified via {sourceLabel}</Text>
                </View>

                <View style={styles.ratingMainRow}>
                    <View style={[styles.ratingCircle, { borderColor: trend === 'Increasing' ? COLORS.success : trend === 'Decreasing' ? COLORS.error : COLORS.accent }]}>
                        <Text style={styles.ratingValue}>{skillData.rating}</Text>
                    </View>
                    <View style={styles.ratingInfo}>
                        <Text style={styles.tierName}>{skillData.tier}</Text>
                        <View style={styles.confidenceRow}>
                            <MaterialIcons
                                name="verified"
                                size={14}
                                color={confidence === 'High' ? COLORS.success : confidence === 'Medium' ? COLORS.warning : COLORS.muted}
                            />
                            <Text style={styles.confidenceText}>Confidence: {confidence}</Text>

                            {/* Trend Icon */}
                            <MaterialIcons
                                name={trend === 'Increasing' ? "trending-up" : trend === 'Decreasing' ? "trending-down" : "trending-flat"}
                                size={16}
                                style={[
                                    styles.trendIcon,
                                    trend === 'Increasing' ? styles.trendUp : trend === 'Decreasing' ? styles.trendDown : styles.trendStable
                                ]}
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.primaryStatsGrid}>
                    <View style={styles.primaryStatBox}>
                        <Text style={styles.primaryStatLabel}>Win Rate</Text>
                        <Text style={styles.primaryStatValue}>{winRate}%</Text>
                    </View>
                    <View style={styles.primaryStatBox}>
                        <Text style={styles.primaryStatLabel}>Matches</Text>
                        <Text style={styles.primaryStatValue}>{skillData.matchesPlayed}</Text>
                    </View>
                    <View style={styles.primaryStatBox}>
                        <Text style={styles.primaryStatLabel}>W / L</Text>
                        <Text style={styles.primaryStatValue}>{skillData.wins} / {skillData.losses}</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderPlatformCard = (name: string, value: string | undefined, icon: string, color: string, isVerified: boolean) => {
        if (!value || !profile) {
            return (
                <View style={[styles.platformCard, styles.notConnected]}>
                    <View style={[styles.platformIcon, { backgroundColor: color }]}>
                        <FontAwesome5 name={icon} size={18} color="#FFF" />
                    </View>
                    <View style={styles.platformInfo}>
                        <Text style={styles.platformName}>{name}</Text>
                        <Text style={styles.platformValue}>Not connected</Text>
                    </View>
                    {uid === user?.uid && (
                        <TouchableOpacity onPress={() => router.push('/(player)/profile/edit' as any)}>
                            <MaterialIcons name="add-circle-outline" size={24} color={COLORS.muted} />
                        </TouchableOpacity>
                    )}
                </View>
            );
        }

        return (
            <View style={styles.platformCard}>
                <View style={[styles.platformIcon, { backgroundColor: color }]}>
                    <FontAwesome5 name={icon} size={18} color="#FFF" />
                </View>
                <View style={styles.platformInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.platformName}>{name}</Text>
                        {isVerified && (
                            <View style={[styles.badge, styles.verifiedBadge]}>
                                <Text style={styles.verifiedBadgeText}>Verified</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.platformValue}>
                        {profile.hidePlatformsPublicly && uid !== user?.uid ? 'Verified Account' : value}
                    </Text>
                </View>
                {uid === user?.uid && (
                    <TouchableOpacity
                        onPressIn={() => {
                            if (touchDebugEnabled) {
                                Logger.debug("TouchDebug", "pressIn", { tag: "profile_sync_stats", targetUid: uid });
                            }
                        }}
                        onPress={handleSync}
                        disabled={syncing}
                        style={styles.syncButton}
                        activeOpacity={0.85}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        {syncing ? (
                            <ActivityIndicator size="small" color={COLORS.accent} />
                        ) : (
                            <MaterialIcons name="sync" size={20} color={COLORS.accent} />
                        )}
                    </TouchableOpacity>
                )}
                {!isVerified && (
                    <TouchableOpacity onPress={() => Linking.openURL(value)}>
                        <MaterialIcons name="launch" size={20} color={COLORS.muted} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderPlatforms = () => {
        if (!profile) return null;

        return (
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Connected Platforms</Text>
                </View>
                <View style={styles.sectionPadding}>
                    {renderPlatformCard('Steam', profile.steamProfileUrl, 'steam', '#1b2838', !!profile.steamId)}
                    {renderPlatformCard('FACEIT', profile.faceitProfileUrl, 'foursquare', '#ff5500', !!profile.faceitId)}
                    {renderPlatformCard('PlayStation', profile.psnOnlineId, 'playstation', '#003791', !!profile.psnAccountId)}
                </View>
            </View>
        );
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
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </SafeAreaView>
        );
    }

    if (!profile) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.notFoundContainer}>
                    <MaterialIcons name="person-off" size={64} color={COLORS.textSecondary} />
                    <Text style={styles.notFoundText}>Profile not found</Text>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButtonLarge}>
                        <Text style={styles.backButtonTextLarge}>Go Back</Text>
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
            <SafeAreaView edges={['top']} style={styles.backgroundHeader}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Player Profile</Text>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {renderSummary()}

                {/* Shared Games Section */}
                {playerGames.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Shared Games</Text>
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.gamesScrollContainer}
                        >
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
                        </ScrollView>

                        {/* Game Stats Card */}
                        {selectedGame && renderPrimarySkillCard()}

                        <View style={styles.sectionPadding}>
                            {renderGameStats()}
                        </View>
                    </View>
                )}

                {renderPlatforms()}

                {/* Preferred Areas */}
                {profile?.areasPreferred && profile.areasPreferred.length > 0 && !profile.hideAreasPublicly && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Preferred Areas</Text>
                        </View>
                        <View style={styles.sectionPadding}>
                            <View style={styles.areaChipsRow}>
                                {profile.areasPreferred.map(area => (
                                    <View key={area} style={styles.areaChip}>
                                        <Text style={styles.areaChipText}>{area}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {/* My Teams */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>My Teams</Text>
                    </View>
                    <View style={styles.sectionPadding}>
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No teams joined yet.</Text>
                        </View>
                    </View>
                </View>

                {/* Recent Matches */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Matches</Text>
                    </View>
                    <View style={styles.sectionPadding}>
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No matches played yet.</Text>
                        </View>
                    </View>
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
