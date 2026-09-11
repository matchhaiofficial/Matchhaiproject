import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import {
  AppBottomSheet,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../../src/components/AppModalPrimitives";
import { AppIcon } from "../../../src/components/AppIcon";
import { AppButton } from "../../../src/components/AppPrimitives";
import { COLORS } from "../../../src/theme";

const localStyles = StyleSheet.create({
  sheet: {
    minHeight: 0,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: "center",
  },
  avatarTextAccent: {
    color: COLORS.accent,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 14,
    gap: 8,
  },
  listContent: {
    paddingBottom: 8,
    gap: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 18,
  },
  inviteAction: {
    minWidth: 76,
  },
  inviteAllButton: {
    flexShrink: 0,
  },
});

const InviteRow = React.memo(function InviteRow({
  friend,
  disabled,
  invited,
  inviting,
  styles,
  onInvite,
}: {
  friend: any;
  disabled: boolean;
  invited: boolean;
  inviting: boolean;
  styles: any;
  onInvite: (friend: any) => void;
}) {
  const handleInvite = useCallback(() => {
    onInvite(friend);
  }, [friend, onInvite]);

  return (
    <View style={styles.friendItem}>
      <View style={styles.friendAvatar}>
        <Text style={[styles.avatarText, localStyles.avatarTextAccent]}>
          {friend.username?.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.friendName}>{friend.username}</Text>
      <AppButton
        variant={invited ? "success" : "primary"}
        style={[localStyles.inviteAction, !invited && styles.sendInviteButton]}
        onPress={handleInvite}
        disabled={disabled}
      >
        {inviting ? <ActivityIndicator size="small" color="#FFF" /> : invited ? "Invited" : "Invite"}
      </AppButton>
    </View>
  );
});

type Props = {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  friends: any[];
  joining: boolean;
  styles: any;
  inviteContextKey: string;
  onInvite: (friend: any) => Promise<boolean>;
};

export function MatchroomInviteSheet({
  visible,
  onClose,
  loading,
  friends,
  joining,
  styles,
  inviteContextKey,
  onInvite,
}: Props) {
  const [invitingFriendKey, setInvitingFriendKey] = useState<string | null>(null);
  const [invitedFriendKeys, setInvitedFriendKeys] = useState<Set<string>>(() => new Set());
  const [invitingAll, setInvitingAll] = useState(false);

  useEffect(() => {
    if (!visible) {
      setInvitingFriendKey(null);
      setInvitingAll(false);
    }
  }, [visible]);

  useEffect(() => {
    setInvitedFriendKeys(new Set());
  }, [inviteContextKey]);

  const keyExtractor = useCallback((item: any, index: number) => {
    return item.uid || item.friendId || item._id || item.id || `${item.username || "friend"}-${index}`;
  }, []);

  const handleInvite = useCallback(async (friend: any, friendKey: string) => {
    if (invitingFriendKey || invitingAll || invitedFriendKeys.has(friendKey)) return;

    setInvitingFriendKey(friendKey);
    try {
      const invited = await onInvite(friend);
      if (invited) {
        setInvitedFriendKeys((current) => new Set(current).add(friendKey));
      }
    } finally {
      setInvitingFriendKey((currentKey) => currentKey === friendKey ? null : currentKey);
    }
  }, [invitedFriendKeys, invitingAll, invitingFriendKey, onInvite]);

  const handleInviteAll = useCallback(async () => {
    if (invitingFriendKey || invitingAll || joining) return;

    const friendsToInvite = friends
      .map((friend, index) => ({ friend, friendKey: keyExtractor(friend, index) }))
      .filter(({ friendKey }) => !invitedFriendKeys.has(friendKey));

    if (friendsToInvite.length === 0) return;

    setInvitingAll(true);
    try {
      for (const { friend, friendKey } of friendsToInvite) {
        setInvitingFriendKey(friendKey);
        const invited = await onInvite(friend);
        if (invited) {
          setInvitedFriendKeys((current) => new Set(current).add(friendKey));
        }
      }
    } finally {
      setInvitingFriendKey(null);
      setInvitingAll(false);
    }
  }, [friends, invitedFriendKeys, invitingAll, invitingFriendKey, joining, keyExtractor, onInvite]);

  const renderFriendRow = useCallback((item: any, friendKey: string) => {
    const invited = invitedFriendKeys.has(friendKey);
    return (
      <InviteRow
        friend={item}
        disabled={invited || joining || invitingAll || Boolean(invitingFriendKey)}
        invited={invited}
        inviting={invitingFriendKey === friendKey}
        styles={styles}
        onInvite={(friend) => {
          void handleInvite(friend, friendKey);
        }}
      />
    );
  }, [handleInvite, invitedFriendKeys, invitingAll, invitingFriendKey, joining, styles]);

  const hasFriendsToInvite = friends.some(
    (friend, index) => !invitedFriendKeys.has(keyExtractor(friend, index)),
  );

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      dismissDisabled={invitingAll}
      sheetStyle={[styles.modalContent, localStyles.sheet]}
    >
      <AppModalHeader
        title="Invite Teammate"
        onClose={onClose}
        closeDisabled={invitingAll}
        alignItems="center"
        rightAccessory={friends.length > 0 ? (
          <AppButton
            size="sm"
            style={localStyles.inviteAllButton}
            onPress={() => {
              void handleInviteAll();
            }}
            disabled={!hasFriendsToInvite || joining || invitingAll || Boolean(invitingFriendKey)}
          >
            {invitingAll ? "Inviting..." : hasFriendsToInvite ? "Invite all" : "All invited"}
          </AppButton>
        ) : undefined}
      />
      <AppModalBody scroll contentContainerStyle={localStyles.bodyContent}>
        {loading ? (
          <View style={localStyles.loadingWrap}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : friends.length === 0 ? (
          <View style={styles.friendListEmpty}>
            <AppIcon
              name="person-add-disabled"
              size={48}
              color={COLORS.overlayMedium}
            />
            <Text style={styles.emptyModalText}>
              No friends found to invite.
            </Text>
          </View>
        ) : (
          <View style={localStyles.listContent}>
            {friends.map((friend, index) => {
              const friendKey = keyExtractor(friend, index);
              return (
                <View key={friendKey}>
                  {renderFriendRow(friend, friendKey)}
                </View>
              );
            })}
          </View>
        )}
      </AppModalBody>
      <AppModalFooter style={localStyles.footer}>
        <AppButton variant="secondary" onPress={onClose} disabled={invitingAll}>
          Done
        </AppButton>
      </AppModalFooter>
    </AppBottomSheet>
  );
}
