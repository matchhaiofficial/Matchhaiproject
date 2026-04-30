import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { AppButton, StatusPill } from "../../src/components/AppPrimitives";
import { DetailSectionCard } from "../../src/components/DetailSurface";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/hooks/useToast";
import {
    acceptTeamMatchChallenge,
    getTeamMatchChallengeById,
    proposeTeamChallengeVenue,
    repairTeamMatchChallenge,
    rejectTeamMatchChallenge,
    subscribeTeamMatchChallenge,
    type TeamMatchChallenge,
} from "../../src/services/teamMatchService";
import type { Zone } from "../../src/services/convex/zoneService";
import { COLORS } from "../../src/theme";
import { getCanonicalGameLabel } from "../../src/utils/gameLabels";
import { getTeamMainRosterSize } from "../../src/constants/teamRosterRules";
import ZonePicker from "../matchrooms/create/components/ZonePicker";
import styles from "./challenge.styles";

const formatGameLabel = (value?: string | null) => {
    const key = String(value || "").trim().toLowerCase();
    if (!key) return "Match";
    return getCanonicalGameLabel(key);
};

const formatStatusLabel = (value?: string | null) =>
    String(value || "pending")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function TeamMatchChallengeDetails() {
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();
    const challengeId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [challenge, setChallenge] = useState<TeamMatchChallenge | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
    const [selectedLineup, setSelectedLineup] = useState<string[]>([]);

    const opponentTeamWithMembers = useQuery(
        api.teams.getWithMembers,
        challenge?.opponentTeamId && user?._id && challenge.captainBUid === user._id
            ? { teamId: challenge.opponentTeamId as Id<"teams"> }
            : "skip",
    );

    useEffect(() => {
        if (!challengeId) return;
        let mounted = true;
        repairTeamMatchChallenge(challengeId).finally(() => {
            getTeamMatchChallengeById(challengeId).then((result) => {
                if (!mounted) return;
                if (!result.ok || !result.data) {
                    showToast({ type: "error", title: "Not found", message: result.message || "Challenge not found." });
                    router.back();
                    return;
                }
                setChallenge(result.data);
                setLoading(false);
            });
        });

        const unsub = subscribeTeamMatchChallenge(challengeId, (data) => {
            if (!mounted) return;
            if (!data) {
                setChallenge(null);
                setLoading(false);
                return;
            }
            setChallenge(data);
            setLoading(false);
        });

        return () => {
            mounted = false;
            unsub();
        };
    }, [challengeId, router, showToast]);

    const isCaptain = useMemo(() => {
        if (!challenge || !user?._id) return false;
        return challenge.captainAUid === user._id || challenge.captainBUid === user._id;
    }, [challenge, user?._id]);
    const isCaptainA = useMemo(() => !!challenge && challenge.captainAUid === user?._id, [challenge, user?._id]);
    const isCaptainB = useMemo(() => !!challenge && challenge.captainBUid === user?._id, [challenge, user?._id]);

    const normalizedStatus = String(challenge?.status || "").trim().toLowerCase();
    const normalizedAdminReviewStatus = String(challenge?.adminReviewStatus || "").trim().toLowerCase();
    const isAdminPending = normalizedStatus === "admin_pending" || normalizedAdminReviewStatus === "pending";
    const isPending = normalizedStatus === "pending";
    const isRejected = normalizedStatus === "rejected";
    const isAcceptedFlow = !!challenge && ["accepted", "venue_proposed", "venue_confirmed", "admin_pending", "completed"].includes(normalizedStatus);

    const myChoice = useMemo(() => {
        if (!challenge || !user?._id) return null;
        return challenge.captainVenueChoices?.[user._id] || null;
    }, [challenge, user?._id]);

    const bothConfirmed = useMemo(() => !!challenge?.matchroomId && !!challenge?.confirmedVenue, [challenge]);
    const proposalFromA = challenge?.proposedVenueByCaptainA || null;
    const alternativeFromB = challenge?.alternativeVenueByCaptainB || null;
    const hasAlternative = !!alternativeFromB?.zoneId;
    const canAcceptNow = !!(isPending && !isAdminPending && isCaptain && ((hasAlternative && isCaptainA) || (!hasAlternative && isCaptainB)));
    const canRejectNow = !!(isPending && !isAdminPending && isCaptain);
    const canProposeVenue = !!(isAcceptedFlow && isCaptain && !challenge?.matchroomId);

    const opponentMembers = useMemo(() => {
        const members = Array.isArray(opponentTeamWithMembers?.members) ? opponentTeamWithMembers.members : [];
        return members.map((member: any, index: number) => ({
            uid: String(member.odxerId || member.uid || ""),
            username: member.username || "Player",
            rosterRole: member.rosterRole || (index < getTeamMainRosterSize(challenge?.gameKey) ? "main" : "substitute"),
        })).filter((member) => member.uid);
    }, [challenge?.gameKey, opponentTeamWithMembers?.members]);

    const activeLineupSize = useMemo(
        () => getTeamMainRosterSize(challenge?.gameKey),
        [challenge?.gameKey],
    );

    const defaultOpponentLineup = useMemo(() => {
        const main = opponentMembers
            .filter((member) => member.rosterRole === "main")
            .slice(0, activeLineupSize)
            .map((member) => member.uid);
        return main.length > 0 ? main : opponentMembers.slice(0, activeLineupSize).map((member) => member.uid);
    }, [activeLineupSize, opponentMembers]);

    const hasOpponentSubstitutes = opponentMembers.some((member) => member.rosterRole === "substitute");

    useEffect(() => {
        if (!canAcceptNow || !isCaptainB || selectedLineup.length > 0) return;
        setSelectedLineup(defaultOpponentLineup);
    }, [canAcceptNow, defaultOpponentLineup, isCaptainB, selectedLineup.length]);

    const toggleLineupPlayer = (uid: string) => {
        setSelectedLineup((prev) => {
            if (prev.includes(uid)) {
                return prev.filter((item) => item !== uid);
            }
            if (prev.length >= activeLineupSize) {
                showToast({
                    type: "warning",
                    title: "Lineup full",
                    message: `Select exactly ${activeLineupSize} players. Remove one player before adding another.`,
                });
                return prev;
            }
            return [...prev, uid];
        });
    };

    const handleProposeVenue = async () => {
        if (!challengeId || !selectedZone || !isCaptain) return;
        setSubmitting(true);
        const result = await proposeTeamChallengeVenue({
            challengeId,
            zoneId: selectedZone.id,
            venueName: selectedZone.venueBrandName,
            areaLabel: selectedZone.primaryBranch?.areaLabel || null,
        });
        setSubmitting(false);
        if (!result.ok) {
            showToast({ type: "error", title: "Proposal failed", message: result.message || "Failed to save venue choice." });
            return;
        }
        if ((result as any)?.matchroomId) {
            showToast({ type: "success", title: "Confirmed", message: "Both captains selected the same venue. Matchroom created." });
            router.push(`/matchrooms/${(result as any).matchroomId}` as any);
        } else {
            showToast({ type: "success", title: "Saved", message: "Venue proposal saved. Waiting for other captain." });
        }
    };

    const handleAcceptChallenge = async () => {
        if (!challengeId || !isPending) return;
        const lineupForAccept: string[] | undefined = isCaptainB
            ? (selectedLineup.length > 0 ? selectedLineup : defaultOpponentLineup)
            : undefined;
        if (isCaptainB && hasOpponentSubstitutes && (lineupForAccept?.length || 0) !== activeLineupSize) {
            showToast({
                type: "warning",
                title: "Lineup required",
                message: `Select exactly ${activeLineupSize} players before accepting.`,
            });
            return;
        }
        setSubmitting(true);
        const result = await acceptTeamMatchChallenge({ challengeId, lineupB: lineupForAccept });
        setSubmitting(false);
        if (!result.ok) {
            if ((result.message || "").toLowerCase().includes("resolved")) {
                const latest = await getTeamMatchChallengeById(challengeId);
                if (latest.ok && latest.data) setChallenge(latest.data);
            }
            showToast({ type: "error", title: "Accept failed", message: result.message || "Failed to accept challenge." });
            return;
        }
        if ((result as any).matchroomId) {
            showToast({ type: "success", title: "Accepted", message: "Challenge accepted and matchroom created." });
            router.push(`/matchrooms/${(result as any).matchroomId}` as any);
            return;
        }
        showToast({ type: "success", title: "Accepted", message: "Challenge accepted. Continue with venue confirmation." });
    };

    const handleRejectChallenge = async () => {
        if (!challengeId || !isPending) return;
        setSubmitting(true);
        const result = await rejectTeamMatchChallenge({ challengeId });
        setSubmitting(false);
        if (!result.ok) {
            if ((result.message || "").toLowerCase().includes("resolved")) {
                const latest = await getTeamMatchChallengeById(challengeId);
                if (latest.ok && latest.data) setChallenge(latest.data);
            }
            showToast({ type: "error", title: "Reject failed", message: result.message || "Failed to reject challenge." });
            return;
        }
        showToast({ type: "success", title: "Rejected", message: "Challenge has been rejected." });
    };

    const handleOpenChat = () => {
        if (!challenge) return;
        if (!challenge.chatId) {
            showToast({ type: "warning", title: "Chat locked", message: "Chat becomes active after challenge acceptance." });
            return;
        }
        router.push(`/teams/challenge-chat?id=${challenge.id}` as any);
    };

    if (loading) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <View style={styles.loaderWrap}>
                    <ActivityIndicator color={COLORS.accent} />
                </View>
            </Screen>
        );
    }

    if (!challenge) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <AppHeader title="Team Challenge" onBack={() => router.back()} inlineTitle />
                <View style={styles.loaderWrap}>
                    <Text style={styles.emptyText}>Challenge not found.</Text>
                </View>
            </Screen>
        );
    }

    const choices = challenge.captainVenueChoices || {};
    const captainAChoice = choices[challenge.captainAUid];
    const captainBChoice = choices[challenge.captainBUid];
    const showNoCommonHint = (challenge.commonAreas || []).length === 0;
    const statusLabel = formatStatusLabel(challenge.status);
    const gameLabel = formatGameLabel(challenge.gameKey);

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader
                title="Team Challenge"
                onBack={() => router.back()}
                inlineTitle
                rightAction={(
                    <Pressable
                        onPress={handleOpenChat}
                        style={({ pressed }) => [
                            styles.chatButton,
                            !challenge.chatId && styles.chatButtonDisabled,
                            pressed && styles.chatButtonPressed,
                        ]}
                    >
                        <AppIcon
                            name="chat-bubble-outline"
                            size={18}
                            color={challenge.chatId ? COLORS.accent : COLORS.muted}
                        />
                    </Pressable>
                )}
            />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <DetailSectionCard
                    title={`${challenge.challengerTeamName} vs ${challenge.opponentTeamName}`}
                    subtitle={`Game: ${gameLabel}`}
                    accessory={
                        <StatusPill
                            tone={
                                isRejected
                                    ? "danger"
                                    : isAdminPending
                                        ? "warning"
                                        : isAcceptedFlow
                                            ? "success"
                                            : "info"
                            }
                            label={statusLabel}
                        />
                    }
                >
                    <View style={styles.statusRow}>
                        {isAdminPending ? (
                            <View style={styles.pendingBadge}>
                                <Text style={styles.pendingBadgeText}>Admin Pending</Text>
                            </View>
                        ) : null}
                    </View>
                    <Text style={styles.meta}>Series: {String(challenge.seriesType || "BO1").toUpperCase()}</Text>
                    <Text style={styles.meta}>Date: {challenge.scheduledDate || "TBD"}</Text>
                    <Text style={styles.meta}>Time: {challenge.scheduledTime || "TBD"}</Text>
                    <Text style={styles.meta}>Price per player: {challenge.pricePerPlayer ? `PKR ${challenge.pricePerPlayer}` : "TBD"}</Text>
                    <Text style={styles.meta}>Team A proposed venue: {proposalFromA?.venueName || "Not selected"}</Text>
                    {proposalFromA?.areaLabel ? <Text style={styles.meta}>Area: {proposalFromA.areaLabel}</Text> : null}
                    {alternativeFromB?.venueName ? (
                        <Text style={styles.meta}>Team B alternative: {alternativeFromB.venueName}{alternativeFromB.areaLabel ? ` (${alternativeFromB.areaLabel})` : ""}</Text>
                    ) : null}
                </DetailSectionCard>

                {isAdminPending && (
                    <DetailSectionCard
                        title="Admin Review Pending"
                        accessory={<StatusPill tone="warning" label="Pending" />}
                    >
                        <Text style={styles.meta}>
                            Challenge has moved to admin review. Captain actions are locked until venue review is completed.
                        </Text>
                    </DetailSectionCard>
                )}

                {isPending && !isAdminPending && (
                    <DetailSectionCard
                        title="Pending Decision"
                        subtitle="Captain action required"
                    >
                        <Text style={styles.meta}>
                            {!isCaptain
                                ? "Waiting for the responding captain."
                                : canAcceptNow
                                    ? "Review this challenge and choose accept or reject."
                                    : hasAlternative
                                        ? "Waiting for Captain A to accept Team B's alternative venue."
                                        : "Waiting for challenged captain to accept, or reject if needed."}
                        </Text>
                        {canAcceptNow && isCaptainB && hasOpponentSubstitutes ? (
                            <View style={styles.lineupPanel}>
                                <Text style={styles.lineupTitle}>
                                    Active lineup ({selectedLineup.length}/{activeLineupSize})
                                </Text>
                                <Text style={styles.meta}>
                                    Main players are selected by default. Swap in a substitute if needed before accepting.
                                </Text>
                                <View style={styles.lineupGrid}>
                                    {opponentMembers.map((member) => {
                                        const selected = selectedLineup.includes(member.uid);
                                        const isSub = member.rosterRole === "substitute";
                                        return (
                                            <Pressable
                                                key={member.uid}
                                                onPress={() => toggleLineupPlayer(member.uid)}
                                                style={({ pressed }) => [
                                                    styles.lineupChip,
                                                    selected && styles.lineupChipSelected,
                                                    isSub && styles.lineupChipSub,
                                                    pressed && styles.chatButtonPressed,
                                                ]}
                                            >
                                                <Text style={[styles.lineupChipText, selected && styles.lineupChipTextSelected]}>
                                                    {member.username}
                                                </Text>
                                                {isSub ? <Text style={styles.lineupSubText}>SUB</Text> : null}
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        ) : null}
                        <AppButton
                            onPress={handleAcceptChallenge}
                            disabled={!canAcceptNow || submitting}
                            size="md"
                            style={styles.challengeActionButton}
                        >
                            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Accept Challenge</Text>}
                        </AppButton>
                        <AppButton
                            variant="danger"
                            onPress={handleRejectChallenge}
                            disabled={!canRejectNow || submitting}
                            size="md"
                            style={styles.challengeActionButton}
                        >
                            <Text style={styles.rejectButtonText}>Reject Challenge</Text>
                        </AppButton>
                    </DetailSectionCard>
                )}

                {isRejected && (
                    <DetailSectionCard title="Challenge Closed">
                        <View style={styles.rejectedBanner}>
                            <AppIcon name="cancel" size={18} color={COLORS.error} />
                            <Text style={styles.rejectedText}>Challenge has been rejected.</Text>
                        </View>
                    </DetailSectionCard>
                )}

                {isAcceptedFlow && (
                    <>
                        <DetailSectionCard title="Common Preferred Areas">
                            {showNoCommonHint ? (
                                <Text style={styles.meta}>No common preferred areas found. Captains can still pick any suitable venue.</Text>
                            ) : (
                                <View style={styles.chipsWrap}>
                                    {(challenge.commonAreas || []).map((area) => (
                                        <View key={area} style={styles.chip}>
                                            <Text style={styles.chipText}>{area}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </DetailSectionCard>

                        {canProposeVenue && (
                            <DetailSectionCard title="Choose Venue">
                                <ZonePicker
                                    gameKey={challenge.gameKey}
                                    selectedZoneId={selectedZone?.id || myChoice?.zoneId || null}
                                    onZoneSelect={setSelectedZone}
                                    userPreferredAreas={challenge.commonAreas || []}
                                />
                                <Text style={styles.meta}>Your choice: {myChoice?.venueName || "None"}</Text>
                                <Text style={styles.meta}>Captain A choice: {captainAChoice?.venueName || "None"}</Text>
                                <Text style={styles.meta}>Captain B choice: {captainBChoice?.venueName || "None"}</Text>
                                <AppButton
                                    onPress={handleProposeVenue}
                                    disabled={!selectedZone || submitting || bothConfirmed}
                                    size="md"
                                    style={styles.challengeActionButton}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>
                                            {bothConfirmed ? "Venue Confirmed" : "Propose / Confirm Venue"}
                                        </Text>
                                    )}
                                </AppButton>
                            </DetailSectionCard>
                        )}

                        {!isCaptain && (
                            <DetailSectionCard title="Captain Restriction">
                                <Text style={styles.meta}>Only captains can propose and confirm venue.</Text>
                            </DetailSectionCard>
                        )}
                    </>
                )}
            </ScrollView>
        </Screen>
    );
}
