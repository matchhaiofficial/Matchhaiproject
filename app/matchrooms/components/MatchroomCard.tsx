import { useRouter } from "expo-router";
import React, { memo, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { AppIcon } from "../../../src/components/AppIcon";
import { useMinuteTicker } from "../../../src/hooks/useMinuteTicker";
import { Matchroom } from "../../../src/services/convex/matchService";
import { COLORS } from "../../../src/theme";
import { getRoomExpiresAt, getRoomLockAt, isRoomExpired, isRoomFull, isLeaveLocked } from "../../../src/utils/matchroomLifecycle";
import { getPrimaryLocationLabel, isBroadcastVenuePending } from "../utils/matchroomLocationDisplay";
import styles from "../matchrooms.styles";

interface MatchroomCardProps {
    room: Matchroom;
    isJoined?: boolean;
    onJoinPress?: () => void;
    onCancelJoinPress?: () => void;
    isRequested?: boolean;
    requestLabel?: string;
    joining?: boolean;
    onAcceptPress?: () => void;
    acceptLabel?: string;
    onPress?: () => void;
    containerStyle?: StyleProp<ViewStyle>;
}

const toValidDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value?.seconds === "number") {
        const parsed = new Date(value.seconds * 1000);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === "number") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};

const parseScheduledDateTime = (dateStr?: string | null, timeStr?: string | null): Date | null => {
    const date = String(dateStr || "").trim();
    const time = String(timeStr || "").trim();
    if (!date) return null;
    let base: Date | null = null;
    if (date.includes("/")) {
        const [day, month, year] = date.split("/").map(Number);
        base = new Date(year, month - 1, day);
    } else {
        base = toValidDate(date);
    }
    if (!base || Number.isNaN(base.getTime())) return null;
    const [hours, minutes] = time.split(":").map(Number);
    if (!Number.isNaN(hours)) base.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
    return base;
};

const localStyles = StyleSheet.create({
    cardPressed: {
        opacity: 0.92,
    },
    gameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    badgeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    expiryBadgeExpired: {
        backgroundColor: COLORS.error,
    },
    expiryBadgeDefault: {
        backgroundColor: COLORS.overlayMedium,
    },
    titleActionsRow: {
        flexDirection: "row",
        gap: 8,
    },
    actionPressed: {
        opacity: 0.88,
    },
});

