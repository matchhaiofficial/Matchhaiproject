import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GAME_FORMATS } from "../../src/constants/gameRules";
import { useAuth } from "../../src/context/AuthContext";
import { createTeam } from "../../src/services/functions";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import styles from "./create.styles";

const GAMES = [
    { key: 'cs2', label: 'CS2' },
    { key: 'fc26', label: 'FC26' },
    { key: 'tekken8', label: 'Tekken 8' },
    { key: 'futsal', label: 'Futsal' },
    { key: 'indoor_cricket', label: 'Cricket' },
    { key: 'padel', label: 'Padel' },
    { key: 'pickleball', label: 'Pickleball' },
];

export default function CreateTeam() {
    const { user } = useAuth();
    const router = useRouter();
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedGame, setSelectedGame] = useState<string | null>(null);
    const [selectedSize, setSelectedSize] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Get available sizes for selected game
    const availableFormats = useMemo(() => {
        if (!selectedGame) return [];
        return GAME_FORMATS[selectedGame] || [];
    }, [selectedGame]);

    // Reset size when game changes
    const handleGameSelect = (gameKey: string) => {
        setSelectedGame(gameKey);
        const formats = GAME_FORMATS[gameKey] || [];
        // Default to first format if available
        setSelectedSize(formats.length > 0 ? formats[0].size : null);
    };

    const handleSubmit = async () => {
        Keyboard.dismiss();
        Logger.info("CreateTeam", "handleSubmit called", { name, selectedGame, selectedSize, uid: user?.uid });

        if (!user) {
            alert("You must be logged in");
            return;
        }
        if (!name.trim()) {
            alert("Please enter a team name");
            return;
        }
        if (!selectedGame) {
            alert("Please select a game");
            return;
        }
        if (!selectedSize) {
            alert("Please select a team size");
            return;
        }

        setSubmitting(true);
        try {
            const result = await createTeam({
                name: name.trim(),
                description: description.trim(),
                game: selectedGame,
                visibility: 'public',
                maxMembers: selectedSize
            });

            if (result.ok) {
                router.replace({
                    pathname: `/teams/${result.teamId}`,
                    params: { showInvite: 'true' }
                } as any);
            } else {
                alert(result.message || "Failed to create team");
            }
        } catch (error) {
            Logger.error("CreateTeam", "Error creating team", error);
            alert("An error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = !!user && !!name.trim() && !!selectedGame && !!selectedSize && !submitting;

    return (
        <SafeAreaView style={styles.screen}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                    </Pressable>
                    <Text style={styles.headerTitle}>Create Team</Text>
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Team Name */}
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>
                            Team Name *
                        </Text>
                        <View style={styles.inputBox}>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., Karachi Warriors"
                                placeholderTextColor={COLORS.muted}
                                value={name}
                                onChangeText={setName}
                                maxLength={30}
                            />
                        </View>
                        <Text style={styles.helperText}>
                            {name.length}/30 characters
                        </Text>
                    </View>

                    {/* Game Selection */}
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>
                            Game Focus *
                        </Text>
                        <View style={styles.chipRow}>
                            {GAMES.map(game => (
                                <TouchableOpacity
                                    key={game.key}
                                    onPress={() => handleGameSelect(game.key)}
                                    style={[
                                        styles.optionChip,
                                        selectedGame === game.key && styles.optionChipActive
                                    ]}
                                >
                                    <Text style={[
                                        styles.optionChipText,
                                        selectedGame === game.key && styles.optionChipTextActive
                                    ]}>
                                        {game.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Team Size Selection (only if game has multiple formats) */}
                    {selectedGame && availableFormats.length > 1 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>
                                Team Size *
                            </Text>
                            <View style={styles.chipRow}>
                                {availableFormats.map(format => (
                                    <TouchableOpacity
                                        key={format.size}
                                        onPress={() => setSelectedSize(format.size)}
                                        style={[
                                            styles.optionChip,
                                            selectedSize === format.size && styles.optionChipActive
                                        ]}
                                    >
                                        <Text style={[
                                            styles.optionChipText,
                                            selectedSize === format.size && styles.optionChipTextActive
                                        ]}>
                                            {format.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Description */}
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>
                            Description (Optional)
                        </Text>
                        <View style={styles.inputBox}>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="What's your team about?"
                                placeholderTextColor={COLORS.muted}
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                maxLength={200}
                            />
                        </View>
                        <Text style={styles.helperText}>
                            {description.length}/200 characters
                        </Text>
                    </View>
                </ScrollView>

                {/* Submit Button */}
                <View style={styles.buttonWrapper}>
                    <Pressable
                        onPressIn={() => {
                            if (touchDebugEnabled) {
                                Logger.debug("TouchDebug", "pressIn", {
                                    tag: "team_create_submit",
                                    canSubmit,
                                    submitting,
                                });
                            }
                        }}
                        onPress={handleSubmit}
                        disabled={!canSubmit}
                        style={({ pressed }) => [
                            styles.primaryButton,
                            !canSubmit && styles.primaryButtonDisabled,
                            pressed && canSubmit && styles.primaryButtonPressed,
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                Create Team
                            </Text>
                        )}
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
