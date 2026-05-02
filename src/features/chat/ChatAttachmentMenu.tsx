import React from "react";
import { Modal, Platform, Pressable, Text, View, StyleSheet } from "react-native";

import { AppIcon } from "../../components/AppIcon";
import { COLORS, FONTS, RADII, SHADOWS, SPACING } from "../../theme";

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
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent={Platform.OS === "android"}
            navigationBarTranslucent={false}
            onRequestClose={onClose}
        >
            <Pressable style={menuStyles.backdrop} onPress={onClose}>
                <View style={menuStyles.sheet}>
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
                </View>
            </Pressable>
        </Modal>
    );
}

const menuStyles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: COLORS.cardDark,
        borderTopLeftRadius: RADII.lg,
        borderTopRightRadius: RADII.lg,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.xl + 12,
        gap: SPACING.sm,
        ...SHADOWS.cardElevated,
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
