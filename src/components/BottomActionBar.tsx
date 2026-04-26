import React from "react";
import {
    Platform,
    StyleSheet,
    View,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../theme";

type BottomActionBarProps = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    minBottomInset?: number;
    onLayout?: (event: LayoutChangeEvent) => void;
};

export default function BottomActionBar({
    children,
    style,
    contentStyle,
    minBottomInset,
    onLayout,
}: BottomActionBarProps) {
    const insets = useSafeAreaInsets();
    const resolvedMinBottomInset =
        minBottomInset ?? (Platform.OS === "android" ? SPACING.lg : SPACING.sm);

    return (
        <View
            onLayout={onLayout}
            style={[
                styles.container,
                {
                    paddingBottom: Math.max(insets.bottom, resolvedMinBottomInset),
                },
                style,
            ]}
        >
            <View style={[styles.content, contentStyle]}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexShrink: 0,
        width: "100%",
        position: "relative",
        zIndex: 40,
        elevation: 24,
        overflow: "visible",
        backgroundColor: COLORS.cardDark,
        borderTopWidth: 1,
        borderTopColor: COLORS.overlayLight,
    },
    content: {
        width: "100%",
        alignSelf: "stretch",
        paddingTop: SPACING.md,
        padding: SPACING.screenPadding,
        paddingBottom: 0,
    },
});
