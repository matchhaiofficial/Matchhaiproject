import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAction, useQuery } from "convex/react";

import AppHeader from "../../src/components/AppHeader";
import BottomActionBar from "../../src/components/BottomActionBar";
import { AppIcon } from "../../src/components/AppIcon";
import { AppButton } from "../../src/components/AppPrimitives";
import { AppDialog, AppModalBody, AppModalFooter, AppModalHeader } from "../../src/components/AppModalPrimitives";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/hooks/useToast";
import { getCaptainedTeams, payTeamChallengeWithWallet, sendTeamMatchChallenge } from "../../src/services/teamMatchService";
import { Team, getTeamById } from "../../src/services/convex/teamService";
import { deriveZoneRate, type Zone } from "../../src/services/convex/zoneService";
import { isUserFullyVerified, showKycVerificationRequiredAlert } from "../../src/utils/verificationGate";
import { getCanonicalGameLabel } from "../../src/utils/gameLabels";
import { getTeamMainRosterSize } from "../../src/constants/teamRosterRules";
import { parseScheduledDateTime } from "../../src/utils/matchroomTime";
import BasicFields from "../matchrooms/create/components/BasicFields";
import ZonePicker from "../matchrooms/create/components/ZonePicker";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../src/theme";
import styles from "../matchrooms/create/create.styles";
import { formatPakistaniPhone, isValidPakistaniPhone, normalizePakistaniPhone } from "../../src/utils/phoneUtils";

type SeriesType = "BO1" | "BO3" | "BO5" | "BO7" | "BO10" | "BO20" | "BO40";
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

const localStyles = StyleSheet.create({
    keyboardShell: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 140,
    },
    matchupCard: {
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
        gap: SPACING.sm,
    },
    matchupTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACING.sm,
    },
    gamePill: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.xs,
        borderRadius: RADII.pill,
        borderWidth: 1,
        borderColor: `${COLORS.accent}44`,
        backgroundColor: `${COLORS.accent}14`,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
    },
    gamePillText: {
        color: COLORS.accent,
        fontFamily: FONTS.interSemiBold,
        fontSize: TEXT_SIZES.caption,
    },
    matchupTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body + 1,
        lineHeight: 22,
    },
    teamFillRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: SPACING.sm,
    },
    teamFillPill: {
        borderRadius: RADII.pill,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.cardDark,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
    },
    teamFillText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
});

const isCsStyleGame = (gameKey: string) => {
    const game = String(gameKey || "").toLowerCase();
    return game === "cs2" || game === "cs16" || game === "valorant";
};

const getSeriesOptionsForGame = (gameKey: string): readonly SeriesType[] => {
    const game = String(gameKey || "").toLowerCase();
    if (isCsStyleGame(game)) return ["BO1", "BO3", "BO5"] as const;
    if (game === "tekken8") return ["BO7", "BO20", "BO40"] as const;
    if (game === "fc26" || game === "fc25" || game === "padel" || game === "pickleball") return ["BO3", "BO5", "BO10"] as const;
    return ["BO1", "BO3", "BO5"] as const;
};

const getDefaultSeriesForGame = (gameKey: string): SeriesType => {
    const game = String(gameKey || "").toLowerCase();
    if (isCsStyleGame(game)) return "BO1";
    if (game === "fc26" || game === "fc25" || game === "padel" || game === "pickleball") return "BO3";
    if (game === "tekken8") return "BO7";
    return "BO1";
};

const formatSeriesLabel = (series: SeriesType) => {
    if (series === "BO1") return "Best of 1";
    if (series === "BO3") return "Best of 3";
    if (series === "BO5") return "Best of 5";
    if (series === "BO10") return "Best of 10";
    if (series === "BO7") return "Best of 7";
    if (series === "BO20") return "Best of 20";
    return "Best of 40";
};

