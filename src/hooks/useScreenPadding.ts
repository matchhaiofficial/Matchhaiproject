import { useWindowDimensions } from 'react-native';
import { SPACING } from '../theme';

export const useScreenPadding = () => {
    const { width } = useWindowDimensions();

    if (width <= 360) return 16;
    if (width <= 400) return 20;
    return SPACING.screenPadding;
};
