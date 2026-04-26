// src/ui/toastConfig.tsx
import React from "react";
import { Text, View } from "react-native";
import type { BaseToastProps } from "react-native-toast-message";
import { AppIcon } from "../components/AppIcon";
import { toastStyles } from "./toastStyles";

interface CustomToastProps extends BaseToastProps {
    text1?: string;
    text2?: string;
}

export const toastConfig = {
    error: ({ text1, text2 }: CustomToastProps) => (
        <View style={[toastStyles.baseContainer, toastStyles.errorContainer]}>
            <View style={[toastStyles.iconContainer, toastStyles.errorIcon]}>
                <AppIcon name="error-outline" size={20} tone="danger" />
            </View>
            <View style={toastStyles.textColumn}>
                {text1 ? <Text style={toastStyles.errorTitle}>{text1}</Text> : null}
                {text2 ? <Text style={toastStyles.messageText}>{text2}</Text> : null}
            </View>
        </View>
    ),

    success: ({ text1, text2 }: CustomToastProps) => (
        <View style={[toastStyles.baseContainer, toastStyles.successContainer]}>
            <View style={[toastStyles.iconContainer, toastStyles.successIcon]}>
                <AppIcon name="check-circle" size={20} tone="success" color="#81C784" />
            </View>
            <View style={toastStyles.textColumn}>
                {text1 ? <Text style={toastStyles.successTitle}>{text1}</Text> : null}
                {text2 ? <Text style={toastStyles.messageText}>{text2}</Text> : null}
            </View>
        </View>
    ),

    warning: ({ text1, text2 }: CustomToastProps) => (
        <View style={[toastStyles.baseContainer, toastStyles.warningContainer]}>
            <View style={[toastStyles.iconContainer, toastStyles.warningIcon]}>
                <AppIcon name="warning" size={20} tone="warning" />
            </View>
            <View style={toastStyles.textColumn}>
                {text1 ? <Text style={toastStyles.warningTitle}>{text1}</Text> : null}
                {text2 ? <Text style={toastStyles.messageText}>{text2}</Text> : null}
            </View>
        </View>
    ),

    delete: ({ text1, text2 }: CustomToastProps) => (
        <View style={[toastStyles.baseContainer, toastStyles.errorContainer]}>
            <View style={[toastStyles.iconContainer, toastStyles.errorIcon]}>
                <AppIcon name="delete-outline" size={20} tone="danger" />
            </View>
            <View style={toastStyles.textColumn}>
                {text1 ? <Text style={toastStyles.errorTitle}>{text1}</Text> : null}
                {text2 ? <Text style={toastStyles.messageText}>{text2}</Text> : null}
            </View>
        </View>
    ),
};
