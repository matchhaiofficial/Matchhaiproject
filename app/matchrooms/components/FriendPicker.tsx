import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";

import { AppIcon } from "../../../src/components/AppIcon";
import { AppBottomSheet, AppModalBody, AppModalFooter, AppModalHeader } from "../../../src/components/AppModalPrimitives";
import { AppButton } from "../../../src/components/AppPrimitives";
import { useAuth } from "../../../src/context/AuthContext";
import { getUserFriends, getUserProfile } from "../../../src/services/userService";
import { COLORS } from "../../../src/theme";

interface FriendPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (friend: { uid: string; username: string; skillScore?: number }, role: string) => void;
    game: string;
    matchroomRoles?: Array<{ role: string; count: number; filled: number }>;
}

const clampRating = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const FriendRow = React.memo(function FriendRow({
    friend,
    onSelectFriend,
}: {
    friend: { uid: string; username: string; skillScore?: number };
    onSelectFriend: (friend: { uid: string; username: string; skillScore?: number }) => void;
}) {
    const handleSelect = useCallback(() => {
        onSelectFriend(friend);
    }, [friend, onSelectFriend]);

    return (
        <Pressable style={styles.friendItem} onPress={handleSelect}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                    {friend.username ? friend.username.charAt(0).toUpperCase() : "?"}
                </Text>
            </View>
            <Text style={styles.friendName}>{friend.username}</Text>
            <AppIcon name="chevron-right" size={20} color={COLORS.muted} />
        </Pressable>
    );
});

export default function FriendPicker({ visible, onClose, onSelect, game, matchroomRoles }: FriendPickerProps) {
    const { user } = useAuth();
    const [friends, setFriends] = useState<Array<{ uid: string; username: string; skillScore?: number }>>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFriend, setSelectedFriend] = useState<{ uid: string; username: string; skillScore?: number } | null>(null);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);

    useEffect(() => {
        if (visible && user) {
            void loadFriends();
        } else {
            setSelectedFriend(null);
            setSelectedRole(null);
            setSearchQuery("");
        }
    }, [visible, user]);

    const loadFriends = useCallback(async () => {
        if (!user?._id) return;
        setLoading(true);
        try {
            const res = await getUserFriends(user._id);
            if (res.ok) {
                const friendsWithScores = await Promise.all(res.data.map(async (f) => {
                    const username = f.fullName || f.username || "Unknown";
                    const profileRes = await getUserProfile(f._id);
                    let score = 50;
                    if (profileRes.ok) {
                        const skillScores = profileRes.data.skillScores as any;
                        const skillData = skillScores?.[game];
                        if (skillData && typeof skillData.rating === "number") score = clampRating(skillData.rating);
                    }
                    return { uid: f.uid, username, skillScore: score };
                }));
                setFriends(friendsWithScores);
            }
        } catch (e) {
            console.error("FriendPicker", "Error loading friends", e);
        } finally {
            setLoading(false);
        }
    }, [game, user?._id]);

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredFriends = useMemo(() => {
        if (!normalizedSearch) return friends;
        return friends.filter((f) => f.username.toLowerCase().includes(normalizedSearch));
    }, [friends, normalizedSearch]);

    const keyExtractor = useCallback((item: { uid: string }) => item.uid, []);

    const handleSelectFriend = useCallback((friend: { uid: string; username: string; skillScore?: number }) => {
        setSelectedFriend(friend);
    }, []);

    const renderFriendItem = useCallback(({ item }: { item: { uid: string; username: string; skillScore?: number } }) => {
        return <FriendRow friend={item} onSelectFriend={handleSelectFriend} />;
    }, [handleSelectFriend]);

    const handleConfirm = useCallback(() => {
        if (selectedFriend && (selectedRole || !matchroomRoles?.length)) {
            onSelect(selectedFriend, selectedRole || "Flex");
        }
    }, [matchroomRoles?.length, onSelect, selectedFriend, selectedRole]);

    const canConfirm = Boolean(selectedFriend && (selectedRole || !matchroomRoles?.length));
    const confirmDisabled = !canConfirm;

    const handleChooseDifferent = useCallback(() => {
        setSelectedFriend(null);
    }, []);

    return (
        <AppBottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
            <AppModalHeader
                title={selectedFriend ? "Confirm Teammate" : "Invite Teammate"}
                onClose={onClose}
            />

            {!selectedFriend ? (
                <AppModalBody scroll contentContainerStyle={styles.bodyContent}>
                    <View style={styles.searchBar}>
                        <AppIcon name="search" size={20} color={COLORS.muted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search friends..."
                            placeholderTextColor={COLORS.muted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {loading ? (
                        <ActivityIndicator style={styles.loadingIndicator} color={COLORS.accent} />
                    ) : (
                        <FlatList
                            data={filteredFriends}
                            keyExtractor={keyExtractor}
                            renderItem={renderFriendItem}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No friends found</Text>
                            }
                            style={styles.list}
                        />
                    )}
                </AppModalBody>
            ) : (
                <>
                    <AppModalBody contentContainerStyle={styles.bodyContent}>
                        <View style={styles.roleSelection}>
                            <View style={styles.confirmationCard}>
                                <View style={styles.avatarLarge}>
                                    <Text style={styles.avatarTextLarge}>{selectedFriend.username ? selectedFriend.username.charAt(0).toUpperCase() : "?"}</Text>
                                </View>
                                <Text style={styles.confirmName}>{selectedFriend.username}</Text>
                                <Text style={styles.confirmSub}>Will be added to your squad booking.</Text>
                            </View>
                        </View>
                    </AppModalBody>
                    <AppModalFooter style={styles.footer}>
                        <View style={styles.actions}>
                            <AppButton variant="secondary" style={styles.actionButton} onPress={handleChooseDifferent}>
                                Choose Different
                            </AppButton>
                            <AppButton style={styles.actionButton} onPress={handleConfirm} disabled={confirmDisabled}>
                                Add to Booking
                            </AppButton>
                        </View>
                    </AppModalFooter>
                </>
            )}
        </AppBottomSheet>
    );
}

const styles = StyleSheet.create({
    sheet: {
        minHeight: "62%",
        maxHeight: "88%",
    },
    bodyContent: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.cardBackground,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        color: COLORS.text,
        fontSize: 16,
    },
    friendItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.accent + "30",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    avatarText: {
        color: COLORS.accent,
        fontWeight: "bold",
        fontSize: 16,
    },
    friendName: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
    },
    list: {
        maxHeight: 400,
    },
    emptyText: {
        color: COLORS.muted,
        textAlign: "center",
        marginVertical: 40,
    },
    loadingIndicator: {
        margin: 40,
    },
    roleSelection: {
        marginTop: 10,
    },
    confirmationCard: {
        alignItems: "center",
        padding: 30,
        backgroundColor: COLORS.cardBackground,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.overlayLight,
    },
    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.accent + "20",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 15,
    },
    avatarTextLarge: {
        fontSize: 32,
        fontWeight: "bold",
        color: COLORS.accent,
    },
    confirmName: {
        fontSize: 22,
        fontWeight: "bold",
        color: COLORS.text,
        marginBottom: 5,
    },
    confirmSub: {
        fontSize: 14,
        color: COLORS.muted,
    },
    actions: {
        flexDirection: "row",
        gap: 12,
    },
    footer: {
        paddingHorizontal: 24,
    },
    actionButton: {
        flex: 1,
    }
});
