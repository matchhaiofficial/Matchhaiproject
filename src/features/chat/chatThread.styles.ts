import { StyleSheet } from "react-native";

import {
    COLORS,
    FONTS,
    RADII,
    SHADOWS,
    SPACING,
} from "../../theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    screenContent: {
        flex: 1,
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
    },
    flex1: {
        flex: 1,
    },
    shell: {
        flex: 1,
        marginHorizontal: SPACING.md,
        marginTop: SPACING.sm,
        marginBottom: SPACING.sm,
        borderRadius: 24,
        backgroundColor: "transparent",
        ...SHADOWS.cardElevated,
    },
    shellSurface: {
        flex: 1,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        overflow: "hidden",
        backgroundColor: COLORS.cardDark,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: COLORS.cardBorder,
    },

    // -------- Header --------
    header: {
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.md,
        backgroundColor: COLORS.cardDark,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.md,
    },
    headerAction: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.overlayLight,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    headerAvatarWrap: {
        minWidth: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    headerAvatarFallback: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    headerAvatarStack: {
        flexDirection: "row",
        alignItems: "center",
    },
    headerAvatarStackItem: {
        // borderWidth on the avatar image provides the stack separator
    },
    headerAvatarStackItemOffset: {
        marginLeft: -12,
    },
    headerAvatarOverflow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.surface,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: COLORS.cardDark,
    },
    headerAvatarOverflowText: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 11,
    },
    avatarBase: {
        backgroundColor: "rgba(66,165,245,0.18)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        overflow: "hidden",
    },
    avatarText: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 14,
    },
    headerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 18,
    },
    headerSubtitle: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 11,
        marginTop: 2,
    },
    headerTypingSubtitle: {
        color: COLORS.accent,
        fontFamily: FONTS.body,
        fontSize: 11,
        marginTop: 2,
        fontStyle: "italic",
    },
    headerPresenceSubtitle: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 11,
        marginTop: 2,
    },

    // -------- Thread --------
    keyboardShell: {
        flex: 1,
    },
    threadContent: {
        flex: 1,
        minHeight: 0,
        backgroundColor: COLORS.backgroundDark,
    },
    messageList: {
        flex: 1,
    },
    messageListDismissLayer: {
        flex: 1,
    },
    listContent: {
        flexGrow: 1,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        gap: SPACING.md,
        backgroundColor: COLORS.backgroundDark,
    },
    contextCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: 20,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        marginBottom: SPACING.md,
    },
    dayDivider: {
        alignSelf: "center",
        paddingHorizontal: SPACING.md,
        paddingVertical: 4,
        borderRadius: RADII.pill,
        backgroundColor: COLORS.overlayLight,
        marginVertical: SPACING.sm,
    },
    dayDividerText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 11,
    },

    // -------- Message row --------
    row: {
        flexDirection: "row",
        width: "100%",
        alignItems: "flex-end",
        gap: SPACING.xs,
    },
    rowMine: {
        justifyContent: "flex-end",
    },
    rowOther: {
        justifyContent: "flex-start",
    },
    rowActionDots: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 18,
    },
    bubbleWrap: {
        maxWidth: "78%",
    },
    messagePressable: {
        borderRadius: 22,
    },
    bubble: {
        borderRadius: 22,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm + 2,
    },
    bubbleMine: {
        backgroundColor: COLORS.accent,
        borderBottomRightRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
    },
    bubbleOther: {
        backgroundColor: COLORS.surface,
        borderBottomLeftRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    bubbleTextMine: {
        color: "#ffffff",
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 20,
    },
    bubbleTextOther: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 20,
    },
    bubbleFooter: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
        paddingHorizontal: 4,
    },
    bubbleFooterMine: {
        justifyContent: "flex-end",
    },
    bubbleFooterOther: {
        justifyContent: "flex-start",
    },
    relativeTimeText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 10,
    },
    seenText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 10,
    },
    editedTag: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 10,
        fontStyle: "italic",
    },
    deletedText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 13,
        fontStyle: "italic",
    },
    typingBubbleRow: {
        flexDirection: "row",
        justifyContent: "flex-start",
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.xs,
        paddingBottom: SPACING.sm,
    },
    typingBubble: {
        minWidth: 96,
        borderRadius: 20,
        borderBottomLeftRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    typingBubbleText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 13,
    },

    // -------- Reply card inside bubble --------
    replyCard: {
        marginBottom: SPACING.xs,
        borderRadius: 14,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        backgroundColor: "rgba(255,255,255,0.18)",
    },
    replyCardOther: {
        backgroundColor: COLORS.overlayLight,
    },
    replyLabel: {
        fontFamily: FONTS.heading,
        fontSize: 10,
        marginBottom: 2,
    },
    replyLabelMine: {
        color: "#ffffff",
    },
    replyLabelOther: {
        color: COLORS.text,
    },
    replySnippetMine: {
        color: "rgba(255,255,255,0.88)",
        fontFamily: FONTS.body,
        fontSize: 11,
    },
    replySnippetOther: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 11,
    },

    // -------- Voice bubble (kept for VoiceMessageBubble) --------
    voiceCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
        minWidth: 190,
    },
    voiceButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.2)",
    },
    voiceButtonOther: {
        backgroundColor: COLORS.overlayLight,
    },
    voiceButtonFailed: {
        backgroundColor: "rgba(239,83,80,0.16)",
        borderWidth: 1,
        borderColor: "rgba(239,83,80,0.4)",
    },
    voiceButtonDisabled: {
        opacity: 0.5,
    },
    waveform: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
    },
    waveformBar: {
        width: 4,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.72)",
    },
    waveformBarOther: {
        backgroundColor: COLORS.textSecondary,
    },
    waveformBarActive: {
        opacity: 1,
    },
    waveformBarFailed: {
        backgroundColor: "rgba(239,83,80,0.72)",
    },
    voiceMeta: {
        alignItems: "flex-end",
        minWidth: 48,
    },
    voiceDurationMine: {
        color: "#ffffff",
        fontFamily: FONTS.heading,
        fontSize: 11,
    },
    voiceDurationOther: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 11,
    },
    voiceStatusMine: {
        marginTop: 2,
        color: "rgba(255,255,255,0.82)",
        fontFamily: FONTS.body,
        fontSize: 10,
    },
    voiceStatusOther: {
        marginTop: 2,
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 10,
    },

    // -------- Reaction quick picker --------
    reactionPickerWrap: {
        marginBottom: SPACING.xs,
    },
    reactionPickerMine: {
        alignItems: "flex-end",
    },
    reactionPickerOther: {
        alignItems: "flex-start",
    },

    // -------- Composer --------
    composerShell: {
        backgroundColor: COLORS.cardDark,
        borderTopColor: COLORS.cardBorder,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderLeftColor: COLORS.cardBorder,
        borderRightColor: COLORS.cardBorder,
        borderBottomColor: COLORS.cardBorder,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        minHeight: 76,
        overflow: "visible",
    },
    composerContent: {
        width: "100%",
    },
    composerReply: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: COLORS.overlayLight,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    composerEditBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
        backgroundColor: "rgba(66,165,245,0.10)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(66,165,245,0.25)",
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    composerReplyTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 11,
    },
    composerReplyText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 11,
        marginTop: 2,
    },
    composerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
        width: "100%",
        minHeight: 56,
        marginBottom: SPACING.sm,
    },
    composerInputWrap: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        minHeight: 52,
        maxHeight: 130,
        borderRadius: 28,
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
    },
    composerInput: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: 15,
        minHeight: 36,
        paddingVertical: 0,
    },
    composerSendAction: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.overlayLight,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    composerSendActionActive: {
        backgroundColor: COLORS.accent,
        borderColor: "rgba(255,255,255,0.16)",
        ...SHADOWS.accentSoft,
    },
    composerSendActionDisabled: {
        opacity: 0.55,
    },
    recordActive: {
        backgroundColor: "rgba(239,83,80,0.14)",
        borderColor: "rgba(239,83,80,0.35)",
    },
    recordingPill: {
        alignSelf: "flex-start",
        marginBottom: SPACING.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
        borderRadius: RADII.pill,
        backgroundColor: "rgba(66,165,245,0.12)",
        borderWidth: 1,
        borderColor: "rgba(66,165,245,0.28)",
    },
    recordingText: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: 11,
    },

    // -------- Image bubble --------
    imageBubble: {
        width: 220,
        height: 180,
        borderRadius: RADII.md,
        marginBottom: SPACING.xs,
        backgroundColor: COLORS.overlayLight,
    },

    // -------- File bubble --------
    fileBubble: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
        minWidth: 180,
    },
    fileBubbleMeta: {
        flex: 1,
    },
    fileNameMine: {
        color: "#ffffff",
        fontFamily: FONTS.heading,
        fontSize: 13,
    },
    fileNameOther: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 13,
    },
    fileSizeMine: {
        color: "rgba(255,255,255,0.72)",
        fontFamily: FONTS.body,
        fontSize: 11,
        marginTop: 2,
    },
    fileSizeOther: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 11,
        marginTop: 2,
    },

    // -------- Image preview modal --------
    imagePreviewBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.9)",
        alignItems: "center",
        justifyContent: "center",
    },
    imagePreviewFull: {
        width: "92%",
        height: "80%",
    },

    // -------- Composer attachment + emoji actions --------
    composerIconAction: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.overlayLight,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    composerEmojiAction: {
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
    },

    // -------- Empty / loading --------
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.xl,
    },
    emptyTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 18,
        marginTop: SPACING.sm,
    },
    emptySubtitle: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 13,
        textAlign: "center",
        marginTop: 6,
        lineHeight: 20,
    },
});
