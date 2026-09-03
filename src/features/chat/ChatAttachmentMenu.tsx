import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";

import { AppIcon } from "../../components/AppIcon";
import { AppBottomSheet, AppModalFooter, AppModalHeader } from "../../components/AppModalPrimitives";
import { COLORS, FONTS, RADII, SPACING } from "../../theme";

type ChatAttachmentMenuProps = {
    visible: boolean;
    onClose: () => void;
    onPickImage: () => void;
    onPickFile: () => void;
};

export default function ChatAttachmentMenu({
    visible,
    onClose,
    onPickImage,
    onPickFile,
}: ChatAttachmentMenuProps) {
    return (
        <AppBottomSheet
            visible={visible}
            onClose={onClose}
            sheetStyle={menuStyles.sheet}
        >
            <AppModalHeader title="Attach" onClose={onClose} />
            <AppModalFooter style={menuStyles.actions}>
                <Pressable
                    style={menuStyles.option}
                    onPress={() => {
                        onClose();
                        onPickImage();
                    }}
                >
                    <View style={menuStyles.optionIcon}>
                        <AppIcon name="photo" size={22} color={COLORS.accent} />
                    </View>
                    <Text style={menuStyles.optionLabel}>Photo</Text>
                </Pressable>
                <Pressable
                    style={menuStyles.option}
                    onPress={() => {
                        onClose();
                        onPickFile();
                    }}
                >
                    <View style={menuStyles.optionIcon}>
                        <AppIcon name="insert-drive-file" size={22} color={COLORS.accent} />
                    </View>
                    <Text style={menuStyles.optionLabel}>File</Text>
                </Pressable>
            </AppModalFooter>
        </AppBottomSheet>
    );
}

const menuStyles = StyleSheet.create({
    sheet: {
        backgroundColor: COLORS.cardDark,
    },
    actions: {
        paddingHorizontal: SPACING.lg,
        gap: SPACING.sm,
    },
    option: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.md,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.sm,
        borderRadius: RADII.md,
    },
    optionIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.overlayLight,
        alignItems: "center",
        justifyContent: "center",
    },
    optionLabel: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 16,
    },
});
