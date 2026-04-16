// ─── SubscriptionStatusCard ───────────────────────────────────
// Profile screen: shows current plan + days left, or upgrade CTA.

import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { useSubscription } from '../../contexts/SubscriptionContext';

export function SubscriptionStatusCard() {
  const { theme } = useTheme();
  const { isSubscribed, planTier, goToUpgrade } = useSubscriptionGate();
  const { subscription } = useSubscription();

  const tierColors: Record<number, [string, string]> = {
    0: ['#6B7280', '#9CA3AF'],
    1: ['#2563EB', '#60A5FA'],
    2: ['#6366F1', '#3B82F6'],
    3: ['#7C3AED', '#A78BFA'],
  };

  const tierGradient = tierColors[planTier] ?? tierColors[0] ?? ['#6B7280', '#9CA3AF'];

  if (!isSubscribed) {
    return (
      <TouchableOpacity
        onPress={goToUpgrade}
        activeOpacity={0.85}
        style={{
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.primary + '66',
          borderRadius: radius['2xl'],
          padding: spacing.xl,
          gap: spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              backgroundColor: theme.primaryMuted,
              width: 40,
              height: 40,
              borderRadius: radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="rocket-outline" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="label">No Active Plan</Typography>
            <Typography variant="caption" color={theme.textTertiary}>
              Unlock the full Quanti-pi experience
            </Typography>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.primary} />
        </View>
        <View
          style={{
            backgroundColor: theme.primary,
            borderRadius: radius.lg,
            paddingVertical: spacing.md,
            alignItems: 'center',
          }}
        >
          <Typography variant="label" color="#FFFFFF">View Plans</Typography>
        </View>
      </TouchableOpacity>
    );
  }

  const planName = subscription?.plan?.displayName ?? 'Active Plan';
  const daysLeft = subscription?.daysRemaining ?? 0;
  const expiryDate = new Date(subscription?.currentPeriodEnd ?? '').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });
  const isCanceling = subscription?.cancelAtPeriodEnd;

  return (
    <TouchableOpacity onPress={goToUpgrade} activeOpacity={0.88}>
      <LinearGradient
        colors={tierGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: radius['2xl'],
          padding: spacing.xl,
          gap: spacing.md,
        }}
      >
        {/* Plan header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="shield-checkmark" size={18} color="rgba(255,255,255,0.9)" />
            <Typography variant="h4" color="#FFFFFF">{planName}</Typography>
          </View>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.full,
            }}
          >
            <Typography variant="captionBold" color="#FFFFFF">
              {isCanceling ? `Cancels ${expiryDate}` : `${daysLeft}d left`}
            </Typography>
          </View>
        </View>

        {/* Days remaining bar */}
        <View
          style={{
            height: 6,
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: radius.full,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: radius.full,
              width: `${Math.min(100, (daysLeft / (subscription?.plan?.billingCycle === 'monthly' ? 30 : 7)) * 100)}%`,
            }}
          />
        </View>

        {/* Footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="rgba(255,255,255,0.7)">
            Renews {expiryDate}
          </Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Typography variant="caption" color="rgba(255,255,255,0.8)">Manage</Typography>
            <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.8)" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}
