import React from "react";
import {
  ActivityIndicator,
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
import { AppIcon } from "../../../src/components/AppIcon";
import { AppButton } from "../../../src/components/AppPrimitives";
import { COLORS } from "../../../src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  dismissDisabled: boolean;
  styles: any;
  counterPrice: string;
  setCounterPrice: (value: string) => void;
  counterDateValue: Date;
  toDateDisplay: (value: Date) => string;
  toTimeDisplay: (value: Date) => string;
  counterExpiryMinutes: string;
  setCounterExpiryMinutes: (value: string) => void;
  counterMessage: string;
  setCounterMessage: (value: string) => void;
  adminProcessing: "accept" | "reject" | "counter" | "cancel" | null;
  onSubmit: () => void;
};

export function MatchroomSuggestSheet({
  visible,
  onClose,
  dismissDisabled,
  styles,
  counterPrice,
  setCounterPrice,
  counterDateValue,
  toDateDisplay,
  toTimeDisplay,
  counterExpiryMinutes,
  setCounterExpiryMinutes,
  counterMessage,
  setCounterMessage,
  adminProcessing,
  onSubmit,
}: Props) {
  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      dismissDisabled={dismissDisabled}
      sheetStyle={styles.modalContent}
    >
      <AppModalHeader
        title="Suggest Alternative"
        subtitle="Propose a different time or price"
        onClose={onClose}
        closeDisabled={dismissDisabled}
      />

      <AppModalBody
        scroll
        contentContainerStyle={styles.modalFormContent}
      >
        <View style={styles.modalSectionCard}>
          <Text style={styles.cardLabel}>Counter Price (PKR)</Text>
          <Text style={styles.modalHelperText}>Enter the updated venue price you want to propose.</Text>
          <TextInput
            value={counterPrice}
            onChangeText={setCounterPrice}
            keyboardType="numeric"
            style={styles.input}
            placeholder="e.g. 1500"
            placeholderTextColor={COLORS.muted}
          />
        </View>

        <View style={styles.modalSectionCard}>
          <Text style={styles.cardLabel}>Suggested Date & Time</Text>
          <Text style={styles.modalHelperText}>This will be sent as the proposed alternative booking slot.</Text>
          <View style={styles.suggestDateRow}>
            <View style={styles.suggestDateField}>
              <AppIcon
                name="calendar-today"
                size={16}
                color={COLORS.accent}
              />
              <Text style={styles.suggestDateFieldText}>
                {toDateDisplay(counterDateValue)}
              </Text>
            </View>
            <View style={styles.suggestDateField}>
              <AppIcon
                name="access-time"
                size={16}
                color={COLORS.accent}
              />
              <Text style={styles.suggestDateFieldText}>
                {toTimeDisplay(counterDateValue)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.modalSectionCard}>
          <Text style={styles.cardLabel}>Offer Expires In (Minutes)</Text>
          <Text style={styles.modalHelperText}>Choose how long the player should have to respond.</Text>
          <TextInput
            value={counterExpiryMinutes}
            onChangeText={setCounterExpiryMinutes}
            keyboardType="numeric"
            style={styles.input}
            placeholder="e.g. 15"
            placeholderTextColor={COLORS.muted}
          />
        </View>

        <View style={styles.modalSectionCard}>
          <Text style={styles.cardLabel}>Note to Player</Text>
          <Text style={styles.modalHelperText}>Add context to explain why this alternative works better.</Text>
          <TextInput
            value={counterMessage}
            onChangeText={setCounterMessage}
            style={[styles.input, styles.textArea]}
            placeholder="e.g. We have slots available at 10 PM instead..."
            placeholderTextColor={COLORS.muted}
            multiline
          />
        </View>
      </AppModalBody>
      <AppModalFooter style={styles.modalFooter}>
        <View style={styles.modalActionsRow}>
          <AppButton
            variant="secondary"
            style={styles.modalActionButton}
            onPress={onClose}
            disabled={adminProcessing === "counter"}
          >
            Cancel
          </AppButton>
          <AppButton
            style={styles.modalActionButton}
            onPress={onSubmit}
            disabled={adminProcessing === "counter"}
            loading={adminProcessing === "counter"}
          >
            Send Counter-Offer
          </AppButton>
        </View>
      </AppModalFooter>
    </AppBottomSheet>
  );
}