const getSeriesHours = (gameKey: string, seriesType: SeriesType) => {
    const game = String(gameKey || "").toLowerCase();
    const series = String(seriesType || "BO1").toUpperCase() as SeriesType;
    if (isCsStyleGame(game)) return series === "BO3" ? 3 : series === "BO5" ? 5 : 1;
    if (game === "fc26" || game === "fc25" || game === "padel" || game === "pickleball") return series === "BO3" ? 1 : series === "BO5" ? 2 : 3;
    if (game === "tekken8") return series === "BO7" ? 1 : series === "BO20" ? 2 : 3;
    return series === "BO3" ? 2 : series === "BO5" ? 3 : 1;
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

const formatCategoryLabel = (value: string) =>
    String(value || "")
        .split(/[_-]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

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
        if (isCsStyleGame(game)) {
            addOption("pc:regular", "Regular", toPositiveNumber(pricing?.pc?.regular?.price));
            addOption("pc:premium", "Premium", toPositiveNumber(pricing?.pc?.premium?.price));
            addOption("pc:elite", "Elite", toPositiveNumber(pricing?.pc?.elite?.price));
        }

        if (game === "fc26" || game === "fc25" || game === "tekken8") {
            const formatLabel = estimatedPlayers > 2 ? "2v2" : "1v1";
            addOption("console:regular", `Regular (${formatLabel})`, getPreferredConsolePrice(pricing?.console?.regular, estimatedPlayers));
            addOption("console:premium", `Premium (${formatLabel})`, getPreferredConsolePrice(pricing?.console?.premium, estimatedPlayers));
            addOption("console:elite", `Elite (${formatLabel})`, getPreferredConsolePrice(pricing?.console?.elite, estimatedPlayers));
            addOption("console:ps5", `PS5 (${formatLabel})`, getPreferredConsolePrice(pricing?.console?.ps5, estimatedPlayers));
            addOption("console:xbox", `Xbox (${formatLabel})`, getPreferredConsolePrice(pricing?.console?.xbox, estimatedPlayers));
        }

        if (game === "futsal") {
            const futsal = pricing?.futsal || {};
            Object.entries(futsal || {}).forEach(([key, val]: any) => {
                addOption(`futsal:${key}`, formatCategoryLabel(String(key)), toPositiveNumber(val?.price));
            });
        }

        if (game === "indoor_cricket") {
            const cricket = pricing?.indoorCricket || pricing?.indoor_cricket || {};
            Object.entries(cricket || {}).forEach(([key, val]: any) => {
                addOption(`cricket:${key}`, formatCategoryLabel(String(key)), toPositiveNumber(val?.price));
            });
        }

        if (game === "padel") {
            const padel = pricing?.padel || {};
            Object.entries(padel || {}).forEach(([key, val]: any) => {
                addOption(`padel:${key}`, formatCategoryLabel(String(key)), toPositiveNumber(val?.price));
            });
        }

        if (game === "pickleball") {
            const pickleball = pricing?.pickleball || {};
            Object.entries(pickleball || {}).forEach(([key, val]: any) => {
                addOption(`pickleball:${key}`, formatCategoryLabel(String(key)), toPositiveNumber(val?.price));
            });
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
    const startCheckout = useAction((api as any).easypaisa.startCheckout);
    const syncCheckoutStatus = useAction((api as any).easypaisa.syncTransactionStatus);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [opponentTeam, setOpponentTeam] = useState<Team | null>(null);
    const [captainedTeams, setCaptainedTeams] = useState<Team[]>([]);
    const [challengerTeamId, setChallengerTeamId] = useState<string>("");
    const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
    const [selectedZoneRateKey, setSelectedZoneRateKey] = useState<string | null>(null);
    const [seriesType, setSeriesType] = useState<SeriesType>("BO1");
    const [pricePerPlayer, setPricePerPlayer] = useState(0);

    const [easypaisaModalVisible, setEasypaisaModalVisible] = useState(false);
    const [easypaisaCheckoutPhone, setEasypaisaCheckoutPhone] = useState("");
    const [startingEasypaisa, setStartingEasypaisa] = useState(false);
    const [activeEasypaisaOrderRef, setActiveEasypaisaOrderRef] = useState<string | null>(null);
    const [pendingCreateAfterPayment, setPendingCreateAfterPayment] = useState<{
        captainPaymentAmount: number;
        walletReference: string;
        challengeArgs: Parameters<typeof sendTeamMatchChallenge>[0];
        challengerTeamName: string;
        opponentTeamName: string;
    } | null>(null);
    const resumedOrderRef = React.useRef<string | null>(null);

    const checkoutStatus = useQuery(
        api.easypaisa.getCheckoutStatus,
        user?._id && activeEasypaisaOrderRef
            ? { userId: user._id as Id<"users">, orderRefNum: activeEasypaisaOrderRef }
            : "skip",
    );
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
            setSeriesType(getDefaultSeriesForGame(String(opponent.game || "")));
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
    const seriesOptions = useMemo(() => getSeriesOptionsForGame(challengeGameKey), [challengeGameKey]);

    const estimatedPlayers = useMemo(
        () => getEstimatedPlayers(challengeGameKey, challengerTeam, opponentTeam),
        [challengeGameKey, challengerTeam, opponentTeam],
    );
    const challengerActivePlayers = useMemo(
        () => Math.max(1, Number(challengerTeam?.mainRosterSize || getTeamMainRosterSize(challengerTeam?.game || challengeGameKey))),
        [challengeGameKey, challengerTeam],
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
        setPricePerPlayer(Math.ceil(baseRate * hours));
    }, [challengeGameKey, selectedZone, selectedZoneRate, seriesType, estimatedPlayers]);

    const captainPaymentAmount = useMemo(
        () => Math.max(0, Math.ceil(pricePerPlayer * challengerActivePlayers)),
        [challengerActivePlayers, pricePerPlayer],
    );

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

        if (!isUserFullyVerified(authUser, user)) {
            showKycVerificationRequiredAlert();
            return;
        }

        setSubmitting(true);
        const walletReference = `team_challenge:create:${challengerTeam.id}:${Date.now()}`;
        const challengeArgs: Parameters<typeof sendTeamMatchChallenge>[0] = {
            challengerTeamId: challengerTeam.id!,
            opponentTeamId: opponentTeam.id!,
            scheduledDate: formData.date,
            scheduledTime: formData.time,
            pricePerPlayer,
            seriesType,
            message: formData.description.trim(),
            zoneRateKey: selectedZoneRate?.key || null,
            zoneRateLabel: selectedZoneRate?.label || null,
            zoneRatePrice: selectedZoneRate?.price || null,
            teamAPaymentAmount: captainPaymentAmount,
            proposedVenueByCaptainA: {
                zoneId: selectedZone.id,
                venueName: selectedZone.venueBrandName,
                areaLabel: selectedZone.primaryBranch?.areaLabel || null,
            },
            maxPlayers: estimatedPlayers,
        };
        const paymentChoice = await new Promise<"wallet" | "pay_now" | "cancel">((resolve) => {
            Alert.alert(
                "Team payment required",
                `Pay PKR ${captainPaymentAmount} for ${challengerTeam.name} (${challengerActivePlayers} players) before sending this challenge.`,
                [
                    { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
                    { text: "Pay Now", onPress: () => resolve("pay_now") },
                    { text: "Pay with Wallet", onPress: () => resolve("wallet") },
                ],
            );
        });
        if (paymentChoice === "cancel") {
            setSubmitting(false);
            return;
        }
        if (paymentChoice === "pay_now") {
            setSubmitting(false);
            setPendingCreateAfterPayment({
                captainPaymentAmount,
                walletReference,
                challengeArgs,
                challengerTeamName: challengerTeam.name,
                opponentTeamName: opponentTeam.name,
            });
            setEasypaisaCheckoutPhone(formatPakistaniPhone(String(user?.phone || "")));
            setEasypaisaModalVisible(true);
            return;
        }
        const walletPayment = await payTeamChallengeWithWallet({
            amount: captainPaymentAmount,
            side: "teamA",
            reference: walletReference,
        });
        if (!walletPayment.ok) {
            setSubmitting(false);
            showToast({ type: "error", title: "Payment failed", message: walletPayment.message || "Unable to pay from wallet." });
            return;
        }
        const result = await sendTeamMatchChallenge(challengeArgs);
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

    const handleStartEasypaisaTopup = async () => {
        if (!user?._id || !pendingCreateAfterPayment) return;
        const amount = Math.max(0, Math.ceil(Number(pendingCreateAfterPayment.captainPaymentAmount || 0)));
        if (amount <= 0) return;
        if (!isValidPakistaniPhone(easypaisaCheckoutPhone)) {
            showToast({ type: "warning", title: "Invalid number", message: "Enter a valid Pakistani mobile number for Easypaisa." });
            return;
        }

        setStartingEasypaisa(true);
        try {
            const normalized = normalizePakistaniPhone(easypaisaCheckoutPhone);
            let checkout: any;
            try {
                checkout = await startCheckout({
                    kind: "wallet_topup",
                    amount,
                    userId: user._id as Id<"users">,
                    phone: normalized.phoneE164 || easypaisaCheckoutPhone,
                    transactionType: "MA",
                });
            } catch (error: any) {
                const message = String(error?.message || error || "");
                if (!/ACCOUNT DOES N[O']?T? EXIST/i.test(message) && !/ACCOUNT DOES NO EXIST/i.test(message)) {
                    throw error;
                }
                checkout = await startCheckout({
                    kind: "wallet_topup",
                    amount,
                    userId: user._id as Id<"users">,
                    phone: normalized.phoneE164 || easypaisaCheckoutPhone,
                    transactionType: "OTC",
                });
            }

            const orderRefNum = String(checkout.orderRefNum || "");
            setActiveEasypaisaOrderRef(orderRefNum || null);
            showToast({
                type: "info",
                title: "Payment started",
                message: checkout.transactionType === "OTC"
                    ? `Use token ${checkout.paymentToken || "generated by Easypaisa"} before it expires.`
                    : "Approve the payment in Easypaisa. MatchHai will keep checking the status.",
            });
        } catch (error: any) {
            showToast({ type: "error", title: "Payment failed", message: error?.message || "Could not start the Easypaisa payment." });
        } finally {
            setStartingEasypaisa(false);
        }
    };

    useEffect(() => {
        if (!activeEasypaisaOrderRef || !checkoutStatus || !pendingCreateAfterPayment) return;
        const status = String((checkoutStatus as any)?.status || "");
        if (status !== "paid") return;
        if (resumedOrderRef.current === activeEasypaisaOrderRef) return;
        resumedOrderRef.current = activeEasypaisaOrderRef;

        void (async () => {
            const walletPayment = await payTeamChallengeWithWallet({
                amount: pendingCreateAfterPayment.captainPaymentAmount,
                side: "teamA",
                reference: pendingCreateAfterPayment.walletReference,
            });
            if (!walletPayment.ok) {
                showToast({ type: "error", title: "Payment failed", message: walletPayment.message || "Unable to pay from wallet." });
                return;
            }
            const result = await sendTeamMatchChallenge(pendingCreateAfterPayment.challengeArgs);
            if (!result.ok) {
                showToast({ type: "error", title: "Challenge failed", message: result.message || "Unable to send challenge." });
                return;
            }

            setEasypaisaModalVisible(false);
            setPendingCreateAfterPayment(null);
            setActiveEasypaisaOrderRef(null);

            Alert.alert("Challenge sent", `${pendingCreateAfterPayment.challengerTeamName} challenged ${pendingCreateAfterPayment.opponentTeamName}.`, [
                { text: "Open Challenge", onPress: () => router.replace(`/teams/challenge?id=${(result as any).challengeId}` as any) },
                { text: "OK" },
            ]);
        })();
    }, [activeEasypaisaOrderRef, checkoutStatus, pendingCreateAfterPayment, router, showToast]);

    useEffect(() => {
        if (!activeEasypaisaOrderRef || !user?._id) return;
        const timer = setInterval(() => {
            syncCheckoutStatus({ orderRefNum: activeEasypaisaOrderRef, userId: user._id as Id<"users"> } as any).catch(() => { });
        }, 2000);
        return () => clearInterval(timer);
    }, [activeEasypaisaOrderRef, syncCheckoutStatus, user?._id]);

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
    const submitDisabled = !canSubmit || !areBothTeamsFilled || !isUserFullyVerified(authUser, user);

    return (
        <Screen style={styles.screen} scroll={false}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "padding"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
                style={localStyles.keyboardShell}
            >
            <AppHeader title="Challenge Team" onBack={() => router.back()} inlineTitle />
            <AppDialog
                visible={easypaisaModalVisible}
                onClose={() => !startingEasypaisa && setEasypaisaModalVisible(false)}
                dismissDisabled={startingEasypaisa}
            >
                <AppModalHeader
                    title="Confirm Easypaisa Number"
                    subtitle={`Pay PKR ${Math.max(0, Math.ceil(Number(pendingCreateAfterPayment?.captainPaymentAmount || 0)))} then MatchHai will send the challenge automatically.`}
                    onClose={() => !startingEasypaisa && setEasypaisaModalVisible(false)}
                    closeDisabled={startingEasypaisa}
                />
                <AppModalBody scroll>
                    <Text style={{ color: COLORS.textSecondary, marginBottom: 10 }}>
                        Mobile Account Number
                    </Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: COLORS.inputBackground,
                                borderRadius: RADII.md,
                                paddingHorizontal: SPACING.md,
                                paddingVertical: SPACING.sm,
                            },
                        ]}
                        keyboardType="phone-pad"
                        value={easypaisaCheckoutPhone}
                        onChangeText={(value) => setEasypaisaCheckoutPhone(formatPakistaniPhone(value))}
                        placeholder="03XX XXX XXXX"
                        placeholderTextColor={COLORS.textSecondary}
                        editable={!startingEasypaisa}
                    />
                    {activeEasypaisaOrderRef ? (
                        <Text style={{ color: COLORS.warning, marginTop: 12 }}>
                            Waiting for payment confirmation...
                        </Text>
                    ) : null}
                </AppModalBody>
                <AppModalFooter>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <AppButton
                            variant="secondary"
                            style={{ flex: 1 }}
                            onPress={() => setEasypaisaModalVisible(false)}
                            disabled={startingEasypaisa}
                        >
                            Cancel
                        </AppButton>
                        <AppButton
                            style={{ flex: 1 }}
                            onPress={handleStartEasypaisaTopup}
                            loading={startingEasypaisa}
                            disabled={startingEasypaisa || Boolean(activeEasypaisaOrderRef)}
                        >
                            Continue to Pay
                        </AppButton>
                    </View>
                </AppModalFooter>
            </AppDialog>
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={styles.accentText.color as string} />
                </View>
            ) : (
                <>
                <ScrollView
                    style={localStyles.scroll}
                    contentContainerStyle={[styles.createScrollContent, localStyles.scrollContent]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={localStyles.matchupCard}>
                        <View style={localStyles.matchupTopRow}>
                            <View style={localStyles.gamePill}>
                                <AppIcon
                                    name={(GAME_ICONS[gameKey] as any) || "sports-esports"}
                                    size={16}
                                    color={styles.accentText.color as string}
                                />
                                <Text style={localStyles.gamePillText}>{gameLabel}</Text>
                            </View>
                        </View>
                        <Text style={localStyles.matchupTitle} numberOfLines={2}>
                            {challengerTeam?.name || "Select your team"} vs {opponentTeam.name}
                        </Text>
                        <View style={localStyles.teamFillRow}>
                            <View style={localStyles.teamFillPill}>
                                <Text style={localStyles.teamFillText}>Your team: {getTeamCountLabel(challengerTeam)}</Text>
                            </View>
                            <View style={localStyles.teamFillPill}>
                                <Text style={localStyles.teamFillText}>Opponent: {getTeamCountLabel(opponentTeam)}</Text>
                            </View>
                        </View>
                        {!areBothTeamsFilled ? (
                            <Text style={styles.submitHintText}>Both teams must be full before a challenge can be sent.</Text>
                        ) : null}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Captain Team<Text style={styles.requiredAsterisk}>*</Text></Text>
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
                            {seriesOptions.map((type) => (
                                <Pressable
                                    key={type}
                                    style={[styles.optionChip, seriesType === type && styles.optionChipActive]}
                                    onPress={() => setSeriesType(type)}
                                >
                                    <Text style={[styles.optionChipText, seriesType === type && styles.optionChipTextActive]}>
                                        {formatSeriesLabel(type)}
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
                                            {option.label} | PKR {option.price}/hr
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
                                placeholder="Calculated from zone rate and series"
                                placeholderTextColor="#757575"
                                editable={false}
                            />
                            <AppIcon name="lock" size={16} color="#6B7380" style={styles.marginLeft8} />
                        </View>
                        <Text style={styles.helperTextTiny}>
                            Based on selected zone rate and series duration. Captain pays PKR {captainPaymentAmount} for {challengerActivePlayers} players.
                        </Text>
                        {selectedZoneRate ? (
                            <Text style={styles.helperTextTiny}>
                                Resource type: {selectedZoneRate.label} at PKR {selectedZoneRate.price}/hr.
                            </Text>
                        ) : null}
                        {pricePerPlayer <= 0 ? (
                            <Text style={styles.submitHintText}>Selected zone pricing is missing for this game/series.</Text>
                        ) : null}
                    </View>

                </ScrollView>

                <BottomActionBar>
                    <Pressable
                        style={({ pressed }) => [
                            styles.primaryButton,
                            submitDisabled && styles.primaryButtonDisabled,
                            pressed && !submitDisabled && styles.primaryButtonPressed,
                        ]}
                        onPress={() => {
                            if (!isUserFullyVerified(authUser, user)) {
                                showKycVerificationRequiredAlert();
                                return;
                            }
                            handleCreateChallenge();
                        }}
                        disabled={submitting}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Send Challenge</Text>
                        )}
                    </Pressable>
                </BottomActionBar>
                </>
            )}
            </KeyboardAvoidingView>
        </Screen>
    );
}
