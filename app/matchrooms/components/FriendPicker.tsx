import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { getUserFriends, getUserProfile } from "../../../src/services/userService";
import { COLORS, SHADOWS } from "../../../src/theme";

interface FriendPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (friend: { uid: string; username: string; skillScore?: number }, role: string) => void;
    game: string;
    matchroomRoles?: Array<{ role: string; count: number; filled: number }>;
}

export default function FriendPicker({ visible, onClose, onSelect, game, matchroomRoles }: FriendPickerProps) {
    const { user } = useAuth();
    const [friends, setFriends] = useState<Array<{ uid: string; username: string; skillScore?: number }>>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFriend, setSelectedFriend] = useState<{ uid: string; username: string; skillScore?: number } | null>(null);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const clampRating = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

    useEffect(() => {
        if (visible && user) {
            loadFriends();
        } else {
            // Reset state when closing
            setSelectedFriend(null);
            setSelectedRole(null);
            setSearchQuery("");
        }
    }, [visible, user]);

    const loadFriends = async () => {
        setLoading(true);
        try {
            const res = await getUserFriends(user!.uid);
            if (res.ok) {
                // Fetch skill scores for the selected game for each friend
                const friendsWithScores = await Promise.all(res.data.map(async (f) => {
                    const profileRes = await getUserProfile(f.uid);
                    let score = 50; // Default
                    if (profileRes.ok) {
                        const skillScores = profileRes.data.skillScores as any;
                        const skillData = skillScores?.[game];
                        if (skillData && typeof skillData.rating === 'number') score = clampRating(skillData.rating);
                    }
                    return { ...f, skillScore: score };
                }));
                setFriends(friendsWithScores);
            }
        } catch (e) {
            console.error("FriendPicker", "Error loading friends", e);
        } finally {
            setLoading(false);
        }
    };

    const filteredFriends = friends.filter(f =>
        f.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleConfirm = () => {
        if (selectedFriend && (selectedRole || !matchroomRoles?.length)) {
            onSelect(selectedFriend, selectedRole || 'Flex');
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.sheet}>
                            <View style={styles.header}>
                                <Text style={styles.title}>
                                    {selectedFriend ? "Confirm Teammate" : "Invite Teammate"}
                                </Text>
                                <TouchableOpacity onPress={onClose}>
                                    <MaterialIcons name="close" size={24} color={COLORS.muted} />
                                </TouchableOpacity>
                            </View>

                            {!selectedFriend ? (
                                <>
                                    <View style={styles.searchBar}>
                                        <MaterialIcons name="search" size={20} color={COLORS.muted} />
                                        <TextInput
                                            style={styles.searchInput}
                                            placeholder="Search friends..."
                                            placeholderTextColor={COLORS.muted}
                                            value={searchQuery}
                                            onChangeText={setSearchQuery}
                                        />
                                    </View>

                                    {loading ? (
                                        <ActivityIndicator style={{ margin: 40 }} color={COLORS.accent} />
                                    ) : (
                                        <FlatList
                                            data={filteredFriends}
                                            keyExtractor={(item) => item.uid}
                                            renderItem={({ item }) => (
                                                <TouchableOpacity
                                                    style={styles.friendItem}
                                                    onPress={() => setSelectedFriend(item)}
                                                >
                                                    <View style={styles.avatar}>
                                                        <Text style={styles.avatarText}>{item.username ? item.username.charAt(0).toUpperCase() : '?'}</Text>
                                                    </View>
                                                    <Text style={styles.friendName}>{item.username}</Text>
                                                    <MaterialIcons name="chevron-right" size={20} color={COLORS.muted} />
                                                </TouchableOpacity>
                                            )}
                                            ListEmptyComponent={
                                                <Text style={styles.emptyText}>No friends found</Text>
                                            }
                                            style={{ maxHeight: 400 }}
                                        />
                                    )}
                                </>
                            ) : (
                                <View style={styles.roleSelection}>
                                    <View style={styles.confirmationCard}>
                                        <View style={styles.avatarLarge}>
                                            <Text style={styles.avatarTextLarge}>{selectedFriend.username ? selectedFriend.username.charAt(0).toUpperCase() : '?'}</Text>
                                        </View>
                                        <Text style={styles.confirmName}>{selectedFriend.username}</Text>
                                        <Text style={styles.confirmSub}>Will be added to your squad booking.</Text>
                                    </View>

                                    <View style={styles.actions}>
                                        <TouchableOpacity
                                            style={styles.backLink}
                                            onPress={() => setSelectedFriend(null)}
                                        >
                                            <View style={styles.secondaryBtnInner}>
                                                <Text style={styles.backLinkText}>Choose Different</Text>
                                            </View>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.confirmBtn}
                                            onPress={handleConfirm}
                                        >
                                            <Text style={styles.confirmBtnText}>Add to Booking</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        marginBottom: 15,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        color: COLORS.text,
        fontSize: 16,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.accent + '30',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: COLORS.accent,
        fontWeight: 'bold',
        fontSize: 16,
    },
    friendName: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
    },
    emptyText: {
        color: COLORS.muted,
        textAlign: 'center',
        marginVertical: 40,
    },
    roleSelection: {
        marginTop: 10,
    },
    confirmationCard: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: COLORS.background,
        borderRadius: 20,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: COLORS.overlayLight,
    },
    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.accent + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    avatarTextLarge: {
        fontSize: 32,
        fontWeight: 'bold',
        color: COLORS.accent,
    },
    confirmName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 5,
    },
    confirmSub: {
        fontSize: 14,
        color: COLORS.muted,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    backLink: {
        flex: 1,
    },
    secondaryBtnInner: {
        height: 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: 'transparent',
    },
    backLinkText: {
        color: COLORS.muted,
        fontSize: 14,
        fontWeight: '600',
    },
    confirmBtn: {
        flex: 1,
        height: 52,
        backgroundColor: COLORS.accent,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.cardSoft,
    },
    confirmBtnDisabled: {
        backgroundColor: COLORS.disabled,
        opacity: 0.6,
    },
    confirmBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    }
});
