import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import MatchroomCard from "../../../../app/matchrooms/components/MatchroomCard";
import { convex } from "../../../../src/lib/convex";
import { useAuth } from "../../../../src/context/AuthContext";
import { useMyActiveMatchroomRoomStates } from "../../../../src/hooks/useMatchroomData";
import { useMatchroomJoinFlow } from "../../../../src/hooks/useMatchroomJoinFlow";
import { useToast } from "../../../../src/hooks/useToast";
import { cancelBookingIntent } from "../../../../src/services/convex/bookingService";
import {
  Matchroom,
  cancelMatchJoinRequest,
} from "../../../../src/services/convex/matchService";
import { COLORS } from "../../../../src/theme";
import Logger from "../../../../src/utils/logger";
import { recordPayloadMetric } from "../../../../src/utils/perfInstrumentation";
import type { MatchroomFilters } from "../filterConfig";
import {
  DiscoverEmptyState,
  DiscoverResultsCount,
  discoverSharedStyles,
} from "./DiscoverShared";
import styles from "../styles/matchrooms.styles";

const isNoPendingRequestResult = (result: { ok: boolean; message?: string }) =>
  !result.ok && /no pending request found/i.test(result.message || "");

interface DiscoverMatchroomListProps {
  filters: MatchroomFilters;
  searchQuery: string;
  bottomPadding?: number;
}

const PAGE_SIZE = 40;
const MAX_DISCOVER_LIMIT = 1000;

const MatchroomRow = React.memo(function MatchroomRow({
  room,
  viewerUserId,
  activeRoomStatus,
  joiningRoomId,
  onJoin,
  onCancel,
}: {
  room: Matchroom;
  viewerUserId: string | undefined;
  activeRoomStatus: string | undefined;
  joiningRoomId: string | null;
  onJoin: (room: Matchroom) => void;
  onCancel: (room: Matchroom) => void;
}) {
  const roomId = String(room.id || room._id || "");
  const isJoined =
    Boolean(viewerUserId) &&
    (room.playerUids?.includes(viewerUserId as any) ||
      (room.players || []).some((player) => player.uid === viewerUserId));

  const handleJoin = useCallback(() => {
    onJoin(room);
  }, [onJoin, room]);

  const handleCancel = useCallback(() => {
    onCancel(room);
  }, [onCancel, room]);

  return (
    <MatchroomCard
      room={room}
      isRequested={Boolean(activeRoomStatus)}
      requestLabel={
        activeRoomStatus === "approved_pending_payment" ? "Pending Pay" : "Requested"
      }
      isJoined={isJoined}
      joining={joiningRoomId === roomId}
      onJoinPress={handleJoin}
      onCancelJoinPress={handleCancel}
    />
  );
});

