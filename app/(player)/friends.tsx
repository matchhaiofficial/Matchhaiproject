import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";

import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useAuth } from "../../src/context/AuthContext";
import { getUserFriends, getUserProfile } from "../../src/services/userService";
import type { UserProfile } from "../../src/services/userService";
import { COLORS } from "../../src/theme";
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

const getGamesFromProfile = (profile?: UserProfile) => {
  if (!profile) return [];
  const labels: string[] = [];
  if (profile.playsCs2) labels.push("CS2");
  if (profile.playsFc) labels.push("FC26");
  if (profile.playsTekken) labels.push("Tekken 8");
  if (profile.playsFutsal) labels.push("Futsal");
  if (profile.playsIndoorCricket) labels.push("Indoor Cricket");
  if (profile.playsPadel) labels.push("Padel");
  if (profile.playsPickleball) labels.push("Pickleball");
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

  const loadFriends = useCallback(
    async (showRefresh = false) => {
      if (!user?.uid) {
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
        const friendsResult = await getUserFriends(user.uid);
        if (!friendsResult.ok || !friendsResult.data) {
          setFriends([]);
          return;
        }

        const detailedFriends = await Promise.all(
          friendsResult.data.map(async (friend) => {
            const profileResult = await getUserProfile(friend.uid);
            const profile = profileResult.ok ? profileResult.data : undefined;
            const username =
              profile?.username ||
              profile?.displayName ||
              friend.username ||
              "Unknown";
            const avatarUri =
              `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=42a5f5&color=fff&size=128`;
            return {
              uid: friend.uid,
              username,
              isOnline: !!profile?.isOnline,
              games: getGamesFromProfile(profile),
              avatarUri,
            };
          }),
        );

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
    [user?.uid],
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
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadFriends(true)} tintColor={COLORS.accent} />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.summaryCard}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>Total Friends</Text>
                  <Text style={styles.summaryValue}>{friends.length}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryCol}>
                  <Text style={styles.summaryLabel}>Online</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.successBright }]}>
                    {onlineCount}
                  </Text>
                </View>
              </View>

              <View style={styles.searchWrap}>
                <MaterialIcons name="search" size={18} color={COLORS.textSecondary} />
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
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.friendCard,
                pressed && styles.friendCardPressed,
              ]}
              onPress={() => router.push(`/(player)/profile/${item.uid}` as any)}
            >
              <View style={styles.avatarWrap}>
                <Image source={{ uri: item.avatarUri }} style={styles.avatar} />
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
                    ? item.games.slice(0, 3).join(" • ")
                    : "Games listed on profile"}
                </Text>
              </View>

              <MaterialIcons
                name="chevron-right"
                size={22}
                color={COLORS.textSecondary}
              />
            </Pressable>
          )}
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
