import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { fetchDoc } from "../../src/services/firestoreService";
import { getCaptainedTeams, sendTeamMatchChallenge } from "../../src/services/teamMatchService";
import type { Team } from "../../src/services/teamService";
import { deriveZoneRate, type Zone } from "../../src/services/zoneService";
import { parseScheduledDateTime } from "../../src/utils/matchroomTime";
import BasicFields from "../matchrooms/create/components/BasicFields";
import ZonePicker from "../matchrooms/create/components/ZonePicker";
import styles from "../matchrooms/create/create.styles";

const SERIES_OPTIONS = ["BO1", "BO3", "BO5"] as const;
const GAME_ICONS: Record<string, string> = {
    cs2: "sports-esports",
    fc26: "sports-soccer",
    fc25: "sports-soccer",
    tekken8: "sports-kabaddi",
    futsal: "sports-soccer",
    indoor_cricket: "sports-cricket",
    padel: "sports-tennis",
    pickleball: "sports-tennis",
};

const getSeriesHours = (gameKey: string, seriesType: "BO1" | "BO3" | "BO5") => {
    const game = String(gameKey || "").toLowerCase();
    if (game === "cs2") return seriesType === "BO3" ? 3 : seriesType === "BO5" ? 5 : 1;
    if (game === "fc26" || game === "fc25") return seriesType === "BO3" ? 1 : seriesType === "BO5" ? 2 : 0.5;
    if (game === "tekken8") return seriesType === "BO3" ? 2 : seriesType === "BO5" ? 3 : 1;
    if (game === "padel" || game === "pickleball") return seriesType === "BO3" ? 1 : seriesType === "BO5" ? 2 : 1;
    return seriesType === "BO3" ? 2 : seriesType === "BO5" ? 3 : 1;
};

const getEstimatedPlayers = (gameKey: string, challenger?: Team | null, opponent?: Team | null) => {
    const game = String(gameKey || "").toLowerCase();
    if (game === "cs2") return 10;
    if (game === "fc26" || game === "fc25" || game === "tekken8") {
        const teamSize = Math.max(Number(challenger?.maxMembers || 0), Number(opponent?.maxMembers || 0), 1);
        return teamSize <= 1 ? 2 : 4;
    }
    if (game === "padel") return 4;
    if (game === "pickleball") {
        const teamSize = Math.max(Number(challenger?.maxMembers || 0), Number(opponent?.maxMembers || 0), 1);
        return teamSize <= 1 ? 2 : 4;
    }
    if (game === "indoor_cricket") return 16;
    return Math.max(2, Number(challenger?.maxMembers || 0) + Number(opponent?.maxMembers || 0));
};

const getBaseZoneRate = (zone: Zone | null, gameKey: string) => {
    if (!zone) return 0;
    const pricing: any = zone.pricing || zone.branches?.[0]?.pricing || {};
    const game = String(gameKey || "").toLowerCase();

    if (game === "cs2") {
        const rates = [
            pricing?.pc?.regular?.price,
            pricing?.pc?.premium?.price,
            pricing?.pc?.elite?.price,
        ].filter((value: any) => typeof value === "number" && value > 0);
        return rates.length > 0 ? Math.min(...rates) : 0;
    }

    if (game === "fc26" || game === "fc25" || game === "tekken8") {
        const rates = [
            pricing?.console?.ps5?.price2v2,
            pricing?.console?.ps5?.price1v1,
            pricing?.console?.xbox?.price2v2,
            pricing?.console?.xbox?.price1v1,
        ].filter((value: any) => typeof value === "number" && value > 0);
        return rates.length > 0 ? Math.min(...rates) : 0;
    }

    const derived = deriveZoneRate(zone, gameKey);
    return typeof derived.rate === "number" && derived.rate > 0 ? derived.rate : 0;
};

