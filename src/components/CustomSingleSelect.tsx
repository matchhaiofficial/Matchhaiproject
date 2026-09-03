import React, { useState, type ReactNode } from "react";
import {
    Pressable,
    Text,
    View,
    ViewStyle,
} from "react-native";
import { AppModalBody, AppModalHeader, AppPickerSheet } from "./AppModalPrimitives";
import { COLORS } from "../theme";
import { AppIcon, type AppIconName } from "./AppIcon";
import styles from "./CustomSingleSelect.styles";

interface CustomSelectProps {
    label: ReactNode;
    value: string;
    options: readonly string[];
    onChange: (val: string) => void;
    icon?: AppIconName;
    placeholder?: string;
    containerStyle?: ViewStyle;
}

export const CustomSingleSelect = ({
    label,
    value,
    options,
    onChange,
    icon,
    placeholder,
    containerStyle,
}: CustomSelectProps) => {
    const [visible, setVisible] = useState(false);

    return (
        <View style={[styles.container, containerStyle]}>
            {typeof label === "string" ? <Text style={styles.label}>{label}</Text> : label}
            <Pressable
                onPress={() => setVisible(true)}
                style={[styles.inputBox]}
            >
                {icon && (
                    <AppIcon
                        name={icon}
                        size="md"
                        style={styles.prefixIcon}
                        tone={value ? "accent" : "muted"}
                    />
                )}
                <Text
                    style={[
                        styles.input,
                        { color: value ? COLORS.text : COLORS.muted },
                    ]}
                >
                    {value || placeholder || `Select ${label}`}
                </Text>
                <AppIcon
                    name="arrow-drop-down"
                    size="lg"
                    tone="muted"
                    style={{ marginLeft: "auto" }}
                />
            </Pressable>

            <AppPickerSheet
                visible={visible}
                onClose={() => setVisible(false)}
            >
                <AppModalHeader
                    title={typeof label === "string" ? `Select ${label}` : "Select option"}
                    onClose={() => setVisible(false)}
                    compact
                />
                <AppModalBody scroll contentContainerStyle={styles.modalBodyContent}>
                    {options.map((item) => (
                        <Pressable
                            key={item}
                            onPress={() => {
                                onChange(item);
                                setVisible(false);
                            }}
                            style={styles.optionItem}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    item === value && styles.optionTextSelected,
                                ]}
                            >
                                {item}
                            </Text>
                            {item === value && (
                                <AppIcon name="check" size="md" tone="accent" />
                            )}
                        </Pressable>
                    ))}
                </AppModalBody>
            </AppPickerSheet>
        </View>
    );
};

