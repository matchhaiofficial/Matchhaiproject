// constants/matchConfig.ts
import {
    CS2_ROLES,
    FC_FORMATIONS,
    FUTSAL_POSITIONS,
    INDOOR_CRICKET_COMPOSITIONS,
    INDOOR_CRICKET_ROLES,
    PADEL_ROLES,
    PICKLEBALL_ROLES,
    TEKKEN_CHARACTERS
} from './profileOptions';

// CS2 Maps
export const CS2_MAPS = [
    'Dust II',
    'Mirage',
    'Inferno',
    'Nuke',
    'Overpass',
    'Vertigo',
    'Ancient',
    'Anubis',
] as const;

// Game Team Configuration
export const GAME_TEAM_CONFIG = {
    cs2: {
        maxTeamSize: 5,
        captainMaxSlots: 5,
        memberMaxSlots: 3,
        formats: ['5v5', '3v3', '2v2'] as const,
        supportsTeams: true,
    },
    fc25: {
        maxTeamSize: 2,
        captainMaxSlots: 2,
        memberMaxSlots: 2,
        formats: ['1v1', '2v2'] as const,
        supportsTeams: true,
    },
    fc26: {
        maxTeamSize: 2,
        captainMaxSlots: 2,
        memberMaxSlots: 2,
        formats: ['1v1', '2v2'] as const,
        supportsTeams: true,
    },
    tekken8: {
        maxTeamSize: 2,
        captainMaxSlots: 2,
        memberMaxSlots: 2,
        formats: ['1v1', '2v2'] as const,
        supportsTeams: true,
    },
    futsal: {
        maxTeamSize: 8,
        captainMaxSlots: 8,
        memberMaxSlots: 4,
        formats: ['5v5', '6v6'] as const,
        supportsTeams: true,
    },
    indoor_cricket: {
        maxTeamSize: 8,
        captainMaxSlots: 8,
        memberMaxSlots: 4,
        formats: ['8-a-side'] as const,
        supportsTeams: true,
    },
    padel: {
        maxTeamSize: 4,
        captainMaxSlots: 2,
        memberMaxSlots: 2,
        formats: ['2v2'] as const,
        supportsTeams: true,
    },
    pickleball: {
        maxTeamSize: 2,
        captainMaxSlots: 2,
        memberMaxSlots: 2,
        formats: ['1v1', '2v2'] as const,
        supportsTeams: true,
    },
} as const;

export type GameKey = keyof typeof GAME_TEAM_CONFIG;

// Game-Specific Field Definitions
export const GAME_FIELDS = {
    cs2: {
        formats: GAME_TEAM_CONFIG.cs2.formats,
        maps: CS2_MAPS,
        roles: CS2_ROLES,
        skillLevels: [
            { label: 'Any', value: 'any' },
            { label: 'FACEIT 1-3', value: 'faceit_1_3' },
            { label: 'FACEIT 4-6', value: 'faceit_4_6' },
            { label: 'FACEIT 7-10', value: 'faceit_7_10' },
        ] as const,
    },
    fc25: {
        formats: GAME_TEAM_CONFIG.fc25.formats,
        formations: FC_FORMATIONS,
        playstyles: ['Possession', 'Counter-Attack', 'High Press', 'Defensive'] as const,
    },
    fc26: {
        formats: GAME_TEAM_CONFIG.fc26.formats,
        formations: FC_FORMATIONS,
        playstyles: ['Possession', 'Counter-Attack', 'High Press', 'Defensive'] as const,
    },
    tekken8: {
        formats: GAME_TEAM_CONFIG.tekken8.formats,
        characters: TEKKEN_CHARACTERS,
        rankLevels: [
            'Beginner',
            'Trainee',
            'Fighter',
            'Strategist',
            'Combatant',
            'Warrior',
            'Assailant',
            'Dominator',
            'Vanquisher',
            'Destroyer',
            'Eliminator',
            'Garyu',
            'Shinryu',
            'Tenryu',
            'Mighty Ruler',
            'Flame Ruler',
            'Battle Ruler',
            'Fujin',
            'Raijin',
            'Kishin',
            'Bushin',
            'Tekken King',
            'Tekken Emperor',
            'Tekken God',
            'Tekken God Supreme',
        ] as const,
    },
    futsal: {
        formats: GAME_TEAM_CONFIG.futsal.formats,
        positions: FUTSAL_POSITIONS,
        formations: [
            {
                name: '2-2 (Diamond)',
                format: '5v5',
                description: '1 GK, 2 Defenders, 2 Attackers',
                positions: { Goalkeeper: 1, Defender: 2, Midfielder: 0, Winger: 1, Striker: 1 }
            },
            {
                name: '3-1 (Defensive)',
                format: '5v5',
                description: '1 GK, 3 Defenders, 1 Striker',
                positions: { Goalkeeper: 1, Defender: 3, Midfielder: 0, Winger: 0, Striker: 1 }
            },
            {
                name: '1-2-1 (Balanced)',
                format: '5v5',
                description: '1 GK, 1 Defender, 2 Midfielders, 1 Striker',
                positions: { Goalkeeper: 1, Defender: 1, Midfielder: 2, Winger: 0, Striker: 1 }
            },
            {
                name: '2-1-1 (Standard)',
                format: '5v5',
                description: '1 GK, 2 Defenders, 1 Midfielder, 1 Striker',
                positions: { Goalkeeper: 1, Defender: 2, Midfielder: 1, Winger: 0, Striker: 1 }
            },
            {
                name: '2-2-1',
                format: '6v6',
                description: '1 GK, 2 Defenders, 2 Midfielders, 1 Striker',
                positions: { Goalkeeper: 1, Defender: 2, Midfielder: 2, Winger: 0, Striker: 1 }
            },
            {
                name: '3-1-1',
                format: '6v6',
                description: '1 GK, 3 Defenders, 1 Midfielder, 1 Striker',
                positions: { Goalkeeper: 1, Defender: 3, Midfielder: 1, Winger: 0, Striker: 1 }
            },
            {
                name: '2-3 (Attacking)',
                format: '6v6',
                description: '1 GK, 2 Defenders, 2 Midfielders, 1 Winger',
                positions: { Goalkeeper: 1, Defender: 2, Midfielder: 2, Winger: 1, Striker: 0 }
            },
        ] as const,
    },
    indoor_cricket: {
        formats: GAME_TEAM_CONFIG.indoor_cricket.formats,
        roles: INDOOR_CRICKET_ROLES,
        overs: [5, 6] as const,
        compositions: INDOOR_CRICKET_COMPOSITIONS,
    },
    padel: {
        formats: GAME_TEAM_CONFIG.padel.formats,
        roles: PADEL_ROLES,
        seriesTypes: ['BO3', 'BO5', 'BO10'] as const,
    },
    pickleball: {
        formats: GAME_TEAM_CONFIG.pickleball.formats,
        roles: PICKLEBALL_ROLES,
        seriesTypes: ['BO3', 'BO5', 'BO10'] as const,
    },
} as const;

// Helper function
export function getGameConfig(gameKey: GameKey) {
    return GAME_TEAM_CONFIG[gameKey];
}

export function getGameFields(gameKey: GameKey) {
    return GAME_FIELDS[gameKey];
}
