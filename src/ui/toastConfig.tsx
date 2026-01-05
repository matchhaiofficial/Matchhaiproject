// src/ui/toastConfig.tsx
import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import type { BaseToastProps } from "react-native-toast-message";
import { COLORS } from "../theme";
import { toastStyles } from "./toastStyles";

interface CustomToastProps extends BaseToastProps {
    text1?: string;
    text2?: string;
}

export const toastConfig = {
    error: ({ text1, text2 }: CustomToastProps) => (
        <View style={[toastStyles.baseContainer, toastStyles.errorContainer]}>
            <View style={[toastStyles.iconContainer, toastStyles.errorIcon]}>
                <MaterialIcons name="error-outline" size={20} color={COLORS.error} />
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
                <MaterialIcons name="check-circle" size={20} color={COLORS.successBright} />
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
                <MaterialIcons name="warning" size={20} color={COLORS.warning} />
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
                <MaterialIcons name="delete-outline" size={20} color={COLORS.error} />
            </View>
            <View style={toastStyles.textColumn}>
                {text1 ? <Text style={toastStyles.errorTitle}>{text1}</Text> : null}
                {text2 ? <Text style={toastStyles.messageText}>{text2}</Text> : null}
            </View>
        </View>
    ),
};
