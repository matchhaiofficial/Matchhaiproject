import React from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import {
  AppBottomSheet,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../../../src/components/AppModalPrimitives";
import { AppIcon } from "../../../../src/components/AppIcon";
import {
  type ZoneBookingQueueItem,
} from "../../../../src/services/convex/zoneAdminBookingService";
import {
  type ZoneBranch,
} from "../../../../src/services/convex/zoneAdminResourceService";
import { COLORS } from "../../../../src/theme";
import styles from "../bookings.styles";

export type ZoneBookingAllocationResourceOption = {
  id: string;
  label: string;
  meta: string;
  resourceIds: string[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  processingAction: "accept" | "reject" | "counter" | null;
  request: ZoneBookingQueueItem | null;
  branches: ZoneBranch[];
  selectedBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
  branchLocked?: boolean;
  loadingResources: boolean;
  resources: ZoneBookingAllocationResourceOption[];
  selectedResourceIds: string[];
  onToggleResource: (resourceIds: string[]) => void;
  selectedCount: number;
  requiredCount: number;
  selectionSummary: string;
  validationMessage: string | null;
  canSubmit: boolean;
  onSubmit: () => void;
};

export function ZoneBookingsAllocationSheet({
  visible,
  onClose,
  processingAction,
  request,
  branches,
  selectedBranchId,
  onSelectBranch,
  branchLocked = false,
  loadingResources,
  resources,
  selectedResourceIds,
  onToggleResource,
  selectedCount,
  requiredCount,
  selectionSummary,
  validationMessage,
  canSubmit,
  onSubmit,
}: Props) {
  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      dismissDisabled={processingAction === "accept"}
      sheetStyle={styles.allocateSheet}
    >
      <AppModalHeader
        title="Allocate resources"
        subtitle="Select the branch and resources before accepting the booking."
        onClose={onClose}
        closeDisabled={processingAction === "accept"}
      />
      <AppModalBody scroll style={styles.allocateBodyScroll} contentContainerStyle={styles.allocateSheetBody}>
        <View style={styles.allocateSummaryCard}>
          <Text style={styles.allocateSheetTitle}>{request?.title || "Booking request"}</Text>
          <Text style={styles.allocateSheetMeta}>
            {String(request?.gameKey || "").toUpperCase()} | {selectionSummary}
          </Text>
          <Text style={styles.allocateSheetMeta}>
            {request?.preferredTime || "Time TBD"} | {request?.preferredAreas?.[0] || "Zone venue"}
          </Text>
          {request?.locationMode === "broadcast" ? (
            <>
              <Text style={styles.allocateSheetMeta}>
                Broadcast areas: {request.preferredAreas?.join(", ") || "None"}
              </Text>
              {request.responseExpiresAt ? (
                <Text style={styles.allocateSheetMeta}>
                  Respond by {new Date(request.responseExpiresAt).toLocaleString()}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.allocateBranchWrap}>
          <Text style={styles.allocateSectionLabel}>
            {branchLocked ? "Branch fixed for this request" : "Branch"}
          </Text>
          <FlatList
            data={branches}
            horizontal
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const selected = selectedBranchId === item.id;
              return (
                <Pressable
                  disabled={branchLocked}
                  onPress={() => onSelectBranch(item.id)}
                  style={[styles.allocateBranchChip, selected && styles.allocateBranchChipActive]}
                >
                  <Text
                    style={[styles.allocateBranchChipText, selected && styles.allocateBranchChipTextActive]}
                  >
                    {item.branchDisplayName}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        <View style={styles.allocateResourcesWrap}>
          <View style={styles.allocateResourcesHeader}>
            <Text style={styles.allocateSectionLabel}>Resources</Text>
            <Text style={styles.allocateSelectionCount}>
              {selectedCount}/{requiredCount}
            </Text>
          </View>
          {loadingResources ? (
            <View style={styles.allocateLoadingWrap}>
              <ActivityIndicator size="small" color={COLORS.accent} />
            </View>
          ) : (
            <FlatList
              data={resources}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.allocateResourceList}
              ListEmptyComponent={
                <Text style={styles.allocateEmptyText}>No available resources found for this branch.</Text>
              }
              renderItem={({ item }) => {
                const selected = item.resourceIds.every((resourceId) =>
                  selectedResourceIds.includes(resourceId),
                );
                return (
                  <Pressable
                    onPress={() => onToggleResource(item.resourceIds)}
                    style={[styles.allocateResourceCard, selected && styles.allocateResourceCardActive]}
                  >
                    <View style={styles.allocateResourceInfo}>
                      <Text style={styles.allocateResourceLabel}>{item.label}</Text>
                      <Text style={styles.allocateResourceMeta}>
                        {item.meta}
                      </Text>
                    </View>
                    <View style={[styles.allocateResourceTick, selected && styles.allocateResourceTickActive]}>
                      {selected ? <AppIcon name="check" size="sm" color="#FFF" /> : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        {validationMessage ? (
          <View style={styles.allocateWarningCard}>
            <AppIcon name="info-outline" size="sm" color={COLORS.warning} />
            <Text style={styles.allocateWarningText}>{validationMessage}</Text>
          </View>
        ) : null}
      </AppModalBody>
      <AppModalFooter style={styles.allocateFooter}>
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit || processingAction === "accept"}
          style={[
            styles.allocateSubmitButton,
            (!canSubmit || processingAction === "accept") && styles.allocateSubmitButtonDisabled,
          ]}
        >
          {processingAction === "accept" ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.allocateSubmitText}>Accept booking</Text>
          )}
        </Pressable>
      </AppModalFooter>
    </AppBottomSheet>
  );
}
