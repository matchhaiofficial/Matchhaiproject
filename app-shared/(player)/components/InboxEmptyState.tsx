import React from "react";
import { Text, View } from "react-native";

import { AppIcon } from "../../../src/components/AppIcon";
import styles from "../inbox.styles";

type Props = {
  activeTab: "pending" | "resolved";
};

export function InboxEmptyState({ activeTab }: Props) {
  return (
    <View style={styles.emptyContent}>
      <View style={styles.emptyIconContainer}>
        <AppIcon name="inbox" size={40} tone="muted" />
      </View>
      <Text style={styles.emptyTitle}>All Caught Up!</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === "pending"
          ? "No new requests right now."
          : "You haven't resolved any notifications yet."}
      </Text>
    </View>
  );
}
