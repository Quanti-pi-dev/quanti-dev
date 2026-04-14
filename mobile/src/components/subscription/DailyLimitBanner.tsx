// ─── DailyLimitBanner ─────────────────────────────────────────
// Shows exams used today vs. daily limit. Shown on Study screen
// when user has hit or is approaching their daily cap.
// Migrated from NativeWind className strings to inline styles + theme tokens.
// All marketing copy is admin-editable via platform_config.

import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { useConfig } from '../../contexts/ConfigContext';

interface DailyLimitBannerProps {
  examsUsedToday: number;
  /** Set true to show full wall (limit reached) vs. soft warning */
  limitReached: boolean;
}

export function DailyLimitBanner({ examsUsedToday, limitReached }: DailyLimitBannerProps) {
  const { theme } = useTheme();
  const { maxExamsPerDay, goToUpgrade } = useSubscriptionGate();
  const router = useRouter();
  const limitTitle = useConfig('daily_limit_title', 'Daily Limit Reached');
  const limitSubtitle = useConfig('daily_limit_subtitle', 'Upgrade for more daily access.');
  const socialProof = useConfig('social_proof_text', '');
  const coinCta = useConfig('daily_limit_coin_cta', '');

  const displayLimit = maxExamsPerDay === -1 ? '∞' : String(maxExamsPerDay);

  if (!limitReached) {
    // Soft warning: 1 remaining
    return (
      <View style={{
        backgroundColor: '#F59E0B14',
        borderWidth: 1,
        borderColor: '#F59E0B40',
        borderRadius: radius.xl,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}>
        <Ionicons name="warning-outline" size={16} color="#F59E0B" />
        <Typography variant="caption" color="#F59E0B" style={{ flex: 1 }}>
          {examsUsedToday}/{displayLimit} exams used today — 1 remaining
        </Typography>
      </View>
    );
  }

  // Hard wall
  return (
    <View style={{
      backgroundColor: '#EF444414',
      borderWidth: 1,
      borderColor: '#EF444440',
      borderRadius: radius['2xl'],
      padding: spacing.xl,
      gap: spacing.md,
      alignItems: 'center',
    }}>
      <View style={{
        width: 48, height: 48, borderRadius: radius.full,
        backgroundColor: '#EF444422',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="ban-outline" size={24} color="#EF4444" />
      </View>

      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Typography variant="label" style={{ textAlign: 'center' }}>
          {limitTitle}
        </Typography>
        <Typography variant="caption" color={theme.textTertiary} style={{ textAlign: 'center' }}>
          You've used {examsUsedToday}/{displayLimit} exams today.{'\n'}
          {limitSubtitle}
        </Typography>
        {socialProof ? (
          <Typography variant="caption" color={theme.primary} style={{ textAlign: 'center', fontStyle: 'italic', marginTop: 2 }}>
            {socialProof}
          </Typography>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={goToUpgrade}
        activeOpacity={0.85}
        style={{
          backgroundColor: theme.primary,
          paddingHorizontal: spacing['2xl'],
          paddingVertical: spacing.sm + 2,
          borderRadius: radius.xl,
        }}
      >
        <Typography variant="label" color="#FFFFFF">Upgrade Plan</Typography>
      </TouchableOpacity>

      {coinCta ? (
        <TouchableOpacity
          onPress={() => router.push('/shop' as never)}
          activeOpacity={0.7}
        >
          <Typography variant="caption" color={theme.primary} style={{ textAlign: 'center', textDecorationLine: 'underline' }}>
            {coinCta}
          </Typography>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
