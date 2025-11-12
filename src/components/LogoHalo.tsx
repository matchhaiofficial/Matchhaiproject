import { Image, View } from 'react-native';
import { COLORS } from '../theme';

export default function LogoHalo() {
  return (
    <View
      pointerEvents="box-none"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Logo */}
      <Image
        source={require('../../assets/logo.png')}
        style={{ width: 400, height: 400, resizeMode: 'contain' }}
      />
    </View>
  );
}
