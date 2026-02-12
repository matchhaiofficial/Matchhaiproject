import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";

import SkillBadge from "../../../src/components/SkillBadge";
import { db } from "../../../src/config/firebaseConfig";
import { GAME_RULES } from "../../../src/constants/gameRules";
import { useAuth } from "../../../src/context/AuthContext";
import { useToast } from "../../../src/hooks/useToast";
import { signOutUser } from "../../../src/services/authService";
import { PsnVerificationResult } from "../../../src/services/psnApi";
import { GameSkillScore } from "../../../src/services/skillRatingService";
import { getUserTeams, Team } from "../../../src/services/teamService";
import { COLORS } from "../../../src/theme";
import styles from "./profile.styles";

// FACEIT Level Icons
const faceitLevelIcons: Record<number, any> = {
    1: require("../../../assets/images/faceit-levels/Level 1.png"),
    2: require("../../../assets/images/faceit-levels/Level 2.png"),
    3: require("../../../assets/images/faceit-levels/Level 3.png"),
    4: require("../../../assets/images/faceit-levels/Level 4.png"),
    5: require("../../../assets/images/faceit-levels/Level 5.png"),
    6: require("../../../assets/images/faceit-levels/Level 6.png"),
    7: require("../../../assets/images/faceit-levels/Level 7.png"),
    8: require("../../../assets/images/faceit-levels/Level 8.png"),
    9: require("../../../assets/images/faceit-levels/Level 9.png"),
    10: require("../../../assets/images/faceit-levels/Level 10.png"),
};

// Generate list from GAME_RULES to ensure consistency
const ALL_GAMES = Object.entries(GAME_RULES).map(([key, rule]) => ({
    key,
    name: rule.label,
    // Icon mapping (could be moved to constants but fine here for now)
    icon: (key === 'cs2' ? 'sports-esports' :
        key === 'fc26' ? 'sports-soccer' :
            key === 'tekken8' ? 'sports-mma' :
                key === 'indoor_cricket' ? 'sports-cricket' :
                    ['padel', 'pickleball'].includes(key) ? 'sports-tennis' : 'sports-soccer') as keyof typeof MaterialIcons.glyphMap
}));

interface FullUserProfile {
    uid: string;
    email?: string;
    fullName?: string;
    username?: string;
    city?: string;
    ageRange?: string;

    // Generic Play Flags & Roles
    playsCs2?: boolean; cs2Role?: string;
    playsFc?: boolean; fcTeam?: string; fcFormation?: string;
    playsTekken?: boolean; tekkenFavorites?: string[];
    playsFutsal?: boolean; futsalPositions?: string[];
    playsIndoorCricket?: boolean; indoorCricketRole?: string; indoorCricketBowlingStyle?: string; indoorCricketBattingStyle?: string;
    playsPadel?: boolean; padelRole?: string;
    playsPickleball?: boolean; pickleballRole?: string;

    // Platform Data
    steamProfileUrl?: string; steamPersonaName?: string; steamId?: string;
    faceitProfileUrl?: string; faceitNickname?: string; faceitSkillLevel?: number; faceitElo?: number;
    psnStats?: PsnVerificationResult;

    // Skill Scores
    skillScores?: Record<string, GameSkillScore>;

    // Generic Stats
    steamCs2Hours?: number;
    steamTekken8Hours?: number;
    steamFc26Hours?: number;

    areasPreferred?: string[];

    // Platform Metadata
    platformLastSynced?: Record<string, any>; // Reserved for future detailed timestamps per platform if structure changes
    updatedAt?: any;
}

