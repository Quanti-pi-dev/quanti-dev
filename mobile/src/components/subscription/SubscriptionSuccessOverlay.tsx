// ─── Subscription Success Overlay ─────────────────────────────
// Full-screen celebratory overlay after trial/payment activation.
// Replaces the plain showAlert() with a premium conversion moment.

import { useEffect, useMemo } from 'react';
import { View, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle,
  withDelay, withTiming, withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

const { width: SW, height: SH } = Dimensions.get('window');
const SPARKLE_COLORS = ['#F59E0B', '#6366F1', '#10B981', '#EC4899', '#3B82F6', '#F97316'];

// ─── Sparkle particle ────────────────────────────────────────

function Sparkle({ delay, x, y, size, color }: {
  delay: number; x: number; y: number; size: number; color: string;
}) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSequence(
      withTiming(1.3, { duration: 300, easing: Easing.out(Easing.back(2)) }),
      withTiming(0, { duration: 600 }),
    ));
    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(300, withTiming(0, { duration: 400 })),
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[style, {
        position: 'absolute', left: x, top: y,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
      }]}
    />
  );
}

// ─── Component ───────────────────────────────────────────────

interface Props {
  visible: boolean;
  title: string;
  subtitle: string;
  buttonText: string;
  onDismiss: () => void;
}

export function SubscriptionSuccessOverlay({ visible, title, subtitle, buttonText, onDismiss }: Props) {
  const { theme } = useTheme();

  const sparkles = useMemo(() => {
    if (!visible) return [];
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.random() * (SW - 20),
      y: Math.random() * (SH * 0.5) + 40,
      size: Math.random() * 8 + 4,
      color: SPARKLE_COLORS[i % SPARKLE_COLORS.length],
      delay: Math.random() * 800 + 200,
    }));
  }, [visible]);

  useEffect(() => {
    if (visible) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 100, backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center', alignItems: 'center',
      }}
    >
      {sparkles.map(({ id, ...props }) => <Sparkle key={id} {...props} color={props.color ?? '#6366F1'} />)}

      <Animated.View
        entering={FadeInUp.delay(200).duration(500).springify().damping(15)}
        style={{
          backgroundColor: theme.card,
          borderRadius: radius['2xl'],
          padding: spacing['2xl'],
          marginHorizontal: spacing['2xl'],
          alignItems: 'center',
          gap: spacing.lg,
          borderWidth: 1.5,
          borderColor: '#6366F140',
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 24,
          elevation: 12,
        }}
      >
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Typography style={{ fontSize: 56, textAlign: 'center' }}>🎉</Typography>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <Typography variant="h2" align="center">{title}</Typography>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <Typography variant="body" color={theme.textSecondary} align="center">
            {subtitle}
          </Typography>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(800).duration(400)} style={{ width: '100%' }}>
          <TouchableOpacity onPress={onDismiss} activeOpacity={0.85}>
            <LinearGradient
              colors={['#6366F1', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: radius.lg,
                paddingVertical: spacing.md,
                alignItems: 'center',
              }}
            >
              <Typography variant="label" color="#FFFFFF">{buttonText}</Typography>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
