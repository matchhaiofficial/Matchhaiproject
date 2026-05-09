import React from "react";
import {
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useEntrance } from "../motion/useEntrance";
import { SPACING } from "../theme";
import { AppIcon } from "./AppIcon";
import styles from "./AppModalPrimitives.styles";

type BaseProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  dismissDisabled?: boolean;
  animationType?: "none" | "slide" | "fade";
};

type HeaderProps = {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  closeDisabled?: boolean;
  rightAccessory?: React.ReactNode;
  compact?: boolean;
};

export type AppDialogProps = BaseProps & {
  cardStyle?: StyleProp<ViewStyle>;
};

export type AppBottomSheetProps = BaseProps & {
  sheetStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export type AppPickerSheetProps = BaseProps & {
  sheetStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export type AppDrawerProps = BaseProps & {
  drawerStyle?: StyleProp<ViewStyle>;
};

type AppModalBodyProps = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

type AppModalFooterProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

function closeIfAllowed(onClose: () => void, dismissDisabled?: boolean) {
  if (!dismissDisabled) onClose();
}

export function AppModalHeader({
  title,
  subtitle,
  onClose,
  closeDisabled,
  rightAccessory,
  compact = false,
}: HeaderProps) {
  return (
    <View style={[styles.header, compact && styles.headerTight]}>
      <View style={styles.titleWrap}>
        <Text
          style={styles.title}
          numberOfLines={1}
          ellipsizeMode="tail"
          allowFontScaling={false}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAccessory}
      {onClose ? (
        <Pressable
          onPress={onClose}
          disabled={closeDisabled}
          style={styles.closeButton}
        >
          <AppIcon name="close" size="md" tone="muted" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function AppModalBody({
  children,
  scroll = false,
  style,
  contentContainerStyle,
}: AppModalBodyProps) {
  if (scroll) {
    return (
      <View style={[styles.bodyScrollWrap, style]}>
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={[styles.bodyContent, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.bodyContent, style, contentContainerStyle]}>
      {children}
    </View>
  );
}

export function AppModalFooter({ children, style }: AppModalFooterProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;

  return (
    <View
      style={[
        styles.footer,
        style,
        {
          paddingBottom: Math.max(SPACING.md, bottomInset + SPACING.md),
        },
      ]}
    >
      {children}
    </View>
  );
}

export function AppDialog({
  visible,
  onClose,
  children,
  dismissDisabled,
  animationType = "fade",
  cardStyle,
}: AppDialogProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomClearance = insets.bottom;
  const verticalChrome = SPACING.xl + bottomClearance + SPACING.md;
  const maxCardHeight = Math.floor(Math.min(windowHeight * 0.75, windowHeight - verticalChrome));
  const entrance = useEntrance({
    visible,
    axis: "y",
    distance: 18,
    initialScale: 0.98,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      statusBarTranslucent={Platform.OS === "android"}
      navigationBarTranslucent={false}
      onRequestClose={() => closeIfAllowed(onClose, dismissDisabled)}
    >
      <Pressable
        style={[
          StyleSheet.absoluteFillObject,
          styles.overlayBase,
          styles.dialogOverlay,
          { paddingBottom: bottomClearance + SPACING.md },
        ]}
        onPress={() => closeIfAllowed(onClose, dismissDisabled)}
      >
        <Animated.View style={[styles.dialogFrame, entrance.animatedStyle]}>
          <Pressable
            style={[styles.dialogCard, { maxHeight: maxCardHeight }, cardStyle]}
          >
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export function AppBottomSheet({
  visible,
  onClose,
  children,
  dismissDisabled,
  animationType = "slide",
  sheetStyle,
  contentStyle,
}: AppBottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const maxSheetHeight = Math.floor(
    Math.min(
      windowHeight * 0.82,
      windowHeight - insets.top - bottomInset - SPACING.xl,
    ),
  );
  const entrance = useEntrance({
    visible,
    axis: "y",
    distance: 22,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      statusBarTranslucent={Platform.OS === "android"}
      navigationBarTranslucent={false}
      onRequestClose={() => closeIfAllowed(onClose, dismissDisabled)}
    >
      <View style={[StyleSheet.absoluteFillObject, styles.overlayBase, styles.sheetOverlay]}>
        <Pressable
          style={styles.backdrop}
          onPress={() => closeIfAllowed(onClose, dismissDisabled)}
        />
        <View style={[styles.sheetWrap, { paddingBottom: Math.max(bottomInset, SPACING.sm) }]}>
          <Animated.View style={entrance.animatedStyle}>
            <View
              style={[
                styles.sheet,
                sheetStyle,
                contentStyle,
                { maxHeight: maxSheetHeight },
              ]}
            >
              {children}
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

export function AppPickerSheet({
  visible,
  onClose,
  children,
  dismissDisabled,
  animationType = "fade",
  sheetStyle,
  contentStyle,
}: AppPickerSheetProps) {
  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      dismissDisabled={dismissDisabled}
      animationType={animationType}
      sheetStyle={[styles.pickerSheet, sheetStyle]}
      contentStyle={contentStyle}
    >
      <View style={styles.handle} />
      {children}
    </AppBottomSheet>
  );
}

export function AppDrawer({
  visible,
  onClose,
  children,
  dismissDisabled,
  animationType = "fade",
  drawerStyle,
}: AppDrawerProps) {
  const entrance = useEntrance({
    visible,
    axis: "x",
    distance: 28,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      statusBarTranslucent={Platform.OS === "android"}
      navigationBarTranslucent={false}
      onRequestClose={() => closeIfAllowed(onClose, dismissDisabled)}
    >
      <View style={[styles.overlayBase, styles.drawerOverlay]}>
        <Animated.View style={entrance.animatedStyle}>
          <View style={[styles.drawerPanel, drawerStyle]}>{children}</View>
        </Animated.View>
        <Pressable
          style={styles.drawerBackdrop}
          onPress={() => closeIfAllowed(onClose, dismissDisabled)}
        />
      </View>
    </Modal>
  );
}