export default function Profile() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const tabBarHeight = useBottomTabBarHeight();
    const [profile, setProfile] = useState<FullUserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [myTeams, setMyTeams] = useState<Team[]>([]);
    const [loadingTeams, setLoadingTeams] = useState(false);

    // Prevent double fetch
    const isFetching = useRef(false);

    const fetchProfile = useCallback(async (isRefresh = false) => {
        if (!user?.uid || (isFetching.current && !isRefresh)) return;

        try {
            isFetching.current = true;
            if (!isRefresh && !profile) setLoading(true); // Initial load only

            const userRef = doc(db, "users", user.uid);
            const snap = await getDoc(userRef);

            if (snap.exists()) {
                setProfile({ uid: snap.id, ...snap.data() } as FullUserProfile);
            }

            setLoadingTeams(true);
            const teamsRes = await getUserTeams(user.uid);
            if (teamsRes.ok && teamsRes.data) {
                setMyTeams(teamsRes.data);
            } else {
                setMyTeams([]);
            }
        } catch (e) {
            console.error("[Profile] Failed to fetch profile", e);
            if (isRefresh) showToast({ type: 'error', title: 'Error', message: 'Could not refresh profile' });
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingTeams(false);
            isFetching.current = false;
        }
    }, [user?.uid]);

    // Focus Effect: Re-fetch only if data might be stale (simplified to always fetch on focus for now to ensure sync after edit)
    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [fetchProfile])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchProfile(true);
    };

    const handleLogout = async () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        const res = await signOutUser();
                        if (res.ok) router.replace("/auth/login");
                        else Alert.alert("Logout Failed", res.message);
                    }
                }
            ]
        );
    };

    const handleSettings = () => router.push("/profile/edit");

    const handleAddGame = (gameKey: string) => {
        // Validation based on GAME_RULES requirements
        const rules = GAME_RULES[gameKey];
        if (rules && rules.requiresOneOf) {
            const hasRequirement = rules.requiresOneOf.some(platform => {
                if (platform === 'steam') return !!profile?.steamId; // Check ID specifically to be sure
                if (platform === 'faceit') return !!profile?.faceitNickname;
                if (platform === 'psn') return !!profile?.psnStats?.psnOnlineId;
                if (platform === 'xbox') return false; // Not fully implemented in profile type yet
                return false;
            });

            if (!hasRequirement) {
                const prettyPlatforms = rules.requiresOneOf.map(p => p.toUpperCase()).join(' or ');
                showToast({
                    type: "warning",
                    title: "Platform Required",
                    message: `Please connect your ${prettyPlatforms} account in Edit Profile to add ${rules.label}.`
                });
                return;
            }
        }
        router.push(`/profile/game-details?gameId=${gameKey}`);
    };

    const handleEditGame = (gameKey: string) => router.push(`/profile/game-details?gameId=${gameKey}`);

    const getInitials = () => {
        if (profile?.fullName) {
            const parts = profile.fullName.trim().split(' ');
            if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            return profile.fullName[0].toUpperCase();
        }
        return profile?.username?.[0].toUpperCase() || user?.email?.[0].toUpperCase() || '?';
    };

    // Check if a game is active
    const isGameActive = (gameKey: string): boolean => {
        if (!profile) return false;
        switch (gameKey) {
            case 'cs2': return !!(profile.playsCs2);
            case 'fc26': return !!(profile.playsFc);
            case 'tekken8': return !!(profile.playsTekken);
            case 'futsal': return !!(profile.playsFutsal);
            case 'indoor_cricket': return !!(profile.playsIndoorCricket);
            case 'padel': return !!(profile.playsPadel);
            case 'pickleball': return !!(profile.playsPickleball);
            default: return false;
        }
    };

    // Helper to get secondary stat (External)
    const getExternalStatLine = (gameKey: string) => {
        if (!profile) return null;

        if (gameKey === 'cs2') {
            if (profile.faceitSkillLevel) return `Faceit LvL ${profile.faceitSkillLevel}`;
            if (profile.faceitElo) return `Elo ${profile.faceitElo}`;
            if (profile.steamCs2Hours) return `${Math.round(profile.steamCs2Hours)}h Played`;
        }
        if (gameKey === 'fc26') {
            if (profile.psnStats?.fc?.progress) return `PSN ${profile.psnStats.fc.progress}%`;
            if (profile.steamFc26Hours) return `${Math.round(profile.steamFc26Hours)}h Played`;
        }
        if (gameKey === 'tekken8') {
            if (profile.psnStats?.tekken8?.progress) return `PSN ${profile.psnStats.tekken8.progress}%`;
            if (profile.steamTekken8Hours) return `${Math.round(profile.steamTekken8Hours)}h Played`;
        }
        return null;
    };

    // Get game role text
    const getGameRole = (gameKey: string) => {
        if (!profile) return 'Not configured';
        switch (gameKey) {
            case 'cs2': return profile.cs2Role || 'No role set';
            case 'fc26': return profile.fcTeam || 'No team set';
            case 'tekken8': return profile.tekkenFavorites?.join(', ') || 'No characters set';
            case 'futsal': return profile.futsalPositions?.join(', ') || 'No position set';
            case 'indoor_cricket': return profile.indoorCricketRole || 'No role set';
            case 'padel': return profile.padelRole || 'No side set';
            case 'pickleball': return profile.pickleballRole || 'No mode set';
            default: return 'Active';
        }
    };

    if (loading) {
        return (
            <Screen style={styles.screen} scroll={false} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen
            style={styles.screen}
            scroll
            contentStyle={[
                styles.scrollContent,
                { paddingBottom: 24 },
            ]}
            edges={['top']}
            scrollProps={{
                showsVerticalScrollIndicator: false,
                refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />,
            }}
        >
            <AppHeader
                title="Profile"
                rightAction={(
                    <TouchableOpacity style={styles.headerIcon} onPress={handleSettings}>
                        <MaterialIcons name="settings" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                )}
            />

            {/* Profile Card */}
            <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials()}</Text>
                    </View>
                    <Text style={styles.profileName}>{profile?.fullName || 'Player'}</Text>
                    {profile?.username && <Text style={styles.profileUsername}>@{profile.username}</Text>}
                    <Text style={styles.profileEmail}>{user?.email}</Text>

                    <View style={styles.profileMeta}>
                        {profile?.city && (
                            <View style={styles.profileMetaItem}>
                                <MaterialIcons name="location-on" size={14} color={COLORS.muted} />
                                <Text style={styles.profileMetaText}>{profile.city}</Text>
                            </View>
                        )}
                        {profile?.ageRange && (
                            <View style={styles.profileMetaItem}>
                                <MaterialIcons name="cake" size={14} color={COLORS.muted} />
                                <Text style={styles.profileMetaText}>{profile.ageRange}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* My Games */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>My Games</Text>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.gamesScrollContainer}
                    >
                        {ALL_GAMES.map(game => {
                            const isActive = isGameActive(game.key);
                            const skillScore = profile?.skillScores?.[game.key];
                            const externalStat = getExternalStatLine(game.key);
                            const roleText = getGameRole(game.key);

                            if (isActive) {
                                return (
                                    <TouchableOpacity key={game.key} style={styles.gameCard} onPress={() => handleEditGame(game.key)}>
                                        <View style={styles.gameIcon}>
                                            <MaterialIcons name={game.icon} size={24} color={COLORS.accent} />
                                        </View>
                                        <View style={styles.gameInfo}>
                                            <Text style={styles.gameName} numberOfLines={1}>{game.name}</Text>
                                            <Text style={styles.gameRole} numberOfLines={1}>{roleText}</Text>
                                            {/* New Secondary Stat Line */}
                                            {externalStat && (
                                                <Text style={styles.secondaryStat} numberOfLines={1}>
                                                    Verified: {externalStat}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Primary Badge: SkillScore > Faceit Level > PSN */}
                                        <View style={styles.marginLeftAuto}>
                                            {skillScore ? (
                                                <SkillBadge tier={skillScore.tier} rating={skillScore.rating} size="compact" />
                                            ) : (
                                                /* Legacy/External Badge Fallback */
                                                game.key === 'cs2' && profile?.faceitSkillLevel ? (
                                                    <Image source={faceitLevelIcons[profile.faceitSkillLevel]} style={styles.faceitIcon} resizeMode="contain" />
                                                ) : (game.key === 'fc26' || game.key === 'tekken8') && profile?.psnStats?.[game.key === 'fc26' ? 'fc' : 'tekken8']?.present ? (
                                                    <View style={styles.gameSkill}>
                                                        <MaterialIcons name="emoji-events" size={16} color="#FFD700" style={styles.yellowIcon} />
                                                    </View>
                                                ) : (
                                                    <MaterialIcons name="chevron-right" size={20} color={COLORS.muted} />
                                                )
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            } else {
                                return (
                                    <TouchableOpacity key={game.key} style={styles.gameCardInactive} onPress={() => handleAddGame(game.key)}>
                                        <View style={styles.gameIconInactive}>
                                            <MaterialIcons name={game.icon} size={24} color={COLORS.muted} />
                                        </View>
                                        <View>
                                            <Text style={styles.gameNameInactive}>{game.name}</Text>
                                            <Text style={styles.gameAddText}>Tap to add</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }
                        })}
                    </ScrollView>
                </View>

                {/* Platforms */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Connected Platforms</Text>
                    </View>

                    <View style={styles.sectionPadding}>
                        {/* Steam */}
                        <TouchableOpacity style={styles.platformCard} onPress={handleSettings}>
                            <View style={[styles.platformIcon, styles.steamIcon]}>
                                <MaterialIcons name="sports-esports" size={20} color={COLORS.steamBorder} />
                            </View>
                            <View style={styles.platformInfo}>
                                <Text style={styles.platformName}>Steam</Text>
                                {profile?.steamPersonaName ? (
                                    <>
                                        <Text style={styles.platformValue}>{profile.steamPersonaName}</Text>
                                        <Text style={styles.syncText}>
                                            Synced: {profile.updatedAt?.toDate?.().toLocaleDateString() || 'Just now'}
                                        </Text>
                                    </>
                                ) : <Text style={styles.platformNotLinked}>Not linked</Text>}
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color={COLORS.muted} />
                        </TouchableOpacity>

                        {/* FACEIT */}
                        <TouchableOpacity style={styles.platformCard} onPress={handleSettings}>
                            <View style={[styles.platformIcon, styles.faceitPlatformIcon]}>
                                <MaterialIcons name="verified" size={20} color={COLORS.faceitBorder} />
                            </View>
                            <View style={styles.platformInfo}>
                                <Text style={styles.platformName}>FACEIT</Text>
                                {profile?.faceitNickname ? (
                                    <>
                                        <Text style={styles.platformValue}>{profile.faceitNickname}</Text>
                                        <Text style={styles.syncText}>
                                            Synced: {profile.updatedAt?.toDate?.().toLocaleDateString() || 'Just now'}
                                        </Text>
                                    </>
                                ) : <Text style={styles.platformNotLinked}>Not linked</Text>}
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color={COLORS.muted} />
                        </TouchableOpacity>

                        {/* PSN */}
                        <TouchableOpacity style={styles.platformCard} onPress={handleSettings}>
                            <View style={[styles.platformIcon, styles.psnIconContainer]}>
                                <MaterialIcons name="sports-esports" size={20} color="#003791" />
                            </View>
                            <View style={styles.platformInfo}>
                                <Text style={styles.platformName}>PlayStation Network</Text>
                                {profile?.psnStats?.psnOnlineId ? (
                                    <>
                                        <Text style={styles.platformValue}>{profile.psnStats.psnOnlineId}</Text>
                                        <Text style={styles.syncText}>
                                            Synced: {profile.updatedAt?.toDate?.().toLocaleDateString() || 'Just now'}
                                        </Text>
                                    </>
                                ) : <Text style={styles.platformNotLinked}>Not linked</Text>}
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color={COLORS.muted} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Preferred Areas */}
                {profile?.areasPreferred && profile.areasPreferred.length > 0 && (
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
                        <TouchableOpacity onPress={() => router.push("/(player)/(tabs)/teams")}>
                            <Text style={styles.sectionLink}>View All</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.sectionPadding}>
                        {loadingTeams ? (
                            <View style={styles.emptyState}>
                                <ActivityIndicator size="small" color={COLORS.accent} />
                            </View>
                        ) : myTeams.length > 0 ? (
                            myTeams.slice(0, 3).map(team => {
                                const maxMembers = team.maxMembers || 0;
                                const rawCount = team.memberUids?.length ?? team.memberCount ?? 0;
                                const memberCount = maxMembers > 0 ? Math.min(rawCount, maxMembers) : rawCount;
                                return (
                                    <TouchableOpacity
                                        key={team.id}
                                        style={styles.teamCard}
                                        onPress={() => router.push(`/teams/${team.id}` as any)}
                                    >
                                        <View style={styles.teamIcon}>
                                            <MaterialIcons name="groups" size={20} color={COLORS.accent} />
                                        </View>
                                        <View style={styles.teamInfo}>
                                            <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
                                            <Text style={styles.teamGame}>{(team.game || '').toUpperCase()}</Text>
                                            <Text style={styles.teamMembers}>{memberCount} / {maxMembers} members</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>You haven't joined any teams yet.</Text>
                                <TouchableOpacity style={styles.emptyButton} onPress={() => router.push("/teams/create")}>
                                    <Text style={styles.emptyButtonText}>Create a Team</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                {/* Recent Matches */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Matches</Text>
                        <TouchableOpacity onPress={() => router.push("/matchrooms/my")}>
                            <Text style={styles.sectionLink}>View All</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.sectionPadding}>
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No matches played yet.</Text>
                            <TouchableOpacity
                                style={styles.emptyButton}
                                onPress={() => router.push({ pathname: "/(player)/(tabs)/discover", params: { segment: 'matchrooms', t: Date.now().toString() } } as any)}
                            >
                                <Text style={styles.emptyButtonText}>Find a Match</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <MaterialIcons name="logout" size={20} color={COLORS.error} />
                    <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>
        </Screen>
    );
}
