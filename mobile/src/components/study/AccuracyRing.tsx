// ─── AccuracyRing ───────────────────────────────────────────
// Animated circular progress ring that fills to the accuracy percentage.
// Uses Reanimated + SVG-like approach via a circular View with
// rotating clip masks for compatibility without react-native-svg.
//
// For simplicity and maximum compatibility, this uses a "half-circle"
// rotation technique with two overlay halves.

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Typography } from '../ui/Typography';

interface AccuracyRingProps {
  /** Accuracy percentage 0-100 */
  percentage: number;
  /** Ring diameter */
  size?: number;
  /** Ring stroke thickness */
  strokeWidth?: number;
  /** Color of the filled portion */
  color: string;
  /** Color of the unfilled track */
  trackColor: string;
  /** Background color of inner circle */
  backgroundColor: string;
  /** Text color for the percentage label */
  textColor: string;
  /** Emoji or extra text to show below the percentage */
  emoji?: string;
  /** Delay before animation starts (ms) */
  delay?: number;
}

export function AccuracyRing({
  percentage,
  size = 120,
  strokeWidth = 8,
  color,
  trackColor,
  backgroundColor,
  textColor,
  emoji,
  delay = 300,
}: AccuracyRingProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(Math.min(percentage, 100) / 100, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const half = size / 2;

  // Right half (0-180°): rotates from -180° to 0°
  const rightHalfStyle = useAnimatedStyle(() => {
    const deg = Math.min(progress.value * 360, 180);
    return { transform: [{ rotate: `${deg - 180}deg` }] };
  });

  // Left half (180-360°): rotates from -180° to 0°, only visible past 50%
  const leftHalfStyle = useAnimatedStyle(() => {
    const deg = Math.max((progress.value * 360) - 180, 0);
    return { transform: [{ rotate: `${deg - 180}deg` }] };
  });

  // The left half track should be hidden until progress > 50%
  const leftCoverStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5 ? color : trackColor,
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Track */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: half,
          backgroundColor: trackColor,
        }}
      />

      {/* Right half clip */}
      <View
        style={{
          position: 'absolute',
          width: half,
          height: size,
          right: 0,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            rightHalfStyle,
            {
              width: half,
              height: size,
              backgroundColor: color,
              borderTopRightRadius: half,
              borderBottomRightRadius: half,
              transformOrigin: 'left center',
            },
          ]}
        />
      </View>

      {/* Left half clip */}
      <View
        style={{
          position: 'absolute',
          width: half,
          height: size,
          left: 0,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            leftCoverStyle,
            {
              position: 'absolute',
              width: half,
              height: size,
              borderTopLeftRadius: half,
              borderBottomLeftRadius: half,
            },
          ]}
        />
        <Animated.View
          style={[
            leftHalfStyle,
            {
              width: half,
              height: size,
              backgroundColor: color,
              borderTopLeftRadius: half,
              borderBottomLeftRadius: half,
              transformOrigin: 'right center',
            },
          ]}
        />
      </View>

      {/* Inner circle (cutout) */}
      <View
        style={{
          width: size - strokeWidth * 2,
          height: size - strokeWidth * 2,
          borderRadius: (size - strokeWidth * 2) / 2,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        {emoji && (
          <Typography variant="h2" style={{ fontSize: size * 0.22 }}>
            {emoji}
          </Typography>
        )}
        <Typography variant="h3" color={textColor} style={{ fontSize: size * 0.2 }}>
          {percentage}%
        </Typography>
      </View>
    </View>
  );
}
