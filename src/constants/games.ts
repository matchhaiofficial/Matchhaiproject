import { ImageSourcePropType } from 'react-native';

export type GameDefinition = {
  id: string;
  name: string;
  description: string;
  image: ImageSourcePropType;
};

export const COMPETITIVE_GAMES: GameDefinition[] = [
  {
    id: 'cs2',
    name: 'Counter Strike 2',
    description: 'Tactical FPS with competitive ranking system',
    image: require('../../assets/games/cs2.png'),
  },
  {
    id: 'valorant',
    name: 'Valorant',
    description: 'Character based tactical shooter with unique abilities',
    image: require('../../assets/games/valorant.png'),
  },
  {
    id: 'fc25',
    name: 'FC 25',
    description: 'Competitive football game with online divisions',
    image: require('../../assets/games/fc25.png'),
  },
  {
    id: 'tekken8',
    name: 'Tekken 8',
    description: '1v1 fighting game with ranked leaderboards',
    image: require('../../assets/games/tekken8.png'),
  },
];
