import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GAME_FORMATS } from "../../src/constants/gameRules";
import { AppIcon } from "../../src/components/AppIcon";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../../src/context/AuthContext";
import { logFlowEvent, useRouteLogger } from "../../src/hooks/useRouteLogger";
import { useToast } from "../../src/hooks/useToast";
import { createTeamAction, inviteToTeamAction } from "../../src/services/convex/teamActionService";
import { COLORS } from "../../src/theme";
import { hasVerifiedEmail, showEmailVerificationRequiredAlert } from "../../src/utils/emailVerificationGate";
import Logger from "../../src/utils/logger";
import styles from "./create.styles";

const GAMES = [
    { key: 'cs2', label: 'CS2' },
    { key: 'cs16', label: 'CS 1.6' },
    { key: 'valorant', label: 'Valorant' },
    { key: 'fc26', label: 'FC26' },
    { key: 'tekken8', label: 'Tekken 8' },
    // Physical sports are temporarily disabled.
    // { key: 'futsal', label: 'Futsal' },
    // { key: 'indoor_cricket', label: 'Cricket' },
    // { key: 'padel', label: 'Padel' },
    // { key: 'pickleball', label: 'Pickleball' },
];

const FIXED_1V1_TEAM_GAMES = new Set(["fc26", "tekken8"]);

const localStyles = StyleSheet.create({
    flexOne: {
        flex: 1,
    },
    keyboardShell: {
        flex: 1,
    },
    chipPressed: {
        opacity: 0.88,
    },
    friendCardPressed: {
        opacity: 0.92,
    },
});

