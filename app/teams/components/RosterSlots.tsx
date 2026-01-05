import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
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
}

export default function RosterSlots({
    maxMembers,
    members,
    captainUid,
    viewerUid,
    isCaptain,
    game,
    onMemberPress
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
                    pressed && styles.pressed
                ]}
                onPress={() => onMemberPress?.(member)}
                disabled={!onMemberPress}
            >
                {/* Avatar */}
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {member.username.charAt(0).toUpperCase()}
                    </Text>
                    {isCaptainSlot && (
                        <View style={styles.captainBadge}>
                            <MaterialIcons name="star" size={12} color={COLORS.background} />
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
            <View key={`empty-${index}`} style={styles.emptySlot}>
                <View style={styles.emptyIcon}>
                    <MaterialIcons name="person-add-alt" size={20} color={COLORS.muted} />
                </View>
                <Text style={styles.emptyText}>Open</Text>
            </View>
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

