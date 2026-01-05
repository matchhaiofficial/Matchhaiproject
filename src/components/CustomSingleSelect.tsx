import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    FlatList,
    Modal,
    Pressable,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";
import { COLORS } from "../theme";
import styles from "./CustomSingleSelect.styles";

interface CustomSelectProps {
    label: string;
    value: string;
    options: readonly string[];
    onChange: (val: string) => void;
    icon?: keyof typeof MaterialIcons.glyphMap;
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
            {label && <Text style={styles.label}>{label}</Text>}
            <Pressable
                onPress={() => setVisible(true)}
                style={[styles.inputBox]}
            >
                {icon && (
                    <MaterialIcons
                        name={icon}
                        size={20}
                        style={styles.prefixIcon}
                        color={value ? COLORS.accent : COLORS.muted}
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
                <MaterialIcons
                    name="arrow-drop-down"
                    size={24}
                    color={COLORS.muted}
                    style={{ marginLeft: "auto" }}
                />
            </Pressable>

            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={() => setVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setVisible(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Select {label}
                            </Text>
                        </View>
                        <FlatList
                            data={options}
                            keyExtractor={(item: string) => item}
                            renderItem={({ item }: { item: string }) => (
                                <TouchableOpacity
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
                                        <MaterialIcons name="check" size={20} color={COLORS.accent} />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
};

