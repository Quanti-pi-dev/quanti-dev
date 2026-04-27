// ─── UpNextHeroCard ───────────────────────────────────────────
// Full-width hero card for the "Up Next for You" section.
// Features: LinearGradient header, animated mastery stage dots,
// pulsing "Start" CTA, staggered entrance.

import { useEffect } from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { radius, spacing } from '../theme/tokens';
import { Typography } from './ui/Typography';

// 5-stage mastery dots (Beginner → Master)
const MASTERY_STAGES = ['Beginner', 'Elementary', 'Developing', 'Proficient', 'Advanced'];

interface UpNextHeroCardProps {
  subjectName: string;
  examName?: string;
  description?: string;
  accentColor: string;
  gradientColors?: [string, string];
  icon: keyof typeof Ionicons['glyphMap'];
  currentStage?: number; // 0-based index into MASTERY_STAGES (0 = not started)
  onStart: () => void;
  animDelay?: number;
  style?: ViewStyle;
}

export function UpNextHeroCard({
  subjectName,
  examName,
  description,
  accentColor,
  gradientColors,
  icon,
  currentStage = 0,
  onStart,
  animDelay = 0,
  style,
}: UpNextHeroCardProps) {
  const { theme } = useTheme();

  const grad: [string, string] = gradientColors ?? [accentColor + 'CC', accentColor + '88'];

  // ── Entrance ────────────────────────────────────────────────
  const translateY = useSharedValue(32);
  const opacity    = useSharedValue(0);
  useEffect(() => {
    translateY.value = withDelay(animDelay, withSpring(0, { stiffness: 120, damping: 18 }));
    opacity.value    = withDelay(animDelay, withTiming(1, { duration: 400 }));
  }, [animDelay]);

  // ── Pulsing CTA ─────────────────────────────────────────────
  const pulseScale = useSharedValue(1);
  const pulseGlow  = useSharedValue(0.8);
  useEffect(() => {
    pulseScale.value = withDelay(
      animDelay + 700,
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: 750 }),
          withTiming(1,    { duration: 750 }),
        ),
        -1,
      ),
    );
    pulseGlow.value = withDelay(
      animDelay + 700,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 750 }),
          withTiming(0.7, { duration: 750 }),
        ),
        -1,
      ),
    );
  }, [animDelay]);

  const entryStyle  = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));
  const pulseStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseGlow.value,
  }));

  return (
    <Animated.View style={[entryStyle, style]}>
      <View
        style={{
          borderRadius: radius['2xl'],
          overflow: 'hidden',
          // Drop shadow
          shadowColor: accentColor,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        {/* ── Gradient header ─────────────────────────────── */}
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xl,
            paddingBottom: spacing.lg,
            gap: spacing.sm,
          }}
        >
          {/* Overline row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)' }} />
            <Typography variant="overline" color="rgba(255,255,255,0.85)">
              Up Next for You
            </Typography>
          </View>

          {/* Icon + subject title row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <View
              style={{
                width: 56, height: 56, borderRadius: radius.xl,
                backgroundColor: 'rgba(255,255,255,0.22)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name={icon} size={28} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              {examName && (
                <Typography variant="caption" color="rgba(255,255,255,0.75)">
                  {examName}
                </Typography>
              )}
              <Typography variant="h3" color="#FFFFFF">
                {subjectName}
              </Typography>
              {description && (
                <Typography variant="bodySmall" color="rgba(255,255,255,0.75)" numberOfLines={2}>
                  {description}
                </Typography>
              )}
            </View>
          </View>

          {/* ── Mastery stage dots ─────────────────────────── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
            {MASTERY_STAGES.map((stage, i) => {
              const isActive  = i === currentStage;
              const isPast    = i < currentStage;
              return (
                <View key={stage} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View
                    style={{
                      width: isActive ? 10 : 8,
                      height: isActive ? 10 : 8,
                      borderRadius: isActive ? 5 : 4,
                      backgroundColor: isPast || isActive
                        ? '#FFFFFF'
                        : 'rgba(255,255,255,0.35)',
                      borderWidth: isActive ? 2 : 0,
                      borderColor: 'rgba(255,255,255,0.6)',
                    }}
                  />
                  {i < MASTERY_STAGES.length - 1 && (
                    <View
                      style={{
                        width: 16, height: 1.5,
                        backgroundColor: isPast ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)',
                        borderRadius: 1,
                      }}
                    />
                  )}
                </View>
              );
            })}
            <Typography variant="caption" color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }}>
              {MASTERY_STAGES[currentStage] ?? 'Beginner'}
            </Typography>
          </View>
        </LinearGradient>

        {/* ── Footer ──────────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            gap: spacing.md,
            backgroundColor: theme.card,
          }}
        >
          <Typography
            variant="caption"
            color={theme.textTertiary}
            style={{ flex: 1 }}
          >
            Answer a few questions to unlock your level and get personalised recommendations.
          </Typography>

          <Animated.View style={pulseStyle}>
            <TouchableOpacity
              onPress={onStart}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={`Start studying ${subjectName}`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                backgroundColor: accentColor,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm + 2,
                borderRadius: radius.full,
                shadowColor: accentColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Typography variant="label" color="#FFFFFF">Start</Typography>
              <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}
