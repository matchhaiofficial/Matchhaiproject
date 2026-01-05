import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedGame, setSelectedGame] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        Keyboard.dismiss();
        Logger.info("CreateTeam", "handleSubmit called", { name, selectedGame, uid: user?.uid });

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

        setSubmitting(true);
        try {
            const result = await createTeam({
                name: name.trim(),
                description: description.trim(),
                game: selectedGame,
                visibility: 'public'
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
                                    onPress={() => setSelectedGame(game.key)}
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
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={submitting}
                        activeOpacity={0.7}
                        style={[
                            styles.primaryButton,
                            submitting && styles.primaryButtonDisabled
                        ]}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                Create Team
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
