// ─── SubscriptionStatusCard ───────────────────────────────────
// Profile screen: shows current plan + days left, or upgrade CTA.

import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import { useSubscription } from '../../contexts/SubscriptionContext';

export function SubscriptionStatusCard() {
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
        className="border border-dashed border-primary/40 rounded-3xl p-5 gap-3"
      >
        <View className="flex-row items-center gap-3">
          <View className="bg-primary/10 w-10 h-10 rounded-2xl items-center justify-center">
            <Ionicons name="rocket-outline" size={20} color="#2563EB" />
          </View>
          <View className="flex-1">
            <Text className="font-body-semibold text-sm text-gray-900 dark:text-white">
              No Active Plan
            </Text>
            <Text className="font-body text-xs text-gray-400 mt-0.5">
              Unlock the full Ouanti-pi experience
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#2563EB" />
        </View>
        <View className="bg-primary rounded-2xl py-2.5 items-center">
          <Text className="text-white font-body-semibold text-sm">
            View Plans
          </Text>
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
        className="rounded-3xl p-5 gap-3"
      >
        {/* Plan header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Ionicons name="shield-checkmark" size={18} color="rgba(255,255,255,0.9)" />
            <Text className="font-heading text-base text-white">{planName}</Text>
          </View>
          {isCanceling ? (
            <View className="bg-white/20 px-2.5 py-1 rounded-full">
              <Text className="text-white text-xs font-body-semibold">Cancels {expiryDate}</Text>
            </View>
          ) : (
            <View className="bg-white/20 px-2.5 py-1 rounded-full">
              <Text className="text-white text-xs font-body-semibold">{daysLeft}d left</Text>
            </View>
          )}
        </View>

        {/* Days remaining bar */}
        <View className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <View
            className="h-full bg-white rounded-full"
            style={{ width: `${Math.min(100, (daysLeft / (subscription?.plan?.billingCycle === 'monthly' ? 30 : 7)) * 100)}%` }}
          />
        </View>

        {/* Footer */}
        <View className="flex-row items-center justify-between">
          <Text className="text-white/70 text-xs font-body">
            Renews {expiryDate}
          </Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-white/80 text-xs font-body">Manage</Text>
            <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.8)" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}
