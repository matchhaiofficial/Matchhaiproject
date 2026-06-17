import React from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  type LayoutChangeEvent,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
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

const KEYBOARD_DISMISS_CLOSE_GRACE_MS = 350;

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
  alignItems?: "flex-start" | "center";
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
  keyboardAware?: boolean;
  keyboardFocusKey?: unknown;
  keyboardExtraClearance?: number;
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

function dismissFocusedTextInput() {
  const focusedInput = TextInput.State?.currentlyFocusedInput?.();
  if (!focusedInput) return false;

  (focusedInput as { blur?: () => void }).blur?.();
  Keyboard.dismiss();
  return true;
}

function useKeyboardAwareRequestClose({
  visible,
  onClose,
  dismissDisabled,
  keyboardAware,
}: {
  visible: boolean;
  onClose: () => void;
  dismissDisabled?: boolean;
  keyboardAware?: boolean;
}) {
  const keyboardVisibleRef = React.useRef(false);
  const keyboardHiddenAtRef = React.useRef(0);

  React.useEffect(() => {
    if (!visible) {
      keyboardVisibleRef.current = false;
      keyboardHiddenAtRef.current = 0;
    }
  }, [visible]);

  React.useEffect(() => {
    if (!visible || !keyboardAware || Platform.OS !== "android") return undefined;

    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      keyboardVisibleRef.current = true;
      keyboardHiddenAtRef.current = 0;
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      keyboardVisibleRef.current = false;
      keyboardHiddenAtRef.current = Date.now();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardAware, visible]);

  return React.useCallback(() => {
    if (dismissDisabled) return;

    if (keyboardAware && Platform.OS === "android") {
      if (dismissFocusedTextInput()) {
        keyboardHiddenAtRef.current = Date.now();
        keyboardVisibleRef.current = false;
        return;
      }

      if (keyboardVisibleRef.current) {
        Keyboard.dismiss();
        return;
      }

      if (Date.now() - keyboardHiddenAtRef.current <= KEYBOARD_DISMISS_CLOSE_GRACE_MS) {
        keyboardHiddenAtRef.current = 0;
        return;
      }
    }

    onClose();
  }, [dismissDisabled, keyboardAware, onClose]);
}

