import { StyleSheet } from "react-native";
import { COLORS, RADII, SPACING, TEXT_SIZES } from "../../../src/theme";

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.screenPadding,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.background,
    },
    noZoneContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    noZoneText: {
        color: COLORS.text,
        fontSize: 18,
    },
    registerButton: {
        marginTop: 16,
    },
    registerButtonText: {
        color: COLORS.accent,
    },
    header: {
        marginBottom: SPACING.xxl,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerTextContainer: {
        flex: 1,
    },
    headerLabel: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.heading,
        fontWeight: "bold",
        marginTop: SPACING.xs,
    },
    logoutButton: {
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1,
        borderColor: COLORS.divider,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: RADII.sm,
    },
    logoutButtonText: {
        color: COLORS.error,
        fontWeight: '600',
        fontSize: TEXT_SIZES.label,
    },
    statusContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: SPACING.sm,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        color: COLORS.muted,
    },
    statusValue: {
        color: COLORS.text,
        textTransform: "capitalize",
    },
    statsGrid: {
        flexDirection: "row",
        gap: SPACING.md,
        marginBottom: SPACING.xxl,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.cardBackground,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    statIcon: {
        marginBottom: SPACING.sm,
    },
    statValue: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: "bold",
    },
    statLabel: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
    },
    section: {
        marginBottom: SPACING.xxl,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "600",
        marginBottom: SPACING.md,
    },
    emptyState: {
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.xl,
        borderRadius: RADII.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.divider,
        borderStyle: 'dashed',
    },
    emptyStateIcon: {
        marginBottom: SPACING.sm,
    },
    emptyStateTitle: {
        color: COLORS.text,
        fontWeight: 'bold',
        marginBottom: SPACING.xs,
        fontSize: TEXT_SIZES.body,
    },
    emptyStateText: {
        color: COLORS.muted,
        textAlign: 'center',
        fontSize: TEXT_SIZES.label,
    },
    requestCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.md,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.accent,
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    gameBadge: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: RADII.sm,
    },
    gameBadgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: TEXT_SIZES.caption,
    },
    sendOfferButton: {
        backgroundColor: COLORS.success,
        padding: SPACING.md,
        borderRadius: RADII.sm,
        alignItems: 'center',
    },
    sendOfferText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: TEXT_SIZES.body,
    },
    userName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontWeight: '600',
        marginBottom: SPACING.xs,
    },
    requestDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginBottom: SPACING.xs,
    },
    requestDetailText: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.label,
    },
    branchHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    viewAllLink: {
        color: COLORS.accent,
    },
    branchCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    branchInfoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    branchName: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "bold",
    },
    branchLocation: {
        color: COLORS.muted,
        marginTop: 4,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.divider,
        marginVertical: 16,
    },
    gamesContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    gameChip: {
        backgroundColor: "rgba(255,255,255,0.05)",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
    },
    gameChipText: {
        color: COLORS.text,
        fontSize: 12,
        textTransform: "capitalize",
    },
});
