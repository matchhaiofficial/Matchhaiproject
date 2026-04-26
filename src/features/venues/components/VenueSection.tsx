import React, { type ReactNode } from "react";
import { Text, View } from "react-native";

import styles from "./VenueDetails.styles";

export default function VenueSection({
  title,
  helperText,
  children,
}: {
  title: string;
  helperText?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {helperText ? <Text style={styles.sectionHelper}>{helperText}</Text> : null}
      </View>
      {children}
    </View>
  );
}
