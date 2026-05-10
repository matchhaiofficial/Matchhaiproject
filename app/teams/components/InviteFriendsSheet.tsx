import React, { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View
} from "react-native";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { AppBottomSheet, AppModalBody, AppModalFooter, AppModalHeader } from "../../../src/components/AppModalPrimitives";
import { AppIcon } from "../../../src/components/AppIcon";
import { AppButton } from "../../../src/components/AppPrimitives";
import { useAuth } from "../../../src/context/AuthContext";
import { useToast } from "../../../src/hooks/useToast";
import { inviteToTeamAction } from "../../../src/services/convex/teamActionService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./InviteFriendsSheet.styles";

interface Friend {
    uid: string;
    username: string;
    inTeam?: boolean;
    teamName?: string | null;
}

interface InviteFriendsSheetProps {
    visible: boolean;
    onClose: () => void;
    teamId: string;
    teamName: string;
    game: string;
    memberUids?: string[];
}

export default function InviteFriendsSheet({ visible, onClose, teamId, teamName, game, memberUids = [] }: InviteFriendsSheetProps) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [invitingIds, setInvitingIds] = useState<Set<string>>(new Set());

    const friendsData = useQuery(
        api.social.listFriendsForGame,
        user?._id && game ? { userId: user._id as Id<"users">, game } : "skip"
    );

    const membersSet = new Set(memberUids);
    const friends: Friend[] = (friendsData ?? [])
        .map((f: any) => ({
            uid: f.friendId,
            username: f.username,
            inTeam: Boolean(f.inTeam),
            teamName: f.teamName || null,
        }))
        .filter((f) => !membersSet.has(f.uid));
    const loading = visible && friendsData === undefined;

    const handleInvite = async (friendUid: string) => {
        if (invitingIds.has(friendUid)) return;

        setInvitingIds((prev) => new Set(prev).add(friendUid));
        try {
            const res = await inviteToTeamAction({ teamId, toUid: friendUid });
            if (!res.ok) {
                showToast({ type: "error", title: "Error", message: res.message || "Failed to send invite" });
                setInvitingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(friendUid);
                    return next;
                });
                return;
            }

            if (res.alreadyPending) {
                showToast({ type: "info", title: "Invite Pending", message: res.message || "An invite is already pending for this friend." });
            }
        } catch (error) {
            Logger.error("InviteFriendsSheet", "HandleInvite error", error);
            setInvitingIds((prev) => {
                const next = new Set(prev);
                next.delete(friendUid);
                return next;
            });
        }
    };

    const renderFriendRow = (item: Friend) => {
        const isInvited = invitingIds.has(item.uid);
        const disabledByTeam = Boolean(item.inTeam);
        const disabled = isInvited || disabledByTeam;

        return (
            <View style={styles.friendItem}>
                <View style={styles.friendInfo}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.friendName} numberOfLines={1}>{item.username}</Text>
                        {disabledByTeam ? (
                            <View style={styles.inTeamBadge}>
                                <Text style={styles.inTeamBadgeText} numberOfLines={1}>
                                    Already in a team{item.teamName ? `: ${item.teamName}` : ""}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>
                <Pressable
                    style={[styles.inviteBtn, disabled && styles.inviteBtnDisabled]}
                    onPress={() => {
                        if (disabledByTeam) {
                            showToast({ type: "info", title: "Already in a team", message: "This player is already in a team for this game and can't be invited." });
                            return;
                        }
                        handleInvite(item.uid);
                    }}
                    disabled={disabled}
                >
                    {isInvited ? (
                        <AppIcon name="check" size={16} color={COLORS.muted} />
                    ) : (
                        <Text style={styles.inviteBtnText}>{disabledByTeam ? "Unavailable" : "Invite"}</Text>
                    )}
                </Pressable>
            </View>
        );
    };

    const hasScrollableList = friends.length > 4;

    return (
        <AppBottomSheet visible={visible} onClose={onClose} sheetStyle={styles.content}>
            <AppModalHeader title="Invite Friends" subtitle={`to ${teamName}`} onClose={onClose} />

            <AppModalBody contentContainerStyle={styles.listBody}>
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color={COLORS.accent} />
                    </View>
                ) : friends.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <AppIcon name="person-add" size={48} color={COLORS.muted} />
                        <Text style={styles.emptyText}>No friends to invite.</Text>
                        <Text style={styles.emptySubtext}>
                            Only friends who play {game.toUpperCase()} appear here.
                        </Text>
                    </View>
                ) : hasScrollableList ? (
                    <ScrollView
                        style={styles.listScroller}
                        contentContainerStyle={styles.list}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {friends.map((friend) => (
                            <View key={friend.uid}>
                                {renderFriendRow(friend)}
                            </View>
                        ))}
                    </ScrollView>
                ) : (
                    <View style={styles.list}>
                        {friends.map((friend) => (
                            <View key={friend.uid}>
                                {renderFriendRow(friend)}
                            </View>
                        ))}
                    </View>
                )}
            </AppModalBody>

            <AppModalFooter style={styles.modalFooter}>
                <AppButton variant="secondary" onPress={onClose}>
                    Done
                </AppButton>
            </AppModalFooter>
        </AppBottomSheet>
    );
}
