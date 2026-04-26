// ─── Trial Pass Banner ───────────────────────────────────────
// Shows a banner when the user has an active streak-triggered trial pass.
// Displays remaining days and a countdown to encourage conversion.

import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { useSubscription } from '../../contexts/SubscriptionContext';

export function TrialPassBanner() {
  const { theme } = useTheme();
  const { trialPass, subscription } = useSubscription();
  const router = useRouter();

  // Don't show if no trial pass, or if user already has a real subscription
  if (!trialPass?.active || subscription?.isActive) return null;

  const daysLeft = Math.ceil(trialPass.remainingSeconds / 86400);
  const hoursLeft = Math.ceil(trialPass.remainingSeconds / 3600);
  const timeLabel = daysLeft > 1 ? `${daysLeft} days` : `${hoursLeft} hours`;

  return (
    <View style={{
      marginHorizontal: spacing.xl,
      marginBottom: spacing.md,
      borderRadius: radius.xl,
      overflow: 'hidden',
    }}>
      <View style={{
        backgroundColor: '#6366F118',
        borderWidth: 1,
        borderColor: '#6366F140',
        borderRadius: radius.xl,
        padding: spacing.lg,
        gap: spacing.sm,
      }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{
            width: 32, height: 32, borderRadius: radius.full,
            backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="star" size={16} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="label" color="#6366F1">
              🎉 Pro Trial Active!
            </Typography>
            <Typography variant="caption" color={theme.textSecondary}>
              Your 7-day streak earned you free Pro access
            </Typography>
          </View>
        </View>

        {/* Countdown */}
        <View style={{
          backgroundColor: theme.card,
          borderRadius: radius.lg,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Ionicons name="time-outline" size={14} color="#F59E0B" />
            <Typography variant="caption" color={theme.textSecondary}>
              Expires in
            </Typography>
          </View>
          <Typography variant="label" color="#F59E0B">
            {timeLabel}
          </Typography>
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={() => router.push('/subscription')}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#6366F1',
            paddingVertical: spacing.sm,
            borderRadius: radius.lg,
            alignItems: 'center',
          }}
        >
          <Typography variant="label" color="#FFFFFF">
            Keep Pro — Subscribe Now
          </Typography>
        </TouchableOpacity>
      </View>
    </View>
  );
}
