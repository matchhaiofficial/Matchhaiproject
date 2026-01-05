// src/constants/skillQuestions.ts

export type SkillTier = 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro' | 'Elite';

export interface AnswerOption {
    label: string;
    value: number;
}

export interface SkillQuestion {
    id: string;
    label: string;
    options: AnswerOption[];
}

export interface ScoreThreshold {
    maxScore: number; // If total score <= this
    rating: number;   // Assign this rating
    tier: SkillTier;
}

export interface GameAssessmentConfig {
    questions: SkillQuestion[];
    thresholds: ScoreThreshold[];
}

export const SKILL_ASSESSMENT_CONFIG: Record<string, GameAssessmentConfig> = {
    // --- FC 26 / FC 25 ---
    fc26: {
        questions: [
            {
                id: 'grindMode',
                label: 'What do you play most in FC 26?',
                options: [
                    { label: "Friendlies / Kick Off", value: 0 },
                    { label: "Seasons / Volta", value: 1 },
                    { label: "Rivals sometimes", value: 2 },
                    { label: "Rivals + Champs", value: 3 },
                ]
            },
            {
                id: 'rivalsBracket',
                label: 'Where are you in Division Rivals usually?',
                options: [
                    { label: "Don't really play", value: 0 },
                    { label: "Div 8–10", value: 1 },
                    { label: "Div 5–7", value: 2 },
                    { label: "Div 3–4", value: 3 },
                    { label: "Div 1–2 / Elite", value: 4 },
                ]
            }
        ],
        thresholds: [
            { maxScore: 1, rating: 20, tier: 'Beginner' },
            { maxScore: 3, rating: 45, tier: 'Intermediate' },
            { maxScore: 5, rating: 70, tier: 'Advanced' },
            { maxScore: 99, rating: 90, tier: 'Pro' }
        ]
    },
    // Reuse for FC25
    fc25: {
        questions: [
            {
                id: 'grindMode',
                label: 'What do you play most in FC?',
                options: [
                    { label: "Friendlies / Kick Off", value: 0 },
                    { label: "Seasons / Volta", value: 1 },
                    { label: "Rivals sometimes", value: 2 },
                    { label: "Rivals + Champs", value: 3 },
                ]
            },
            {
                id: 'rivalsBracket',
                label: 'Where are you in Division Rivals usually?',
                options: [
                    { label: "Don't really play", value: 0 },
                    { label: "Div 8–10", value: 1 },
                    { label: "Div 5–7", value: 2 },
                    { label: "Div 3–4", value: 3 },
                    { label: "Div 1–2 / Elite", value: 4 },
                ]
            }
        ],
        thresholds: [
            { maxScore: 1, rating: 20, tier: 'Beginner' },
            { maxScore: 3, rating: 45, tier: 'Intermediate' },
            { maxScore: 5, rating: 70, tier: 'Advanced' },
            { maxScore: 99, rating: 90, tier: 'Pro' }
        ]
    },

    // --- Tekken 8 ---
    tekken8: {
        questions: [
            {
                id: 'experience',
                label: 'How long have you played seriously?',
                options: [
                    { label: "< 3 months", value: 0 },
                    { label: "3–12 months", value: 1 },
                    { label: "1–3 years", value: 2 },
                    { label: "3+ years", value: 3 },
                ]
            },
            {
                id: 'environment',
                label: 'Where do you usually play?',
                options: [
                    { label: "Casual / Friends", value: 0 },
                    { label: "Local Gaming Zones", value: 1 },
                    { label: "Entered local tourney", value: 2 },
                    { label: "Regular tourney player", value: 3 },
                ]
            }
        ],
        thresholds: [
            { maxScore: 1, rating: 20, tier: 'Beginner' },
            { maxScore: 3, rating: 50, tier: 'Intermediate' },
            { maxScore: 4, rating: 75, tier: 'Advanced' },
            { maxScore: 99, rating: 92, tier: 'Pro' }
        ]
    },

    // --- Futsal ---
    futsal: {
        questions: [
            {
                id: 'frequency',
                label: 'How often do you play?',
                options: [
                    { label: "Once a month or less", value: 0 },
                    { label: "1x / week", value: 1 },
                    { label: "2–3x / week", value: 2 },
                    { label: "Almost daily", value: 3 },
                ]
            },
            {
                id: 'level',
                label: 'What describes your games?',
                options: [
                    { label: "Casual w/ friends", value: 0 },
                    { label: "Organized / Turf", value: 1 },
                    { label: "College / Club", value: 2 },
                    { label: "League / Tournament", value: 3 },
                ]
            }
        ],
        thresholds: [
            { maxScore: 1, rating: 25, tier: 'Beginner' },
            { maxScore: 3, rating: 55, tier: 'Intermediate' },
            { maxScore: 4, rating: 75, tier: 'Advanced' },
            { maxScore: 99, rating: 90, tier: 'Pro' }
        ]
    },

    // --- Indoor Cricket ---
    indoor_cricket: {
        questions: [
            {
                id: 'experience',
                label: 'How long have you played matches?',
                options: [
                    { label: "< 6 months", value: 0 },
                    { label: "6–24 months", value: 1 },
                    { label: "2–4 years", value: 2 },
                    { label: "4+ years", value: 3 },
                ]
            },
            {
                id: 'competitionLevel',
                label: "What's your usual level?",
                options: [
                    { label: "Friends / Casual", value: 0 },
                    { label: "Indoor Leagues", value: 2 },
                    { label: "Serious Tournaments", value: 3 },
                ]
            }
        ],
        thresholds: [
            { maxScore: 1, rating: 25, tier: 'Beginner' },
            { maxScore: 3, rating: 55, tier: 'Intermediate' },
            { maxScore: 4, rating: 75, tier: 'Advanced' },
            { maxScore: 99, rating: 92, tier: 'Pro' }
        ]
    },

    // --- Padel ---
    padel: {
        questions: [
            {
                id: 'experience',
                label: 'How long have you been playing Padel?',
                options: [
                    { label: "New (< 6 months)", value: 0 },
                    { label: "6–24 months", value: 1 },
                    { label: "2–4 years", value: 2 },
                    { label: "4+ years", value: 3 },
                ]
            }
        ],
        thresholds: [
            { maxScore: 0, rating: 15, tier: 'Beginner' },
            { maxScore: 1, rating: 40, tier: 'Intermediate' },
            { maxScore: 2, rating: 70, tier: 'Advanced' },
            { maxScore: 99, rating: 90, tier: 'Pro' }
        ]
    },

    // --- Pickleball ---
    pickleball: {
        questions: [
            {
                id: 'pickleballLevel',
                label: 'Which option fits you best?',
                options: [
                    { label: "Learning / Casual", value: 0 },
                    { label: "Regular Rec Games", value: 1 },
                    { label: "Club / Ladder", value: 2 },
                    { label: "Tournament Player", value: 3 },
                ]
            }
        ],
        thresholds: [
            { maxScore: 0, rating: 20, tier: 'Beginner' },
            { maxScore: 1, rating: 45, tier: 'Intermediate' },
            { maxScore: 2, rating: 70, tier: 'Advanced' },
            { maxScore: 99, rating: 90, tier: 'Pro' }
        ]
    }
};