export default function DiscoverMatchroomList({
  filters,
  searchQuery,
  bottomPadding,
}: DiscoverMatchroomListProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [rooms, setRooms] = useState<Matchroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);
  const [optimisticRoomStatuses, setOptimisticRoomStatuses] = useState<
    Record<string, string>
  >({});
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  const { roomStatuses, activeIntentIdsByRoom } = useMyActiveMatchroomRoomStates();
  const { startJoin, setupModal } = useMatchroomJoinFlow();

  const fetchRooms = useCallback(async (nextLimit = PAGE_SIZE, silent = false) => {
    if (!user) {
      setRooms([]);
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      setHasMore(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      const rows = await convex.query(api.discover.listDiscoverMatchrooms, {
        viewerUserId: user._id as any,
        selectedGame: filters.game,
        searchQuery,
        selectedSkill: filters.skill,
        selectedFormat: filters.format,
        selectedRole: filters.role,
        selectedSeries: filters.series,
        selectedOvers: filters.overs,
        selectedArea: filters.area,
        selectedSkillLevel: filters.skillLevel,
        selectedTimeline: filters.timeline,
        selectedOpenSlots: filters.openSlots,
        selectedPriceRange: filters.priceRange,
        limit: nextLimit,
      });
      setRooms(rows as Matchroom[]);
      setLimit(nextLimit);
      setHasMore(rows.length >= nextLimit && nextLimit < MAX_DISCOVER_LIMIT);
      recordPayloadMetric("discover.matchrooms_payload", rows, {
        game: filters.game,
        query: searchQuery,
      });
    } catch (error) {
      Logger.error("DiscoverMatchrooms", "Failed to fetch rooms", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [filters, searchQuery, user]);

  useEffect(() => {
    setOptimisticRoomStatuses((previous) => {
      const next = { ...previous };
      let changed = false;

      Object.keys(next).forEach((roomId) => {
        if (roomStatuses.has(roomId)) {
          delete next[roomId];
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [roomStatuses]);

  useEffect(() => {
    setLoading(true);
    fetchRooms(PAGE_SIZE);
  }, [fetchRooms]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRooms(PAGE_SIZE);
  }, [fetchRooms]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || refreshing || !hasMore) return;
    const nextLimit = Math.min(limit + PAGE_SIZE, MAX_DISCOVER_LIMIT);
    if (nextLimit <= limit) return;
    setLoadingMore(true);
    fetchRooms(nextLimit, true);
  }, [fetchRooms, hasMore, limit, loading, loadingMore, refreshing]);

  const handleRequestToJoin = useCallback(
    async (room: Matchroom) => {
      const roomId = String(room.id || room._id || "");
      setJoiningRoomId(roomId);

      try {
        await startJoin({
          room,
          onRequested: () => {
            if (!roomId) return;
            setOptimisticRoomStatuses((previous) => ({
              ...previous,
              [roomId]: "pending",
            }));
          },
        });
      } catch (error) {
        Logger.error("DiscoverMatchrooms", "Join request error", error);
        showToast({
          type: "error",
          title: "Error",
          message: "An unexpected error occurred.",
        });
      } finally {
        setJoiningRoomId(null);
      }
    },
    [showToast, startJoin],
  );

  const handleCancelRequestToJoin = useCallback(
    async (room: Matchroom) => {
      if (!user) return;

      try {
        const roomId = String(room.id || room._id || "");
        const results = await Promise.all([
          cancelMatchJoinRequest(room.id!, user._id),
          ...((activeIntentIdsByRoom.get(roomId) || []).map((intentId) =>
            cancelBookingIntent(intentId, user._id),
          )),
        ]);
        const failed = results.find((result) => !result.ok && !isNoPendingRequestResult(result));
        const hasSuccessfulCancellation = results.some((result) => result.ok);

        if (failed || (!hasSuccessfulCancellation && !results.every(isNoPendingRequestResult))) {
          showToast({
            type: "error",
            title: "Error",
            message: failed?.message || "Failed to cancel request.",
          });
          return;
        }

        setOptimisticRoomStatuses((previous) => {
          if (!roomId || !(roomId in previous)) {
            return previous;
          }

          const next = { ...previous };
          delete next[roomId];
          return next;
        });
      } catch (error) {
        Logger.error("DiscoverMatchrooms", "Cancel request error", error);
        showToast({
          type: "error",
          title: "Error",
          message: "An unexpected error occurred.",
        });
      }
    },
    [activeIntentIdsByRoom, showToast, user],
  );

  const contentContainerStyle = useMemo(
    () => [styles.listContent, { paddingBottom: bottomPadding ?? 24 }],
    [bottomPadding],
  );

  const effectiveRoomStatuses = useMemo(() => {
    const merged = new Map(roomStatuses);
    Object.entries(optimisticRoomStatuses).forEach(([roomId, status]) => {
      if (!merged.has(roomId) && status) {
        merged.set(roomId, status);
      }
    });
    return merged;
  }, [optimisticRoomStatuses, roomStatuses]);

  const roomStatusFingerprint = useMemo(() => {
    return JSON.stringify(
      Array.from(effectiveRoomStatuses.entries()).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  }, [effectiveRoomStatuses]);

  const renderItem = useCallback(
    ({ item }: { item: Matchroom }) => {
      const roomId = String(item.id || item._id || "");
      const activeRoomStatus = effectiveRoomStatuses.get(roomId);
      return (
        <MatchroomRow
          room={item}
          viewerUserId={user?._id}
          activeRoomStatus={activeRoomStatus}
          joiningRoomId={joiningRoomId}
          onJoin={handleRequestToJoin}
          onCancel={handleCancelRequestToJoin}
        />
      );
    },
    [effectiveRoomStatuses, handleCancelRequestToJoin, handleRequestToJoin, joiningRoomId, user?._id],
  );

  const keyExtractor = useCallback((item: Matchroom) => {
    return String(item.id || item._id || "");
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={discoverSharedStyles.shell}>
      <DiscoverResultsCount
        label={`${rooms.length} matchroom${rooms.length !== 1 ? "s" : ""} found`}
      />

      <FlatList
        data={rooms}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={roomStatusFingerprint}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={
          <DiscoverEmptyState
            icon="sports-esports"
            title="No matchrooms found"
            description="Try adjusting your search or filters, or be the first to create a matchroom."
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator size="small" color={COLORS.accent} />
            </View>
          ) : null
        }
      />

      {setupModal}
    </View>
  );
}
