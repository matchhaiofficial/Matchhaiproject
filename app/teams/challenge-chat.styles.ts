import { StyleSheet } from "react-native";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../src/theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    flex1: {
        flex: 1,
    },
    loaderWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    listContent: {
        padding: SPACING.screenPadding,
        gap: SPACING.sm,
    },
    messageRow: {
        flexDirection: "row",
    },
    messageRowMine: {
        justifyContent: "flex-end",
    },
    messageRowOther: {
        justifyContent: "flex-start",
    },
    bubble: {
        maxWidth: "82%",
        borderRadius: RADII.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderWidth: 1,
    },
    bubbleMine: {
        backgroundColor: "rgba(66,165,245,0.18)",
        borderColor: "rgba(66,165,245,0.45)",
    },
    bubbleOther: {
        backgroundColor: COLORS.cardDark,
        borderColor: COLORS.cardBorder,
    },
    senderName: {
        color: COLORS.muted,
        fontFamily: FONTS.heading,
        fontSize: 10,
        marginBottom: 2,
        textTransform: "uppercase",
    },
    messageText: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
        lineHeight: 20,
    },
    inputWrap: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.cardBorder,
        padding: SPACING.screenPadding,
        backgroundColor: COLORS.cardDark,
    },
    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.inputBackground,
        color: COLORS.text,
        borderRadius: RADII.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        fontFamily: FONTS.body,
    },
    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.accent,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
});

