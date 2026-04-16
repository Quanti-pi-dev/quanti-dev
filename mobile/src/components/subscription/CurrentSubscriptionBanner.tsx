// ─── CurrentSubscriptionBanner ────────────────────────────────
// Shows active plan info at the top of the subscription screen.

import { View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { cancelSubscription, reactivateSubscription } from '../../services/subscription.service';
import { useSubscription } from '../../contexts/SubscriptionContext';
import type { SubscriptionSummary } from '@kd/shared';

interface CurrentSubscriptionBannerProps {
  subscription: SubscriptionSummary;
}

export function CurrentSubscriptionBanner({ subscription }: CurrentSubscriptionBannerProps) {
  const { theme } = useTheme();
  const { refreshSubscription } = useSubscription();
  const [loading, setLoading] = useState(false);

  const isCanceling = subscription.cancelAtPeriodEnd;
  const daysLeft = subscription.daysRemaining ?? 0;
  const expiryDate = new Date(subscription.currentPeriodEnd).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  async function handleCancel() {
    Alert.alert(
      'Cancel Subscription',
      `You'll keep access until ${expiryDate}. Cancel anyway?`,
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel', style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await cancelSubscription();
              await refreshSubscription();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert('Error', 'Could not cancel. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  }

  async function handleReactivate() {
    setLoading(true);
    try {
      await reactivateSubscription();
      await refreshSubscription();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not reactivate. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      style={{
        backgroundColor: theme.primaryMuted,
        borderWidth: 1,
        borderColor: theme.primary + '33',
        borderRadius: radius['2xl'],
        padding: spacing.xl,
        gap: spacing.md,
      }}
    >
      {/* Plan name row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              backgroundColor: theme.primaryMuted,
              width: 36,
              height: 36,
              borderRadius: radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="shield-checkmark" size={18} color={theme.primary} />
          </View>
          <View>
            <Typography variant="caption" color={theme.textTertiary}>Active Plan</Typography>
            <Typography variant="h4">{subscription.plan?.displayName ?? 'Pro'}</Typography>
          </View>
        </View>

        {isCanceling ? (
          <View
            style={{
              backgroundColor: theme.errorMuted,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.full,
            }}
          >
            <Typography variant="captionBold" color={theme.error}>Cancels {expiryDate}</Typography>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: theme.successMuted,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.full,
            }}
          >
            <Typography variant="captionBold" color={theme.success}>{daysLeft}d left</Typography>
          </View>
        )}
      </View>

      {/* Progress bar — days remaining */}
      <View>
        <View
          style={{
            height: 6,
            backgroundColor: theme.border,
            borderRadius: radius.full,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              backgroundColor: theme.primary,
              borderRadius: radius.full,
              width: `${Math.min(100, (daysLeft / 30) * 100)}%`,
            }}
          />
        </View>
        <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: spacing.xs }}>
          Renews {expiryDate}
        </Typography>
      </View>

      {/* Cancel / reactivate */}
      {loading ? (
        <ActivityIndicator size="small" color={theme.primary} />
      ) : isCanceling ? (
        <TouchableOpacity
          onPress={handleReactivate}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-circle-outline" size={15} color={theme.primary} />
          <Typography variant="captionBold" color={theme.primary}>Reactivate subscription</Typography>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={handleCancel}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={15} color={theme.textTertiary} />
          <Typography variant="caption" color={theme.textTertiary}>Cancel at period end</Typography>
        </TouchableOpacity>
      )}
    </View>
  );
}
