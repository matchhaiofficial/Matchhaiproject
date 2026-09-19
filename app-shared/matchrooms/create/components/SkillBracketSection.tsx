import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AppIcon } from '../../../../src/components/AppIcon';
import { SKILL_ASSESSMENT_CONFIG } from '../../../../src/constants/skillQuestions';
import {
    GameSkillScore,
    initializeSkillIfMissing,
    saveSelfAssessment,
    SkillTier
} from '../../../../src/services/skillRatingService';
import { UserProfile } from '../../../../src/services/userService';
import { COLORS } from '../../../../src/theme';
import styles from './SkillBracketSection.styles';

const clampRating = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export type SkillChangeParams = {
    score: number | null;
    tier: SkillTier | 'Any' | null;
};

type Props = {
    gameKey: string;
    userProfile: UserProfile | null;
    valueScore: number | null;
    valueTier: string | null;
    onChange: (params: SkillChangeParams) => void;
};

// --- Helper Component: ChipGroup ---
const ChipGroup = ({
    label,
    options,
    selectedValue,
    onSelect,
}: {
    label: string;
    options: { label: string; value: number }[];
    selectedValue: any;
    onSelect: (val: any) => void;
}) => (
    <View style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionLabel, { fontSize: 13, marginBottom: 8 }]}>{label}</Text>
        <View style={styles.chipRow}>
            {options.map((opt, index) => {
                const active = selectedValue === opt.value;
                return (
                    <Pressable
                        key={`${label}:${index}:${opt.label}`}
                        onPress={() => onSelect(opt.value)}
                        style={[
                            styles.optionChip,
                            active && styles.optionChipActive
                        ]}
                    >
                        <Text style={[
                            styles.optionChipText,
                            active && styles.optionChipTextActive
                        ]}>
                            {opt.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    </View>
);

// --- Sub-component: SkillCalibration ---
function SkillCalibration({
    gameKey,
    onComplete,
}: {
    gameKey: string;
    onComplete: (answers: Record<string, number>) => void;
}) {
    const config = SKILL_ASSESSMENT_CONFIG[gameKey];
    const [answers, setAnswers] = useState<Record<string, number>>({});

    if (!config) return null;

    const isComplete = config.questions.every(q => answers[q.id] !== undefined);

    return (
        <View style={styles.calibrateContainer}>
            <View style={styles.calibrateHeader}>
                <Text style={styles.calibrateTitle}>Calibrate your level</Text>
                <Text style={styles.calibrateBullet}>• One-time only</Text>
            </View>

            {config.questions.map(q => (
                <ChipGroup
                    key={q.id}
                    label={q.label}
                    options={q.options}
                    selectedValue={answers[q.id]}
                    onSelect={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                />
            ))}

            {isComplete && (
                <Pressable
                    onPress={() => onComplete(answers)}
                    style={styles.calibrateButton}
                >
                    <Text style={styles.calibrateButtonText}>Save & Continue</Text>
                </Pressable>
            )}
        </View>
    );
}

// --- Main Component ---
export default function SkillBracketSection({
    gameKey,
    userProfile,
    valueScore,
    valueTier,
    onChange,
}: Props) {
    const [loading, setLoading] = useState(false);
    const [localSkill, setLocalSkill] = useState<GameSkillScore | null>(null);

    useEffect(() => {
        if (!userProfile?._id) return;

        const loadSkill = async () => {
            setLoading(true);
            try {
                const skill = await initializeSkillIfMissing(userProfile._id, gameKey as any, userProfile);
                if (skill) {
                    setLocalSkill({ ...skill, rating: clampRating(skill.rating) });
                    if (valueTier === null) {
                        onChange({ score: clampRating(skill.rating), tier: skill.tier });
                    }
                } else {
                    setLocalSkill(null);
                }
            } catch (err) {
                console.error("Skill check failed", err);
            } finally {
                setLoading(false);
            }
        };

        loadSkill();
    }, [gameKey, userProfile?._id]);

    const handleCalibrationComplete = async (answers: Record<string, number>) => {
        if (!userProfile?._id) return;
        setLoading(true);
        try {
            const res = await saveSelfAssessment(userProfile._id, gameKey as any, answers);
            if (res.ok && res.rating !== undefined && res.tier) {
                const normalizedRating = clampRating(res.rating);
                const newSkill: GameSkillScore = {
                    rating: normalizedRating,
                    tier: res.tier,
                    matchesPlayed: 0,
                    wins: 0,
                    losses: 0,
                    initialSource: 'questionnaire',
                    initialRating: normalizedRating,
                    lastMatchDate: null,
                    lastUpdated: Date.now()
                };
                setLocalSkill(newSkill);
                onChange({ score: normalizedRating, tier: res.tier });
            }
        } catch (err) {
            console.error("Calibration save failed", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator color={COLORS.accent} />
            </View>
        );
    }

    const tiers = ['Any', 'Beginner', 'Casual', 'Intermediate', 'Advanced', 'Pro', 'Elite'];
    const hasAssessment = !!SKILL_ASSESSMENT_CONFIG[gameKey];
    const selectedTier = valueTier || 'Any';

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.sectionLabel}>Skill Level</Text>
            </View>

            {localSkill ? (
                // Case A: Skill Exists -> Display Badge & Allow Bracket Selection
                <>
                    <View style={styles.skillBadge}>
                        <View>
                            <Text style={styles.skillBadgeText}>{localSkill.tier}</Text>
                            <Text style={styles.skillBadgeRating}>MatchHai Score: {clampRating(localSkill.rating)}/100</Text>
                        </View>
                        <AppIcon name="check-circle" size={24} color={COLORS.accent} />
                    </View>

                    <Text style={[styles.sectionLabel, { fontSize: 13, marginTop: 16, marginBottom: 8 }]}>Match Bracket</Text>
                    <View style={styles.chipRow}>
                        {tiers.map((t) => (
                            <Pressable
                                key={t}
                                style={[
                                    styles.optionChip,
                                    valueTier === t && styles.optionChipActive
                                ]}
                                onPress={() => onChange({ score: valueScore, tier: t as any })}
                            >
                                <Text style={[
                                    styles.optionChipText,
                                    valueTier === t && styles.optionChipTextActive
                                ]}>
                                    {t}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </>
            ) : hasAssessment ? (
                // Case B: No Skill + Assessment Available -> Show Calibration
                <SkillCalibration gameKey={gameKey} onComplete={handleCalibrationComplete} />
            ) : (
                // Case C: No Skill + No Assessment -> Show manual bracket selector
                <>
                    <Text style={[styles.sectionLabel, { fontSize: 13, marginBottom: 8 }]}>
                        Match Bracket
                    </Text>
                    <View style={styles.chipRow}>
                        {tiers.map((t) => (
                            <Pressable
                                key={t}
                                style={[
                                    styles.optionChip,
                                    selectedTier === t && styles.optionChipActive
                                ]}
                                onPress={() => onChange({ score: valueScore, tier: t as any })}
                            >
                                <Text style={[
                                    styles.optionChipText,
                                    selectedTier === t && styles.optionChipTextActive
                                ]}>
                                    {t}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </>
            )}

            <Text style={styles.helperTiny}>
                This sets the minimum skill bracket for your matchroom.
            </Text>
        </View>
    );
}
