import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/hooks/useToast";
import { getCaptainedTeams, sendTeamMatchChallenge } from "../../src/services/teamMatchService";
import { Team, getTeamById } from "../../src/services/convex/teamService";
import { deriveZoneRate, type Zone } from "../../src/services/convex/zoneService";
import { hasVerifiedEmail, showEmailVerificationRequiredAlert } from "../../src/utils/emailVerificationGate";
import { getCanonicalGameLabel } from "../../src/utils/gameLabels";
import { getTeamMainRosterSize } from "../../src/constants/teamRosterRules";
import { parseScheduledDateTime } from "../../src/utils/matchroomTime";
import BasicFields from "../matchrooms/create/components/BasicFields";
import ZonePicker from "../matchrooms/create/components/ZonePicker";
import styles from "../matchrooms/create/create.styles";

const SERIES_OPTIONS = ["BO1", "BO3", "BO5"] as const;
const GAME_ICONS: Record<string, string> = {
    cs2: "sports-esports",
    cs16: "sports-esports",
    valorant: "sports-esports",
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
    if (game === "cs2" || game === "cs16" || game === "valorant") return seriesType === "BO3" ? 3 : seriesType === "BO5" ? 5 : 1;
    if (game === "fc26" || game === "fc25") return seriesType === "BO3" ? 1 : seriesType === "BO5" ? 2 : 0.5;
    if (game === "tekken8") return seriesType === "BO3" ? 2 : seriesType === "BO5" ? 3 : 1;
    if (game === "padel" || game === "pickleball") return seriesType === "BO3" ? 1 : seriesType === "BO5" ? 2 : 1;
    return seriesType === "BO3" ? 2 : seriesType === "BO5" ? 3 : 1;
};

