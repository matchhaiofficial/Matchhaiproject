import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
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
  loadingWrap: {
    padding: 40,
    alignItems: "center",
  },
  avatarTextAccent: {
    color: COLORS.accent,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  listContent: {
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: 24,
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

  const renderItem = useCallback(({ item }: { item: any }) => {
    return <InviteRow friend={item} joining={joining} styles={styles} onInvite={onInvite} />;
  }, [joining, onInvite, styles]);

  return (
    <AppBottomSheet visible={visible} onClose={onClose} sheetStyle={styles.modalContent}>
      <AppModalHeader title="Invite Teammate" onClose={onClose} />
      <AppModalBody scroll contentContainerStyle={localStyles.bodyContent}>
        {loading ? (
          <View style={localStyles.loadingWrap}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={keyExtractor}
            ListEmptyComponent={
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
            }
            renderItem={renderItem}
            contentContainerStyle={localStyles.listContent}
          />
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
