// ─── TutorEmptyState ─────────────────────────────────────────
// Shown on the Home screen when the user is onboarded but has
// no study data yet for the intelligence engine to analyze.
// Encourages the first study session with a warm, tutor-like nudge.

import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/tokens';
import { Typography } from './ui/Typography';
import type { UserPreferences } from '@kd/shared';

interface Props {
  preferences: Pick<UserPreferences, 'studyPersonality' | 'sessionPreference'> | null | undefined;
}

export function TutorEmptyState({ preferences }: Props) {
  const { theme } = useTheme();
  const router = useRouter();

  const personality = preferences?.studyPersonality;
  const sessionPref = preferences?.sessionPreference;

  // Personality-tuned message
  const message = personality
    ? `As a ${personality}, your study insights will be powered by real data. Complete your first session to unlock your personalized AI tutor.`
    : 'Complete your first study session to unlock your AI tutor — personalized insights, memory tracking, and exam readiness.';

  const ctaLabel = sessionPref === 'quick'
    ? '⚡ Quick 5-min Session'
    : sessionPref === 'deep'
      ? '📚 Start a Deep Session'
      : '🎯 Start Studying';

  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <View style={{
        backgroundColor: theme.card,
        borderRadius: radius['2xl'],
        padding: spacing.xl,
        gap: spacing.lg,
        borderWidth: 1,
        borderColor: theme.primary + '25',
        alignItems: 'center',
      }}>
        {/* Illustration */}
        <View style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: theme.primary + '12',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography style={{ fontSize: 36 }}>🧠</Typography>
        </View>

        <View style={{ gap: spacing.xs, alignItems: 'center' }}>
          <Typography variant="label" style={{ textAlign: 'center' }}>
            Your AI Tutor is Warming Up
          </Typography>
          <Typography variant="body" color={theme.textSecondary} style={{ textAlign: 'center', lineHeight: 20 }}>
            {message}
          </Typography>
        </View>

        {/* What you'll unlock */}
        <View style={{ gap: spacing.sm, width: '100%' }}>
          {[
            { icon: '📊' as const, label: 'Exam Readiness Score' },
            { icon: '🧠' as const, label: 'Knowledge Health Map' },
            { icon: '⚠️' as const, label: 'Memory Decay Alerts' },
            { icon: '🎯' as const, label: 'Personalized Study Plan' },
          ].map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Typography style={{ fontSize: 14 }}>{item.icon}</Typography>
              <Typography variant="bodySmall" color={theme.textTertiary}>
                {item.label}
              </Typography>
              <View style={{
                marginLeft: 'auto',
                backgroundColor: theme.primary + '15',
                borderRadius: radius.full,
                paddingHorizontal: 6, paddingVertical: 2,
              }}>
                <Typography variant="caption" color={theme.primary} style={{ fontSize: 9 }}>
                  UNLOCK
                </Typography>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/study')}
          activeOpacity={0.85}
          accessibilityRole="button"
          style={{
            backgroundColor: theme.primary,
            borderRadius: radius.xl,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="play-circle" size={18} color="#FFFFFF" />
          <Typography variant="label" color="#FFFFFF">{ctaLabel}</Typography>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
