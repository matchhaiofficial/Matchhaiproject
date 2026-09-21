import React, { useMemo, useState, type ReactNode } from "react";
import {
    Pressable,
    Text,
    TextInput,
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
    searchable?: boolean;
    searchPlaceholder?: string;
    modalTitle?: string;
}

export const CustomSingleSelect = ({
    label,
    value,
    options,
    onChange,
    icon,
    placeholder,
    containerStyle,
    searchable = false,
    searchPlaceholder = "Search options",
    modalTitle,
}: CustomSelectProps) => {
    const [visible, setVisible] = useState(false);
    const [search, setSearch] = useState("");
    const visibleOptions = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return needle ? options.filter((item) => item.toLowerCase().includes(needle)) : options;
    }, [options, search]);
    const close = () => {
        setVisible(false);
        setSearch("");
    };

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
                onClose={close}
            >
                <AppModalHeader
                    title={modalTitle || (typeof label === "string" ? `Select ${label}` : "Select option")}
                    onClose={close}
                    compact
                />
                <AppModalBody scroll contentContainerStyle={styles.modalBodyContent}>
                    {searchable ? (
                        <View style={styles.searchBox}>
                            <AppIcon name="search" size="md" tone="muted" />
                            <TextInput
                                value={search}
                                onChangeText={setSearch}
                                placeholder={searchPlaceholder}
                                placeholderTextColor={COLORS.muted}
                                style={styles.searchInput}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                    ) : null}
                    {visibleOptions.map((item) => (
                        <Pressable
                            key={item}
                            onPress={() => {
                                onChange(item);
                                close();
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
                    {searchable && visibleOptions.length === 0 ? (
                        <Text style={styles.emptyText}>No matching options.</Text>
                    ) : null}
                </AppModalBody>
            </AppPickerSheet>
        </View>
    );
};
