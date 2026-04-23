import { StyleSheet } from "react-native";

import { COLORS, SPACING } from "../../../src/theme";

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  content: {
    gap: SPACING.lg,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionStack: {
    gap: SPACING.md,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  metricCard: {
    width: "47%",
  },
  infoStack: {
    gap: SPACING.sm,
  },
  compactActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  listTabs: {
    marginBottom: SPACING.xs,
  },
});
