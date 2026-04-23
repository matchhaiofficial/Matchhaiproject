import React from "react";
import { Text } from "react-native";

import { AppCard } from "../../../components/AppPrimitives";
import styles from "./VenueDetails.styles";

export default function VenueEmptyCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AppCard variant="empty" style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{description}</Text>
    </AppCard>
  );
}
