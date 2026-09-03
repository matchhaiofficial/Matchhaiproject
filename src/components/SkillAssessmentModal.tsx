import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SKILL_ASSESSMENT_CONFIG } from '../constants/skillQuestions';
import { useToast } from '../hooks/useToast';
import { GameKey, saveSelfAssessment } from '../services/skillRatingService';
import { AppBottomSheet, AppModalBody, AppModalFooter, AppModalHeader } from './AppModalPrimitives';
import { AppButton } from './AppPrimitives';
import styles from './SkillAssessmentModal.styles';

interface Props {
    visible: boolean;
    onClose: () => void;
    gameKey: string;
    userId: string;
    onSuccess: (rating: number, tier: string) => void | Promise<void | boolean>;
}

export default function SkillAssessmentModal({ visible, onClose, gameKey, userId, onSuccess }: Props) {
    const { showToast } = useToast();
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const config = SKILL_ASSESSMENT_CONFIG[gameKey];

    // Reset when opening
    useEffect(() => {
        if (visible) {
            setAnswers({});
            setErrorMessage(null);
            setLoading(false);
        }
    }, [visible, gameKey]);

    if (!config) return null;

    const handleSelect = (questionId: string, value: number) => {
        setErrorMessage(null);
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const isComplete = config.questions.every(q => answers[q.id] !== undefined);

    const handleSubmit = async () => {
        if (!isComplete) return;
        if (!userId) {
            const message = "Please sign in again before saving your skill check.";
            setErrorMessage(message);
            showToast({
                message,
                title: "Session required",
                type: "error",
            });
            return;
        }

        setLoading(true);
        setErrorMessage(null);
        try {
            const result = await saveSelfAssessment(userId, gameKey as GameKey, answers);
            if (!result.ok) {
                setErrorMessage(result.message);
                showToast({
                    message: result.message,
                    title: "Skill check not saved",
                    type: "error",
                });
                return;
            }

            await onSuccess(result.rating, result.tier);
            onClose();
        } catch (error) {
            console.error(error);
            const message = "Your skill was saved, but MatchHai could not continue. Please tap Create again.";
            setErrorMessage(message);
            showToast({
                message,
                title: "Could not continue",
                type: "error",
            });
            onClose();
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
                closeDisabled={loading}
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
                {errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                ) : null}
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