export default function TeamChallengeCreateScreen() {
    const params = useLocalSearchParams<{ opponentTeamId?: string | string[] }>();
    const opponentTeamId = Array.isArray(params.opponentTeamId) ? params.opponentTeamId[0] : params.opponentTeamId;
    const router = useRouter();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [opponentTeam, setOpponentTeam] = useState<Team | null>(null);
    const [captainedTeams, setCaptainedTeams] = useState<Team[]>([]);
    const [challengerTeamId, setChallengerTeamId] = useState<string>("");
    const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
    const [seriesType, setSeriesType] = useState<(typeof SERIES_OPTIONS)[number]>("BO1");
    const [pricePerPlayer, setPricePerPlayer] = useState(0);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        maxPlayers: 10,
        date: "",
        time: "",
    });

    useEffect(() => {
        const load = async () => {
            if (!opponentTeamId || !user?.uid) {
                setLoading(false);
                return;
            }

            const [opponentSnap, captained] = await Promise.all([
                fetchDoc<Team>(["teams", opponentTeamId]),
                getCaptainedTeams(user.uid),
            ]);

            if (!opponentSnap.exists) {
                Alert.alert("Not found", "Opponent team not found.");
                router.back();
                return;
            }

            const opponent = { id: opponentSnap.id, ...opponentSnap.data } as Team;
            setOpponentTeam(opponent);
            setFormData((prev) => ({
                ...prev,
                title: prev.title || `Challenge: ${opponent.name}`,
            }));

            const sameGameTeams: Team[] = (captained.ok && captained.data ? captained.data : []).filter(
                (item: Team) => item.id !== opponent.id && String(item.game || "").toLowerCase() === String(opponent.game || "").toLowerCase(),
            );
            setCaptainedTeams(sameGameTeams);
            if (sameGameTeams.length > 0) {
                setChallengerTeamId(sameGameTeams[0].id || "");
            }
            setLoading(false);
        };

        load();
    }, [opponentTeamId, router, user?.uid]);

    const challengerTeam = useMemo(
        () => captainedTeams.find((item) => item.id === challengerTeamId) || null,
        [captainedTeams, challengerTeamId],
    );

    const isTeamFilled = (team: Team | null) => {
        if (!team) return false;
        const maxMembers = Number(team.maxMembers || 0);
        const memberCount = Math.max(
            Number(team.memberCount || 0),
            Array.isArray(team.memberUids) ? team.memberUids.length : 0,
            Array.isArray(team.members) ? team.members.length : 0,
        );
        if (!Number.isFinite(maxMembers) || maxMembers <= 0) return false;
        return memberCount >= maxMembers;
    };

    const getTeamCountLabel = (team: Team | null) => {
        if (!team) return "0/0";
        const maxMembers = Number(team.maxMembers || 0);
        const memberCount = Math.max(
            Number(team.memberCount || 0),
            Array.isArray(team.memberUids) ? team.memberUids.length : 0,
            Array.isArray(team.members) ? team.members.length : 0,
        );
        const safeMax = Number.isFinite(maxMembers) && maxMembers > 0 ? maxMembers : 0;
        return `${memberCount}/${safeMax}`;
    };

    const areBothTeamsFilled = isTeamFilled(challengerTeam) && isTeamFilled(opponentTeam);

    const estimatedPlayers = useMemo(
        () => getEstimatedPlayers(String(opponentTeam?.game || ""), challengerTeam, opponentTeam),
        [challengerTeam, opponentTeam],
    );

    useEffect(() => {
        const game = String(opponentTeam?.game || "");
        const baseRate = getBaseZoneRate(selectedZone, game);
        if (!baseRate) {
            setPricePerPlayer(0);
            return;
        }
        const hours = getSeriesHours(game, seriesType);
        const totalCost = baseRate * hours;
        const perPlayer = estimatedPlayers > 0 ? Math.ceil(totalCost / estimatedPlayers) : 0;
        setPricePerPlayer(perPlayer);
    }, [opponentTeam?.game, selectedZone, seriesType, estimatedPlayers]);

    const canSubmit = !!challengerTeam &&
        !!opponentTeam &&
        !!selectedZone &&
        !!formData.date &&
        !!formData.time &&
        pricePerPlayer > 0 &&
        !submitting;

    const handleFieldChange = (field: string, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleCreateChallenge = async () => {
        if (submitting) return;
        if (!challengerTeam || !opponentTeam || !selectedZone || !formData.date || !formData.time || pricePerPlayer <= 0) {
            Alert.alert("Missing details", "Select captain team, date/time, preferred zone, and valid pricing before sending challenge.");
            return;
        }
        if (!areBothTeamsFilled) {
            Alert.alert(
                "Teams not filled",
                `${challengerTeam.name}: ${getTeamCountLabel(challengerTeam)}\n${opponentTeam.name}: ${getTeamCountLabel(opponentTeam)}\n\nBoth teams must be full to send a challenge.`,
            );
            return;
        }

        const scheduledAt = parseScheduledDateTime(formData.date, formData.time);
        if (!scheduledAt) {
            Alert.alert("Invalid date/time", "Select valid date and time.");
            return;
        }
        if (scheduledAt.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
            Alert.alert("Invalid schedule", "Challenge match must be at least 24 hours from now.");
            return;
        }

        setSubmitting(true);
        const result = await sendTeamMatchChallenge({
            challengerTeamId: challengerTeam.id!,
            opponentTeamId: opponentTeam.id!,
            scheduledDate: formData.date,
            scheduledTime: formData.time,
            pricePerPlayer,
            seriesType,
            message: formData.description.trim(),
            proposedVenueByCaptainA: {
                zoneId: selectedZone.id,
                venueName: selectedZone.venueBrandName,
                areaLabel: selectedZone.primaryBranch?.areaLabel || null,
            },
            maxPlayers: estimatedPlayers,
        });
        setSubmitting(false);

        if (!result.ok) {
            Alert.alert("Challenge failed", result.message || "Unable to send challenge.");
            return;
        }

        Alert.alert("Challenge sent", `${challengerTeam.name} challenged ${opponentTeam.name}.`, [
            { text: "Open Challenge", onPress: () => router.replace(`/teams/challenge?id=${result.challengeId}` as any) },
            { text: "OK" },
        ]);
    };

    if (loading) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <View style={styles.centered}>
                    <ActivityIndicator color="#FFF" />
                </View>
            </Screen>
        );
    }

    if (!opponentTeam) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <AppHeader title="Challenge Team" onBack={() => router.back()} inlineTitle />
                <View style={styles.centered}>
                    <Text style={styles.helperText}>Opponent team not found.</Text>
                </View>
            </Screen>
        );
    }

    const gameKey = String(opponentTeam.game || "").toLowerCase();
    const gameLabel = String(opponentTeam.game || "").toUpperCase();

    return (
        <Screen style={styles.screen}>
            <AppHeader title="Challenge Team" onBack={() => router.back()} inlineTitle />
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={styles.accentText.color as string} />
                </View>
            ) : (
                <ScrollView style={{ paddingHorizontal: 20 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Create Team Challenge</Text>
                        <Text style={styles.headerSubtitle}>Reuse matchroom flow with challenge approval.</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Selected Game / Sport</Text>
                        <View style={styles.gameGrid}>
                            <View style={[styles.gameCard, styles.gameCardActive]}>
                                <MaterialIcons
                                    name={(GAME_ICONS[gameKey] as any) || "sports-esports"}
                                    size={32}
                                    color={styles.accentText.color as string}
                                    style={styles.gameIcon}
                                />
                                <Text style={[styles.gameName, styles.gameNameActive]}>{gameLabel}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Match Setup</Text>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoBoxText}>
                                {challengerTeam?.name || "Your Team"} vs {opponentTeam.name} - {String(opponentTeam.game || "").toUpperCase()}
                            </Text>
                            <Text style={styles.infoBoxSmall}>Team B will review your date, time, series, zone and pricing context.</Text>
                            <Text style={styles.infoBoxSmall}>
                                Team A filled: {isTeamFilled(challengerTeam) ? "Yes" : "No"} | Team B filled: {isTeamFilled(opponentTeam) ? "Yes" : "No"}
                            </Text>
                        </View>
                        {!areBothTeamsFilled ? (
                            <Text style={styles.submitHintText}>Team challenge can only be sent when both teams are full.</Text>
                        ) : null}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Select Your Captain Team<Text style={styles.requiredAsterisk}>*</Text></Text>
                        <View style={styles.chipRow}>
                            {captainedTeams.map((team) => (
                                <Pressable
                                    key={team.id}
                                    style={[styles.optionChip, challengerTeamId === team.id && styles.optionChipActive]}
                                    onPress={() => setChallengerTeamId(team.id || "")}
                                >
                                    <Text style={[styles.optionChipText, challengerTeamId === team.id && styles.optionChipTextActive]}>
                                        {team.name}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        {captainedTeams.length === 0 ? (
                            <Text style={styles.submitHintText}>
                                You must captain another {String(opponentTeam.game || "").toUpperCase()} team to challenge.
                            </Text>
                        ) : null}
                    </View>

                    <BasicFields
                        formData={formData}
                        onChange={handleFieldChange}
                        selectedGame={gameKey}
                        minimumDate={(() => {
                            const d = new Date();
                            d.setHours(0, 0, 0, 0);
                            d.setDate(d.getDate() + 1);
                            return d;
                        })()}
                        dateHelperText="Challenge matches must be at least 24 hours from now."
                    />

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Series Type<Text style={styles.requiredAsterisk}>*</Text></Text>
                        <View style={styles.chipRow}>
                            {SERIES_OPTIONS.map((type) => (
                                <Pressable
                                    key={type}
                                    style={[styles.optionChip, seriesType === type && styles.optionChipActive]}
                                    onPress={() => setSeriesType(type)}
                                >
                                    <Text style={[styles.optionChipText, seriesType === type && styles.optionChipTextActive]}>
                                        {type === "BO1" ? "Best of 1" : type === "BO3" ? "Best of 3" : "Best of 5"}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        <Text style={styles.helperText}>
                            Est. booking hours: {getSeriesHours(gameKey, seriesType)}h
                        </Text>
                    </View>

                    <ZonePicker
                        gameKey={gameKey}
                        selectedZoneId={selectedZone?.id || null}
                        onZoneSelect={setSelectedZone}
                    />

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Price Per Player (PKR)</Text>
                        <View style={[styles.inputBox, styles.row, { alignItems: "center" }]}>
                            <TextInput
                                style={[styles.input, styles.flex1, styles.mutedText]}
                                value={pricePerPlayer > 0 ? String(pricePerPlayer) : ""}
                                placeholder="Calculated from zone rate & series"
                                placeholderTextColor="#757575"
                                editable={false}
                            />
                            <MaterialIcons name="lock" size={16} color="#6B7380" style={styles.marginLeft8} />
                        </View>
                        <Text style={styles.helperTextTiny}>
                            Computed using selected zone hourly rate, series duration, and expected players ({estimatedPlayers}).
                        </Text>
                        {pricePerPlayer <= 0 ? (
                            <Text style={styles.submitHintText}>Selected zone pricing is missing for this game/series.</Text>
                        ) : null}
                    </View>

                    <View style={styles.buttonWrapper}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.primaryButton,
                                submitting && styles.primaryButtonDisabled,
                                pressed && canSubmit && !submitting && styles.primaryButtonPressed,
                            ]}
                            onPress={handleCreateChallenge}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Send Challenge</Text>
                            )}
                        </Pressable>
                    </View>
                </ScrollView>
            )}
        </Screen>
    );
}

