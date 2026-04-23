import React from "react";
import { View } from "react-native";

import { AppButton } from "../../../components/AppPrimitives";
import styles from "./VenueDetails.styles";

export default function VenuePrimaryActionBar({
  onCreateMatchroom,
}: {
  onCreateMatchroom: () => void;
}) {
  return (
    <View style={styles.actionBar}>
      <View style={styles.actionBarCard}>
        <AppButton leadingIcon="sports-esports" onPress={onCreateMatchroom}>
          Book Venue
        </AppButton>
      </View>
    </View>
  );
}
