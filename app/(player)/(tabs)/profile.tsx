import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import React, { useCallback, useRef, useState, useEffect } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Animated from "react-native-reanimated";
import AppHeader from "../../../src/components/AppHeader";
import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import { AppImage } from "../../../src/components/AppImage";
import { AppButton, AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useEntrance } from "../../../src/motion/useEntrance";
import { usePressScale } from "../../../src/motion/usePressScale";

import SkillBadge from "../../../src/components/SkillBadge";
import { GAME_RULES } from "../../../src/constants/gameRules";
import { useAuth } from "../../../src/context/AuthContext";
import { useToast } from "../../../src/hooks/useToast";
import { signOutUser } from "../../../src/services/authService";
import type { PsnVerificationResult } from "../../../src/services/convex/externalApiService";
import { GameSkillScore } from "../../../src/services/skillRatingService";
import { getUserTeams, Team } from "../../../src/services/convex/teamService";
import { buildLegacyTeamsHref } from "../../../src/navigation/routes";
import { COLORS } from "../../../src/theme";
import { isPhysicalGameDisabled } from "../../../constants/gameAvailability";
import {
    PlayerEmptyStateCard,
    PlayerSectionHeader,
} from "../components/PlayerSurface";
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
        key === 'cs16' ? 'sports-esports' :
        key === 'valorant' ? 'sports-esports' :
        key === 'fc26' ? 'sports-soccer' :
            key === 'tekken8' ? 'sports-mma' :
                key === 'indoor_cricket' ? 'sports-cricket' :
                    ['padel', 'pickleball'].includes(key) ? 'sports-tennis' : 'sports-soccer') as AppIconName
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
    playsCs16?: boolean; cs16Role?: string;
    playsValorant?: boolean; valorantRole?: string;
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
    const { animatedStyle: entranceStyle } = useEntrance({
        axis: "y",
        distance: 10,
        initialScale: 0.995,
    });
    const {
        animatedStyle: settingsPressStyle,
        onPressIn: settingsPressIn,
        onPressOut: settingsPressOut,
    } = usePressScale({ activeScale: 0.98 });
    useRouteLogger("ProfileScreen", { userId: user?._id });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [myTeams, setMyTeams] = useState<Team[]>([]);
    const [loadingTeams, setLoadingTeams] = useState(false);

    // Convex reactive query for user profile (replaces getDoc)
    const convexProfile = useQuery(
        api.users.getById,
        user?._id ? { userId: user._id as Id<"users"> } : "skip"
    );

    // Derive profile from reactive query
    const profile: FullUserProfile | null = convexProfile
        ? { uid: convexProfile._id, ...convexProfile } as any as FullUserProfile
        : null;

    // Update loading state when profile loads
    useEffect(() => {
        if (convexProfile !== undefined) {
            setLoading(false);
        }
    }, [convexProfile]);

    // Prevent double fetch for teams
    const isFetching = useRef(false);

    const fetchTeams = useCallback(async (isRefresh = false) => {
        if (!user?._id || (isFetching.current && !isRefresh)) return;

        try {
            isFetching.current = true;
            setLoadingTeams(true);
            const teamsRes = await getUserTeams(user._id);
            if (teamsRes.ok && teamsRes.data) {
                setMyTeams(teamsRes.data.filter((team) => !isPhysicalGameDisabled(team.game)));
            } else {
                setMyTeams([]);
            }
        } catch (e) {
            console.error("[Profile] Failed to fetch teams", e);
            if (isRefresh) showToast({ type: 'error', title: 'Error', message: 'Could not refresh profile' });
        } finally {
            setRefreshing(false);
            setLoadingTeams(false);
            isFetching.current = false;
        }
    }, [user?._id]);

    // Focus Effect: Re-fetch teams on focus
    useFocusEffect(
        useCallback(() => {
            fetchTeams();
        }, [fetchTeams])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchTeams(true);
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
                        else showToast({ type: "error", title: "Logout Failed", message: res.message });
                    }
                }
            ]
        );
    };

    const handleSettings = () => router.push("/profile/edit");

    const handleAddGame = (gameKey: string) => {
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
                    type: "info",
                    title: "Verification optional",
                    message: `${rules.label} can use ${prettyPlatforms} for faster verification, but you can continue and set your skill in-app.`
                });
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
            case 'cs16': return !!(profile.playsCs16);
            case 'valorant': return !!(profile.playsValorant);
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
        if (gameKey === 'cs16') {
            const score = profile.skillScores?.cs16;
            if (score?.tier) return `${score.tier} ${score.rating ?? ''}`.trim();
        }
        if (gameKey === 'valorant') {
            const score = profile.skillScores?.valorant;
            if (score?.tier) return `${score.tier} ${score.rating ?? ''}`.trim();
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
            case 'cs16': return profile.cs16Role || 'No role set';
            case 'valorant': return profile.valorantRole || 'No role set';
            case 'fc26': return profile.fcTeam || 'No team set';
            case 'tekken8': return profile.tekkenFavorites?.join(', ') || 'No characters set';
            case 'futsal': return profile.futsalPositions?.join(', ') || 'No position set';
            case 'indoor_cricket': return profile.indoorCricketRole || 'No role set';
            case 'padel': return profile.padelRole || 'No side set';
            case 'pickleball': return profile.pickleballRole || 'No mode set';
            default: return 'Active';
        }
    };

    // Format updatedAt for sync display
    const formatSyncDate = (updatedAt: any) => {
        if (!updatedAt) return 'Just now';
        if (typeof updatedAt === 'number') {
            return new Date(updatedAt).toLocaleDateString();
        }
        if (updatedAt?.toDate) {
            return updatedAt.toDate().toLocaleDateString();
        }
        return 'Just now';
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
            routeKey="/(player)/(tabs)/profile"
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
                inlineTitle
                rightAction={(
                    <Pressable
                        style={styles.headerIcon}
                        onPress={handleSettings}
                        onPressIn={settingsPressIn}
                        onPressOut={settingsPressOut}
                    >
                        <Animated.View style={settingsPressStyle}>
                            <AppIcon name="settings" size={24} color={COLORS.text} />
                        </Animated.View>
                    </Pressable>
                )}
            />

            <Animated.View style={entranceStyle}>
            {/* Profile Card */}
            <AppCard style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials()}</Text>
                    </View>
                    <Text style={styles.profileName}>{profile?.fullName || 'Player'}</Text>
                    {profile?.username && <Text style={styles.profileUsername}>@{profile.username}</Text>}
                    <Text style={styles.profileEmail}>{user?.email}</Text>

                    <View style={styles.profileMeta}>
                        {profile?.city && (
                            <View style={styles.profileMetaItem}>
                                <AppIcon name="location-on" size={14} color={COLORS.muted} />
                                <Text style={styles.profileMetaText}>{profile.city}</Text>
                            </View>
                        )}
                        {profile?.ageRange && (
                            <View style={styles.profileMetaItem}>
                                <AppIcon name="cake" size={14} color={COLORS.muted} />
                                <Text style={styles.profileMetaText}>{profile.ageRange}</Text>
                            </View>
                        )}
                    </View>
                </AppCard>

                {/* My Games */}
                <View style={styles.section}>
                    <PlayerSectionHeader title="My Games" />

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
                                    <Pressable key={game.key} style={styles.gameCard} onPress={() => handleEditGame(game.key)}>
                                        <AppCard style={styles.gameCardInner}>
                                        <View style={styles.gameIcon}>
                                            <AppIcon name={game.icon} size={24} color={COLORS.accent} />
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
                                                    <AppImage
                                                        source={faceitLevelIcons[profile.faceitSkillLevel]}
                                                        containerStyle={styles.faceitIcon}
                                                        contentFit="contain"
                                                    />
                                                ) : (game.key === 'fc26' || game.key === 'tekken8') && profile?.psnStats?.[game.key === 'fc26' ? 'fc' : 'tekken8']?.present ? (
                                                    <View style={styles.gameSkill}>
                                                        <AppIcon name="emoji-events" size={16} color="#FFD700" style={styles.yellowIcon} />
                                                    </View>
                                                ) : (
                                                    <AppIcon name="chevron-right" size={20} color={COLORS.muted} />
                                                )
                                            )}
                                        </View>
                                        </AppCard>
                                    </Pressable>
                                );
                            } else {
                                return (
                                    <Pressable key={game.key} style={styles.gameCardInactive} onPress={() => handleAddGame(game.key)}>
                                        <AppCard style={styles.gameCardInactiveInner}>
                                        <View style={styles.gameIconInactive}>
                                            <AppIcon name={game.icon} size={24} color={COLORS.muted} />
                                        </View>
                                        <View>
                                            <Text style={styles.gameNameInactive}>{game.name}</Text>
                                            <Text style={styles.gameAddText}>Tap to add</Text>
                                        </View>
                                        </AppCard>
                                    </Pressable>
                                );
                            }
                        })}
                    </ScrollView>
                </View>

                {/* Platforms */}
                <View style={styles.section}>
                    <PlayerSectionHeader title="Connected Platforms" />

                    <View style={styles.sectionPadding}>
                        {/* Steam */}
                        <Pressable style={styles.platformCard} onPress={handleSettings}>
                            <AppCard style={styles.platformCardInner}>
                            <View style={[styles.platformIcon, styles.steamIcon]}>
                                <AppIcon name="sports-esports" size={20} color={COLORS.steamBorder} />
                            </View>
                            <View style={styles.platformInfo}>
                                <Text style={styles.platformName}>Steam</Text>
                                {profile?.steamPersonaName ? (
                                    <>
                                        <Text style={styles.platformValue}>{profile.steamPersonaName}</Text>
                                        <Text style={styles.syncText}>
                                            Synced: {formatSyncDate(profile.updatedAt)}
                                        </Text>
                                    </>
                                ) : <Text style={styles.platformNotLinked}>Not linked</Text>}
                            </View>
                            <AppIcon name="chevron-right" size={20} color={COLORS.muted} />
                            </AppCard>
                        </Pressable>

                        {/* FACEIT */}
                        <Pressable style={styles.platformCard} onPress={handleSettings}>
                            <AppCard style={styles.platformCardInner}>
                            <View style={[styles.platformIcon, styles.faceitPlatformIcon]}>
                                <AppIcon name="verified" size={20} color={COLORS.faceitBorder} />
                            </View>
                            <View style={styles.platformInfo}>
                                <Text style={styles.platformName}>FACEIT</Text>
                                {profile?.faceitNickname ? (
                                    <>
                                        <Text style={styles.platformValue}>{profile.faceitNickname}</Text>
                                        <Text style={styles.syncText}>
                                            Synced: {formatSyncDate(profile.updatedAt)}
                                        </Text>
                                    </>
                                ) : <Text style={styles.platformNotLinked}>Not linked</Text>}
                            </View>
                            <AppIcon name="chevron-right" size={20} color={COLORS.muted} />
                            </AppCard>
                        </Pressable>

                        {/* PSN */}
                        <Pressable style={styles.platformCard} onPress={handleSettings}>
                            <AppCard style={styles.platformCardInner}>
                            <View style={[styles.platformIcon, styles.psnIconContainer]}>
                                <AppIcon name="sports-esports" size={20} color="#003791" />
                            </View>
                            <View style={styles.platformInfo}>
                                <Text style={styles.platformName}>PlayStation Network</Text>
                                {profile?.psnStats?.psnOnlineId ? (
                                    <>
                                        <Text style={styles.platformValue}>{profile.psnStats.psnOnlineId}</Text>
                                        <Text style={styles.syncText}>
                                            Synced: {formatSyncDate(profile.updatedAt)}
                                        </Text>
                                    </>
                                ) : <Text style={styles.platformNotLinked}>Not linked</Text>}
                            </View>
                            <AppIcon name="chevron-right" size={20} color={COLORS.muted} />
                            </AppCard>
                        </Pressable>
                    </View>
                </View>

                {/* Preferred Areas */}
                {profile?.areasPreferred && profile.areasPreferred.length > 0 && (
                    <View style={styles.section}>
                        <PlayerSectionHeader
                            title="Preferred Areas"
                            actionLabel="Edit"
                            onPress={() => router.push({ pathname: "/profile/edit", params: { focus: "areas" } })}
                        />
                        <View style={styles.sectionPadding}>
                            <View style={styles.areaChipsRow}>
                                {profile.areasPreferred.map(area => (
                                    <StatusPill
                                        key={area}
                                        label={area}
                                        tone="neutral"
                                        style={styles.areaChip}
                                        textStyle={styles.areaChipText}
                                    />
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {/* My Teams */}
                <View style={styles.section}>
                    <PlayerSectionHeader
                        title="My Teams"
                        actionLabel="View All"
                        onPress={() => router.push(buildLegacyTeamsHref("my") as any)}
                    />
                    <View style={styles.sectionPadding}>
                        {loadingTeams ? (
                            <AppCard variant="empty" style={styles.emptyState}>
                                <ActivityIndicator size="small" color={COLORS.accent} />
                            </AppCard>
                        ) : myTeams.length > 0 ? (
                            myTeams.slice(0, 3).map(team => {
                                const maxMembers = team.maxMembers || 0;
                                const rawCount = team.memberUids?.length ?? team.memberCount ?? 0;
                                const memberCount = maxMembers > 0 ? Math.min(rawCount, maxMembers) : rawCount;
                                return (
                                    <Pressable
                                        key={team.id}
                                        style={styles.teamCard}
                                        onPress={() => router.push(`/teams/${team.id}` as any)}
                                    >
                                        <AppCard style={styles.teamCardInner}>
                                        <View style={styles.teamIcon}>
                                            <AppIcon name="groups" size={20} color={COLORS.accent} />
                                        </View>
                                        <View style={styles.teamInfo}>
                                            <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
                                            <Text style={styles.teamGame}>{(team.game || '').toUpperCase()}</Text>
                                            <Text style={styles.teamMembers}>{memberCount} / {maxMembers} members</Text>
                                        </View>
                                        </AppCard>
                                    </Pressable>
                                );
                            })
                        ) : (
                            <PlayerEmptyStateCard
                                title="You haven't joined any teams yet."
                                actionLabel="Create a Team"
                                onPress={() => router.push("/teams/create")}
                                style={styles.emptyState}
                            />
                        )}
                    </View>
                </View>

                {/* Recent Matches */}
                <View style={styles.section}>
                    <PlayerSectionHeader
                        title="Recent Matches"
                        actionLabel="View All"
                        onPress={() => router.push("/matchrooms/my")}
                    />
                    <View style={styles.sectionPadding}>
                        <PlayerEmptyStateCard
                            title="No matches played yet."
                            actionLabel="Find a Match"
                            onPress={() => router.push({ pathname: "/(player)/(tabs)/discover", params: { segment: 'matchrooms', t: Date.now().toString() } } as any)}
                            style={styles.emptyState}
                        />
                    </View>
                </View>

                {/* Logout */}
                {__DEV__ ? (
                    <AppButton
                        variant="secondary"
                        style={[styles.logoutButton, { marginBottom: 12 }]}
                        onPress={() => router.push("/debug/perf")}
                        perf={{ actionKey: "open_perf_debug", toRouteKey: "/debug/perf" }}
                    >
                        Open Perf Debug
                    </AppButton>
                ) : null}

                <AppButton variant="danger" style={styles.logoutButton} onPress={handleLogout}>
                    <AppIcon name="logout" size={20} color={COLORS.error} />
                    <Text style={styles.logoutButtonText}>Logout</Text>
                </AppButton>
            </Animated.View>
        </Screen>
    );
}