const MatchroomCard = memo(({ room, onJoinPress, onCancelJoinPress, isRequested, requestLabel, joining, isJoined, onAcceptPress, acceptLabel, onPress, containerStyle }: MatchroomCardProps) => {
    const router = useRouter();
    const isWalkInRoom = String((room as any).bookingSource || "").toLowerCase() === "walkin";

    // "Locked" is time-based (within 24h of start, or zone-confirmed) and is
    // independent of "full". A full room is not locked until the 24h window.
    const isLocked = isLeaveLocked(room);
    const isFull = isRoomFull(room);
    const isExpired = isRoomExpired(room);
    const nowMs = useMinuteTicker();

    const formatCountdown = (ms: number) => {
        const total = Math.max(0, Math.floor(ms / 1000));
        const days = Math.floor(total / (24 * 3600));
        const hours = Math.floor((total % (24 * 3600)) / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const expiresAt = getRoomExpiresAt(room);
    const lockAt = getRoomLockAt(room);
    const expiryLabel = (() => {
        if (isExpired) return "EXPIRED";
        if (isLocked) return "LOCKED";
        if (isFull) {
            if (!lockAt) return null;
            const diff = lockAt.getTime() - nowMs;
            return diff <= 0 ? "LOCKED" : `LOCKS IN ${formatCountdown(diff)}`;
        }
        if (!expiresAt) return null;
        const diff = expiresAt.getTime() - nowMs;
        return diff <= 0 ? "EXPIRED" : `EXPIRES IN ${formatCountdown(diff)}`;
    })();

    const roleDemandSummary = useMemo(() => {
        const openSlots = [...(room.slotsA || []), ...(room.slotsB || [])].filter(
            (slot) => slot.status === "open"
        );

        if (openSlots.length === 0) {
            return null;
        }

        const roleCounts = new Map<string, number>();
        for (const slot of openSlots) {
            const role = String(slot.role || "Player").trim() || "Player";
            roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
        }

        const sortedRoles = Array.from(roleCounts.entries()).sort((left, right) => {
            if (right[1] !== left[1]) return right[1] - left[1];
            return left[0].localeCompare(right[0]);
        });

        const [topRole, topCount] = sortedRoles[0];
        const totalOpen = openSlots.length;
        const hasMultipleRoles = sortedRoles.length > 1;

        if (hasMultipleRoles || topCount !== 1) {
            return `${totalOpen}x ${topRole}`;
        }

        return topRole;
    }, [room.hostSkillTier, room.skillLevel, room.slotsA, room.slotsB]);

    const friendJoinedLabel = useMemo(() => {
        const total = Number(room.friendJoinedCount || 0);
        if (total <= 0) return null;
        return total === 1 ? "1 friend joined" : `${total} friends joined`;
    }, [room.friendJoinedCount]);

    const handlePress = () => {
        if (onPress) {
            onPress();
            return;
        }
        router.push({ pathname: "/matchrooms/[id]" as any, params: { id: room.id! } });
    };

    const timeDisplay = useMemo(() => {
        const getStartDate = () => {
            const startTime = toValidDate(room.startTime);
            if (startTime) return startTime;
            if (typeof room.scheduledStartAt === "number") {
                const scheduledStart = toValidDate(room.scheduledStartAt);
                if (scheduledStart) return scheduledStart;
            }
            const scheduled = parseScheduledDateTime(room.scheduledDate, room.scheduledTime);
            if (scheduled) return scheduled;
            if (room.scheduledTime) {
                const [hours, minutes] = room.scheduledTime.split(":").map(Number);
                if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
                    const fallback = new Date();
                    fallback.setHours(hours, minutes, 0, 0);
                    return fallback;
                }
            }
            return null;
        };

        const startDate = getStartDate();
        if (!startDate) return "Time not set";

        const durationMinutes = Number(
            room.durationMinutes ||
            (room.durationHours ? room.durationHours * 60 : 0) ||
            0,
        );
        const endDate = durationMinutes > 0
            ? new Date(startDate.getTime() + durationMinutes * 60 * 1000)
            : null;

        const startLabel = startDate.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

        if (!endDate) return startLabel;

        const endLabel = endDate.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

        return `${startLabel} - ${endLabel}`;
    }, [room.durationHours, room.durationMinutes, room.scheduledDate, room.scheduledStartAt, room.scheduledTime, room.startTime]);

    // Format Location (Mock distance for now, or use location name)
    const locationDisplay = getPrimaryLocationLabel(room);
    const isBroadcastPending = isBroadcastVenuePending(room);
    const distanceDisplay = locationDisplay.length > 15 ? locationDisplay.substring(0, 15) + '...' : locationDisplay;

    return (
        <Pressable
            style={({ pressed }) => [styles.nearbyCard, containerStyle, pressed && localStyles.cardPressed]}
            onPress={handlePress}
        >
            {/* Row 1: Game Name, Friend Count & Lock Badge */}
            <View style={[styles.nearbyTitleRow, { marginBottom: 6 }]}>
                <View style={localStyles.gameRow}>
                    <Text style={[styles.nearbyGame, { marginBottom: 0 }]}>{room.game}</Text>
                    {isWalkInRoom ? (
                        <View style={styles.walkInOnlyBadge}>
                            <Text style={styles.walkInOnlyBadgeText}>WALK-IN</Text>
                        </View>
                    ) : null}
                </View>
                <View style={localStyles.badgeRow}>
                    {isFull && (
                        <View style={styles.lockBadge}>
                            <AppIcon name="people" size={10} color="#FFF" />
                            <Text style={styles.lockBadgeText}>FULL</Text>
                        </View>
                    )}
                    {!!expiryLabel && (
                        <View style={[styles.lockBadge, isExpired ? localStyles.expiryBadgeExpired : localStyles.expiryBadgeDefault]}>
                            <Text style={styles.lockBadgeText}>
                                {expiryLabel}
                            </Text>
                        </View>
                    )}
                    {friendJoinedLabel && (
                        <View style={styles.matchMetaBadge}>
                            <AppIcon name="groups-2" size={12} color={COLORS.text} />
                            <Text style={styles.matchMetaText}>{friendJoinedLabel}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Row 2: Title & Book Slot Button / Request Button */}
            <View style={styles.nearbyTitleRow}>
                <Text style={styles.nearbyTitle} numberOfLines={1}>{room.title}</Text>
                <View style={localStyles.titleActionsRow}>
                    {isJoined && (
                        <View style={styles.joinedBtn}>
                            <Text style={styles.joinedBtnText}>Joined</Text>
                        </View>
                    )}
                    {!isJoined && !isRequested && onJoinPress && (room.status !== 'in-progress' && room.status !== 'completed') && (
                        <Pressable
                            style={({ pressed }) => [styles.requestBtn, pressed && localStyles.actionPressed, joining && { opacity: 0.6 }]}
                            onPress={(e) => {
                                e.stopPropagation();
                                if (!joining) onJoinPress();
                            }}
                            disabled={joining}
                        >
                            {joining ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.requestBtnText}>Request</Text>
                            )}
                        </Pressable>
                    )}
                    {!isJoined && isRequested && onCancelJoinPress && (
                        <Pressable
                            style={({ pressed }) => [styles.acceptBtn, pressed && localStyles.actionPressed]}
                            onPress={(e) => {
                                e.stopPropagation();
                                onCancelJoinPress();
                            }}
                        >
                            <Text style={styles.acceptBtnText}>{requestLabel || "Pending"}</Text>
                        </Pressable>
                    )}
                    {onAcceptPress && (
                        <Pressable
                            style={({ pressed }) => [styles.acceptBtn, pressed && localStyles.actionPressed]}
                            onPress={(e) => {
                                e.stopPropagation();
                                onAcceptPress();
                            }}
                        >
                            <Text style={styles.acceptBtnText}>{acceptLabel || "Accept"}</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {/* Row 3: Location & Time */}
            <View style={styles.nearbyInfoRow}>
                <View style={styles.nearbyDistance}>
                    <AppIcon name="location-on" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.nearbyDistanceText}>
                        {isBroadcastPending ? `Areas: ${distanceDisplay}` : distanceDisplay}
                    </Text>
                </View>
                <View style={styles.nearbyTime}>
                    <AppIcon name="schedule" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.nearbyTimeText}>{timeDisplay}</Text>
                </View>
            </View>

            {/* Row 4: Roles & Price */}
            <View style={styles.nearbyBottomRow}>
                <View style={styles.roleRow}>
                    {roleDemandSummary ? (
                        <View style={styles.roleTag}>
                            <Text style={styles.roleText}>{roleDemandSummary}</Text>
                        </View>
                    ) : room.format ? (
                        <View style={styles.skillTag}>
                            <Text style={styles.skillText}>{room.format}</Text>
                        </View>
                    ) : null}
                </View>
                <View style={styles.priceTagContainer}>
                    <Text style={styles.priceTagText}>
                        {room.pricing?.perPlayer && room.pricing.perPlayer > 0 ? `Rs. ${room.pricing.perPlayer}` : 'FREE'}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
});

export default MatchroomCard;
