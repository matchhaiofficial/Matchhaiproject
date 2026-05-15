import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { AppImage } from "../../src/components/AppImage";
import BottomActionBar from "../../src/components/BottomActionBar";
import { AppBottomSheet, AppDialog, AppModalBody, AppModalFooter, AppModalHeader } from "../../src/components/AppModalPrimitives";
import { AppButton, AppCard, StatusPill } from "../../src/components/AppPrimitives";
import { DetailSectionCard } from "../../src/components/DetailSurface";
import ReportIssueModal from "../../src/components/ReportIssueModal";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { logFlowEvent, useRouteLogger } from "../../src/hooks/useRouteLogger";
import { useToast } from "../../src/hooks/useToast";
import { useEntrance } from "../../src/motion/useEntrance";
import { usePressScale } from "../../src/motion/usePressScale";
import {
    leaveTeamAction,
    removeMemberAction,
    requestToJoinTeamAction,
    respondToJoinRequestAction,
    transferCaptainAction,
} from "../../src/services/convex/teamActionService";
import { Team, deleteTeam, getUserTeams, updateTeamName, uploadTeamLogo } from "../../src/services/convex/teamService";
import { submitUserReport } from "../../src/services/convex/reportService";
import { getUserProfile } from "../../src/services/userService";
import { COLORS, SPACING } from "../../src/theme";
import { isUserFullyVerified, showKycVerificationRequiredAlert } from "../../src/utils/verificationGate";
import { getCanonicalGameLabel } from "../../src/utils/gameLabels";
import { getTeamMainRosterSize, getTeamMaxSubstitutes } from "../../src/constants/teamRosterRules";
import Logger from "../../src/utils/logger";
import { buildLegacyTeamsHref } from "../../src/navigation/routes";
import { getTeamMainDisplayCount } from "../../src/utils/teamRosterDisplay";
import styles from "./[id].styles";
import InviteFriendsSheet from "./components/InviteFriendsSheet";
import RosterSlots from "./components/RosterSlots";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Game max members mapping
const GAME_MAX_MEMBERS: Record<string, number> = {
    cs2: 5,
    cs16: 5,
    valorant: 5,
    fc25: 2,
    fc26: 2,
    tekken8: 2,
    padel: 2,
    pickleball: 2,
    futsal: 7,
    indoor_cricket: 8,
};

const REPORT_REASONS = [
    "Toxic Behavior",
    "Cheating/Hacking",
    "Impersonation",
    "Inappropriate Name",
    "Spam/Harassment",
    "Other",
];

function HeaderIconButton({
    icon,
    color,
    onPress,
    onPressIn,
    hitSlop,
}: {
    icon: React.ComponentProps<typeof AppIcon>["name"];
    color: string;
    onPress: () => void;
    onPressIn?: () => void;
    hitSlop?: { top: number; bottom: number; left: number; right: number };
}) {
    const { animatedStyle, onPressIn: motionPressIn, onPressOut } = usePressScale({
        activeScale: 0.98,
    });

    return (
        <AnimatedPressable
            onPress={onPress}
            onPressIn={() => {
                motionPressIn();
                onPressIn?.();
            }}
            onPressOut={onPressOut}
            style={[styles.headerIcon, animatedStyle]}
            hitSlop={hitSlop}
        >
            <AppIcon name={icon} size={24} color={color} />
        </AnimatedPressable>
    );
}

function ReportIconButton({ onPress }: { onPress: () => void }) {
    const { animatedStyle, onPressIn, onPressOut } = usePressScale({ activeScale: 0.99 });

    return (
        <AnimatedPressable
            onPress={onPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.reportIconButton, animatedStyle]}
        >
            <AppIcon name="report-problem" size={20} color={COLORS.error} />
        </AnimatedPressable>
    );
}