function getKeyboardAvoidBehavior(
  keyboardAvoidBehavior?: BaseProps["keyboardAvoidBehavior"],
) {
  return keyboardAvoidBehavior ?? "padding";
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
  alignItems = "flex-start",
}: HeaderProps) {
  return (
    <View style={[styles.header, compact && styles.headerTight, alignItems === "center" && styles.headerCentered]}>
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
  keyboardAware = false,
  keyboardFocusKey,
  keyboardExtraClearance = SPACING.md,
}: AppModalBodyProps) {
  const bodyRef = React.useRef<View | null>(null);
  const scrollRef = React.useRef<ScrollView | null>(null);
  const scrollOffsetYRef = React.useRef(0);
  const keyboardTopRef = React.useRef<number | null>(null);
  const [keyboardOverlap, setKeyboardOverlap] = React.useState(0);

  const ensureFocusedInputVisible = React.useCallback(() => {
    if (!scroll || !keyboardAware) return;

    requestAnimationFrame(() => {
      setTimeout(() => {
        const focusedInput = TextInput.State?.currentlyFocusedInput?.();
        const scrollView = scrollRef.current;
        const body = bodyRef.current;
        if (!focusedInput || !scrollView || !body) return;

        const measurableInput = focusedInput as {
          measureInWindow?: (
            callback: (x: number, y: number, width: number, height: number) => void,
          ) => void;
        };
        if (!measurableInput.measureInWindow) return;

        body.measureInWindow((_bodyX, bodyY, _bodyWidth, bodyHeight) => {
          measurableInput.measureInWindow?.((_inputX, inputY, _inputWidth, inputHeight) => {
            const bodyBottom = bodyY + bodyHeight;
            const keyboardTop = keyboardTopRef.current;
            const visibleBottom =
              Math.min(bodyBottom, keyboardTop ?? bodyBottom) - keyboardExtraClearance;
            const visibleTop = bodyY + SPACING.sm;
            const inputBottom = inputY + inputHeight;
            let nextOffsetY = scrollOffsetYRef.current;

            if (inputBottom > visibleBottom) {
              nextOffsetY += inputBottom - visibleBottom;
            } else if (inputY < visibleTop) {
              nextOffsetY -= visibleTop - inputY;
            }

            nextOffsetY = Math.max(0, Math.round(nextOffsetY));
            if (Math.abs(nextOffsetY - scrollOffsetYRef.current) > 1) {
              scrollView.scrollTo({ y: nextOffsetY, animated: true });
            }
          });
        });
      }, 100);
    });
  }, [keyboardAware, keyboardExtraClearance, scroll]);

  React.useEffect(() => {
    if (!scroll || !keyboardAware) {
      keyboardTopRef.current = null;
      setKeyboardOverlap(0);
      return undefined;
    }

    const handleKeyboardFrame = (event: { endCoordinates?: { screenY?: number } }) => {
      const keyboardTop = event.endCoordinates?.screenY;
      keyboardTopRef.current = typeof keyboardTop === "number" ? keyboardTop : null;

      bodyRef.current?.measureInWindow((_x, bodyY, _width, bodyHeight) => {
        const bodyBottom = bodyY + bodyHeight;
        const overlap =
          typeof keyboardTop === "number" ? Math.max(0, bodyBottom - keyboardTop) : 0;
        setKeyboardOverlap(overlap > 0 ? overlap + keyboardExtraClearance : 0);
      });
      ensureFocusedInputVisible();
    };
    const handleKeyboardHide = () => {
      keyboardTopRef.current = null;
      setKeyboardOverlap(0);
    };

    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      handleKeyboardFrame,
    );
    const frameSubscription =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillChangeFrame", handleKeyboardFrame)
        : null;
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      handleKeyboardHide,
    );

    return () => {
      showSubscription.remove();
      frameSubscription?.remove();
      hideSubscription.remove();
    };
  }, [
    ensureFocusedInputVisible,
    keyboardAware,
    keyboardExtraClearance,
    scroll,
  ]);

  React.useEffect(() => {
    if (keyboardFocusKey == null) return;
    ensureFocusedInputVisible();
  }, [ensureFocusedInputVisible, keyboardFocusKey]);

  React.useEffect(() => {
    if (keyboardOverlap <= 0) return;
    ensureFocusedInputVisible();
  }, [ensureFocusedInputVisible, keyboardOverlap]);

  if (scroll) {
    return (
      <View
        ref={bodyRef}
        collapsable={false}
        style={[styles.bodyScrollWrap, style]}
      >
        <ScrollView
          ref={scrollRef}
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
          scrollEventThrottle={16}
          onScroll={(event) => {
            scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
          {keyboardAware && keyboardOverlap > 0 ? (
            <View style={{ height: keyboardOverlap }} />
          ) : null}
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
  const [sheetViewportHeight, setSheetViewportHeight] = React.useState(0);
  const measuredViewportHeight = sheetViewportHeight || windowHeight;
  const availableSheetHeight = Math.max(
    0,
    measuredViewportHeight - insets.top - bottomInset - SPACING.xl,
  );
  const maxSheetHeight = Math.floor(
    Math.min(
      measuredViewportHeight * 0.82,
      availableSheetHeight,
    ),
  );
  React.useEffect(() => {
    if (!visible) setSheetViewportHeight(0);
  }, [visible]);
  const handleSheetViewportLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setSheetViewportHeight((currentHeight) =>
      Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight,
    );
  }, []);
  const entrance = useEntrance({
    visible,
    axis: "y",
    distance: 22,
  });
  const handleRequestClose = useKeyboardAwareRequestClose({
    visible,
    onClose,
    dismissDisabled,
    keyboardAware,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      statusBarTranslucent={Platform.OS === "android"}
      navigationBarTranslucent={false}
      onRequestClose={handleRequestClose}
    >
      <View style={[StyleSheet.absoluteFillObject, styles.overlayBase, styles.sheetOverlay]}>
        <Pressable
          style={styles.backdrop}
          onPress={handleRequestClose}
        />
        <MaybeKeyboardAvoidingView
          enabled={keyboardAware && Platform.OS === "ios"}
          behavior={keyboardAvoidBehavior}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={styles.sheetKeyboardAvoiding}
        >
          <View
            style={styles.sheetWrap}
            onLayout={handleSheetViewportLayout}
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
          <Animated.View style={[keyboardAware && styles.drawerAnimatedFill, entrance.animatedStyle]}>
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
