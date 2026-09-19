import React from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import { COLORS, FONTS, SPACING, TEXT_SIZES } from "../../../src/theme";

type RegistrationFieldLabelProps = {
  label: string;
  required?: boolean;
  optional?: boolean;
  style?: StyleProp<TextStyle>;
};

export default function RegistrationFieldLabel({
  label,
  required = false,
  optional = false,
  style,
}: RegistrationFieldLabelProps) {
  return (
    <Text style={[styles.label, style]}>
      {label}
      {required ? <Text style={styles.required}> *</Text> : null}
      {optional ? <Text style={styles.optional}> (Optional)</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    color: "rgba(253, 253, 253, 0.85)",
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.label - 1,
    marginBottom: SPACING.xs,
  },
  required: {
    color: COLORS.error,
    fontFamily: FONTS.body,
  },
  optional: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
  },
});
