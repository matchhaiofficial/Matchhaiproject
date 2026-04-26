import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { AppIcon } from '../../../src/components/AppIcon';
import { COLORS } from '../../../src/theme';
import styles from './RosterSlots.styles';

interface Member {
    uid: string;
    username: string;
    role?: string;
    roleForGame?: string;
}

interface RosterSlotsProps {
    maxMembers: number;
    members: Member[];
    captainUid: string;
    viewerUid?: string;
    isCaptain: boolean;
    game: string;
    onMemberPress?: (member: Member) => void;
    onEmptySlotPress?: () => void;
}

export default function RosterSlots({
    maxMembers,
    members,
    captainUid,
    viewerUid,
    isCaptain,
    game,
    onMemberPress,
    onEmptySlotPress
}: RosterSlotsProps) {

    // Pad with empty slots
    const slots = Array.from({ length: maxMembers }, (_, index) => {
        return members[index] || null;
    });

    const renderMember = (member: Member) => {
        const isCaptainSlot = member.uid === captainUid;
        const isViewer = member.uid === viewerUid;

        return (
            <Pressable
                key={`member-${member.uid}`}
                style={({ pressed }) => [
                    styles.memberCard,
                    isCaptainSlot && styles.captainCard,
                    pressed && Platform.OS === 'ios' && styles.pressed
                ]}
                onPress={() => onMemberPress?.(member)}
                disabled={!onMemberPress}
                android_ripple={{ color: COLORS.overlayMedium }}
            >
                {/* Avatar */}
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {member.username.charAt(0).toUpperCase()}
                    </Text>
                    {isCaptainSlot && (
                        <View style={styles.captainBadge}>
                            <AppIcon name="star" size={12} color={COLORS.backgroundDark} />
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.memberInfo}>
                    <Text style={styles.memberName} numberOfLines={1}>
                        {member.username}
                    </Text>

                    {member.roleForGame && (
                        <View style={styles.roleContainer}>
                            <Text style={styles.roleText} numberOfLines={1}>
                                {member.roleForGame}
                            </Text>
                        </View>
                    )}

                    {isViewer && (
                        <View style={styles.youBadge}>
                            <Text style={styles.youText}>YOU</Text>
                        </View>
                    )}
                </View>
            </Pressable>
        );
    };

    const renderEmptySlot = (index: number) => {
        return (
            <Pressable
                key={`empty-${index}`}
                style={({ pressed }) => [
                    styles.emptySlot,
                    pressed && Platform.OS === 'ios' && styles.pressed
                ]}
                onPress={() => onEmptySlotPress?.()}
                disabled={!onEmptySlotPress}
                android_ripple={{ color: COLORS.overlayMedium }}
            >
                <View style={styles.emptyIcon}>
                    <AppIcon name="person-add-alt" size={20} color={COLORS.muted} />
                </View>
                <Text style={styles.emptyText}>Open</Text>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            {slots.map((member, index) => {
                if (member) {
                    return renderMember(member);
                }
                return renderEmptySlot(index);
            })}
        </View>
    );
}


