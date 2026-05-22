import React from "react";
import {
  KeyboardAvoidingView,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
  type Edge,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useEntrance } from "../motion/useEntrance";
import { SPACING } from "../theme";
import { toastConfig } from "../ui/toastConfig";
import { AppIcon } from "./AppIcon";
import styles from "./AppModalPrimitives.styles";

type BaseProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  dismissDisabled?: boolean;
  animationType?: "none" | "slide" | "fade";
  keyboardAware?: boolean;
  keyboardAvoidBehavior?: "padding" | "height" | "position";
  keyboardVerticalOffset?: number;
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
  contentSafeAreaEdges?: Edge[];
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
  includeSafeAreaBottom?: boolean;
  minBottomPadding?: number;
  extraBottomPadding?: number;
};

function closeIfAllowed(onClose: () => void, dismissDisabled?: boolean) {
  if (!dismissDisabled) onClose();
}

function getKeyboardAvoidBehavior(
  keyboardAvoidBehavior?: BaseProps["keyboardAvoidBehavior"],
) {
  return keyboardAvoidBehavior ?? (Platform.OS === "ios" ? "padding" : "height");
}

function MaybeKeyboardAvoidingView({
  enabled,
  behavior,
  keyboardVerticalOffset = 0,
  style,
  children,
}: {
  enabled?: boolean;
  behavior?: BaseProps["keyboardAvoidBehavior"];
  keyboardVerticalOffset?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <KeyboardAvoidingView
      behavior={getKeyboardAvoidBehavior(behavior)}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={style}
    >
      {children}
    </KeyboardAvoidingView>
  );
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
          // NOTE: `styles.bodyContent` includes `flexShrink: 1` for non-scroll layouts.
          // In a ScrollView, `flexShrink` on the content container can prevent the
          // content from exceeding the viewport, which breaks scrolling. Override it.
          contentContainerStyle={[
            styles.bodyContent,
            { flexShrink: 0 },
            contentContainerStyle,
          ]}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
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

export function AppModalFooter({
  children,
  style,
  includeSafeAreaBottom = true,
  minBottomPadding = SPACING.md,
  extraBottomPadding = 0,
}: AppModalFooterProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = includeSafeAreaBottom ? Math.max(0, insets.bottom || 0) : 0;

  return (
    <View
      style={[
        styles.footer,
        style,
        {
          paddingBottom:
            Math.max(minBottomPadding, bottomInset + minBottomPadding) +
            extraBottomPadding,
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
  keyboardAware = false,
  keyboardAvoidBehavior,
  keyboardVerticalOffset = 0,
}: AppDialogProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomClearance = Math.max(0, insets.bottom || 0);
  const topClearance = Math.max(0, insets.top || 0);
  const verticalChrome = topClearance + bottomClearance + SPACING.xl + SPACING.md;
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
      <View
        style={[
          StyleSheet.absoluteFillObject,
          styles.overlayBase,
          styles.dialogOverlay,
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={() => closeIfAllowed(onClose, dismissDisabled)}
        />
        <MaybeKeyboardAvoidingView
          enabled={keyboardAware}
          behavior={keyboardAvoidBehavior}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={styles.dialogKeyboardAvoiding}
        >
          <Animated.View style={[styles.dialogFrame, entrance.animatedStyle]}>
            <View style={[styles.dialogCard, { maxHeight: maxCardHeight }, cardStyle]}>
              {children}
            </View>
          </Animated.View>
        </MaybeKeyboardAvoidingView>
      </View>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <Toast config={toastConfig} />
      </View>
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
  keyboardAware = false,
  keyboardAvoidBehavior,
  keyboardVerticalOffset = 0,
}: AppBottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(0, insets.bottom || 0);
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
        <MaybeKeyboardAvoidingView
          enabled={keyboardAware}
          behavior={keyboardAvoidBehavior}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={styles.sheetKeyboardAvoiding}
        >
          <View
            style={styles.sheetWrap}
          >
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
        </MaybeKeyboardAvoidingView>
      </View>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <Toast config={toastConfig} />
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
  keyboardAware = false,
  keyboardAvoidBehavior,
  keyboardVerticalOffset = 0,
}: AppPickerSheetProps) {
  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      dismissDisabled={dismissDisabled}
      animationType={animationType}
      sheetStyle={[styles.pickerSheet, sheetStyle]}
      contentStyle={contentStyle}
      keyboardAware={keyboardAware}
      keyboardAvoidBehavior={keyboardAvoidBehavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
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
  keyboardAware = false,
  keyboardAvoidBehavior,
  keyboardVerticalOffset = 0,
  contentSafeAreaEdges,
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
        <MaybeKeyboardAvoidingView
          enabled={keyboardAware}
          behavior={keyboardAvoidBehavior}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={styles.drawerKeyboardAvoiding}
        >
          <Animated.View style={entrance.animatedStyle}>
            <View style={[styles.drawerPanel, drawerStyle]}>
              {contentSafeAreaEdges ? (
                <SafeAreaView
                  style={styles.drawerSafeArea}
                  edges={contentSafeAreaEdges}
                >
                  {children}
                </SafeAreaView>
              ) : (
                children
              )}
            </View>
          </Animated.View>
        </MaybeKeyboardAvoidingView>
        <Pressable
          style={styles.drawerBackdrop}
          onPress={() => closeIfAllowed(onClose, dismissDisabled)}
        />
      </View>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
        <Toast config={toastConfig} />
      </View>
    </Modal>
  );
}