const getEstimatedPlayers = (gameKey: string, challenger?: Team | null, opponent?: Team | null) => {
    const game = String(gameKey || "").toLowerCase();
    if (game === "cs2" || game === "cs16" || game === "valorant") return 10;
    if (game === "fc26" || game === "fc25" || game === "tekken8") {
        const teamSize = Math.max(
            Number(challenger?.mainRosterSize || getTeamMainRosterSize(game)),
            Number(opponent?.mainRosterSize || getTeamMainRosterSize(game)),
            1,
        );
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

type ZoneRateOption = {
    key: string;
    label: string;
    price: number;
};

const toPositiveNumber = (value: any) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getZonePricingSources = (zone: Zone | null) => {
    if (!zone) return [];
    const sources = [
        ...(Array.isArray(zone.branches) ? zone.branches.map((branch: any) => branch?.pricing) : []),
        zone.pricing,
    ];
    return sources.filter(Boolean);
};

const getPreferredConsolePrice = (tier: any, estimatedPlayers: number) => {
    const preferred = estimatedPlayers > 2 ? tier?.price2v2 : tier?.price1v1;
    return toPositiveNumber(preferred) || toPositiveNumber(tier?.price1v1) || toPositiveNumber(tier?.price2v2) || toPositiveNumber(tier?.price);
};

const buildZoneRateOptions = (zone: Zone | null, gameKey: string, estimatedPlayers: number): ZoneRateOption[] => {
    const game = String(gameKey || "").toLowerCase();
    const pricingSources = getZonePricingSources(zone);
    const options = new Map<string, ZoneRateOption>();

    const addOption = (key: string, label: string, price: number) => {
        if (price > 0 && !options.has(key)) {
            options.set(key, { key, label, price });
        }
    };

    for (const pricing of pricingSources) {
        if (game === "cs2" || game === "cs16" || game === "valorant") {
            addOption("pc-regular", "Regular", toPositiveNumber(pricing?.pc?.regular?.price));
            addOption("pc-premium", "Premium", toPositiveNumber(pricing?.pc?.premium?.price));
            addOption("pc-elite", "Elite", toPositiveNumber(pricing?.pc?.elite?.price));
        }

        if (game === "fc26" || game === "fc25" || game === "tekken8") {
            const formatLabel = estimatedPlayers > 2 ? "2v2" : "1v1";
            addOption("console-regular", `Regular (${formatLabel})`, getPreferredConsolePrice(pricing?.console?.regular, estimatedPlayers));
            addOption("console-premium", `Premium (${formatLabel})`, getPreferredConsolePrice(pricing?.console?.premium, estimatedPlayers));
            addOption("console-elite", `Elite (${formatLabel})`, getPreferredConsolePrice(pricing?.console?.elite, estimatedPlayers));
            addOption("console-ps5", `PS5 (${formatLabel})`, getPreferredConsolePrice(pricing?.console?.ps5, estimatedPlayers));
            addOption("console-xbox", `Xbox (${formatLabel})`, getPreferredConsolePrice(pricing?.console?.xbox, estimatedPlayers));
        }
    }

    return Array.from(options.values());
};

const getBaseZoneRate = (zone: Zone | null, gameKey: string, estimatedPlayers = 2) => {
    if (!zone) return 0;
    if (typeof zone.effectiveRate === "number" && zone.effectiveRate > 0) {
        return zone.effectiveRate;
    }
    const game = String(gameKey || "").toLowerCase();

    if (game === "cs2" || game === "cs16" || game === "valorant") {
        const rates = buildZoneRateOptions(zone, game, estimatedPlayers).map((option) => option.price);
        return rates.length > 0 ? Math.min(...rates) : 0;
    }

    if (game === "fc26" || game === "fc25" || game === "tekken8") {
        const rates = buildZoneRateOptions(zone, game, estimatedPlayers).map((option) => option.price);
        return rates.length > 0 ? Math.min(...rates) : 0;
    }

    const derived = deriveZoneRate(zone, gameKey);
    return typeof derived.rate === "number" && derived.rate > 0 ? derived.rate : 0;
};

export default function TeamChallengeCreateScreen() {
    const params = useLocalSearchParams<{ opponentTeamId?: string | string[] }>();
    const opponentTeamId = Array.isArray(params.opponentTeamId) ? params.opponentTeamId[0] : params.opponentTeamId;
    const router = useRouter();
    const { user, authUser } = useAuth();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [opponentTeam, setOpponentTeam] = useState<Team | null>(null);
    const [captainedTeams, setCaptainedTeams] = useState<Team[]>([]);
    const [challengerTeamId, setChallengerTeamId] = useState<string>("");
    const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
    const [selectedZoneRateKey, setSelectedZoneRateKey] = useState<string | null>(null);
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
            if (!opponentTeamId || !user?._id) {
                setLoading(false);
                return;
            }

            const [opponentResult, captained] = await Promise.all([
                getTeamById(opponentTeamId),
                getCaptainedTeams(user._id),
            ]);

            if (!opponentResult.ok || !opponentResult.data) {
                showToast({ type: "error", title: "Not found", message: "Opponent team not found." });
                router.back();
                return;
            }

            const opponent = opponentResult.data;
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
    }, [opponentTeamId, router, showToast, user?._id]);

    const challengerTeam = useMemo(
        () => captainedTeams.find((item) => item.id === challengerTeamId) || null,
        [captainedTeams, challengerTeamId],
    );

    const isTeamFilled = (team: Team | null) => {
        if (!team) return false;
    const maxMembers = Number(team.mainRosterSize || getTeamMainRosterSize(team.game));
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
        const maxMembers = Number(team.mainRosterSize || getTeamMainRosterSize(team.game));
        const memberCount = Math.max(
            Number(team.memberCount || 0),
            Array.isArray(team.memberUids) ? team.memberUids.length : 0,
            Array.isArray(team.members) ? team.members.length : 0,
        );
        const safeMax = Number.isFinite(maxMembers) && maxMembers > 0 ? maxMembers : 0;
        return `${memberCount}/${safeMax}`;
    };

    const areBothTeamsFilled = isTeamFilled(challengerTeam) && isTeamFilled(opponentTeam);
    const challengeGameKey = String(opponentTeam?.game || "").toLowerCase();

    const estimatedPlayers = useMemo(
        () => getEstimatedPlayers(challengeGameKey, challengerTeam, opponentTeam),
        [challengeGameKey, challengerTeam, opponentTeam],
    );

    const zoneRateOptions = useMemo(
        () => buildZoneRateOptions(selectedZone, challengeGameKey, estimatedPlayers),
        [selectedZone, challengeGameKey, estimatedPlayers],
    );

    const selectedZoneRate = useMemo(
        () => zoneRateOptions.find((option) => option.key === selectedZoneRateKey) || zoneRateOptions[0] || null,
        [zoneRateOptions, selectedZoneRateKey],
    );

    useEffect(() => {
        if (zoneRateOptions.length === 0) {
            setSelectedZoneRateKey(null);
            return;
        }
        if (!selectedZoneRateKey || !zoneRateOptions.some((option) => option.key === selectedZoneRateKey)) {
            setSelectedZoneRateKey(zoneRateOptions[0].key);
        }
    }, [selectedZoneRateKey, zoneRateOptions]);

    useEffect(() => {
        setSelectedZoneRateKey(null);
    }, [selectedZone?.id, challengeGameKey, estimatedPlayers]);

    useEffect(() => {
        const baseRate = selectedZoneRate?.price || getBaseZoneRate(selectedZone, challengeGameKey, estimatedPlayers);
        if (!baseRate) {
            setPricePerPlayer(0);
            return;
        }
        const hours = getSeriesHours(challengeGameKey, seriesType);
        const totalCost = baseRate * hours;
        const perPlayer = estimatedPlayers > 0 ? Math.ceil(totalCost / estimatedPlayers) : 0;
        setPricePerPlayer(perPlayer);
    }, [challengeGameKey, selectedZone, selectedZoneRate, seriesType, estimatedPlayers]);

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
        if (!challengerTeam || !opponentTeam || !selectedZone || !formData.date || !formData.time) {
            showToast({ type: "warning", title: "Missing details", message: "Select captain team, date/time, and preferred zone before sending challenge." });
            return;
        }
        if (!areBothTeamsFilled) {
            showToast({
                type: "warning",
                title: "Teams not filled",
                message: `${challengerTeam.name}: ${getTeamCountLabel(challengerTeam)} | ${opponentTeam.name}: ${getTeamCountLabel(opponentTeam)}. Both teams must be full to send a challenge.`,
            });
            return;
        }
        if (pricePerPlayer <= 0) {
            showToast({ type: "warning", title: "Missing pricing", message: "Selected zone pricing is missing for this game/series." });
            return;
        }

        const scheduledAt = parseScheduledDateTime(formData.date, formData.time);
        if (!scheduledAt) {
            showToast({ type: "warning", title: "Invalid date/time", message: "Select valid date and time." });
            return;
        }
        if (scheduledAt.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
            showToast({ type: "warning", title: "Invalid schedule", message: "Challenge match must be at least 24 hours from now." });
            return;
        }

        if (!hasVerifiedEmail(authUser)) {
            showEmailVerificationRequiredAlert();
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
            showToast({ type: "error", title: "Challenge failed", message: result.message || "Unable to send challenge." });
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

    const gameKey = challengeGameKey;
    const gameLabel = getCanonicalGameLabel(opponentTeam.game);

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
                                <AppIcon
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
                                {challengerTeam?.name || "Your Team"} vs {opponentTeam.name} - {gameLabel}
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
                                You must captain another {gameLabel} team to challenge.
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

                    {selectedZone && zoneRateOptions.length > 0 ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>Category<Text style={styles.requiredAsterisk}>*</Text></Text>
                            <View style={styles.chipRow}>
                                {zoneRateOptions.map((option) => (
                                    <Pressable
                                        key={option.key}
                                        style={[styles.optionChip, selectedZoneRate?.key === option.key && styles.optionChipActive]}
                                        onPress={() => setSelectedZoneRateKey(option.key)}
                                    >
                                        <Text style={[styles.optionChipText, selectedZoneRate?.key === option.key && styles.optionChipTextActive]}>
                                            {option.label} · PKR {option.price}/hr
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    ) : null}

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
                            <AppIcon name="lock" size={16} color="#6B7380" style={styles.marginLeft8} />
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
                                (submitting || !hasVerifiedEmail(authUser)) &&
                                    styles.primaryButtonDisabled,
                                pressed &&
                                    canSubmit &&
                                    !submitting &&
                                    hasVerifiedEmail(authUser) &&
                                    styles.primaryButtonPressed,
                            ]}
                            onPress={() => {
                                if (!hasVerifiedEmail(authUser)) {
                                    showEmailVerificationRequiredAlert();
                                    return;
                                }
                                handleCreateChallenge();
                            }}
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