export default function CreateTeam() {
    const { user, authUser } = useAuth();
    const router = useRouter();
    const { showToast } = useToast();
    const touchDebugEnabled = false;
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedGame, setSelectedGame] = useState<string | null>(null);
    const [selectedSize, setSelectedSize] = useState<number | null>(null);
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    useRouteLogger("CreateTeamScreen", {
        selectedGame,
        selectedSize,
        invitedCount: selectedFriendIds.length,
    });

    const eligibleFriendsRaw = useQuery(
        api.social.listFriendsForGame,
        user?._id && selectedGame
            ? { userId: user._id as Id<"users">, game: selectedGame }
            : "skip"
    );

    // Get available sizes for selected game
    const availableFormats = useMemo(() => {
        if (!selectedGame) return [];
        return GAME_FORMATS[selectedGame] || [];
    }, [selectedGame]);
    const usesFixed1v1TeamSize = selectedGame ? FIXED_1V1_TEAM_GAMES.has(selectedGame) : false;
    const effectiveTeamSize = usesFixed1v1TeamSize ? 1 : selectedSize;
    const shouldShowTeamSizeSelector = Boolean(
        selectedGame && !usesFixed1v1TeamSize && availableFormats.length > 1,
    );

    const eligibleFriends = useMemo(
        () => (eligibleFriendsRaw ?? []).map((friend: any) => ({
            uid: friend.friendId as string,
            username: friend.username as string,
            fullName: friend.fullName as string | undefined,
            isOnline: !!friend.isOnline,
        })),
        [eligibleFriendsRaw]
    );

    const maxInviteCount = Math.max(0, (effectiveTeamSize ?? 1) - 1);
    const selectedGameLabel = useMemo(
        () => GAMES.find((game) => game.key === selectedGame)?.label ?? "this game",
        [selectedGame]
    );

    // Reset size when game changes
    const handleGameSelect = (gameKey: string) => {
        setSelectedGame(gameKey);
        const formats = GAME_FORMATS[gameKey] || [];
        // Default to first format if available
        setSelectedSize(formats.length > 0 ? formats[0].size : null);
        setSelectedFriendIds([]);
    };

    const toggleFriendSelection = (friendId: string) => {
        setSelectedFriendIds((prev) => {
            if (prev.includes(friendId)) {
                return prev.filter((id) => id !== friendId);
            }
            if (prev.length >= maxInviteCount) {
                showToast({
                    type: "warning",
                    title: "Invite limit reached",
                    message: `You can invite up to ${maxInviteCount} friend${maxInviteCount === 1 ? "" : "s"} for this team size.`,
                });
                return prev;
            }
            return [...prev, friendId];
        });
    };

    const handleSubmit = async () => {
        Keyboard.dismiss();
        logFlowEvent("CreateTeam", "Submitting team creation", {
            nameLength: name.trim().length,
            selectedGame,
            selectedSize: effectiveTeamSize,
            invitedCount: selectedFriendIds.length,
            uid: user?._id
        });

        if (!user) {
            showToast({ type: "error", title: "Login required", message: "You must be logged in." });
            return;
        }
        if (!name.trim()) {
            showToast({ type: "warning", title: "Team name required", message: "Please enter a team name." });
            return;
        }
        if (!selectedGame) {
            showToast({ type: "warning", title: "Game required", message: "Please select a game." });
            return;
        }
        if (!effectiveTeamSize) {
            showToast({ type: "warning", title: "Team size required", message: "Please select a team size." });
            return;
        }
        if (!hasVerifiedEmail(authUser)) {
            showEmailVerificationRequiredAlert();
            return;
        }

        setSubmitting(true);
        try {
            const result = await createTeamAction({
                name: name.trim(),
                description: description.trim(),
                game: selectedGame,
                visibility: 'public',
                maxMembers: effectiveTeamSize
            });

            if (result.ok) {
                if (result.teamId && selectedFriendIds.length > 0) {
                    await Promise.allSettled(
                        selectedFriendIds.map((friendId) =>
                            inviteToTeamAction({
                                teamId: result.teamId,
                                toUid: friendId,
                            })
                        )
                    );
                }

                router.replace({
                    pathname: `/teams/${result.teamId}`,
                    params: { showInvite: 'true' }
                } as any);
            } else {
                showToast({
                    type: "error",
                    title: "Create team failed",
                    message: result.message || "Failed to create team.",
                });
            }
        } catch (error) {
            Logger.error("CreateTeam", "Error creating team", error);
            showToast({
                type: "error",
                title: "Create team failed",
                message: "An error occurred.",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = !!user && !!name.trim() && !!selectedGame && !!effectiveTeamSize && !submitting;

    return (
        <SafeAreaView style={styles.screen}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={localStyles.keyboardShell}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <AppIcon name="arrow-back" size={24} color={COLORS.text} />
                    </Pressable>
                    <Text style={styles.headerTitle}>Create Team</Text>
                </View>

                <ScrollView
                    style={localStyles.flexOne}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Team Name */}
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>
                            Team Name *
                        </Text>
                        <View style={styles.inputBox}>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., Karachi Warriors"
                                placeholderTextColor={COLORS.muted}
                                value={name}
                                onChangeText={setName}
                                maxLength={30}
                            />
                        </View>
                        <Text style={styles.helperText}>
                            {name.length}/30 characters
                        </Text>
                    </View>

                    {/* Game Selection */}
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>
                            Game Focus *
                        </Text>
                        <View style={styles.chipRow}>
                            {GAMES.map(game => (
                                <Pressable
                                    key={game.key}
                                    onPress={() => handleGameSelect(game.key)}
                                    style={({ pressed }) => [
                                        styles.optionChip,
                                        selectedGame === game.key && styles.optionChipActive,
                                        pressed && localStyles.chipPressed,
                                    ]}
                                >
                                    <Text style={[
                                        styles.optionChipText,
                                        selectedGame === game.key && styles.optionChipTextActive
                                    ]}>
                                        {game.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    {/* Team Size Selection */}
                    {shouldShowTeamSizeSelector && (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>
                                Team Size *
                            </Text>
                            <View style={styles.chipRow}>
                                {availableFormats.map(format => (
                                    <Pressable
                                        key={format.size}
                                        onPress={() => setSelectedSize(format.size)}
                                        style={({ pressed }) => [
                                            styles.optionChip,
                                            selectedSize === format.size && styles.optionChipActive,
                                            pressed && localStyles.chipPressed,
                                        ]}
                                    >
                                        <Text style={[
                                            styles.optionChipText,
                                            selectedSize === format.size && styles.optionChipTextActive
                                        ]}>
                                            {format.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Description */}
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>
                            Description (Optional)
                        </Text>
                        <View style={styles.inputBox}>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="What's your team about?"
                                placeholderTextColor={COLORS.muted}
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                maxLength={200}
                            />
                        </View>
                        <Text style={styles.helperText}>
                            {description.length}/200 characters
                        </Text>
                    </View>

                    {selectedGame && (
                        <View style={styles.section}>
                            <View style={styles.inviteHeaderRow}>
                                <Text style={styles.sectionLabel}>
                                    Invite Friends (Optional)
                                </Text>
                                <Text style={styles.inviteCountText}>
                                    {selectedFriendIds.length}/{maxInviteCount}
                                </Text>
                            </View>

                            {eligibleFriendsRaw === undefined ? (
                                <View style={styles.inviteLoadingRow}>
                                    <ActivityIndicator size="small" color={COLORS.accent} />
                                    <Text style={styles.inviteHelperText}>Loading eligible friends...</Text>
                                </View>
                            ) : eligibleFriends.length > 0 && maxInviteCount > 0 ? (
                                <>
                                    <Text style={styles.helperText}>
                                        Only friends who play {selectedGameLabel} are shown here.
                                    </Text>
                                    <View style={styles.inviteList}>
                                        {eligibleFriends.map((friend) => {
                                            const selected = selectedFriendIds.includes(friend.uid);
                                            return (
                                                <Pressable
                                                    key={friend.uid}
                                                    onPress={() => toggleFriendSelection(friend.uid)}
                                                    style={({ pressed }) => [
                                                        styles.friendCard,
                                                        selected && styles.friendCardSelected,
                                                        pressed && localStyles.friendCardPressed,
                                                    ]}
                                                >
                                                    <View style={styles.friendCardInfo}>
                                                        <View style={styles.friendAvatar}>
                                                            <Text style={styles.friendAvatarText}>
                                                                {friend.username.charAt(0).toUpperCase()}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.friendMeta}>
                                                            <Text style={styles.friendName}>{friend.username}</Text>
                                                            <Text style={styles.friendSubtext}>
                                                                {friend.fullName || (friend.isOnline ? "Online" : "Available to invite")}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <AppIcon
                                                        name={selected ? "check-circle" : "radio-button-unchecked"}
                                                        size={20}
                                                        color={selected ? COLORS.accent : COLORS.muted}
                                                    />
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </>
                            ) : (
                                <View style={styles.inviteEmptyCard}>
                                    <Text style={styles.inviteEmptyTitle}>No eligible friends found</Text>
                                    <Text style={styles.inviteEmptyText}>
                                        {maxInviteCount === 0
                                            ? "This team size does not allow additional invites."
                                            : `Only friends who play ${selectedGameLabel} can be invited here.`}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>

                {/* Submit Button */}
                <View style={styles.buttonWrapper}>
                    <Pressable
                        onPressIn={() => {
                            if (touchDebugEnabled) {
                                Logger.debug("TouchDebug", "pressIn", {
                                    tag: "team_create_submit",
                                    canSubmit,
                                    submitting,
                                });
                            }
                        }}
                        onPress={handleSubmit}
                        disabled={!canSubmit}
                        style={({ pressed }) => [
                            styles.primaryButton,
                            !canSubmit && styles.primaryButtonDisabled,
                            pressed && canSubmit && styles.primaryButtonPressed,
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                Create Team
                            </Text>
                        )}
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
