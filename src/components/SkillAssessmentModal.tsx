import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SKILL_ASSESSMENT_CONFIG } from '../constants/skillQuestions';
import { GameKey, saveSelfAssessment } from '../services/skillRatingService';
import { AppBottomSheet, AppModalBody, AppModalFooter, AppModalHeader } from './AppModalPrimitives';
import { AppButton } from './AppPrimitives';
import styles from './SkillAssessmentModal.styles';

interface Props {
    visible: boolean;
    onClose: () => void;
    gameKey: string;
    userId: string;
    onSuccess: (rating: number, tier: string) => void;
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
            if (result.ok && result.rating !== undefined && result.tier) {
                onSuccess(result.rating, result.tier);
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
        <AppBottomSheet
            visible={visible}
            onClose={onClose}
            dismissDisabled={loading}
            sheetStyle={styles.container}
        >
            <AppModalHeader
                title="One-time Setup"
                subtitle="Rate your skill to continue"
                onClose={onClose}
            />

            <AppModalBody scroll contentContainerStyle={styles.content}>
                {config.questions.map((q) => (
                    <View key={q.id} style={styles.questionSection}>
                        <Text style={styles.questionLabel}>{q.label}</Text>
                        <View style={styles.optionsGrid}>
                            {q.options.map((opt, index) => {
                                const selected = answers[q.id] === opt.value;
                                return (
                                    <Pressable
                                        key={`${q.id}:${index}:${opt.label}`}
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
            </AppModalBody>

            <AppModalFooter style={styles.footer}>
                <AppButton
                    variant="primary"
                    style={[styles.submitButton, (!isComplete || loading) && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={!isComplete || loading}
                    loading={loading}
                >
                    Save & Continue
                </AppButton>
            </AppModalFooter>
        </AppBottomSheet>
    );
}

