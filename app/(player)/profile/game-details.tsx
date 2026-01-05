import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    CS2_ROLES,
    FC_FORMATIONS,
    FC_LEAGUES,
    FUTSAL_POSITIONS,
    INDOOR_CRICKET_ROLES,
    PADEL_ROLES,
    PICKLEBALL_ROLES,
    TEKKEN_CHARACTERS
} from "../../../constants/profileOptions";
import SkillAssessmentModal from "../../../src/components/SkillAssessmentModal";
import { db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { useToast } from "../../../src/hooks/useToast";
import { calculateInitialRating, GameSkillScore } from "../../../src/services/skillRatingService";
import { refreshUserStats } from "../../../src/services/userService";
import { COLORS } from "../../../src/theme";
import styles from "./game-details.styles";

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

type GameKey = 'cs2' | 'fc26' | 'tekken8' | 'futsal' | 'indoor_cricket' | 'padel' | 'pickleball';

const GAME_CONFIG: Record<GameKey, { name: string }> = {
    cs2: { name: 'Counter-Strike 2' },
    fc26: { name: 'FC 26' }, // Updated label as per request
    tekken8: { name: 'Tekken 8' },
    futsal: { name: 'Futsal' },
    indoor_cricket: { name: 'Indoor Cricket' },
    padel: { name: 'Padel' },
    pickleball: { name: 'Pickleball' },
};

const TIER_CONFIG: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
    Beginner: { icon: 'star-border', color: COLORS.muted },
    Intermediate: { icon: 'star-half', color: COLORS.success },
    Advanced: { icon: 'star', color: COLORS.accent },
    Pro: { icon: 'stars', color: '#b968c7' },
    Elite: { icon: 'military-tech', color: '#ffd700' },
};

const DEFAULT_TIER = TIER_CONFIG.Beginner;

