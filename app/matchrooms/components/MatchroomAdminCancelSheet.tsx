import React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AppBottomSheet,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../../src/components/AppModalPrimitives";
import { AppButton } from "../../../src/components/AppPrimitives";
import { COLORS } from "../../../src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  styles: any;
  adminProcessing: "accept" | "reject" | "counter" | "cancel" | null;
  adminCancelReasons: string[];
  adminCancelReason: string;
  setAdminCancelReason: (value: string) => void;
  adminCancelNote: string;
  setAdminCancelNote: (value: string) => void;
  onSubmit: () => void;
};

export function MatchroomAdminCancelSheet({
  visible,
  onClose,
  styles,
  adminProcessing,
  adminCancelReasons,
  adminCancelReason,
  setAdminCancelReason,
  adminCancelNote,
  setAdminCancelNote,
  onSubmit,
}: Props) {
  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      dismissDisabled={adminProcessing === "cancel"}
      sheetStyle={styles.modalContent}
    >
      <AppModalHeader
        title="Force Cancel Matchroom"
        subtitle="Select a reason for venue cancellation"
        onClose={onClose}
        closeDisabled={adminProcessing === "cancel"}
      />

      <AppModalBody
        scroll
        contentContainerStyle={styles.modalFormContent}
      >
        <View style={styles.modalSectionCard}>
          <Text style={styles.cardLabel}>Cancellation Reason</Text>
          <Text style={styles.modalHelperText}>
            Select the reason that best explains why this matchroom must be cancelled.
          </Text>
          <View style={styles.modalChipWrap}>
            {adminCancelReasons.map((reason) => (
              <Pressable
                key={reason}
                style={({ pressed }) => [
                  styles.reasonChip,
                  adminCancelReason === reason && styles.reasonChipActive,
                  pressed && { opacity: 0.88 },
                ]}
                onPress={() => setAdminCancelReason(reason)}
              >
                <Text
                  style={[
                    styles.reasonText,
                    adminCancelReason === reason && styles.reasonTextActive,
                  ]}
                >
                  {reason}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.modalSectionCard}>
          <Text style={styles.cardLabel}>Internal Note</Text>
          <Text style={styles.modalHelperText}>
            Add any context that should be shown to the players.
          </Text>
          <TextInput
            style={[styles.input, styles.modalTextArea]}
            placeholder="Any extra details for the players..."
            placeholderTextColor={COLORS.muted}
            multiline
            value={adminCancelNote}
            onChangeText={setAdminCancelNote}
            selectionColor={COLORS.accent}
          />
        </View>
      </AppModalBody>
      <AppModalFooter style={styles.modalFooter}>
        <View style={styles.modalActionsRow}>
          <AppButton
            variant="secondary"
            style={styles.modalActionButton}
            onPress={onClose}
            disabled={adminProcessing === "cancel"}
          >
            Cancel
          </AppButton>
          <AppButton
            variant="danger"
            style={styles.modalActionButton}
            onPress={onSubmit}
            disabled={adminProcessing === "cancel" || !adminCancelReason}
            loading={adminProcessing === "cancel"}
          >
            Confirm Cancellation
          </AppButton>
        </View>
      </AppModalFooter>
    </AppBottomSheet>
  );
}
