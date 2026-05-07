import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "../../convex/_generated/api";
import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { AppImage } from "../../src/components/AppImage";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useAuth } from "../../src/context/AuthContext";
import { useRouteLogger } from "../../src/hooks/useRouteLogger";
import { getUserFriends } from "../../src/services/userService";
import { COLORS, FONTS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import styles from "./friends.styles";

type FriendListItem = {
  uid: string;
  username: string;
  isOnline: boolean;
  games: string[];
  avatarUri: string;
};

type FriendFilter = "all" | "online" | "offline";

const getGamesFromFriend = (friend?: {
  playsCs2?: boolean;
  playsFc?: boolean;
  playsTekken?: boolean;
  playsFutsal?: boolean;
  playsIndoorCricket?: boolean;
  playsPadel?: boolean;
  playsPickleball?: boolean;
}) => {
  if (!friend) return [];
  const labels: string[] = [];
  if (friend.playsCs2) labels.push("CS2");
  if (friend.playsFc) labels.push("FC26");
  if (friend.playsTekken) labels.push("Tekken 8");
  // Physical sports are temporarily disabled.
  // if (friend.playsFutsal) labels.push("Futsal");
  // if (friend.playsIndoorCricket) labels.push("Indoor Cricket");
  // if (friend.playsPadel) labels.push("Padel");
  // if (friend.playsPickleball) labels.push("Pickleball");
  return labels;
};

export default function FriendsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FriendFilter>("all");
  useRouteLogger("FriendsScreen", {
    activeFilter,
    searchQueryLength: searchQuery.trim().length,
    userId: user?._id,
  });

  // Real-time unread counts per friend DM
  const dmUnreadCounts = useQuery(
    api.friendChat.getUnreadCounts,
    user?._id ? {} : "skip"
  ) || {};

  const loadFriends = useCallback(
    async (showRefresh = false) => {
      if (!user?._id) {
        setFriends([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const friendsResult = await getUserFriends(user._id);
        if (!friendsResult.ok || !friendsResult.data) {
          setFriends([]);
          return;
        }

        const detailedFriends = friendsResult.data.map((friend) => {
          const username = friend.fullName || friend.username || "Unknown";
          const avatarUri =
            friend.photoURL ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=42a5f5&color=fff&size=128`;
          return {
            uid: friend.uid,
            username,
            isOnline: !!friend.isOnline,
            games: getGamesFromFriend(friend),
            avatarUri,
          };
        });

        detailedFriends.sort((a, b) => {
          if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
          return a.username.localeCompare(b.username);
        });

        setFriends(detailedFriends);
      } catch (error) {
        Logger.error("Friends", "Failed to load friends", error);
        setFriends([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?._id],
  );

  useFocusEffect(
    useCallback(() => {
      loadFriends();
    }, [loadFriends]),
  );

  const onlineCount = useMemo(
    () => friends.filter((friend) => friend.isOnline).length,
    [friends],
  );
  const offlineCount = useMemo(
    () => Math.max(0, friends.length - onlineCount),
    [friends.length, onlineCount],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredFriends = useMemo(() => {
    return friends.filter((friend) => {
      if (activeFilter === "online" && !friend.isOnline) return false;
      if (activeFilter === "offline" && friend.isOnline) return false;
      if (!normalizedSearch) return true;
      return friend.username.toLowerCase().includes(normalizedSearch);
    });
  }, [friends, activeFilter, normalizedSearch]);

  const openFriendProfile = useCallback((uid: string) => {
    router.push(`/(player)/profile/${uid}` as any);
  }, [router]);

  const openFriendChat = useCallback((uid: string) => {
    router.push(`/(player)/friend-chat/${uid}` as any);
  }, [router]);

  const onRefresh = useCallback(() => {
    loadFriends(true);
  }, [loadFriends]);

  const keyExtractor = useCallback((item: FriendListItem) => item.uid, []);

  const renderFriendItem = useCallback(({ item }: { item: FriendListItem }) => {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.friendCard,
          pressed && styles.friendCardPressed,
        ]}
        onPress={() => openFriendProfile(item.uid)}
      >
        <View style={styles.avatarWrap}>
          <AppImage source={{ uri: item.avatarUri }} containerStyle={styles.avatar} />
          <View
            style={[
              styles.statusDot,
              item.isOnline ? styles.statusDotOnline : styles.statusDotOffline,
            ]}
          />
        </View>

        <View style={styles.friendInfo}>
          <Text style={styles.friendName} numberOfLines={1}>
            {item.username}
          </Text>
          <Text
            style={[
              styles.friendStatus,
              item.isOnline ? styles.onlineText : styles.offlineText,
            ]}
          >
            {item.isOnline ? "Online" : "Offline"}
          </Text>
          <Text style={styles.gamesText} numberOfLines={1}>
            {item.games.length > 0
              ? item.games.slice(0, 3).join(" | ")
              : "Games listed on profile"}
          </Text>
        </View>

        <Pressable
          style={styles.chatButton}
          onPress={(e) => { e.stopPropagation(); openFriendChat(item.uid); }}
          hitSlop={8}
        >
          <AppIcon name="chat" size={20} color={COLORS.accent} />
          {(dmUnreadCounts[item.uid] || 0) > 0 ? (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>
                {dmUnreadCounts[item.uid] > 99 ? "99+" : dmUnreadCounts[item.uid]}
              </Text>
            </View>
          ) : null}
        </Pressable>
        <AppIcon name="chevron-right" size={22} tone="muted" />
      </Pressable>
    );
  }, [dmUnreadCounts, openFriendChat, openFriendProfile]);

  const listHeader = useMemo(() => {
    return (
      <View>
        <View style={styles.summaryCard}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Total Friends</Text>
            <Text style={styles.summaryValue}>{friends.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Online</Text>
            <Text style={[styles.summaryValue, styles.summaryValueOnline]}>
              {onlineCount}
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <AppIcon name="search" size={18} tone="muted" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search friends by username"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <SegmentedTabs<FriendFilter>
          items={[
            { key: "all", label: "All", badge: friends.length },
            { key: "online", label: "Online", badge: onlineCount },
            { key: "offline", label: "Offline", badge: offlineCount },
          ]}
          value={activeFilter}
          onChange={setActiveFilter}
          style={styles.filterTabs}
          compact
        />
      </View>
    );
  }, [activeFilter, friends.length, offlineCount, onlineCount, searchQuery]);

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader title="My Friends" onBack={() => router.back()} inlineTitle />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredFriends}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
          }
          ListHeaderComponent={listHeader}
          renderItem={renderFriendItem}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {friends.length === 0 ? "No friends yet" : "No friends match this filter"}
              </Text>
              <Text style={styles.emptyText}>
                {friends.length === 0
                  ? "Add friends from Discover to see them here."
                  : "Try a different search or switch Online/Offline tabs."}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