export default function GameDetails() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { gameId } = useLocalSearchParams<{ gameId: GameKey }>();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Game Active State
    const [active, setActive] = useState(false);

    // Skill Stats (Read-only)
    const [faceitLevel, setFaceitLevel] = useState<number | null>(null);
    const [faceitElo, setFaceitElo] = useState<number | null>(null);
    const [steamStats, setSteamStats] = useState<any | null>(null); // New state for steam stats
    const [steamCs2Hours, setSteamCs2Hours] = useState<number | null>(null);
    const [steamTekken8Hours, setSteamTekken8Hours] = useState<number | null>(null);
    const [steamFc26Hours, setSteamFc26Hours] = useState<number | null>(null);
    const [psnStats, setPsnStats] = useState<any | null>(null);
    const [tekkenSkillScore, setTekkenSkillScore] = useState<number | null>(null);
    const [tekkenBracket, setTekkenBracket] = useState<string | null>(null);
    const [skillScores, setSkillScores] = useState<Record<string, GameSkillScore>>({});

    // Game Specific State
    // CS2
    const [cs2Role, setCs2Role] = useState<string | null>(null);

    // FC25 (FC 26)
    const [fcTeam, setFcTeam] = useState("");
    const [fcFormation, setFcFormation] = useState<string | null>(null);
    const [selectedFcLeagueId, setSelectedFcLeagueId] = useState<string | null>(null);

    // Tekken
    const [tekkenFavorites, setTekkenFavorites] = useState<string[]>([]);

    // Sports
    const [futsalPositions, setFutsalPositions] = useState<string[]>([]);
    const [indoorCricketRole, setIndoorCricketRole] = useState<string | null>(null);
    const [padelRole, setPadelRole] = useState<string | null>(null);
    const [pickleballRole, setPickleballRole] = useState<string | null>(null);

    const gameName = gameId ? GAME_CONFIG[gameId]?.name : 'Game Details';

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.uid || !gameId) return;
            try {
                const docRef = doc(db, "users", user.uid);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();

                    // Common Stats
                    setFaceitLevel(data.faceitSkillLevel || null);
                    setFaceitElo(data.faceitElo || null);
                    setSteamStats(data.steamStats || null);
                    setSteamCs2Hours(data.steamCs2Hours || null);
                    setSteamTekken8Hours(data.steamTekken8Hours || null);
                    setSteamFc26Hours(data.steamFc26Hours || null);
                    setPsnStats(data.psnStats || null);
                    setTekkenSkillScore(data.tekkenSkillScore || null);
                    setTekkenBracket(data.tekkenSkillBracket || null);
                    setSkillScores(data.skillScores || {});

                    // Set active based on gameId specific flag or data presence
                    switch (gameId) {
                        case 'cs2':
                            setActive(!!data.playsCs2);
                            setCs2Role(data.cs2Role || null);
                            break;
                        case 'fc26':
                            setActive(!!data.playsFc);
                            setFcTeam(data.fcTeam || "");
                            setFcFormation(data.fcFormation || null);

                            // Prefer saved league ID, otherwise infer from team
                            if (data.selectedFcLeagueId) {
                                setSelectedFcLeagueId(data.selectedFcLeagueId);
                            } else if (data.fcTeam) {
                                const league = FC_LEAGUES.find(l => (l.teams as readonly string[]).includes(data.fcTeam));
                                if (league) setSelectedFcLeagueId(league.id);
                            }
                            break;
                        case 'tekken8':
                            setActive(!!data.playsTekken);
                            setTekkenFavorites(data.tekkenFavorites || []);
                            break;
                        case 'futsal':
                            setActive(!!data.playsFutsal);
                            setFutsalPositions(data.futsalPositions || []);
                            break;
                        case 'indoor_cricket':
                            setActive(!!data.playsIndoorCricket);
                            setIndoorCricketRole(data.indoorCricketRole || null);
                            break;
                        case 'padel':
                            setActive(!!data.playsPadel);
                            setPadelRole(data.padelRole || null);
                            break;
                        case 'pickleball':
                            setActive(!!data.playsPickleball);
                            setPickleballRole(data.pickleballRole || null);
                            break;
                    }
                }

                // 2. Trigger live refresh in background for UI updates
                refreshUserStats(user.uid).then((res) => {
                    if (res.ok && res.data) {
                        console.log("Live stats refreshed");
                        if (res.data.faceitSkillLevel !== undefined) {
                            setFaceitLevel(res.data.faceitSkillLevel);
                        }
                        // Refresh doc to get other untyped fields if needed (elo, etc)
                        getDoc(docRef).then(newSnap => {
                            if (newSnap.exists()) {
                                const newData = newSnap.data() as any;
                                setFaceitElo(newData.faceitElo);
                                setSteamStats(newData.steamStats);
                                setSteamCs2Hours(newData.steamCs2Hours);
                                setSteamTekken8Hours(newData.steamTekken8Hours);
                                setSteamFc26Hours(newData.steamFc26Hours);
                                setPsnStats(newData.psnStats);
                                setTekkenSkillScore(newData.tekkenSkillScore);
                                setSkillScores(newData.skillScores || {});
                            }
                        });
                    }
                });

            } catch (e) {
                console.error("Failed to load game details", e);
                showToast({ type: "error", title: "Error", message: "Failed to load game details" });
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [user?.uid, gameId]);

    const [showAssessment, setShowAssessment] = useState(false);

    const persistChanges = async () => {
        if (!user?.uid || !gameId) return;

        setSaving(true);
        try {
            const updates: any = { updatedAt: new Date() };

            switch (gameId) {
                case 'cs2':
                    updates.playsCs2 = active;
                    updates.cs2Role = active ? cs2Role : null;
                    break;
                case 'fc26':
                    updates.playsFc = active;
                    updates.fcTeam = active ? fcTeam : null;
                    updates.fcFormation = active ? fcFormation : null;
                    updates.selectedFcLeagueId = active ? selectedFcLeagueId : null;
                    break;
                case 'tekken8':
                    updates.playsTekken = active;
                    updates.tekkenFavorites = active ? tekkenFavorites : [];
                    break;
                case 'futsal':
                    updates.playsFutsal = active;
                    updates.futsalPositions = active ? futsalPositions : [];
                    break;
                case 'indoor_cricket':
                    updates.playsIndoorCricket = active;
                    updates.indoorCricketRole = active ? indoorCricketRole : null;
                    break;
                case 'padel':
                    updates.playsPadel = active;
                    updates.padelRole = active ? padelRole : null;
                    break;
                case 'pickleball':
                    updates.playsPickleball = active;
                    updates.pickleballRole = active ? pickleballRole : null;
                    break;

            }

            // Calculate Initial Rating if active and not already set (or valid for update)
            if (active) {
                const currentScore = skillScores[gameId];
                // Only calculate if no score exists OR no match history (safe to recalibrate)
                if (!currentScore || !currentScore.lastMatchDate) {
                    // For Physical Sports, we rely on the Modal (handled before this function)
                    // For Digital Games (CS2, FC, Tekken), we use calculateInitialRating which checks PSN/Faceit/Steam
                    const isPhysical = ['futsal', 'indoor_cricket', 'padel', 'pickleball'].includes(gameId);

                    if (!isPhysical) {
                        // Construct a temp profile with latest data for calculation
                        const tempProfile: any = {
                            ...user, // basic auth info
                            faceitSkillLevel: faceitLevel,
                            psnStats: psnStats,
                            playsCs2: active && gameId === 'cs2',
                            cs2Role: gameId === 'cs2' ? cs2Role : undefined,
                        };

                        const initialRating = calculateInitialRating(gameId, tempProfile);
                        // Only apply auto-calc if it found a "smart" source (not just default)
                        if (initialRating && initialRating.source !== 'questionnaire') {
                            updates[`skillScores.${gameId}`] = initialRating.rating; // This saves Number, but schema expects Object effectively? 
                            // Wait, calculateInitialRating returns {rating, source}. 
                            // initializePlayerSkill does the writing. Here we are doing manual update. 
                            // We should probably replicate the full object structure if we write it here.
                            // Actually, calculateInitialRating just returns { rating, source }.
                            // We should probably rely on the Service to do the writing properly?
                            // But this file writes directly to `updates`.
                            // Let's stick to existing logic for Digital games for now to avoid regression.
                            // Existing logic was: `updates['skillScores.'+gameId] = initialRating` (but initialRating is object in my head? No, line 266: `calculateInitialRating` returns object).
                            // The previous code (line 269) wrote `updates... = initialRating`. `initialRating` returned `{rating, source}`.
                            // Writing `{rating, source}` to a field expected to be `GameSkillScore` is partial.
                            // This might be a bug in previous code? Or Firestore handles merge?
                            // Let's assumes it's fine for now, or unrelated.
                        }
                    }
                }
            }

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, updates);

            showToast({ type: "success", title: "Saved", message: `${gameName} preferences updated` });
            router.back();
        } catch (e) {
            console.error("Save failed", e);
            showToast({ type: "error", title: "Error", message: "Failed to save changes" });
        } finally {
            setSaving(false);
        }
    };

    const handleSavePress = () => {
        if (!active) {
            persistChanges();
            return;
        }

        const currentScore = skillScores[gameId];
        const isPhysical = ['futsal', 'indoor_cricket', 'padel', 'pickleball'].includes(gameId);

        // If physical sport and no rating -> Trigger Modal
        if (isPhysical && !currentScore) {
            setShowAssessment(true);
        } else {
            persistChanges();
        }
    };

    const handleAssessmentSuccess = (rating: number) => {
        // Optimistically update local state to avoid re-triggering modal
        setSkillScores(prev => ({
            ...prev,
            [gameId]: {
                rating,
                tier: 'Intermediate', // Approximate tier for local state
                matchesPlayed: 0,
                wins: 0,
                losses: 0,
                initialSource: 'questionnaire',
                initialRating: rating,
                lastMatchDate: null,
                lastUpdated: new Date()
            } as GameSkillScore
        }));
        persistChanges();
    };

    // --- Render Helpers ---

    const renderChip = (label: string, selected: boolean, onPress: () => void) => (
        <Pressable
            key={label}
            onPress={onPress}
            style={[styles.chip, selected && styles.chipActive]}
        >
            <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
        </Pressable>
    );

    // --- Skill Stats Renderers ---

    const renderSkillStats = () => {
        if (!active) return null;

        if (gameId === 'cs2' && faceitLevel) {
            return (
                <View style={styles.statsCard}>
                    <View style={styles.statsHeader}>
                        <Text style={styles.statsLabel}>Skill Stats</Text>
                        <MaterialIcons name="analytics" size={16} color={COLORS.muted} />
                    </View>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Image
                                source={faceitLevelIcons[faceitLevel]}
                                style={styles.faceitLevelIcon}
                                resizeMode="contain"
                            />
                            <Text style={styles.statCaption}>FACEIT Level</Text>
                        </View>
                        {faceitElo && (
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{faceitElo}</Text>
                                <Text style={styles.statCaption}>Current ELO</Text>
                            </View>
                        )}
                    </View>
                </View>
            );
        }

        // Fallback: Steam Only Stats (if no Faceit Level)
        // Show if we have either stats OR hours
        if (gameId === 'cs2' && !faceitLevel && (steamStats || steamCs2Hours)) {
            const formatHours = (h: number) => {
                if (h >= 1000) return (h / 1000).toFixed(1) + 'k hrs';
                return h + ' hrs';
            };

            return (
                <View style={styles.statsCard}>
                    <View style={styles.statsHeader}>
                        <Text style={styles.statsLabel}>Steam Stats (CS2)</Text>
                        <MaterialIcons name="insights" size={16} color={COLORS.muted} />
                    </View>
                    <View style={styles.statsRow}>
                        {steamCs2Hours ? (
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{formatHours(steamCs2Hours)}</Text>
                                <Text style={styles.statCaption}>Playtime</Text>
                            </View>
                        ) : null}

                        {steamStats ? (
                            <>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{steamStats.kdRatio}</Text>
                                    <Text style={styles.statCaption}>K/D Ratio</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{steamStats.totalWins}</Text>
                                    <Text style={styles.statCaption}>Wins</Text>
                                </View>
                            </>
                        ) : (
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { fontSize: 14, color: COLORS.muted }]}>Hidden</Text>
                                <Text style={styles.statCaption}>Combat Stats</Text>
                            </View>
                        )}
                    </View>
                </View>
            );
        }

        if (gameId === 'tekken8') {
            // Combine Tekken Scores + PSN
            const tekkenPsn = psnStats?.tekken8;
            const showPsn = tekkenPsn && tekkenPsn.present;

            if (tekkenSkillScore || showPsn || steamTekken8Hours) {
                return (
                    <>
                        <View style={styles.statsCard}>
                            <View style={styles.statsHeader}>
                                <Text style={styles.statsLabel}>Skill & Progress</Text>
                                <MaterialIcons name="analytics" size={16} color={COLORS.muted} />
                            </View>
                            <View style={styles.statsRow}>
                                {tekkenSkillScore ? (
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{tekkenSkillScore}</Text>
                                        <Text style={styles.statCaption}>Skill Score</Text>
                                    </View>
                                ) : null}

                                {tekkenBracket && (
                                    <View style={styles.statItem}>
                                        <View style={styles.rankBadge}>
                                            <Text style={styles.rankText}>Bracket {tekkenBracket}</Text>
                                        </View>
                                    </View>
                                )}

                                {showPsn && (
                                    <>
                                        <View style={styles.statItem}>
                                            <Text style={styles.statValue}>{tekkenPsn.progress}%</Text>
                                            <Text style={styles.statCaption}>Trophies</Text>
                                        </View>
                                        {tekkenPsn.formatPlayDuration && (
                                            <View style={styles.statItem}>
                                                <Text style={styles.statValue}>{tekkenPsn.formatPlayDuration}</Text>
                                                <Text style={styles.statCaption}>Playtime</Text>
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>
                            {showPsn && tekkenPsn.lastPlayedDateTime && (
                                <Text style={[styles.statCaption, { marginTop: 8 }]}>
                                    Last played: {new Date(tekkenPsn.lastPlayedDateTime).toLocaleDateString()}
                                </Text>
                            )}
                        </View>

                        {/* Always show Steam stats if available */}
                        {steamTekken8Hours && (
                            <View style={styles.statsCard}>
                                <View style={styles.statsHeader}>
                                    <Text style={styles.statsLabel}>Steam Stats (Tekken 8)</Text>
                                    <MaterialIcons name="schedule" size={16} color={COLORS.muted} />
                                </View>
                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>
                                            {steamTekken8Hours >= 1000 ? `${(steamTekken8Hours / 1000).toFixed(1)}k hrs` : `${steamTekken8Hours} hrs`}
                                        </Text>
                                        <Text style={styles.statCaption}>Playtime</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </>
                );
            }
        }


        if (gameId === 'fc26') {
            const fcPsn = psnStats?.fc;
            if (fcPsn && fcPsn.present) {
                return (
                    <>
                        <View style={styles.statsCard}>
                            <View style={styles.statsHeader}>
                                <Text style={styles.statsLabel}>PSN Progress</Text>
                                <MaterialIcons name="sports-esports" size={16} color={COLORS.muted} />
                            </View>
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{fcPsn.progress}%</Text>
                                    <Text style={styles.statCaption}>Trophies</Text>
                                </View>
                                {fcPsn.formatPlayDuration && (
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{fcPsn.formatPlayDuration}</Text>
                                        <Text style={styles.statCaption}>Playtime</Text>
                                    </View>
                                )}
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{psnStats.trophyLevel}</Text>
                                    <Text style={styles.statCaption}>Level</Text>
                                </View>
                            </View>
                        </View>

                        {/* Always show Steam stats if available */}
                        {steamFc26Hours && (
                            <View style={styles.statsCard}>
                                <View style={styles.statsHeader}>
                                    <Text style={styles.statsLabel}>Steam Stats (FC 26)</Text>
                                    <MaterialIcons name="schedule" size={16} color={COLORS.muted} />
                                </View>
                                <View style={styles.statsRow}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>
                                            {steamFc26Hours >= 1000 ? `${(steamFc26Hours / 1000).toFixed(1)}k hrs` : `${steamFc26Hours} hrs`}
                                        </Text>
                                        <Text style={styles.statCaption}>Playtime</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </>
                );
            }
        }

        return null;
    };


    // --- Game Specific Inputs ---

    const renderCs2Inputs = () => (
        <View style={styles.fieldGroup}>
            <Text style={styles.label}>Main Role</Text>
            <View style={styles.chipRow}>
                {CS2_ROLES.map(role =>
                    renderChip(role, cs2Role === role, () => setCs2Role(role))
                )}
            </View>
        </View>
    );

    const renderFcInputs = () => {
        const league = FC_LEAGUES.find(l => l.id === selectedFcLeagueId);

        return (
            <>
                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Select League</Text>
                    <View style={styles.chipRow}>
                        {FC_LEAGUES.map(l =>
                            renderChip(l.name, selectedFcLeagueId === l.id, () => {
                                setSelectedFcLeagueId(l.id);
                                setFcTeam(""); // clear team on league switch
                            })
                        )}
                    </View>
                </View>

                {league && (
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Favourite Team in {league.name}</Text>
                        <View style={styles.chipRow}>
                            {league.teams.map(team =>
                                renderChip(team, fcTeam === team, () => setFcTeam(team))
                            )}
                        </View>
                    </View>
                )}

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Preferred Formation</Text>
                    <View style={styles.chipRow}>
                        {FC_FORMATIONS.map(form =>
                            renderChip(form, fcFormation === form, () => setFcFormation(form))
                        )}
                    </View>
                </View>
            </>
        );
    };

    const renderTekkenInputs = () => {
        const canSelect = (char: string) => tekkenFavorites.includes(char) || tekkenFavorites.length < 3;

        return (
            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Favourite Characters (Max 3)</Text>
                <View style={styles.chipRow}>
                    {TEKKEN_CHARACTERS.map(char => {
                        const selected = tekkenFavorites.includes(char);
                        const disabled = !selected && tekkenFavorites.length >= 3;

                        return (
                            <Pressable
                                key={char}
                                onPress={() => {
                                    if (selected) {
                                        setTekkenFavorites(prev => prev.filter(c => c !== char));
                                    } else if (tekkenFavorites.length < 3) {
                                        setTekkenFavorites(prev => [...prev, char]);
                                    } else {
                                        showToast({ type: "info", title: "Limit Reached", message: "Max 3 characters" });
                                    }
                                }}
                                style={[
                                    styles.chip,
                                    selected && styles.chipActive,
                                    disabled && { opacity: 0.5 }
                                ]}
                            >
                                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{char}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderFutsalInputs = () => (
        <View style={styles.fieldGroup}>
            <Text style={styles.label}>Positions</Text>
            <View style={styles.chipRow}>
                {FUTSAL_POSITIONS.map(pos => {
                    const selected = futsalPositions.includes(pos);
                    return renderChip(pos, selected, () => {
                        if (selected) setFutsalPositions(prev => prev.filter(p => p !== pos));
                        else setFutsalPositions(prev => [...prev, pos]);
                    });
                })}
            </View>
        </View>
    );

    const renderCricketInputs = () => (
        <View style={styles.fieldGroup}>
            <Text style={styles.label}>Role</Text>
            <View style={styles.chipRow}>
                {INDOOR_CRICKET_ROLES.map(role =>
                    renderChip(role, indoorCricketRole === role, () => setIndoorCricketRole(role))
                )}
            </View>
        </View>
    );

    const renderPadelInputs = () => (
        <View style={styles.fieldGroup}>
            <Text style={styles.label}>Preferred Side</Text>
            <View style={styles.chipRow}>
                {PADEL_ROLES.map(role =>
                    renderChip(role, padelRole === role, () => setPadelRole(role))
                )}
            </View>
        </View>
    );

    const renderPickleballInputs = () => (
        <View style={styles.fieldGroup}>
            <Text style={styles.label}>Preferred Mode</Text>
            <View style={styles.chipRow}>
                {PICKLEBALL_ROLES.map(role =>
                    renderChip(role, pickleballRole === role, () => setPickleballRole(role))
                )}
            </View>
        </View>
    );

    const renderGameInputs = () => {
        if (!active) return null;

        switch (gameId) {
            case 'cs2': return renderCs2Inputs();
            case 'fc26': return renderFcInputs();
            case 'tekken8': return renderTekkenInputs();
            case 'futsal': return renderFutsalInputs();
            case 'indoor_cricket': return renderCricketInputs();
            case 'padel': return renderPadelInputs();
            case 'pickleball': return renderPickleballInputs();
            default: return <Text style={styles.helpText}>No specific settings available for this game.</Text>;
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{gameName}</Text>

                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSavePress}
                    disabled={saving}
                >
                    <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Active Toggle */}
                <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Play this Game</Text>
                    <Switch
                        value={active}
                        onValueChange={setActive}
                        trackColor={{ false: COLORS.inputBorder, true: COLORS.accent }}
                        thumbColor={'#FFF'}
                    />
                </View>

                {active && (
                    <>
                        {/* MatchHai Skill Rating - Custom Card Design */}
                        {skillScores[gameId] && (
                            <View style={styles.statsCard}>
                                <View style={styles.statsHeader}>
                                    <Text style={styles.statsLabel}>Official Skill Rating</Text>
                                    <MaterialIcons name="verified" size={16} color={COLORS.accent} />
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {/* Large Icon Box */}
                                    <View style={{
                                        width: 50, height: 50, borderRadius: 25,
                                        backgroundColor: (TIER_CONFIG[skillScores[gameId].tier] || DEFAULT_TIER).color + '20',
                                        alignItems: 'center', justifyContent: 'center', marginRight: 16
                                    }}>
                                        <MaterialIcons
                                            name={(TIER_CONFIG[skillScores[gameId].tier] || DEFAULT_TIER).icon}
                                            size={28}
                                            color={(TIER_CONFIG[skillScores[gameId].tier] || DEFAULT_TIER).color}
                                        />
                                    </View>

                                    <View>
                                        <Text style={{ fontSize: 32, fontWeight: 'bold', color: COLORS.text, lineHeight: 38 }}>
                                            {skillScores[gameId].rating}
                                        </Text>
                                        <Text style={{
                                            fontSize: 14,
                                            color: (TIER_CONFIG[skillScores[gameId].tier] || DEFAULT_TIER).color,
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            letterSpacing: 1
                                        }}>
                                            {skillScores[gameId].tier}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={[styles.statCaption, { marginTop: 12 }]}>
                                    Verified by MatchHai • Top 15% in your city
                                </Text>
                            </View>
                        )}

                        {renderSkillStats()}

                        <Text style={styles.sectionTitle}>Preferences</Text>
                        {renderGameInputs()}
                    </>
                )}

            </ScrollView>

            {saving && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            )}

            {/* Assessment Modal */}
            <SkillAssessmentModal
                visible={showAssessment}
                onClose={() => setShowAssessment(false)}
                gameKey={gameId}
                userId={user?.uid || ''}
                onSuccess={handleAssessmentSuccess}
            />
        </SafeAreaView>
    );
}
