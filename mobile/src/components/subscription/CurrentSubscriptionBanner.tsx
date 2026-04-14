// ─── CurrentSubscriptionBanner ────────────────────────────────
// Shows active plan info at the top of the subscription screen.

import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { cancelSubscription, reactivateSubscription } from '../../services/subscription.service';
import { useSubscription } from '../../contexts/SubscriptionContext';
import type { SubscriptionSummary } from '@kd/shared';

interface CurrentSubscriptionBannerProps {
  subscription: SubscriptionSummary;
}

export function CurrentSubscriptionBanner({ subscription }: CurrentSubscriptionBannerProps) {
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
    <View className="bg-primary/8 dark:bg-primary/10 border border-primary/20 rounded-3xl p-5 gap-3">
      {/* Plan name row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="bg-primary/10 w-9 h-9 rounded-2xl items-center justify-center">
            <Ionicons name="shield-checkmark" size={18} color="#2563EB" />
          </View>
          <View>
            <Text className="font-body-semibold text-sm text-gray-500 dark:text-gray-400">
              Active Plan
            </Text>
            <Text className="font-heading text-base text-gray-900 dark:text-white">
              {subscription.plan?.displayName ?? 'Pro'}
            </Text>
          </View>
        </View>

        {isCanceling ? (
          <View className="bg-red-100 dark:bg-red-900/20 px-2.5 py-1 rounded-full">
            <Text className="text-red-500 text-xs font-body-semibold">Cancels {expiryDate}</Text>
          </View>
        ) : (
          <View className="bg-correct/10 px-2.5 py-1 rounded-full">
            <Text className="text-correct text-xs font-body-semibold">{daysLeft}d left</Text>
          </View>
        )}
      </View>

      {/* Progress bar — days remaining */}
      <View>
        <View className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${Math.min(100, (daysLeft / 30) * 100)}%` }}
          />
        </View>
        <Text className="text-xs text-gray-400 font-body mt-1">
          Renews {expiryDate}
        </Text>
      </View>

      {/* Cancel / reactivate */}
      {loading ? (
        <ActivityIndicator size="small" color="#2563EB" />
      ) : isCanceling ? (
        <TouchableOpacity onPress={handleReactivate} className="flex-row items-center gap-1" activeOpacity={0.7}>
          <Ionicons name="refresh-circle-outline" size={15} color="#2563EB" />
          <Text className="text-primary text-xs font-body-semibold">Reactivate subscription</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={handleCancel} className="flex-row items-center gap-1" activeOpacity={0.7}>
          <Ionicons name="close-circle-outline" size={15} color="#9CA3AF" />
          <Text className="text-gray-400 text-xs font-body">Cancel at period end</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
