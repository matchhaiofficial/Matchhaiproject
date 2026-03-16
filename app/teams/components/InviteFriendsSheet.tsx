import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { inviteToTeam } from "../../../src/services/functions";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./InviteFriendsSheet.styles";

interface Friend {
    uid: string;
    username: string;
}

interface InviteFriendsSheetProps {
    visible: boolean;
    onClose: () => void;
    teamId: string;
    teamName: string;
}

export default function InviteFriendsSheet({ visible, onClose, teamId, teamName }: InviteFriendsSheetProps) {
    const { user } = useAuth();
    const [invitingIds, setInvitingIds] = useState<Set<string>>(new Set());

    // Real-time query for friends (replaces Firebase getDocs)
    const friendsData = useQuery(
        api.social.listFriends,
        user?._id ? { userId: user._id as Id<"users"> } : "skip"
    );

    const friends: Friend[] = (friendsData ?? []).map((f: any) => ({
        uid: f.friendId,
        username: f.username,
    }));
    const loading = visible && friendsData === undefined;

    const handleInvite = async (friendUid: string, friendUsername: string) => {
        if (invitingIds.has(friendUid)) return;

        setInvitingIds(prev => new Set(prev).add(friendUid));
        try {
            const res = await inviteToTeam({ teamId, toUid: friendUid });
            if (res.ok) {
                // Keep it in state but maybe show "Invited"
            } else {
                Alert.alert("Error", res.message || "Failed to send invite");
                setInvitingIds(prev => {
                    const next = new Set(prev);
                    next.delete(friendUid);
                    return next;
                });
            }
        } catch (error) {
            Logger.error("InviteFriendsSheet", "HandleInvite error", error);
            setInvitingIds(prev => {
                const next = new Set(prev);
                next.delete(friendUid);
                return next;
            });
        }
    };

    const renderFriendItem = ({ item }: { item: Friend }) => {
        const isInvited = invitingIds.has(item.uid);

        return (
            <View style={styles.friendItem}>
                <View style={styles.friendInfo}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.friendName}>{item.username}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.inviteBtn, isInvited && styles.inviteBtnDisabled]}
                    onPress={() => handleInvite(item.uid, item.username)}
                    disabled={isInvited}
                >
                    {isInvited ? (
                        <MaterialIcons name="check" size={16} color={COLORS.muted} />
                    ) : (
                        <Text style={styles.inviteBtnText}>Invite</Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Invite Friends</Text>
                            <Text style={styles.subtitle}>to {teamName}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <MaterialIcons name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator color={COLORS.accent} />
                        </View>
                    ) : (
                        <FlatList
                            data={friends}
                            renderItem={renderFriendItem}
                            keyExtractor={item => item.uid}
                            contentContainerStyle={styles.list}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <MaterialIcons name="person-add" size={48} color={COLORS.muted} />
                                    <Text style={styles.emptyText}>No friends to invite.</Text>
                                    <Text style={styles.emptySubtext}>Add friends to invite them to your team!</Text>
                                </View>
                            }
                        />
                    )}

                    <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                        <Text style={styles.doneBtnText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

