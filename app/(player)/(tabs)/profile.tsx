import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { doc, getDoc } from "firebase/firestore";
import SkillBadge from "../../../src/components/SkillBadge";
import { db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { useToast } from "../../../src/hooks/useToast";
import { signOutUser } from "../../../src/services/authService";
import { PsnVerificationResult } from "../../../src/services/psnApi";
import { GameSkillScore } from "../../../src/services/skillRatingService";
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

// All available games for the platform
const ALL_GAMES: Array<{ key: string; name: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
    { key: 'cs2', name: 'Counter-Strike 2', icon: 'sports-esports' },
    { key: 'fc26', name: 'FC 26', icon: 'sports-soccer' },
    { key: 'tekken8', name: 'Tekken 8', icon: 'sports-mma' },
    { key: 'futsal', name: 'Futsal', icon: 'sports-soccer' },
    { key: 'indoor_cricket', name: 'Indoor Cricket', icon: 'sports-cricket' },
    { key: 'padel', name: 'Padel', icon: 'sports-tennis' },
    { key: 'pickleball', name: 'Pickleball', icon: 'sports-tennis' },
];

interface FullUserProfile {
    uid: string;
    email?: string;
    fullName?: string;
    username?: string;
    phone?: string;
    city?: string;
    ageRange?: string;

    // Game preferences
    playsCs2?: boolean;
    cs2Role?: string;
    faceitSkillLevel?: number;
    faceitElo?: number;
    faceitNickname?: string;

    playsFc?: boolean;
    fcTeam?: string;
    fcFormation?: string;

    playsTekken?: boolean;
    tekkenFavorites?: string[];

    playsFutsal?: boolean;
    futsalPositions?: string[];

    playsIndoorCricket?: boolean;
    indoorCricketRole?: string;
    indoorCricketBowlingStyle?: string;
    indoorCricketBattingStyle?: string;

    playsPadel?: boolean;
    padelRole?: string;

    playsPickleball?: boolean;
    pickleballRole?: string;

    // Location
    areasPreferred?: string[];

    // Platform links
    steamProfileUrl?: string;
    steamPersonaName?: string;
    faceitProfileUrl?: string;

    // Teams
    teamsByGame?: Record<string, string[]>;

    // PSN
    psnStats?: PsnVerificationResult;

    // MatchHai Skill Scores
    skillScores?: Record<string, GameSkillScore>;

    // Steam Stats
    steamCs2Hours?: number;
    steamTekken8Hours?: number;
    steamFc26Hours?: number;
    steamStats?: any;
}

export default function Profile() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [profile, setProfile] = useState<FullUserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchProfile = async () => {
        if (!user?.uid) return;

        try {
            const userRef = doc(db, "users", user.uid);
            const snap = await getDoc(userRef);

            if (snap.exists()) {
                setProfile({ uid: snap.id, ...snap.data() } as FullUserProfile);
            }
        } catch (e) {
            console.error("[Profile] Failed to fetch profile", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [user?.uid]);

    // Auto-refresh profile when screen gains focus (e.g., after editing platforms)
    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [user?.uid])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchProfile();
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
                        if (res.ok) {
                            router.replace("/auth/login");
                        } else {
                            Alert.alert("Logout Failed", res.message);
                        }
                    }
                }
            ]
        );
    };

    const handleSettings = () => {
        router.push("/profile/edit");
    };

    const handleAddGame = (gameKey: string) => {
        // Validation: Check if user has required platform verification
        if (gameKey === 'cs2') {
            // CS2 requires Steam OR FACEIT
            const hasSteam = !!(profile?.steamProfileUrl);
            const hasFaceit = !!(profile?.faceitNickname);

            if (!hasSteam && !hasFaceit) {
                showToast({
                    type: "warning",
                    title: "Platform Required",
                    message: "Please connect your Steam or FACEIT account in Edit Profile to add CS2."
                });
                return;
            }
        }

        if (gameKey === 'tekken8' || gameKey === 'fc26') {
            // Tekken 8 and FC26 require PSN OR Steam
            const hasPsn = !!(profile?.psnStats?.psnOnlineId);
            const hasSteam = !!(profile?.steamProfileUrl);

            if (!hasPsn && !hasSteam) {
                const gameName = gameKey === 'tekken8' ? 'Tekken 8' : 'FC 26';
                showToast({
                    type: "warning",
                    title: "Platform Required",
                    message: `Please connect your PSN or Steam account in Edit Profile to add ${gameName}.`
                });
                return;
            }
        }

        // Validation passed, proceed to game details
        router.push(`/profile/game-details?gameId=${gameKey}`);
    };

    const handleEditGame = (gameKey: string) => {
        router.push(`/profile/game-details?gameId=${gameKey}`);
    };
    const getInitials = () => {
        if (profile?.fullName) {
            const parts = profile.fullName.trim().split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return profile.fullName[0].toUpperCase();
        }
        if (profile?.username) {
            return profile.username[0].toUpperCase();
        }
        return user?.email?.[0].toUpperCase() || '?';
    };

    // Check if a game is active
    const isGameActive = (gameKey: string): boolean => {
        if (!profile) return false;

        switch (gameKey) {
            case 'cs2': return !!(profile.playsCs2 || profile.cs2Role);
            case 'fc26': return !!(profile.playsFc || profile.fcTeam);
            case 'tekken8': return !!(profile.playsTekken || (profile.tekkenFavorites?.length ?? 0) > 0);
            case 'futsal': return !!(profile.playsFutsal || (profile.futsalPositions?.length ?? 0) > 0);
            case 'indoor_cricket': return !!(profile.playsIndoorCricket || profile.indoorCricketRole);
            case 'padel': return !!(profile.playsPadel || profile.padelRole);
            case 'pickleball': return !!(profile.playsPickleball || profile.pickleballRole);
            default: return false;
        }
    };

    // Get game role/details for display
    const getGameDetails = (gameKey: string): {
        role: string;
        extras?: string[];
        faceitLevel?: number;
        faceitElo?: number;
        psnData?: { percent: number; playtime?: string };
        steamHours?: number;
    } => {
        if (!profile) return { role: 'Not configured' };

        switch (gameKey) {
            case 'cs2':
                return {
                    role: profile.cs2Role || 'No role set',
                    faceitLevel: profile.faceitSkillLevel,
                    faceitElo: profile.faceitElo,
                    steamHours: profile.steamCs2Hours, // Fallback for CS2
                };
            case 'fc26':
                const fcPsn = profile.psnStats?.fc;
                return {
                    role: profile.fcTeam || 'No team set',
                    extras: profile.fcFormation ? [profile.fcFormation] : [],
                    psnData: fcPsn && fcPsn.present ? {
                        percent: fcPsn.progress || 0,
                        playtime: fcPsn.formatPlayDuration || undefined
                    } : undefined,
                    steamHours: profile.steamFc26Hours // Fallback to Steam
                };
            case 'tekken8':
                const tekPsn = profile.psnStats?.tekken8;
                return {
                    role: profile.tekkenFavorites?.join(', ') || 'No characters set',
                    psnData: tekPsn && tekPsn.present ? {
                        percent: tekPsn.progress || 0,
                        playtime: tekPsn.formatPlayDuration || undefined
                    } : undefined,
                    steamHours: profile.steamTekken8Hours // Fallback to Steam
                };
            case 'futsal':
                return {
                    role: profile.futsalPositions?.join(', ') || 'No position set',
                };
            case 'indoor_cricket':
                return {
                    role: profile.indoorCricketRole || 'No role set',
                    extras: [profile.indoorCricketBattingStyle, profile.indoorCricketBowlingStyle].filter(Boolean) as string[],
                };
            case 'padel':
                return {
                    role: profile.padelRole || 'No role set',
                };
            case 'pickleball':
                return {
                    role: profile.pickleballRole || 'No role set',
                };
            default:
                return { role: 'Not configured' };
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

    return (
        <SafeAreaView style={styles.screen}>
            {/* Header with Settings Icon */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Profile</Text>
                <TouchableOpacity style={styles.headerIcon} onPress={handleSettings}>
                    <MaterialIcons name="settings" size={24} color={COLORS.text} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                }
            >
                {/* Profile Card (no edit button) */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials()}</Text>
                    </View>

                    <Text style={styles.profileName}>
                        {profile?.fullName || 'Player'}
                    </Text>

                    {profile?.username && (
                        <Text style={styles.profileUsername}>@{profile.username}</Text>
                    )}

                    <Text style={styles.profileEmail}>{user?.email}</Text>

                    {/* Meta info: City, Age */}
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

                {/* My Games Section - Show ALL games */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>My Games</Text>
                    </View>

                    {ALL_GAMES.map(game => {
                        const isActive = isGameActive(game.key);
                        const details = getGameDetails(game.key);

                        if (isActive) {
                            // Active game card
                            return (
                                <TouchableOpacity
                                    key={game.key}
                                    style={styles.gameCard}
                                    onPress={() => handleEditGame(game.key)}
                                >
                                    <View style={styles.gameIcon}>
                                        <MaterialIcons name={game.icon} size={24} color={COLORS.accent} />
                                    </View>
                                    <View style={styles.gameInfo}>
                                        <Text style={styles.gameName}>{game.name}</Text>
                                        <Text style={styles.gameRole}>
                                            {details.role}
                                            {details.extras && details.extras.length > 0 && (
                                                ` · ${details.extras.join(' · ')}`
                                            )}
                                        </Text>
                                    </View>
                                    {/* Skill Badge Display */}
                                    <View style={{ marginLeft: 'auto' }}>
                                        {profile?.skillScores?.[game.key] ? (
                                            <SkillBadge
                                                tier={profile.skillScores[game.key].tier}
                                                rating={profile.skillScores[game.key].rating}
                                                size="compact"
                                            />
                                        ) : (
                                            /* Legacy/Fallback displays if no SkillScore exists yet */
                                            game.key === 'cs2' && details.faceitLevel ? (
                                                <Image
                                                    source={faceitLevelIcons[details.faceitLevel]}
                                                    style={styles.faceitIcon}
                                                    resizeMode="contain"
                                                />
                                            ) : (game.key === 'fc26' || game.key === 'tekken8') && details.psnData ? (
                                                <View style={styles.gameSkill}>
                                                    <MaterialIcons name="emoji-events" size={16} color="#FFD700" style={{ marginRight: 4 }} />
                                                    <Text style={[styles.gameRole, { color: COLORS.text, fontWeight: '600' }]}>
                                                        {details.psnData.percent}%
                                                    </Text>
                                                </View>
                                            ) : (
                                                <MaterialIcons name="chevron-right" size={20} color={COLORS.muted} />
                                            )
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        } else {
                            // Inactive game card (grayed out, tap to add)
                            return (
                                <TouchableOpacity
                                    key={game.key}
                                    style={styles.gameCardInactive}
                                    onPress={() => handleAddGame(game.key)}
                                >
                                    <View style={styles.gameIconInactive}>
                                        <MaterialIcons name={game.icon} size={24} color={COLORS.muted} />
                                    </View>
                                    <Text style={styles.gameNameInactive}>{game.name}</Text>
                                    <Text style={styles.gameAddText}>Tap to add</Text>
                                </TouchableOpacity>
                            );
                        }
                    })}
                </View>

                {/* Platform Links */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Connected Platforms</Text>
                    </View>

                    {/* Steam */}
                    <TouchableOpacity style={styles.platformCard} onPress={handleSettings}>
                        <View style={[styles.platformIcon, styles.steamIcon]}>
                            <MaterialIcons name="sports-esports" size={20} color={COLORS.steamBorder} />
                        </View>
                        <View style={styles.platformInfo}>
                            <Text style={styles.platformName}>Steam</Text>
                            {profile?.steamPersonaName ? (
                                <Text style={styles.platformValue}>{profile.steamPersonaName}</Text>
                            ) : (
                                <Text style={styles.platformNotLinked}>Not linked</Text>
                            )}
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
                                <Text style={styles.platformValue}>{profile.faceitNickname}</Text>
                            ) : (
                                <Text style={styles.platformNotLinked}>Not linked</Text>
                            )}
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color={COLORS.muted} />
                    </TouchableOpacity>

                    {/* PSN */}
                    <TouchableOpacity style={styles.platformCard} onPress={handleSettings}>
                        <View style={[styles.platformIcon, { backgroundColor: 'rgba(0, 48, 135, 0.1)', borderColor: '#003087', borderWidth: 1 }]}>
                            <MaterialIcons name="sports-esports" size={20} color="#003791" />
                        </View>
                        <View style={styles.platformInfo}>
                            <Text style={styles.platformName}>PlayStation Network</Text>
                            {profile?.psnStats?.psnOnlineId ? (
                                <Text style={styles.platformValue}>{profile.psnStats.psnOnlineId}</Text>
                            ) : (
                                <Text style={styles.platformNotLinked}>Not linked</Text>
                            )}
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color={COLORS.muted} />
                    </TouchableOpacity>
                </View>

                {/* Preferred Areas */}
                {profile?.areasPreferred && profile.areasPreferred.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Preferred Areas</Text>
                        </View>
                        <View style={styles.areaChipsRow}>
                            {profile.areasPreferred.map(area => (
                                <View key={area} style={styles.areaChip}>
                                    <Text style={styles.areaChipText}>{area}</Text>
                                </View>
                            ))}
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

                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            You haven't joined any teams yet.
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyButton}
                            onPress={() => router.push("/teams/create")}
                        >
                            <Text style={styles.emptyButtonText}>Create a Team</Text>
                        </TouchableOpacity>
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

                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>
                            No matches played yet.
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyButton}
                            onPress={() => router.push("/(player)/(tabs)/matchrooms")}
                        >
                            <Text style={styles.emptyButtonText}>Find a Match</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <MaterialIcons name="logout" size={20} color={COLORS.error} />
                    <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
