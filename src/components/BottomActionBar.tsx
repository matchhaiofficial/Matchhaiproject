import React from "react";
import {
    Platform,
    StyleSheet,
    View,
    useWindowDimensions,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../theme";
import { useScreenPadding } from "../hooks/useScreenPadding";

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
    const { width: windowWidth } = useWindowDimensions();
    const horizontalPadding = useScreenPadding();
    const resolvedMinBottomInset =
        minBottomInset ?? (Platform.OS === "android" ? SPACING.md : SPACING.sm);

    return (
        <View
            onLayout={onLayout}
            style={[
                styles.container,
                {
                    alignSelf: "center",
                    width: windowWidth,
                    paddingBottom: Math.max(insets.bottom, resolvedMinBottomInset),
                },
                style,
            ]}
        >
            <View
                style={[
                    styles.content,
                    { paddingHorizontal: horizontalPadding },
                    contentStyle,
                ]}
            >
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexShrink: 0,
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
        paddingBottom: 0,
    },
});
