import { StyleSheet } from 'react-native';
import { COLORS, CTA, FONTS, RADII, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  screenContent: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  header: {
    paddingTop: 0,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.backgroundDark,
  },
  headerGhostAction: {
    width: 40,
    height: 40,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flex: 1,
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.input,
    paddingVertical: 0,
    paddingHorizontal: SPACING.sm,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.inputBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonPressed: {
    opacity: 0.9,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: "#FFF",
    fontFamily: FONTS.heading,
    fontSize: 10,
    fontWeight: "700",
  },
  segmentTabs: {
    marginTop: SPACING.xs,
  },
  itemFiltersScroll: {
    flexGrow: 0,
    marginBottom: 0,
  },
  itemFiltersScrollSpaced: {
    marginTop: SPACING.md,
  },
  itemFiltersContent: {
    flexGrow: 1,
    paddingBottom: SPACING.sm,
  },
  optionChip: {
    minWidth: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: SPACING.sm,
  },
  optionChipActive: {
    backgroundColor: COLORS.cardDark,
    borderColor: COLORS.accent,
  },
  optionChipText: {
    color: COLORS.muted,
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  optionChipTextActive: {
    color: COLORS.text,
    fontWeight: "bold",
  },
  fabWrapper: {
    position: "absolute",
    right: 24,
    zIndex: 20,
    elevation: 12,
    pointerEvents: "box-none",
  },
  fab: {
    ...CTA.fabButton,
  },
  contentArea: {
    flex: 1,
  },
  segmentPanel: {
    flex: 1,
  },
  segmentPanelHidden: {
    display: "none",
  },
});

