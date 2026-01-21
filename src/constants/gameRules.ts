import { CS2_ROLES, FUTSAL_POSITIONS, INDOOR_CRICKET_ROLES, PADEL_ROLES, PICKLEBALL_ROLES } from "../../constants/profileOptions";

export type PlatformStatus = 'idle' | 'verifying' | 'verified' | 'taken' | 'error';

export interface PlatformState<T = any> {
    status: PlatformStatus;
    message?: string;
    data?: T;
    lastCheckedAt?: number;
}

export type GameRule = {
    label: string;
    requiresOneOf?: string[];
    roles?: readonly string[];
    multi?: boolean;
    max?: number;
    skillSource?: string[];
    hasFormation?: boolean;
    hasCharacters?: boolean;
    hasPosition?: boolean;
};

export const GAME_RULES: Record<string, GameRule> = {
    cs2: {
        label: 'Counter-Strike 2',
        requiresOneOf: ['steam', 'faceit'],
        roles: CS2_ROLES,
        multi: false,
        skillSource: ['faceit', 'steam']
    },
    fc26: {
        label: 'FC 26',
        requiresOneOf: ['steam', 'psn', 'xbox'],
        multi: false,
        hasFormation: true,
        skillSource: ['psn', 'steam']
    },
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
