import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SKILL_ASSESSMENT_CONFIG } from '../constants/skillQuestions';
import { GameKey, saveSelfAssessment } from '../services/skillRatingService';
import { COLORS } from '../theme';
import styles from './SkillAssessmentModal.styles';

interface Props {
    visible: boolean;
    onClose: () => void;
    gameKey: string;
    userId: string;
    onSuccess: (rating: number) => void;
}

export default function SkillAssessmentModal({ visible, onClose, gameKey, userId, onSuccess }: Props) {
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);

    const config = SKILL_ASSESSMENT_CONFIG[gameKey];

    // Reset when opening
    useEffect(() => {
        if (visible) {
            setAnswers({});
            setLoading(false);
        }
    }, [visible, gameKey]);

    if (!config) return null;

    const handleSelect = (questionId: string, value: number) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const isComplete = config.questions.every(q => answers[q.id] !== undefined);

    const handleSubmit = async () => {
        if (!isComplete) return;

        setLoading(true);
        try {
            const result = await saveSelfAssessment(userId, gameKey as GameKey, answers);
            if (result.ok && result.rating) {
                onSuccess(result.rating);
                onClose();
            } else {
                // Handle error
                console.error('Failed to save assessment');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>One-time Setup</Text>
                            <Text style={styles.subtitle}>Rate your skill to continue</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
                        </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        {config.questions.map((q) => (
                            <View key={q.id} style={styles.questionSection}>
                                <Text style={styles.questionLabel}>{q.label}</Text>
                                <View style={styles.optionsGrid}>
                                    {q.options.map((opt) => {
                                        const selected = answers[q.id] === opt.value;
                                        return (
                                            <Pressable
                                                key={opt.value}
                                                onPress={() => handleSelect(q.id, opt.value)}
                                                style={[
                                                    styles.option,
                                                    selected && styles.optionSelected
                                                ]}
                                            >
                                                <Text style={[
                                                    styles.optionText,
                                                    selected && styles.optionTextSelected
                                                ]}>
                                                    {opt.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Pressable
                            style={[styles.submitButton, (!isComplete || loading) && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={!isComplete || loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.submitButtonText}>Save & Continue</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

