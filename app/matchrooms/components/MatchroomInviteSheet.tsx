import React, { useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  },
  list: {
    flexGrow: 0,
    maxHeight: 320,
  },
  listContent: {
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 18,
  },
});

const InviteRow = React.memo(function InviteRow({
  friend,
  joining,
  styles,
  onInvite,
}: {
  friend: any;
  joining: boolean;
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
      <AppButton style={styles.sendInviteButton} onPress={handleInvite} disabled={joining}>
        Invite
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
  onInvite: (friend: any) => void;
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
  const keyExtractor = useCallback((item: any, index: number) => {
    return item.uid || item.id || `${item.username || "friend"}-${index}`;
  }, []);

  const renderFriendRow = useCallback((item: any) => {
    return <InviteRow friend={item} joining={joining} styles={styles} onInvite={onInvite} />;
  }, [joining, onInvite, styles]);

  const hasScrollableList = friends.length > 4;

  return (
    <AppBottomSheet visible={visible} onClose={onClose} sheetStyle={[styles.modalContent, localStyles.sheet]}>
      <AppModalHeader title="Invite Teammate" onClose={onClose} />
      <AppModalBody contentContainerStyle={localStyles.bodyContent}>
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
        ) : hasScrollableList ? (
          <ScrollView
            style={localStyles.list}
            contentContainerStyle={localStyles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {friends.map((friend, index) => (
              <View key={keyExtractor(friend, index)}>
                {renderFriendRow(friend)}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={localStyles.listContent}>
            {friends.map((friend, index) => (
              <View key={keyExtractor(friend, index)}>
                {renderFriendRow(friend)}
              </View>
            ))}
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
