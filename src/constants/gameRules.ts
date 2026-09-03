import { CS2_ROLES, FUTSAL_POSITIONS, INDOOR_CRICKET_ROLES, PADEL_ROLES, PICKLEBALL_ROLES, VALORANT_ROLES } from "../../constants/profileOptions";
import { isEnabledGameKey } from "../../constants/gameAvailability";

export type PlatformStatus = 'idle' | 'verifying' | 'verified' | 'taken' | 'error';

export interface PlatformState<T = any> {
    status: PlatformStatus;
    message?: string;
    data?: T;
    lastCheckedAt?: number;
}

export type GameRule = {
    label: string;
    // Keep legacy field for compatibility, but treat it as a verification hint in UI.
    requiresOneOf?: string[];
    roles?: readonly string[];
    multi?: boolean;
    max?: number;
    skillSource?: string[];
    hasFormation?: boolean;
    hasCharacters?: boolean;
    hasPosition?: boolean;
};

// Variable Format Configuration
export interface GameFormat {
    label: string;
    size: number;
}

export const GAME_FORMATS: Record<string, GameFormat[]> = {
    futsal: [
        { label: '5v5', size: 5 },
        { label: '6v6', size: 6 },
        { label: '7v7', size: 7 }
    ],
    indoor_cricket: [
        { label: '6v6', size: 6 }, // Common variant, adding for completeness
        { label: '8v8', size: 8 },
        { label: '10v10', size: 10 }
    ],
    tekken8: [
        { label: '1v1', size: 1 },
        { label: '2v2', size: 2 }
    ],
    fc26: [
        { label: '1v1', size: 1 },
        { label: '2v2', size: 2 }
    ],
    // Defaults for others to ensure no crash if not specified
    cs2: [{ label: '5v5', size: 5 }],
    cs16: [{ label: '5v5', size: 5 }],
    valorant: [{ label: '5v5', size: 5 }],
    pickleball: [{ label: 'Double', size: 2 }],
    padel: [{ label: 'Double', size: 2 }]
};

const FC_RULE: GameRule = {
    label: 'FC26',
    requiresOneOf: ['steam', 'psn', 'xbox'],
    multi: false,
    hasFormation: true,
    skillSource: ['psn', 'steam']
};

const ALL_GAME_RULES: Record<string, GameRule> = {
    cs2: {
        label: 'Counter-Strike 2',
        requiresOneOf: ['steam', 'faceit'],
        roles: CS2_ROLES,
        multi: false,
        skillSource: ['faceit', 'steam']
    },
    cs16: {
        label: 'CS 1.6',
        roles: CS2_ROLES,
        multi: false,
        skillSource: ['questionnaire']
    },
    valorant: {
        label: 'Valorant',
        roles: VALORANT_ROLES,
        multi: false,
        skillSource: ['questionnaire']
    },
    fc25: FC_RULE,
    fc26: FC_RULE,
    tekken8: {
        label: 'Tekken 8',
        requiresOneOf: ['steam', 'psn', 'xbox'],
        multi: true,
        max: 3,
        hasCharacters: true,
        skillSource: ['psn']
    },
    futsal: {
        label: 'Futsal',
        roles: FUTSAL_POSITIONS,
        multi: false,
        hasPosition: true
    },
    indoor_cricket: {
        label: 'Indoor Cricket',
        roles: INDOOR_CRICKET_ROLES,
        multi: false
    },
    padel: {
        label: 'Padel',
        roles: PADEL_ROLES,
        multi: false,
        hasPosition: true
    },
    pickleball: {
        label: 'Pickleball',
        roles: PICKLEBALL_ROLES,
        multi: false,
        hasPosition: true
    },
};

export const GAME_RULES: Record<string, GameRule> = Object.fromEntries(
    Object.entries(ALL_GAME_RULES).filter(([gameKey]) => isEnabledGameKey(gameKey)),
);
