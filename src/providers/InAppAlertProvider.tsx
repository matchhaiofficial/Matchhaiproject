import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";

import {
  AppDialog,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../components/AppModalPrimitives";
import { AppButton } from "../components/AppPrimitives";
import { COLORS, FONTS, SPACING } from "../theme";

type AlertButtonConfig = {
  text?: string;
  onPress?: (() => void | Promise<void>) | undefined;
  style?: "default" | "cancel" | "destructive";
};

type AlertOptionsConfig = {
  cancelable?: boolean;
};

type AlertEntry = {
  buttons: AlertButtonConfig[];
  message?: string;
  options?: AlertOptionsConfig;
  title: string;
};

type InAppAlertContextValue = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButtonConfig[],
    options?: AlertOptionsConfig,
  ) => void;
};

const InAppAlertContext = createContext<InAppAlertContextValue | null>(null);

function normalizeButtons(buttons?: AlertButtonConfig[]) {
  if (!buttons || buttons.length === 0) {
    return [{ text: "OK" }];
  }
  return buttons.map((button) => ({
    style: "default" as const,
    text: "OK",
    ...button,
  }));
}

function variantForButton(style?: AlertButtonConfig["style"]) {
  if (style === "destructive") return "danger" as const;
  if (style === "cancel") return "secondary" as const;
  return "primary" as const;
}

function isDismissButton(button: AlertButtonConfig) {
  return button.style === "cancel";
}

export function useInAppAlert() {
  const value = useContext(InAppAlertContext);
  if (!value) {
    throw new Error("useInAppAlert must be used within InAppAlertProvider");
  }
  return value;
}

export default function InAppAlertProvider({ children }: { children: React.ReactNode }) {
  const originalAlertRef = useRef(Alert.alert);
  const queueRef = useRef<AlertEntry[]>([]);
  const [activeAlert, setActiveAlert] = useState<AlertEntry | null>(null);

  const showNext = () => {
    if (queueRef.current.length === 0) {
      setActiveAlert(null);
      return;
    }
    const [next, ...rest] = queueRef.current;
    queueRef.current = rest;
    setActiveAlert(next);
  };

  const enqueueAlert = (
    title: string,
    message?: string,
    buttons?: AlertButtonConfig[],
    options?: AlertOptionsConfig,
  ) => {
    const entry: AlertEntry = {
      buttons: normalizeButtons(buttons),
      message,
      options,
      title,
    };

    if (!activeAlert) {
      setActiveAlert(entry);
      return;
    }

    queueRef.current = [...queueRef.current, entry];
  };

  useEffect(() => {
    const original = originalAlertRef.current;

    Alert.alert = (title, message, buttons, options) => {
      enqueueAlert(title, message, buttons, options);
    };

    return () => {
      Alert.alert = original;
    };
  }, [activeAlert]);

  const dismiss = (button?: AlertButtonConfig) => {
    setActiveAlert(null);
    requestAnimationFrame(() => {
      try {
        const result = button?.onPress?.();
        if (result && typeof (result as Promise<unknown>).catch === "function") {
          (result as Promise<unknown>).catch((error) => {
            console.error("[InAppAlertProvider] Alert action failed", error);
          });
        }
      } catch (error) {
        console.error("[InAppAlertProvider] Alert action failed", error);
      }
      showNext();
    });
  };

  const contextValue = useMemo<InAppAlertContextValue>(
    () => ({
      alert: enqueueAlert,
    }),
    [activeAlert],
  );

  const buttons = activeAlert?.buttons ?? [];
  const stackedButtons = buttons.length > 2;
  const dismissButton = buttons.find(isDismissButton);

  return (
    <InAppAlertContext.Provider value={contextValue}>
      {children}
      <AppDialog
        visible={Boolean(activeAlert)}
        onClose={() =>
          activeAlert?.options?.cancelable !== false ? dismiss(dismissButton ?? buttons[0]) : undefined
        }
        dismissDisabled={activeAlert?.options?.cancelable === false}
      >
        {activeAlert ? (
          <>
            <AppModalHeader
              title={activeAlert.title}
              subtitle={undefined}
              onClose={
                activeAlert.options?.cancelable !== false
                  ? () => dismiss(dismissButton ?? buttons[0])
                  : undefined
              }
            />
            <AppModalBody scroll contentContainerStyle={{ paddingBottom: SPACING.lg }}>
              {activeAlert.message ? (
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontFamily: FONTS.body,
                    fontSize: 15,
                    lineHeight: 24,
                  }}
                >
                  {activeAlert.message}
                </Text>
              ) : null}
            </AppModalBody>
            <AppModalFooter>
              <View
                style={{
                  flexDirection: stackedButtons ? "column" : "row",
                  gap: SPACING.sm,
                }}
              >
                {buttons.map((button, index) => (
                  <AppButton
                    key={`${button.text || "button"}-${index}`}
                    variant={variantForButton(button.style)}
                    style={{ flex: stackedButtons ? undefined : 1 }}
                    onPress={() => dismiss(button)}
                  >
                    {button.text || "OK"}
                  </AppButton>
                ))}
              </View>
            </AppModalFooter>
          </>
        ) : null}
      </AppDialog>
    </InAppAlertContext.Provider>
  );
}
