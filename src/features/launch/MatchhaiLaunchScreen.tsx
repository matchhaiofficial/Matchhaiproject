import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { COLORS, FONTS } from "../../theme";

type MatchhaiLaunchScreenProps = {
  exiting?: boolean;
};

const LOGO = require("../../../assets/logo.png");

export default function MatchhaiLaunchScreen({ exiting = false }: MatchhaiLaunchScreenProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  const screenOpacity = useSharedValue(1);
  const logoProgress = useSharedValue(0);
  const copyProgress = useSharedValue(0);
  const progressValue = useSharedValue(0);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });

    const subscription = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (enabled) => setReduceMotion(enabled),
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      logoProgress.value = 1;
      copyProgress.value = 1;
      progressValue.value = 1;
      return;
    }

    logoProgress.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
    copyProgress.value = withDelay(
      180,
      withTiming(1, {
        duration: 460,
        easing: Easing.out(Easing.cubic),
      }),
    );
    progressValue.value = withTiming(1, {
      duration: 920,
      easing: Easing.out(Easing.cubic),
    });
  }, [copyProgress, logoProgress, progressValue, reduceMotion]);

  useEffect(() => {
    screenOpacity.value = withTiming(exiting ? 0 : 1, {
      duration: exiting ? 220 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [exiting, screenOpacity]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoProgress.value,
    transform: [
      {
        scale: interpolate(logoProgress.value, [0, 1], [0.98, 1]),
      },
      {
        translateY: interpolate(logoProgress.value, [0, 1], [6, 0]),
      },
    ],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(copyProgress.value, [0, 1], [0, 0.86]),
    transform: [
      {
        translateY: interpolate(copyProgress.value, [0, 1], [6, 0]),
      },
    ],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progressValue.value }],
  }));

  return (
    <Animated.View style={[styles.screen, screenStyle]}>
      <View style={styles.content}>
        <View style={styles.logoStage}>
          <Animated.View style={[styles.logoShell, logoStyle]}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        </View>

        <Animated.View style={[styles.copy, copyStyle]}>
          <Text style={styles.brand}>Matchhai</Text>
          <Text style={styles.tagline}>Khelo bina scene ke.</Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
          <Text style={styles.loadingText}>Preparing your session</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050607",
    overflow: "hidden",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logoStage: {
    width: 144,
    height: 144,
    alignItems: "center",
    justifyContent: "center",
  },
  logoShell: {
    width: 132,
    height: 132,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.025)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
  },
  logo: {
    width: 96,
    height: 96,
  },
  copy: {
    alignItems: "center",
    marginTop: 28,
  },
  brand: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 28,
    letterSpacing: 0,
  },
  tagline: {
    marginTop: 10,
    color: "rgba(255, 255, 255, 0.72)",
    fontFamily: FONTS.interMedium,
    fontSize: 14,
    letterSpacing: 0,
  },
  progressTrack: {
    width: 132,
    height: 2,
    marginTop: 28,
    overflow: "hidden",
    borderRadius: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  progressFill: {
    width: "100%",
    height: "100%",
    borderRadius: 1,
    backgroundColor: "rgba(66, 165, 245, 0.72)",
    transformOrigin: "left",
  },
  loadingText: {
    marginTop: 14,
    color: "rgba(255, 255, 255, 0.46)",
    fontFamily: FONTS.interMedium,
    fontSize: 12,
    letterSpacing: 0,
  },
});
