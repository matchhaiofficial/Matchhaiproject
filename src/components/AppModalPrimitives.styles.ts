import { StyleSheet } from "react-native";

import { COLORS, FONTS, RADII, SHADOWS, SPACING } from "../theme";

export default StyleSheet.create({
  overlayBase: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  dialogOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  dialogFrame: {
    width: "100%",
    alignItems: "center",
  },
  dialogKeyboardAvoiding: {
    width: "100%",
  },
  dialogCard: {
    width: "100%",
    maxWidth: 560,
    flexShrink: 1,
    minHeight: 0,
    backgroundColor: COLORS.cardDark,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
    ...SHADOWS.cardElevated,
  },
  sheetOverlay: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  sheetKeyboardAvoiding: {
    flex: 1,
  },
  sheet: {
    flexShrink: 1,
    minHeight: 0,
    backgroundColor: COLORS.cardDark,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
    ...SHADOWS.cardElevated,
  },
  pickerSheet: {
    backgroundColor: COLORS.cardBackground,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.cardBorder,
    alignSelf: "center",
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  header: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.overlayLight,
  },
  headerCentered: {
    alignItems: "center",
  },
  headerTight: {
    paddingTop: SPACING.md,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 20,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 4,
  },
  bodyScroll: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  bodyScrollWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  bodyContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    flexShrink: 1,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.cardDark,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.overlayLight,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  drawerOverlay: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  drawerPanel: {
    flexShrink: 1,
    minHeight: 0,
    backgroundColor: COLORS.cardDark,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderRightWidth: 1,
    borderRightColor: COLORS.cardBorder,
    overflow: "hidden",
    ...SHADOWS.cardElevated,
  },
  drawerBackdrop: {
    flex: 1,
  },
  drawerKeyboardAvoiding: {
    flexShrink: 1,
    minHeight: 0,
  },
  // When keyboardAware=true the KAV introduces a column context. Without flex:1
  // the Animated.View is content-sized, causing the panel (flex:1 flexBasis:0)
  // to collapse to height 0 and clip all content behind overflow:hidden.
  // Adding flex:1 here lets the Animated.View fill the KAV's definite height
  // (which is the full screen height via alignSelf:stretch in the row parent).
  drawerAnimatedFill: {
    flex: 1,
  },
  drawerSafeArea: {
    flex: 1,
  },
});