export default function TeamDetails() {
    const params = useLocalSearchParams();
    const { id } = params;
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, authUser } = useAuth();
    const { showToast } = useToast();
    const [submitting, setSubmitting] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const deletingTeamRef = useRef(false);

    // Rename States
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [newName, setNewName] = useState("");
    const [memberActionTarget, setMemberActionTarget] = useState<{ uid: string; username: string } | null>(null);
    const [confirmationDialog, setConfirmationDialog] = useState<{
        title: string;
        message: string;
        confirmLabel: string;
        confirmTone?: "primary" | "secondary" | "ghost" | "danger" | "success";
        onConfirm: () => Promise<void> | void;
    } | null>(null);

    // Invite States
    const [showInviteSheet, setShowInviteSheet] = useState(false);

    // Report States
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportDescription, setReportDescription] = useState("");
    const [reporting, setReporting] = useState(false);
    const [showRoleRequiredSheet, setShowRoleRequiredSheet] = useState(false);

    useRouteLogger("TeamDetailsScreen", { teamId: id, userId: user?._id });
    const touchDebugEnabled = false;
    const roleRequiredSheetBottomOffset = Platform.OS === "android"
        ? Math.max(insets.bottom, 48)
        : 0;
    const roleRequiredFooterBottomPadding = Platform.OS === "android"
        ? SPACING.xl
        : Math.max(insets.bottom, SPACING.xl);
    const { animatedStyle: contentEntranceStyle } = useEntrance({ distance: 18 });

    // ---- Convex reactive queries ----

    // Team with members (real-time)
    const teamWithMembers = useQuery(
        api.teams.getWithMembers,
        id ? { teamId: id as Id<"teams"> } : "skip"
    );

    // Captain's teams (for challenge button)
    const captainedTeamsRaw = useQuery(
        api.teams.listByCaptain,
        user?._id ? { captainUid: user._id as Id<"users"> } : "skip"
    );
    const captainedTeams: Team[] = (captainedTeamsRaw ?? []).map((t: any) => ({ ...t, id: t._id })) as Team[];

    // Build team object from Convex data
    const team: Team | null = teamWithMembers
        ? {
            ...teamWithMembers,
            id: teamWithMembers._id,
            members: (teamWithMembers.members ?? []).map((m: any) => ({
                uid: m.odxerId ?? m.uid,
                username: m.username,
                role: m.role,
                rosterRole: m.rosterRole,
                rosterOrder: m.rosterOrder,
                joinedAt: m.joinedAt,
            })),
        } as Team
        : null;

    const isDeleted = Boolean(team?.deletedAt || (team as any)?.status === "deleted");

    // Determine isCaptain early so we can conditionally query pending requests
    const isCaptain = !isDeleted && team?.captainUid === user?._id;
    const isMember = team?.members?.some(m => m.uid === user?._id) || false;

    // Captain-only: real-time pending join requests
    const pendingRequestsRaw = useQuery(
        api.notifications.listTeamJoinRequests,
        id && user?._id && isCaptain && !isDeleted
            ? { captainUid: user._id as Id<"users">, teamId: id as Id<"teams"> }
            : "skip"
    );
    const pendingRequests = (pendingRequestsRaw ?? []).map((r: any) => ({
        ...r,
        id: r._id,
    }));

    // Non-member: check if viewer has a pending join request
    const entityKey = id && user?._id ? `team_join_request_${id}_${user._id}` : "";
    const myPendingRequest = useQuery(
        api.notifications.checkPendingTeamJoinRequest,
        id && user?._id && !isMember && entityKey
            ? { entityKey }
            : "skip"
    ) ?? false;

    const loading = teamWithMembers === undefined;

    // Role & Permission Checks
    const memberCount = team?.members?.length ?? team?.memberUids?.length ?? team?.memberCount ?? 0;
    const mainRosterSize = team ? (team.mainRosterSize || getTeamMainRosterSize(team.game)) : 0;
    const maxSubstitutes = team
        ? (typeof team.maxSubstitutes === "number"
            ? team.maxSubstitutes
            : Math.min(getTeamMaxSubstitutes(team.game), Math.max(0, Number(team.maxMembers || 0) - mainRosterSize)))
        : 0;
    const maxMembers = team ? mainRosterSize + maxSubstitutes : 0;
    const memberCountDisplay = maxMembers > 0 ? Math.min(memberCount, maxMembers) : memberCount;
    const mainMemberCountDisplay = team ? getTeamMainDisplayCount(team) : 0;
    const isFull = !isDeleted && team ? memberCountDisplay >= maxMembers : false;
    const isPrivate = team?.visibility === 'private';

    // Redirect if team not found (after loading completes)
    useEffect(() => {
        if (teamWithMembers === null) {
            if (deletingTeamRef.current) return;
            showToast({ type: "error", title: "Error", message: "Team not found" });
            router.replace(buildLegacyTeamsHref("my") as any);
        }
    }, [router, showToast, teamWithMembers]);

    useEffect(() => {
        if (params.showInvite === "true" && team && isCaptain) {
            setShowInviteSheet(true);
            router.setParams({ showInvite: undefined } as any);
        }
    }, [params.showInvite, team, isCaptain]);

    const closeConfirmationDialog = () => {
        if (!submitting) {
            setConfirmationDialog(null);
        }
    };

    const openConfirmationDialog = ({
        title,
        message,
        confirmLabel,
        confirmTone = "danger",
        onConfirm,
    }: {
        title: string;
        message: string;
        confirmLabel: string;
        confirmTone?: "primary" | "secondary" | "ghost" | "danger" | "success";
        onConfirm: () => Promise<void> | void;
    }) => {
        setConfirmationDialog({ title, message, confirmLabel, confirmTone, onConfirm });
    };

    const handleJoinRequest = async () => {
        if (!id || submitting || !user) return;
        logFlowEvent("TeamDetails", "Requesting to join team", { teamId: id, userId: user._id });
        if (!isUserFullyVerified(authUser, user)) {
            showKycVerificationRequiredAlert();
            return;
        }

        // Check if user has set role for this game AND not already in a team for this game
        try {
            const profileRes = await getUserProfile(user._id);
            if (!profileRes.ok) {
                showToast({ type: "error", title: "Error", message: "Could not load your profile." });
                return;
            }

            const profile = profileRes.data;
            let userRole;

            // Extract role based on game
            switch (team?.game) {
                case 'cs2':
                    userRole = profile.cs2Role;
                    break;
                case 'cs16':
                    userRole = (profile as any).cs16Role;
                    break;
                case 'valorant':
                    userRole = (profile as any).valorantRole;
                    break;
                case 'futsal':
                    userRole = profile.futsalPosition;
                    break;
                case 'indoor_cricket':
                    userRole = profile.indoorCricketRole;
                    break;
                case 'padel':
                    userRole = profile.padelRole;
                    break;
                case 'pickleball':
                    userRole = profile.pickleballRole;
                    break;
                case 'fc25':
                case 'fc26':
                    userRole = profile.fcTeam;
                    break;
                case 'tekken8':
                    userRole = profile.tekkenFavorites?.length ? profile.tekkenFavorites.join(', ') : null;
                    break;
            }

            if (!userRole) {
                setShowRoleRequiredSheet(true);
                return;
            }

            // Check if user is already in a team for this game
            const userTeamsForGame = await getUserTeams(user._id);
            if (userTeamsForGame.ok && userTeamsForGame.data) {
                const hasTeamInGame = userTeamsForGame.data.some(
                    t => t.game.toLowerCase() === team?.game.toLowerCase()
                );
                if (hasTeamInGame) {
                    showToast({
                        type: "warning",
                        title: "Already in a team",
                        message: `You can only join one team per game. Leave your current ${getCanonicalGameLabel(team?.game)} team first.`,
                    });
                    return;
                }
            }
        } catch (e: any) {
            Logger.error("TeamDetails", "Error checking role", e);
            showToast({ type: "error", title: "Error", message: "Could not verify your role." });
            return;
        }

        setSubmitting(true);
        try {
            const res = await requestToJoinTeamAction({ teamId: id as string });
            if (res.ok) {
                showToast({ type: "success", title: "Success", message: "Request sent to captain!" });
            } else {
                showToast({ type: "error", title: "Error", message: res.message || "Failed to send request." });
            }
        } catch (e: any) {
            showToast({ type: "error", title: "Error", message: e.message || "Error sending request." });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRespondRequest = async (notifId: string, decision: 'accept' | 'reject') => {
        logFlowEvent("TeamDetails", "Responding to join request", {
            teamId: id,
            notifId,
            decision,
        });
        setSubmitting(true);
        try {
            const res = await respondToJoinRequestAction({ notificationId: notifId, decision });
            if (!res.ok) {
                showToast({ type: "error", title: "Error", message: res.message || "Action failed." });
            }
        } catch (e: any) {
            showToast({ type: "error", title: "Error", message: e.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveMemberAction = (memberUid: string, username: string) => {
        openConfirmationDialog({
            title: "Remove Member",
            message: `Are you sure you want to remove ${username} from the team?`,
            confirmLabel: "Remove",
            confirmTone: "danger",
            onConfirm: async () => {
                logFlowEvent("TeamDetails", "Removing team member", {
                    teamId: id,
                    memberUid,
                });
                setSubmitting(true);
                try {
                    const res = await removeMemberAction({ teamId: id as string, memberUid });
                    if (!res.ok) {
                        showToast({ type: "error", title: "Error", message: res.message || "Failed to remove." });
                        return;
                    }
                    setMemberActionTarget(null);
                    setConfirmationDialog(null);
                } catch (e: any) {
                    showToast({ type: "error", title: "Error", message: e.message });
                } finally {
                    setSubmitting(false);
                }
            },
        });
    };

    const handleTransferAction = (memberUid: string, username: string) => {
        openConfirmationDialog({
            title: "Transfer Captaincy",
            message: `Are you sure you want to transfer captaincy to ${username}? You will become a regular member.`,
            confirmLabel: "Transfer",
            confirmTone: "danger",
            onConfirm: async () => {
                setSubmitting(true);
                try {
                    const res = await transferCaptainAction({ teamId: id as string, newCaptainUid: memberUid });
                    if (!res.ok) {
                        showToast({ type: "error", title: "Error", message: res.message || "Failed to transfer." });
                        return;
                    }
                    setMemberActionTarget(null);
                    setConfirmationDialog(null);
                } catch (e: any) {
                    showToast({ type: "error", title: "Error", message: e.message });
                } finally {
                    setSubmitting(false);
                }
            },
        });
    };

    const handleDeleteAction = () => {
        openConfirmationDialog({
            title: "Delete Team",
            message: "Are you sure you want to delete this team? This action cannot be undone.",
            confirmLabel: "Delete",
            confirmTone: "danger",
            onConfirm: async () => {
                setSubmitting(true);
                deletingTeamRef.current = true;
                try {
                    const res = await deleteTeam(id as string);
                    if (res.ok) {
                        setConfirmationDialog(null);
                        showToast({
                            type: "success",
                            title: "Team deleted",
                            message: res.message || "Team deleted successfully.",
                        });
                        router.replace(buildLegacyTeamsHref("my") as any);
                    } else {
                        deletingTeamRef.current = false;
                        showToast({ type: "error", title: "Error", message: res.message || "Failed to delete team." });
                    }
                } catch (e: any) {
                    deletingTeamRef.current = false;
                    showToast({ type: "error", title: "Error", message: e.message });
                } finally {
                    setSubmitting(false);
                }
            },
        });
    };

    const handleRenameTeam = async () => {
        if (!newName.trim() || !id) return;
        setSubmitting(true);
        try {
            const res = await updateTeamName(id as string, newName.trim());
            if (res.ok) {
                setShowRenameModal(false);
            } else {
                showToast({ type: "error", title: "Error", message: res.message || "Failed to rename team." });
            }
        } catch (e: any) {
            showToast({ type: "error", title: "Error", message: e.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handlePickLogo = async () => {
        if (!isCaptain) return;

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setLogoUploading(true);
                setSubmitting(true);
                const res = await uploadTeamLogo(id as string, result.assets[0].uri);
                if (!res.ok) {
                    showToast({ type: "error", title: "Error", message: res.message || "Failed to upload logo." });
                }
            }
        } catch (e: any) {
            Logger.error("TeamDetails", "Error picking image", e);
            showToast({ type: "error", title: "Error", message: "Could not pick image." });
        } finally {
            setLogoUploading(false);
            setSubmitting(false);
        }
    };

    const handleShare = async () => {
        if (!team) return;
        try {
            await Share.share({
                message: `Check out my team ${team.name} on MatchHai!`,
            });
        } catch (error) {
            Logger.error("TeamDetails", "Error sharing", error);
        }
    };

    const handleLeaveTeam = () => {
        openConfirmationDialog({
            title: "Leave Team",
            message: `Are you sure you want to leave ${team?.name}? You will need to request to rejoin.`,
            confirmLabel: "Leave",
            confirmTone: "danger",
            onConfirm: async () => {
                setSubmitting(true);
                try {
                    const res = await leaveTeamAction({ teamId: id as string });
                    if (res.ok) {
                        setConfirmationDialog(null);
                        showToast({ type: "success", title: "Success", message: "You have left the team." });
                        router.replace(buildLegacyTeamsHref("my") as any);
                    } else {
                        showToast({ type: "error", title: "Error", message: res.message || "Failed to leave team." });
                    }
                } catch (e: any) {
                    showToast({ type: "error", title: "Error", message: e.message || "Error leaving team." });
                } finally {
                    setSubmitting(false);
                }
            },
        });
    };

    const handleChallenge = async () => {
        if (!team?.id || !user?._id) return;
        const candidates = captainedTeams.filter(
            (item) => item.id !== team.id && String(item.game || "").toLowerCase() === String(team.game || "").toLowerCase(),
        );
        if (candidates.length === 0) {
            showToast({ type: "warning", title: "Captain team required", message: `Captain a ${String(team.game || "").toUpperCase()} team first to challenge.` });
            return;
        }
        const hasFullCandidate = candidates.some((candidate: any) => {
            const required = Number(candidate.mainRosterSize || getTeamMainRosterSize(candidate.game));
            const memberCount = Math.max(
                Number(candidate.memberCount || 0),
                Array.isArray(candidate.memberUids) ? candidate.memberUids.length : 0,
            );
            return Number.isFinite(required) && required > 0 && memberCount >= required;
        });
        if (!hasFullCandidate) {
            Alert.alert("Team not full", "Your team is not full yet. Fill your roster before challenging another team.");
            return;
        }
        router.push({
            pathname: "/teams/challenge-create" as any,
            params: { opponentTeamId: team.id },
        } as any);
    };

    const handleSubmitTeamReport = async () => {
        if (!team?.captainUid || !reportReason) return;
        setReporting(true);
        const result = await submitUserReport({
            reportedUserId: team.captainUid,
            reason: reportReason,
            description: reportDescription,
        });
        setReporting(false);

        if (!result.ok) {
            showToast({ type: "error", title: "Report failed", message: result.message });
            return;
        }

        showToast({
            type: "success",
            title: result.data.created ? "Report submitted" : "Report already exists",
            message: result.message || "Our moderation team will review it.",
        });
        setShowReportModal(false);
        setReportReason("");
        setReportDescription("");
    };

    // Button State Logic
    const getButtonState = () => {
        if (isMember) return 'member';
        if (myPendingRequest) return 'requested';
        if (isFull) return 'full';
        if (isPrivate) return 'private';
        return 'eligible';
    };

    const buttonState = getButtonState();

    const handleEmptySlotPress = () => {
        if (isCaptain) {
            setShowInviteSheet(true);
            return;
        }
        if (buttonState === 'eligible') {
            handleJoinRequest();
            return;
        }
        if (buttonState === 'requested') {
            showToast({ type: "warning", title: "Request Pending", message: "Your request is already pending captain approval." });
            return;
        }
        if (buttonState === 'full') {
            showToast({ type: "warning", title: "Team Full", message: "This team is currently full." });
            return;
        }
        if (buttonState === 'private') {
            showToast({ type: "warning", title: "Invite Only", message: "This team is private. Ask the captain for an invite." });
        }
    };

    if (loading || !team) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </Screen>
        );
    }

    const hasChallengeCandidateTeam = !isMember && (buttonState === 'eligible' || buttonState === 'full') && captainedTeams.some(
        (item: any) => item.id !== team.id && String(item.game || "").toLowerCase() === String(team.game || "").toLowerCase(),
    );
    const canChallengeTeam = !isMember && (buttonState === 'eligible' || buttonState === 'full') && captainedTeams.some(
        (item: any) => {
            if (item.id === team.id) return false;
            if (String(item.game || "").toLowerCase() !== String(team.game || "").toLowerCase()) return false;
            const required = Number(item.mainRosterSize || getTeamMainRosterSize(item.game));
            const memberCount = Math.max(
                Number(item.memberCount || 0),
                Array.isArray(item.memberUids) ? item.memberUids.length : 0,
            );
            return Number.isFinite(required) && required > 0 && memberCount >= required;
        },
    );
    const showBottomActionBar = !isDeleted && ((isMember && !isCaptain) || !isMember);

    return (
        <Screen style={styles.screen} scroll={false} contentStyle={styles.screenContent} debugTag="team_detail_screen">
            <AppHeader
                title="Team Details"
                onBack={() => router.back()}
                inlineTitle
                style={styles.pageHeader}
                rightAction={(
                    <View style={styles.headerActions}>
                        {isCaptain && (
                            <HeaderIconButton
                                icon="delete-outline"
                                color={COLORS.error}
                                onPress={handleDeleteAction}
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "team_header_delete" });
                                    }
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            />
                        )}
                        {isCaptain && (
                            <HeaderIconButton
                                icon="person-add-alt-1"
                                color={COLORS.accent}
                                onPress={() => setShowInviteSheet(true)}
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "team_header_invite" });
                                    }
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            />
                        )}
                        {!isDeleted && (
                            <HeaderIconButton
                                icon="share"
                                color={COLORS.accent}
                                onPress={handleShare}
                            />
                        )}
                    </View>
                )}
            />

            <View style={styles.body}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[
                        styles.scrollContent,
                        showBottomActionBar && styles.scrollContentWithBottomAction,
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={contentEntranceStyle}>
                        {isDeleted && (
                            <View style={styles.deletedBanner}>
                                <AppIcon name="warning" size={20} color={COLORS.warning} />
                                <View style={styles.deletedBannerTextWrap}>
                                    <Text style={styles.deletedBannerTitle}>Deleted Team</Text>
                                    <Text style={styles.deletedBannerText}>
                                        This team has been deleted. You can view its saved roster, but actions are disabled.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Team Info Section */}
                        <AppCard variant="elevated" style={styles.teamHeader}>
                            <View pointerEvents="none" style={styles.teamHeaderAccent} />
                            <Pressable
                                onPress={handlePickLogo}
                                disabled={!isCaptain || submitting}
                                style={({ pressed }) => [
                                    styles.teamLogoLarge,
                                    isCaptain && styles.teamLogoLargeCaptain,
                                    pressed && isCaptain && styles.logoPressed,
                                ]}
                            >
                                {team.logoUrl ? (
                                    <AppImage source={{ uri: team.logoUrl }} containerStyle={styles.teamLogoImage} />
                                ) : (
                                    <Text style={styles.teamLogoTextLarge}>
                                        {team.name.charAt(0).toUpperCase()}
                                    </Text>
                                )}
                                {isCaptain && (
                                    <View style={styles.logoEditBadge}>
                                        {logoUploading ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <AppIcon name="edit" size={16} color="#FFF" />
                                        )}
                                    </View>
                                )}
                            </Pressable>
                            <View style={styles.teamNameContainer}>
                                <Text style={styles.teamNameLarge} numberOfLines={1} ellipsizeMode="tail">
                                    {team.name}
                                </Text>
                                {isCaptain && (
                                    <Pressable
                                        onPress={() => {
                                            setNewName(team.name);
                                            setShowRenameModal(true);
                                        }}
                                        style={({ pressed }) => [
                                            styles.editNameIcon,
                                            pressed && styles.headerIconPressed
                                        ]}
                                        android_ripple={{ color: COLORS.overlayMedium, borderless: true, radius: 20 }}
                                    >
                                        <AppIcon name="edit" size={20} color={COLORS.accent} />
                                    </Pressable>
                                )}
                            </View>
                            <StatusPill tone="info" label={getCanonicalGameLabel(team.game)} style={styles.gamePill} />
                            {isDeleted && (
                                <StatusPill tone="warning" label="Deleted" caps={false} style={styles.deletedPill} />
                            )}
                            {team.description && <Text style={styles.description}>{team.description}</Text>}

                            {/* Occupancy Indicator with Report Button */}
                            <View style={styles.occupancyActionRow}>
                                <View style={styles.occupancyInfoPill}>
                                    <AppIcon name="people" size={16} color={COLORS.muted} />
                                    <Text style={styles.occupancyText}>
                                        {mainMemberCountDisplay} / {mainRosterSize}
                                    </Text>
                                    {isFull && <StatusPill tone="danger" label="Full" />}
                                </View>

                                {!isCaptain && !isDeleted && (
                                    <View style={styles.reportActionSlot}>
                                        <ReportIconButton onPress={() => setShowReportModal(true)} />
                                    </View>
                                )}
                            </View>

                            {/* Member Badge */}
                            {isMember && (
                                <StatusPill
                                    tone="success"
                                    label="Member"
                                    caps={false}
                                    style={styles.memberPill}
                                    textStyle={styles.memberPillText}
                                />
                            )}
                        </AppCard>

                        {/* Stats */}
                        <DetailSectionCard title="Team Stats" style={styles.statsCard}>
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, styles.statPrimary]}>{team.stats?.matchesPlayed || 0}</Text>
                                    <Text style={styles.statLabel}>Matches</Text>
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, styles.statSuccess]}>{team.stats?.wins || 0}</Text>
                                    <Text style={styles.statLabel}>Wins</Text>
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, styles.statError]}>{team.stats?.losses || 0}</Text>
                                    <Text style={styles.statLabel}>Losses</Text>
                                </View>
                            </View>
                        </DetailSectionCard>

                        {/* Captain's Request Section */}
                        {!isDeleted && isCaptain && pendingRequests.length > 0 && (
                            <DetailSectionCard title={`Join Requests (${pendingRequests.length})`} style={styles.requestSection}>
                                {pendingRequests.map(req => (
                                    <AppCard key={req.id} style={styles.requestCard}>
                                        <View style={styles.requestHeader}>
                                            <Text style={styles.requestUser}>{req.fromUsername}</Text>
                                            <Text style={styles.snapshotText}>{req.data?.requesterSnapshot?.city || 'No city'}</Text>
                                        </View>
                                        <View style={styles.requestSnapshot}>
                                            <Text style={styles.snapshotText}>
                                                Tier: {req.data?.requesterSnapshot?.skillTier?.[team.game] || 'Unranked'}
                                                {req.data?.requesterSnapshot?.stats?.faceitLevel ? ` • Faceit Lvl ${req.data.requesterSnapshot.stats.faceitLevel}` : ''}
                                            </Text>
                                        </View>
                                        <View style={styles.requestActions}>
                                            <AppButton
                                                variant="success"
                                                size="sm"
                                                onPress={() => handleRespondRequest(req.id, 'accept')}
                                                disabled={submitting}
                                            >
                                                <Text style={styles.actionText}>Accept</Text>
                                            </AppButton>
                                            <AppButton
                                                variant="danger"
                                                size="sm"
                                                onPress={() => handleRespondRequest(req.id, 'reject')}
                                                disabled={submitting}
                                            >
                                                <Text style={styles.rejectText}>Decline</Text>
                                            </AppButton>
                                        </View>
                                    </AppCard>
                                ))}
                            </DetailSectionCard>
                        )}

                        {/* Roster Slots (Slot Grid) */}
                        <DetailSectionCard
                            title="Lineup"
                            subtitle={
                                isDeleted
                                    ? "This deleted team is read-only."
                                    : isCaptain
                                        ? "Manage members, invites, and captain actions from here."
                                        : undefined
                            }
                            style={styles.rosterSection}
                        >
                            <RosterSlots
                                maxMembers={maxMembers}
                                mainRosterSize={mainRosterSize}
                                maxSubstitutes={maxSubstitutes}
                                members={team.members || []}
                                captainUid={team.captainUid}
                                viewerUid={user?._id}
                                isCaptain={isCaptain}
                                game={team.game}
                                onEmptySlotPress={!isDeleted ? handleEmptySlotPress : undefined}
                                onMemberPress={(member) => {
                                    if (!isDeleted && isCaptain && member.uid !== user?._id) {
                                        setMemberActionTarget({ uid: member.uid, username: member.username });
                                        return;
                                    }
                                    router.push(`/(player)/profile/${member.uid}` as any);
                                }}
                            />
                        </DetailSectionCard>
                    </Animated.View>
                </ScrollView>
                {showBottomActionBar ? (
                    <BottomActionBar>
                        {isMember && !isCaptain ? (
                            <AppButton
                                variant="danger"
                                size="lg"
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "team_leave" });
                                    }
                                }}
                                onPress={handleLeaveTeam}
                                disabled={submitting}
                                style={styles.leaveButton}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.leaveButtonText}>Leave Team</Text>
                                )}
                            </AppButton>
                        ) : null}

                        {!isMember ? (
                            <View style={styles.actionBarContent}>
                                {buttonState === 'eligible' && (
                                    <>
                                        {hasChallengeCandidateTeam ? (
                                          <View style={styles.footerActionRow}>
                                            <AppButton
                                                variant="success"
                                                size="lg"
                                                onPress={handleChallenge}
                                                disabled={submitting}
                                                style={[
                                                    styles.challengeButton,
                                                    styles.footerActionButton,
                                                    !canChallengeTeam && styles.challengeButtonDisabled,
                                                ]}
                                            >
                                                <Text style={styles.challengeButtonText}>Challenge Team</Text>
                                            </AppButton>
                                            <AppButton
                                                size="lg"
                                                onPressIn={() => {
                                                    if (touchDebugEnabled) {
                                                        Logger.debug("TouchDebug", "pressIn", { tag: "team_request_join" });
                                                    }
                                                }}
                                                onPress={handleJoinRequest}
                                                disabled={submitting}
                                                style={[styles.actionButton, styles.footerActionButton]}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Text style={styles.actionButtonText}>Request</Text>
                                            </AppButton>
                                          </View>
                                        ) : (
                                          <AppButton
                                              size="lg"
                                              onPressIn={() => {
                                                  if (touchDebugEnabled) {
                                                      Logger.debug("TouchDebug", "pressIn", { tag: "team_request_join" });
                                                  }
                                              }}
                                              onPress={handleJoinRequest}
                                              disabled={submitting}
                                              style={styles.actionButton}
                                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                          >
                                              <Text style={styles.actionButtonText}>Request to Join</Text>
                                          </AppButton>
                                        )}
                                    </>
                                )}
                                {buttonState === 'requested' && (
                                    <AppCard style={styles.actionButtonDisabled}>
                                        <ActivityIndicator size="small" color={COLORS.warning} style={styles.headerIcon} />
                                        <Text style={styles.actionButtonTextDisabled}>Requested</Text>
                                    </AppCard>
                                )}
                                {buttonState === 'full' && (
                                    hasChallengeCandidateTeam ? (
                                        <AppButton
                                            variant="success"
                                            size="lg"
                                            onPress={handleChallenge}
                                            disabled={submitting}
                                            style={[styles.challengeButton, !canChallengeTeam && styles.challengeButtonDisabled]}
                                        >
                                            <Text style={styles.challengeButtonText}>Challenge Team</Text>
                                        </AppButton>
                                    ) : (
                                        <AppCard style={styles.actionButtonDisabled}>
                                            <Text style={styles.actionButtonTextDisabled}>Full</Text>
                                        </AppCard>
                                    )
                                )}
                                {buttonState === 'private' && (
                                    <AppCard style={styles.actionButtonDisabled}>
                                        <Text style={styles.actionButtonTextDisabled}>Invite Only</Text>
                                    </AppCard>
                                )}
                            </View>
                        ) : null}
                    </BottomActionBar>
                ) : null}
            </View>

            <AppDialog
                visible={showRenameModal}
                onClose={() => setShowRenameModal(false)}
                dismissDisabled={submitting}
                cardStyle={styles.renameDialogCard}
            >
                <AppModalHeader title="Rename Team" onClose={() => setShowRenameModal(false)} closeDisabled={submitting} />
                <AppModalBody contentContainerStyle={styles.renameDialogContent}>
                    <TextInput
                        style={styles.renameInput}
                        value={newName}
                        onChangeText={setNewName}
                        placeholder="Enter new team name"
                        placeholderTextColor={COLORS.muted}
                        autoFocus
                    />
                </AppModalBody>
                <AppModalFooter style={styles.dialogFooter}>
                    <View style={styles.renameActions}>
                        <AppButton variant="ghost" onPress={() => setShowRenameModal(false)} disabled={submitting}>
                            Cancel
                        </AppButton>
                        <AppButton onPress={handleRenameTeam} disabled={submitting} loading={submitting}>
                            Save Changes
                        </AppButton>
                    </View>
                </AppModalFooter>
            </AppDialog>

            <AppBottomSheet
                visible={showRoleRequiredSheet}
                onClose={() => setShowRoleRequiredSheet(false)}
                sheetStyle={[
                    styles.roleRequiredSheet,
                    roleRequiredSheetBottomOffset
                        ? { marginBottom: roleRequiredSheetBottomOffset }
                        : null,
                ]}
            >
                <AppModalHeader
                    title="Set your role first"
                    onClose={() => setShowRoleRequiredSheet(false)}
                />
                <AppModalBody contentContainerStyle={styles.roleRequiredContent}>
                    <Text style={styles.roleRequiredMessage}>
                        Choose your role for {getCanonicalGameLabel(team?.game)} to request teams.
                    </Text>
                </AppModalBody>
                <AppModalFooter
                    style={[
                        styles.roleRequiredFooter,
                        { paddingBottom: roleRequiredFooterBottomPadding },
                    ]}
                >
                    <View style={styles.roleRequiredActions}>
                        <AppButton
                            variant="secondary"
                            style={styles.roleRequiredActionButton}
                            onPress={() => setShowRoleRequiredSheet(false)}
                        >
                            Cancel
                        </AppButton>
                        <AppButton
                            style={styles.roleRequiredActionButton}
                            onPress={() => {
                                setShowRoleRequiredSheet(false);
                                router.push('/(player)/profile/edit' as any);
                            }}
                        >
                            Set Role
                        </AppButton>
                    </View>
                </AppModalFooter>
            </AppBottomSheet>

            <AppDialog
                visible={memberActionTarget !== null}
                onClose={() => setMemberActionTarget(null)}
                dismissDisabled={submitting}
                cardStyle={styles.memberDialogCard}
            >
                <AppModalHeader
                    title={memberActionTarget?.username ?? "Member Actions"}
                    subtitle="Choose an action for this teammate."
                    onClose={() => setMemberActionTarget(null)}
                    closeDisabled={submitting}
                />
                <AppModalBody contentContainerStyle={styles.memberDialogContent}>
                    <AppButton
                        variant="secondary"
                        onPress={() => {
                            if (!memberActionTarget) return;
                            setMemberActionTarget(null);
                            router.push(`/(player)/profile/${memberActionTarget.uid}` as any);
                        }}
                        disabled={submitting}
                    >
                        View Profile
                    </AppButton>
                    <AppButton
                        variant="ghost"
                        onPress={() => {
                            if (memberActionTarget) {
                                handleTransferAction(memberActionTarget.uid, memberActionTarget.username);
                            }
                        }}
                        disabled={submitting}
                    >
                        Transfer Captaincy
                    </AppButton>
                    <AppButton
                        variant="danger"
                        onPress={() => {
                            if (memberActionTarget) {
                                handleRemoveMemberAction(memberActionTarget.uid, memberActionTarget.username);
                            }
                        }}
                        disabled={submitting}
                    >
                        Remove From Team
                    </AppButton>
                </AppModalBody>
            </AppDialog>

            <AppBottomSheet
                visible={confirmationDialog !== null}
                onClose={closeConfirmationDialog}
                dismissDisabled={submitting}
            >
                <AppModalHeader
                    title={confirmationDialog?.title ?? ""}
                    onClose={closeConfirmationDialog}
                    closeDisabled={submitting}
                />
                <AppModalBody contentContainerStyle={styles.confirmationDialogContent}>
                    <Text style={styles.confirmationMessage}>{confirmationDialog?.message}</Text>
                </AppModalBody>
                <AppModalFooter style={styles.dialogFooter}>
                    <View style={styles.confirmationActions}>
                        <AppButton
                            variant="secondary"
                            onPress={closeConfirmationDialog}
                            disabled={submitting}
                            style={[
                                styles.confirmationActionButton,
                                styles.confirmationCancelButton,
                            ]}
                        >
                            Cancel
                        </AppButton>
                        <AppButton
                            variant={confirmationDialog?.confirmTone ?? "danger"}
                            onPress={() => void confirmationDialog?.onConfirm()}
                            disabled={submitting}
                            loading={submitting}
                            style={styles.confirmationActionButton}
                        >
                            {confirmationDialog?.confirmLabel ?? "Confirm"}
                        </AppButton>
                    </View>
                </AppModalFooter>
            </AppBottomSheet>

            {/* Invite Friends Sheet */}
            <InviteFriendsSheet
                visible={showInviteSheet}
                onClose={() => setShowInviteSheet(false)}
                teamId={id as string}
                teamName={team.name}
                game={team.game}
                memberUids={team.memberUids}
            />

            {/* Report Team Modal */}
            <ReportIssueModal
                visible={showReportModal}
                title="Report Team"
                subtitle="Flag behavior that violates MatchHai policies."
                reasons={REPORT_REASONS}
                reason={reportReason}
                description={reportDescription}
                onChangeReason={setReportReason}
                onChangeDescription={setReportDescription}
                onSubmit={handleSubmitTeamReport}
                onClose={() => setShowReportModal(false)}
                loading={reporting}
                submitLabel="Submit Report"
            />
        </Screen>
    );
}
