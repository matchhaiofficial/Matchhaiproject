import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { memo } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { Matchroom } from "../../../src/services/matchService";
import { COLORS } from "../../../src/theme";
import { isRoomFull, isRoomLocked } from "../../../src/utils/matchroomLifecycle";
import styles from "../matchrooms.styles";

interface MatchroomCardProps {
    room: Matchroom;
}

const MatchroomCard = memo(({ room }: MatchroomCardProps) => {
    const router = useRouter();
    // ... rest of the logic remains the same

    // Check if room is locked/full
    const isLocked = isRoomLocked(room);
    const isFull = isRoomFull(room);

    // Prepare Roles/Skills for display
    const displayRoles: string[] = [];
    let isSkillTag = false;

    const openSlots = [...(room.slotsA || []), ...(room.slotsB || [])].filter(s => s.status === 'open');
    const rolesNeeded = openSlots.reduce((acc, s) => {
        if (s.role) {
            acc[s.role] = (acc[s.role] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const rolesNeededList = Object.entries(rolesNeeded);

    if (rolesNeededList.length > 0) {
        rolesNeededList.forEach(([role, count]) => {
            displayRoles.push(`NEEDS ${role}`);
        });
    } else {
        // Show Skill Level
        isSkillTag = true;
        if (room.hostSkillTier && room.hostSkillTier !== 'Any') {
            displayRoles.push(room.hostSkillTier);
        } else if (room.skillLevel) {
            displayRoles.push(room.skillLevel);
        }
    }

    // Limit to 2 tags
    const tagsToShow = displayRoles.slice(0, 2);
    const remainingCount = displayRoles.length - 2;

    const handlePress = () => {
        router.push({ pathname: "/matchrooms/[id]" as any, params: { id: room.id! } });
    };

    // Format Time (12h)
    let timeDisplay = 'Flexible Time';
    if (room.scheduledTime) {
        const [h, m] = room.scheduledTime.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        timeDisplay = `${h12}:${String(m).padStart(2, '0')} ${period}`;
    } else if (room.startTime?.seconds) {
        timeDisplay = new Date(room.startTime.seconds * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // Format Location (Mock distance for now, or use location name)
    const locationDisplay = room.location || 'Online';
    // Helper to mock distance if location is a string (real app would calc distance)
    const distanceDisplay = locationDisplay.length > 15 ? locationDisplay.substring(0, 15) + '...' : locationDisplay;


    return (
        <TouchableOpacity
            style={styles.nearbyCard}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            {/* Row 1: Game Name, Skill Score & Lock Badge */}
            <View style={[styles.nearbyTitleRow, { marginBottom: 6 }]}>
                <Text style={[styles.nearbyGame, { marginBottom: 0 }]}>{room.game}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {/* LOCKED/FULL Badge */}
                    {isLocked && (
                        <View style={styles.lockBadge}>
                            <MaterialIcons name="lock" size={10} color="#FFF" />
                            <Text style={styles.lockBadgeText}>
                                {isFull ? 'FULL' : 'LOCKED'}
                            </Text>
                        </View>
                    )}
                    {room.hostSkillScore !== undefined && room.hostSkillScore !== null && (
                        <View style={styles.matchScoreBadge}>
                            <MaterialIcons name="local-fire-department" size={12} color="#FFF" />
                            <Text style={styles.matchScoreText}>{room.hostSkillScore}%</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Row 2: Title & Book Slot Button */}
            <View style={styles.nearbyTitleRow}>
                <Text style={styles.nearbyTitle} numberOfLines={1}>{room.title}</Text>
                <TouchableOpacity style={styles.bookSlotBtn} onPress={handlePress}>
                    <Text style={styles.bookSlotText}>View</Text>
                </TouchableOpacity>
            </View>

            {/* Row 3: Location & Time */}
            <View style={styles.nearbyInfoRow}>
                <View style={styles.nearbyDistance}>
                    <MaterialIcons name="location-on" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.nearbyDistanceText}>{distanceDisplay}</Text>
                </View>
                <View style={styles.nearbyTime}>
                    <MaterialIcons name="schedule" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.nearbyTimeText}>{timeDisplay}</Text>
                </View>
            </View>

            {/* Row 4: Roles & Price */}
            <View style={styles.nearbyBottomRow}>
                <View style={styles.roleRow}>
                    {tagsToShow.map((tag, index) => (
                        <View key={index} style={isSkillTag ? styles.skillTag : styles.roleTag}>
                            <Text style={isSkillTag ? styles.skillText : styles.roleText}>{tag}</Text>
                        </View>
                    ))}
                    {remainingCount > 0 && (
                        <Text style={styles.moreRolesText}>+{remainingCount}</Text>
                    )}
                    {/* If no tags, maybe show format? */}
                    {tagsToShow.length === 0 && room.format && (
                        <View style={styles.skillTag}>
                            <Text style={styles.skillText}>{room.format}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.priceTagContainer}>
                    <Text style={styles.priceTagText}>
                        {room.pricing?.perPlayer && room.pricing.perPlayer > 0 ? `₨ ${room.pricing.perPlayer}` : 'FREE'}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
});

export default MatchroomCard;
