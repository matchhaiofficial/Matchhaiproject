import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView, Share, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import { db } from "../../src/config/firebaseConfig";
import { useAuth } from "../../src/context/AuthContext";
import { leaveTeam, removeMember, requestToJoinTeam, respondToJoinRequest, transferCaptain } from "../../src/services/functions";
import { Team, deleteTeam, getUserTeams, updateTeamName, uploadTeamLogo } from "../../src/services/teamService";
import { getUserProfile } from "../../src/services/userService";
import { COLORS, SPACING } from "../../src/theme";
import Logger from "../../src/utils/logger";
import styles from "./[id].styles";
import InviteFriendsSheet from "./components/InviteFriendsSheet";
import RosterSlots from "./components/RosterSlots";

// Game max members mapping
const GAME_MAX_MEMBERS: Record<string, number> = {
    cs2: 5,
    fc25: 2,
    fc26: 2,
    tekken8: 2,
    padel: 2,
    pickleball: 2,
    futsal: 7,
    indoor_cricket: 8,
};

export default function TeamDetails() {
    const params = useLocalSearchParams();
    const { id } = params;
    const router = useRouter();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [team, setTeam] = useState<Team | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Join Request States
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [myPendingRequest, setMyPendingRequest] = useState<boolean>(false);

    // Rename States
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [newName, setNewName] = useState("");

    // Invite States
    const [showInviteSheet, setShowInviteSheet] = useState(false);
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';

    // Optimized fetchTeam: 1 doc read + 1 members query + 1 request check = 3 reads total
    const fetchTeam = async () => {
        if (!id || !user) return;
        try {
            // Read 1: Team doc
            const teamDoc = await getDoc(doc(db, 'teams', id as string));
            if (!teamDoc.exists()) {
                Alert.alert("Error", "Team not found");
                router.back();
                return;
            }

            const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;

            // Read 2: Members subcollection
            const membersSnapshot = await getDocs(
                query(
                    collection(db, 'teams', id as string, 'members')
                )
            );
            const members: any[] = [];
            membersSnapshot.forEach(doc => members.push({ ...doc.data() }));
            // Prefer subcollection members, but merge in memberUids if subcollection is incomplete/stale.
            const memberUids = Array.isArray(teamData.memberUids) ? teamData.memberUids : [];
            if (memberUids.length > 0) {
                const membersByUid = new Map<string, any>();
                members.forEach(m => {
                    if (m?.uid) membersByUid.set(m.uid, m);
                });
                teamData.members = memberUids.map(uid => {
                    const existing = membersByUid.get(uid);
                    if (existing) return existing;
                    return { uid, username: uid.slice(0, 6) + '…', role: 'member', joinedAt: null };
                });
            } else {
                teamData.members = members;
            }

            setTeam(teamData);

            // Read 3: Check if viewer has pending request (deterministic ID)
            if (!members.some(m => m.uid === user.uid)) {
                const requestId = `team_join_request_${id}_${user.uid}`;
                const requestDoc = await getDoc(doc(db, 'notifications', requestId));
                if (requestDoc.exists() && requestDoc.data()?.status === 'pending') {
                    setMyPendingRequest(true);
                } else {
                    setMyPendingRequest(false);
                }
            } else {
                setMyPendingRequest(false);
            }
        } catch (error) {
            Logger.error("TeamDetails", "Error fetching team", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTeam();
    }, [id, user]);

    // Role & Permission Checks
    const isMember = team?.members?.some(m => m.uid === user?.uid) || false;
    const isCaptain = team?.captainUid === user?.uid;
    const memberCount = team?.members?.length ?? team?.memberUids?.length ?? team?.memberCount ?? 0;
    const maxMembers = team ? (team.maxMembers || GAME_MAX_MEMBERS[team.game] || 5) : 0;
    const memberCountDisplay = maxMembers > 0 ? Math.min(memberCount, maxMembers) : memberCount;
    const isFull = team ? memberCountDisplay >= maxMembers : false;
    const isPrivate = team?.visibility === 'private';

    // Real-time Listeners (Captain only)
    useEffect(() => {
        if (!id || !user || !isCaptain) return;

        // Captain-only: listen to join requests
        const q = query(
            collection(db, "notifications"),
            where("type", "==", "team_join_request"),
            where("toUid", "==", user.uid),
            where("meta.teamId", "==", id),
            where("status", "==", "pending")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            list.sort((a, b) => {
                const timeA = a.createdAt?.toMillis?.() || 0;
                const timeB = b.createdAt?.toMillis?.() || 0;
                return timeB - timeA;
            });
            setPendingRequests(list);
        });

        return () => unsubscribe();
    }, [id, user, isCaptain]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchTeam();
    };

    const handleJoinRequest = async () => {
        if (!id || submitting || !user) return;

        // Check if user has set role for this game AND not already in a team for this game
        try {
            const profileRes = await getUserProfile(user.uid);
            if (!profileRes.ok) {
                Alert.alert("Error", "Could not load your profile.");
                return;
            }

            const profile = profileRes.data;
            let userRole;

            // Extract role based on game
            switch (team?.game) {
                case 'cs2':
                    userRole = profile.cs2Role;
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
                Alert.alert(
                    "Set your role first",
                    `Choose your role for ${team?.game?.toUpperCase()} to request teams.`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Set Role", onPress: () => router.push('/(player)/profile/edit' as any) }
                    ]
                );
                return;
            }

            // Check if user is already in a team for this game
            const userTeamsForGame = await getUserTeams(user.uid);
            if (userTeamsForGame.ok && userTeamsForGame.data) {
                const hasTeamInGame = userTeamsForGame.data.some(
                    t => t.game.toLowerCase() === team?.game.toLowerCase()
                );
                if (hasTeamInGame) {
                    Alert.alert(
                        "Already in a team",
                        `You can only join one team per game. Leave your current ${team?.game?.toUpperCase()} team first.`
                    );
                    return;
                }
            }
        } catch (e: any) {
            Logger.error("TeamDetails", "Error checking role", e);
            Alert.alert("Error", "Could not verify your role.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await requestToJoinTeam({ teamId: id as string });
            if (res.ok) {
                Alert.alert("Success", "Request sent to captain!");
                setMyPendingRequest(true);
            } else {
                Alert.alert("Error", res.message || "Failed to send request.");
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "Error sending request.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRespondRequest = async (notifId: string, decision: 'accept' | 'reject') => {
        setSubmitting(true);
        try {
            const res = await respondToJoinRequest({ notificationId: notifId, decision });
            if (res.ok) {
                if (decision === 'accept') {
                    fetchTeam(); // Refresh roster
                }
            } else {
                Alert.alert("Error", res.message || "Action failed.");
            }
        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveMemberAction = (memberUid: string, username: string) => {
        Alert.alert(
            "Remove Member",
            `Are you sure you want to remove ${username} from the team?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            const res = await removeMember({ teamId: id as string, memberUid });
                            if (res.ok) {
                                fetchTeam();
                            } else {
                                Alert.alert("Error", res.message || "Failed to remove.");
                            }
                        } catch (e: any) {
                            Alert.alert("Error", e.message);
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    const handleTransferAction = (memberUid: string, username: string) => {
        Alert.alert(
            "Transfer Captaincy",
            `Are you sure you want to transfer captaincy to ${username}? You will become a regular member.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Transfer",
                    style: "destructive",
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            const res = await transferCaptain({ teamId: id as string, newCaptainUid: memberUid });
                            if (res.ok) {
                                fetchTeam();
                            } else {
                                Alert.alert("Error", res.message || "Failed to transfer.");
                            }
                        } catch (e: any) {
                            Alert.alert("Error", e.message);
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    const handleDeleteAction = () => {
        Alert.alert(
            "Delete Team",
            "Are you sure you want to delete this team? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            const res = await deleteTeam(id as string);
                            if (res.ok) {
                                router.back();
                            } else {
                                Alert.alert("Error", res.message || "Failed to delete team.");
                            }
                        } catch (e: any) {
                            Alert.alert("Error", e.message);
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    const handleRenameTeam = async () => {
        if (!newName.trim() || !id) return;
        setSubmitting(true);
        try {
            const res = await updateTeamName(id as string, newName.trim());
            if (res.ok) {
                setShowRenameModal(false);
                fetchTeam();
            } else {
                Alert.alert("Error", res.message || "Failed to rename team.");
            }
        } catch (e: any) {
            Alert.alert("Error", e.message);
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
                setSubmitting(true);
                const res = await uploadTeamLogo(id as string, result.assets[0].uri);
                if (res.ok) {
                    fetchTeam();
                } else {
                    Alert.alert("Error", res.message || "Failed to upload logo.");
                }
            }
        } catch (e: any) {
            Logger.error("TeamDetails", "Error picking image", e);
            Alert.alert("Error", "Could not pick image.");
        } finally {
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
        Alert.alert(
            "Leave Team",
            `Are you sure you want to leave ${team?.name}? You will need to request to rejoin.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Leave",
                    style: "destructive",
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            const res = await leaveTeam({ teamId: id as string });
                            if (res.ok) {
                                Alert.alert("Success", "You have left the team.");
                                router.replace("/(player)/(tabs)/teams");
                            } else {
                                Alert.alert("Error", res.message || "Failed to leave team.");
                            }
                        } catch (e: any) {
                            Alert.alert("Error", e.message || "Error leaving team.");
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
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
            Alert.alert("Request Pending", "Your request is already pending captain approval.");
            return;
        }
        if (buttonState === 'full') {
            Alert.alert("Team Full", "This team is currently full.");
            return;
        }
        if (buttonState === 'private') {
            Alert.alert("Invite Only", "This team is private. Ask the captain for an invite.");
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

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader
                title="Team Details"
                onBack={() => router.back()}
                inlineTitle
                rightAction={(
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {isCaptain && (
                            <TouchableOpacity
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "team_header_delete" });
                                    }
                                }}
                                onPress={handleDeleteAction}
                                style={styles.headerIcon}
                                activeOpacity={0.85}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <MaterialIcons name="delete" size={24} color={COLORS.error} />
                            </TouchableOpacity>
                        )}
                        {isCaptain && (
                            <TouchableOpacity
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "team_header_invite" });
                                    }
                                }}
                                onPress={() => setShowInviteSheet(true)}
                                style={styles.headerIcon}
                                activeOpacity={0.85}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <MaterialIcons name="person-add" size={24} color={COLORS.accent} />
                            </TouchableOpacity>
                        )}
                        <Pressable
                            style={({ pressed }) => [
                                styles.headerIcon,
                                pressed && { opacity: 0.7 }
                            ]}
                            onPress={handleShare}
                            android_ripple={{ color: COLORS.overlayMedium, borderless: true, radius: 24 }}
                        >
                            <MaterialIcons name="share" size={24} color={COLORS.accent} />
                        </Pressable>
                    </View>
                )}
            />

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Team Info Section */}
                <View style={styles.teamHeader}>
                    <TouchableOpacity
                        onPress={handlePickLogo}
                        disabled={!isCaptain || submitting}
                        activeOpacity={0.8}
                        style={[styles.teamLogoLarge, isCaptain && styles.teamLogoLargeCaptain]}
                    >
                        {team.logoUrl ? (
                            <Image source={{ uri: team.logoUrl }} style={styles.teamLogoImage} />
                        ) : (
                            <Text style={styles.teamLogoTextLarge}>
                                {team.name.charAt(0).toUpperCase()}
                            </Text>
                        )}
                        {isCaptain && (
                            <View style={styles.logoEditBadge}>
                                <MaterialIcons name="photo-camera" size={14} color="#FFF" />
                            </View>
                        )}
                    </TouchableOpacity>
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
                                    pressed && { opacity: 0.7 }
                                ]}
                                android_ripple={{ color: COLORS.overlayMedium, borderless: true, radius: 20 }}
                            >
                                <MaterialIcons name="edit" size={20} color={COLORS.accent} />
                            </Pressable>
                        )}
                    </View>
                    <View style={styles.gameBadge}>
                        <Text style={styles.gameBadgeText}>{team.game.toUpperCase()}</Text>
                    </View>
                    {team.description && <Text style={styles.description}>{team.description}</Text>}

                    {/* Occupancy Indicator */}
                    <View style={styles.occupancyRow}>
                        <MaterialIcons name="people" size={16} color={COLORS.muted} />
                        <Text style={styles.occupancyText}>
                            {memberCountDisplay} / {maxMembers}
                        </Text>
                        {isFull && <Text style={styles.fullBadge}>FULL</Text>}
                    </View>

                    {/* Member Badge */}
                    {isMember && (
                        <View style={styles.memberBadge}>
                            <MaterialIcons name="check-circle" size={14} color={COLORS.success} />
                            <Text style={styles.memberBadgeText}>You're a member</Text>
                        </View>
                    )}
                </View>

                {/* Stats */}
                <View style={styles.statsCard}>
                    <Text style={styles.statsTitle}>Team Stats</Text>
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
                </View>

                {/* Captain's Request Section */}
                {isCaptain && pendingRequests.length > 0 && (
                    <View style={styles.requestSection}>
                        <Text style={styles.requestTitle}>Join Requests ({pendingRequests.length})</Text>
                        {pendingRequests.map(req => (
                            <View key={req.id} style={styles.requestCard}>
                                <View style={styles.requestHeader}>
                                    <Text style={styles.requestUser}>{req.fromUsername}</Text>
                                    <Text style={styles.snapshotText}>{req.meta.requesterSnapshot?.city || 'No city'}</Text>
                                </View>
                                <View style={styles.requestSnapshot}>
                                    <Text style={styles.snapshotText}>
                                        Tier: {req.meta.requesterSnapshot?.skillTier?.[team.game] || 'Unranked'}
                                        {req.meta.requesterSnapshot?.stats?.faceitLevel ? ` • Faceit Lvl ${req.meta.requesterSnapshot.stats.faceitLevel}` : ''}
                                    </Text>
                                </View>
                                <View style={styles.requestActions}>
                                    <TouchableOpacity
                                        style={styles.acceptBtn}
                                        onPress={() => handleRespondRequest(req.id, 'accept')}
                                        disabled={submitting}
                                    >
                                        <Text style={styles.actionText}>Accept</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.rejectBtn}
                                        onPress={() => handleRespondRequest(req.id, 'reject')}
                                        disabled={submitting}
                                    >
                                        <Text style={styles.rejectText}>Decline</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Roster Slots (Slot Grid) */}
                <View style={styles.rosterSection}>
                    <Text style={styles.rosterTitle}>Lineup</Text>
                    <RosterSlots
                        maxMembers={maxMembers}
                        members={team.members || []}
                        captainUid={team.captainUid}
                        viewerUid={user?.uid}
                        isCaptain={isCaptain}
                        game={team.game}
                        onEmptySlotPress={handleEmptySlotPress}
                        onMemberPress={isCaptain ? (member) => {
                            if (member.uid !== user?.uid) {
                                Alert.alert(
                                    member.username,
                                    "Choose an action",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "Transfer Captaincy",
                                            onPress: () => handleTransferAction(member.uid, member.username)
                                        },
                                        {
                                            text: "Remove from Team",
                                            style: "destructive",
                                            onPress: () => handleRemoveMemberAction(member.uid, member.username)
                                        }
                                    ]
                                );
                            }
                        } : undefined}
                    />
                </View>
                <View style={styles.footerSpacer} />
            </ScrollView>

            {/* Action Bar */}
            {isMember && !isCaptain && (
                <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom + 12, SPACING.lg) }]}>
                    <TouchableOpacity
                        onPressIn={() => {
                            if (touchDebugEnabled) {
                                Logger.debug("TouchDebug", "pressIn", { tag: "team_leave" });
                            }
                        }}
                        onPress={handleLeaveTeam}
                        disabled={submitting}
                        style={[styles.leaveButton, submitting && { opacity: 0.6 }]}
                        activeOpacity={0.85}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.leaveButtonText}>Leave Team</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Action Bar (Non-Members Only) */}
            {!isMember && (
                <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom + 12, SPACING.lg) }]}>
                    {buttonState === 'eligible' && (
                        <>
                            <TouchableOpacity
                                onPressIn={() => {
                                    if (touchDebugEnabled) {
                                        Logger.debug("TouchDebug", "pressIn", { tag: "team_request_join" });
                                    }
                                }}
                                onPress={handleJoinRequest}
                                disabled={submitting}
                                style={[styles.actionButton, submitting && styles.actionButtonDisabled]}
                                activeOpacity={0.85}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={styles.actionButtonText}>Request to Join</Text>
                            </TouchableOpacity>
                            <Text style={styles.helperText}>Captain approval required. You'll see updates in Inbox.</Text>
                        </>
                    )}
                    {buttonState === 'requested' && (
                        <>
                            <View style={styles.actionButtonDisabled}>
                                <ActivityIndicator size="small" color={COLORS.warning} style={styles.headerIcon} />
                                <Text style={styles.actionButtonTextDisabled}>Requested</Text>
                            </View>
                            <Text style={styles.helperText}>Waiting for captain approval</Text>
                        </>
                    )}
                    {buttonState === 'full' && (
                        <>
                            <View style={styles.actionButtonDisabled}>
                                <Text style={styles.actionButtonTextDisabled}>Full</Text>
                            </View>
                            <Text style={styles.helperText}>This lineup is complete.</Text>
                        </>
                    )}
                    {buttonState === 'private' && (
                        <>
                            <View style={styles.actionButtonDisabled}>
                                <Text style={styles.actionButtonTextDisabled}>Invite Only</Text>
                            </View>
                            <Text style={styles.helperText}>This team requires an invite.</Text>
                        </>
                    )}
                </View>
            )}

            {/* Rename Modal */}
            <Modal
                visible={showRenameModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRenameModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: COLORS.surfaceHighlight, padding: 24, borderRadius: 16, width: '85%', borderWidth: 1, borderColor: COLORS.divider }}>
                        <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>Rename Team</Text>
                        <TextInput
                            style={{ backgroundColor: COLORS.background, color: COLORS.text, padding: 14, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: COLORS.inputBorder, fontSize: 16 }}
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="Enter new team name"
                            placeholderTextColor={COLORS.muted}
                            autoFocus
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20 }}>
                            <TouchableOpacity onPress={() => setShowRenameModal(false)}>
                                <Text style={{ color: COLORS.muted, fontSize: 16 }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleRenameTeam} disabled={submitting}>
                                {submitting ? (
                                    <ActivityIndicator size="small" color={COLORS.accent} />
                                ) : (
                                    <Text style={{ color: COLORS.accent, fontSize: 16, fontWeight: 'bold' }}>Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Invite Friends Sheet */}
            <InviteFriendsSheet
                visible={showInviteSheet}
                onClose={() => setShowInviteSheet(false)}
                teamId={id as string}
                teamName={team.name}
            />
        </Screen>
    );
}
