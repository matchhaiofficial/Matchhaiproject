// src/constants/skillQuestions.ts

export type SkillTier = 'Beginner' | 'Casual' | 'Intermediate' | 'Advanced' | 'Pro' | 'Elite';

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
    maxScore: number;
    rating: number;
    tier: SkillTier;
}

export interface GameAssessmentConfig {
    questions: SkillQuestion[];
    thresholds: ScoreThreshold[];
}

const FC_ASSESSMENT_CONFIG: GameAssessmentConfig = {
    questions: [
        {
            id: 'grindMode',
            label: 'What do you play most in FC26?',
            options: [
                { label: 'Friendlies / Kick Off', value: 0 },
                { label: 'Seasons / Volta', value: 1 },
                { label: 'Rivals sometimes', value: 2 },
                { label: 'Rivals + Champs', value: 3 },
            ]
        },
        {
            id: 'rivalsBracket',
            label: 'Where are you in Division Rivals usually?',
            options: [
                { label: "Don't really play", value: 0 },
                { label: 'Div 8-10', value: 1 },
                { label: 'Div 5-7', value: 2 },
                { label: 'Div 3-4', value: 3 },
                { label: 'Div 1-2 / Elite', value: 4 },
            ]
        }
    ],
    thresholds: [
        { maxScore: 1, rating: 20, tier: 'Beginner' },
        { maxScore: 3, rating: 45, tier: 'Intermediate' },
        { maxScore: 5, rating: 70, tier: 'Advanced' },
        { maxScore: 99, rating: 90, tier: 'Pro' }
    ]
};

export const SKILL_ASSESSMENT_CONFIG: Record<string, GameAssessmentConfig> = {
    cs16: {
        questions: [
            {
                id: 'experience',
                label: 'How long have you been playing CS 1.6 competitively?',
                options: [
                    { label: 'New or mostly casual', value: 0 },
                    { label: 'Up to 1 year', value: 1 },
                    { label: '1-3 years', value: 2 },
                    { label: '3+ years', value: 3 },
                ]
            },
            {
                id: 'environment',
                label: 'What level do you usually play at?',
                options: [
                    { label: 'Public servers / casual mix', value: 0 },
                    { label: 'Local scrims / mixes', value: 1 },
                    { label: 'Regular team practice', value: 2 },
                    { label: 'Serious tournaments / leagues', value: 3 },
                ]
            },
            {
                id: 'impact',
                label: 'How often do you top-frag or carry rounds against your usual opponents?',
                options: [
                    { label: 'Rarely', value: 0 },
                    { label: 'Sometimes', value: 1 },
                    { label: 'Often', value: 2 },
                    { label: 'Very often', value: 3 },
                ]
            }
        ],
        thresholds: [
            { maxScore: 2, rating: 25, tier: 'Beginner' },
            { maxScore: 5, rating: 50, tier: 'Intermediate' },
            { maxScore: 7, rating: 75, tier: 'Advanced' },
            { maxScore: 99, rating: 90, tier: 'Pro' }
        ]
    },
    valorant: {
        questions: [
            {
                id: 'recent_rank',
                label: 'What is your most recent VALORANT competitive rank?',
                options: [
                    { label: 'Iron / Bronze', value: 1 },
                    { label: 'Silver', value: 2 },
                    { label: 'Gold', value: 3 },
                    { label: 'Platinum', value: 4 },
                    { label: 'Diamond / Ascendant / Immortal+', value: 5 },
                    { label: 'I have not played ranked recently', value: 2 },
                ]
            },
            {
                id: 'match_performance',
                label: 'In matches around your level, where do you usually finish?',
                options: [
                    { label: 'Usually bottom frag', value: 1 },
                    { label: 'Usually lower half', value: 2 },
                    { label: 'Usually middle of the scoreboard', value: 3 },
                    { label: 'Usually top 3', value: 4 },
                    { label: 'Usually team/match MVP often', value: 5 },
                ]
            },
            {
                id: 'game_sense',
                label: 'Which description fits you best?',
                options: [
                    { label: 'I am still learning crosshair placement, movement, and positioning', value: 1 },
                    { label: 'My aim is decent, but I struggle with consistency', value: 2 },
                    { label: 'I can trade well, play with team, and use utility properly', value: 3 },
                    { label: 'I have strong game sense and can carry rounds with decisions', value: 4 },
                    { label: 'I can consistently impact games with both aim and smart utility usage', value: 5 },
                ]
            }
        ],
        thresholds: [
            { maxScore: 5, rating: 20, tier: 'Beginner' },
            { maxScore: 8, rating: 45, tier: 'Casual' },
            { maxScore: 11, rating: 65, tier: 'Intermediate' },
            { maxScore: 13, rating: 82, tier: 'Advanced' },
            { maxScore: 15, rating: 97, tier: 'Elite' }
        ]
    },
    fc26: FC_ASSESSMENT_CONFIG,
    fc25: FC_ASSESSMENT_CONFIG,
    tekken8: {
        questions: [
            {
                id: 'experience',
                label: 'How long have you played seriously?',
                options: [
                    { label: '< 3 months', value: 0 },
                    { label: '3-12 months', value: 1 },
                    { label: '1-3 years', value: 2 },
                    { label: '3+ years', value: 3 },
                ]
            },
            {
                id: 'environment',
                label: 'Where do you usually play?',
                options: [
                    { label: 'Casual / Friends', value: 0 },
                    { label: 'Local Gaming Zones', value: 1 },
                    { label: 'Entered local tourney', value: 2 },
                    { label: 'Regular tourney player', value: 3 },
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
    futsal: {
        questions: [
            {
                id: 'frequency',
                label: 'How often do you play?',
                options: [
                    { label: 'Once a month or less', value: 0 },
                    { label: '1x / week', value: 1 },
                    { label: '2-3x / week', value: 2 },
                    { label: 'Almost daily', value: 3 },
                ]
            },
            {
                id: 'level',
                label: 'What describes your games?',
                options: [
                    { label: 'Casual w/ friends', value: 0 },
                    { label: 'Organized / Turf', value: 1 },
                    { label: 'College / Club', value: 2 },
                    { label: 'League / Tournament', value: 3 },
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
    indoor_cricket: {
        questions: [
            {
                id: 'experience',
                label: 'How long have you played matches?',
                options: [
                    { label: '< 6 months', value: 0 },
                    { label: '6-24 months', value: 1 },
                    { label: '2-4 years', value: 2 },
                    { label: '4+ years', value: 3 },
                ]
            },
            {
                id: 'competitionLevel',
                label: "What's your usual level?",
                options: [
                    { label: 'Friends / Casual', value: 0 },
                    { label: 'Indoor Leagues', value: 2 },
                    { label: 'Serious Tournaments', value: 3 },
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
    padel: {
        questions: [
            {
                id: 'experience',
                label: 'How long have you been playing Padel?',
                options: [
                    { label: 'New (< 6 months)', value: 0 },
                    { label: '6-24 months', value: 1 },
                    { label: '2-4 years', value: 2 },
                    { label: '4+ years', value: 3 },
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
    pickleball: {
        questions: [
            {
                id: 'pickleballLevel',
                label: 'Which option fits you best?',
                options: [
                    { label: 'Learning / Casual', value: 0 },
                    { label: 'Regular Rec Games', value: 1 },
                    { label: 'Club / Ladder', value: 2 },
                    { label: 'Tournament Player', value: 3 },
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
