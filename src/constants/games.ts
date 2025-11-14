import { ImageSourcePropType } from 'react-native';

export type GameDefinition = {
  id: string;
  name: string;
  description: string;
  image?: ImageSourcePropType | null;
};

/**
 * Images are optional so the bundle still builds even if the files have not been provided yet.
 * Drop the png assets inside `assets/games/` and update the require paths below when available.
 */
export const COMPETITIVE_GAMES: GameDefinition[] = [
  {
    id: 'cs2',
    name: 'Counter Strike 2',
    description: 'Tactical FPS with competitive ranking system',
    image: null,
  },
  {
    id: 'valorant',
    name: 'Valorant',
    description: 'Character based tactical shooter with unique abilities',
    image: null,
  },
  {
    id: 'fc25',
    name: 'FC 25',
    description: 'Competitive football game with online divisions',
    image: null,
  },
  {
    id: 'tekken8',
    name: 'Tekken 8',
    description: '1v1 fighting game with ranked leaderboards',
    image: null,
  },
];
