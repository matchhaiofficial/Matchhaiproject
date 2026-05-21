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
});

const InviteRow = React.memo(function InviteRow({
  friend,
  disabled,
  inviting,
  styles,
  onInvite,
}: {
  friend: any;
  disabled: boolean;
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
      <AppButton style={styles.sendInviteButton} onPress={handleInvite} disabled={disabled}>
        {inviting ? <ActivityIndicator size="small" color="#FFF" /> : "Invite"}
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
  onInvite: (friend: any) => Promise<void> | void;
};

export function MatchroomInviteSheet({
  visible,
  onClose,
  loading,
  friends,
  joining,
  styles,
  onInvite,
}: Props) {
  const [invitingFriendKey, setInvitingFriendKey] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setInvitingFriendKey(null);
    }
  }, [visible]);

  const keyExtractor = useCallback((item: any, index: number) => {
    return item.uid || item.friendId || item._id || item.id || `${item.username || "friend"}-${index}`;
  }, []);

  const handleInvite = useCallback(async (friend: any, friendKey: string) => {
    if (invitingFriendKey) return;

    setInvitingFriendKey(friendKey);
    try {
      await onInvite(friend);
    } finally {
      setInvitingFriendKey((currentKey) => currentKey === friendKey ? null : currentKey);
    }
  }, [invitingFriendKey, onInvite]);

  const renderFriendRow = useCallback((item: any, friendKey: string) => {
    return (
      <InviteRow
        friend={item}
        disabled={joining || Boolean(invitingFriendKey)}
        inviting={invitingFriendKey === friendKey}
        styles={styles}
        onInvite={(friend) => {
          void handleInvite(friend, friendKey);
        }}
      />
    );
  }, [handleInvite, invitingFriendKey, joining, styles]);

  return (
    <AppBottomSheet visible={visible} onClose={onClose} sheetStyle={[styles.modalContent, localStyles.sheet]}>
      <AppModalHeader title="Invite Teammate" onClose={onClose} />
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
        <AppButton variant="secondary" onPress={onClose}>
          Done
        </AppButton>
      </AppModalFooter>
    </AppBottomSheet>
  );
}
