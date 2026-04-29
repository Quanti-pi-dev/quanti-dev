// ─── SubscriptionCard ─────────────────────────────────────────
// Plan details, cancel/reactivate actions, and recent invoices.
// Shows an upgrade CTA for non-subscribed users.
// Extracted from ProfileScreen for memoization.

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useGlobalUI } from '../../contexts/GlobalUIContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { cancelSubscription, reactivateSubscription } from '../../services/subscription.service';

export const SubscriptionCard = React.memo(function SubscriptionCard() {
  const { theme } = useTheme();
  const router = useRouter();
  const { subscription, isSubscribed, refreshSubscription } = useSubscription();
  const { showToast } = useGlobalUI();

  // ─── Subscription Payment History ─────────────────────────
  const { data: invoices } = useQuery({
    queryKey: ['subscription-invoices'],
    queryFn: async () => {
      const { data } = await api.get('/subscriptions/invoices');
      return (data?.data ?? []) as Array<{ id: string; amountPaise: number; createdAt: string; status: string }>;
    },
    enabled: isSubscribed,
    staleTime: 60_000,
  });

  // ─── Subscription Actions ─────────────────────────────────
  async function handleCancel() {
    try {
      await cancelSubscription();
      await refreshSubscription();
    } catch {
      showToast('Could not cancel your subscription. Please try again.', 'error');
    }
  }

  async function handleReactivate() {
    try {
      await reactivateSubscription();
      await refreshSubscription();
    } catch {
      showToast('Could not reactivate your subscription. Please try again.', 'error');
    }
  }

  return (
    <>
      {isSubscribed && subscription ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h4">Your Plan</Typography>
              <TouchableOpacity onPress={() => router.push('/subscription')}>
                <Typography variant="label" color={theme.primary}>Manage</Typography>
              </TouchableOpacity>
            </View>
            <View style={{
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: theme.primaryMuted,
              gap: spacing.xs,
            }}>
              <Typography variant="label" color={theme.primary}>
                {subscription?.plan?.displayName ?? 'Active Plan'} · {subscription?.plan?.billingCycle === 'monthly' ? 'Monthly' : 'Weekly'}
              </Typography>
              {subscription?.cancelAtPeriodEnd ? (
                <Typography variant="caption" color={theme.error}>
                  Cancels on {new Date(subscription?.currentPeriodEnd ?? '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Typography>
              ) : (
                <Typography variant="caption" color={theme.textSecondary}>
                  Renews on {new Date(subscription?.currentPeriodEnd ?? '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {` (${subscription?.daysRemaining ?? 0}d remaining)`}
                </Typography>
              )}
            </View>

            {subscription?.cancelAtPeriodEnd ? (
              <TouchableOpacity
                onPress={handleReactivate}
                style={{
                  backgroundColor: theme.successLight,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  alignItems: 'center',
                }}
              >
                <Typography variant="label" color={theme.success}>Reactivate Subscription</Typography>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleCancel}>
                <Typography variant="caption" color={theme.textTertiary} align="center">
                  Cancel subscription
                </Typography>
              </TouchableOpacity>
            )}

            {invoices && invoices.length > 0 && (
              <View style={{ gap: spacing.xs }}>
                <Typography variant="overline" color={theme.textTertiary}>Recent Payments</Typography>
                {invoices.slice(0, 3).map((inv) => (
                  <View key={inv.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color={theme.textSecondary}>
                      {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Typography>
                    <Typography variant="caption" color={inv.status === 'captured' ? theme.success : theme.textTertiary}>
                      ₹{Math.round(inv.amountPaise / 100)}
                    </Typography>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>
      ) : (
        <TouchableOpacity
          onPress={() => router.push('/subscription')}
          activeOpacity={0.85}
          style={{
            backgroundColor: theme.primaryMuted,
            borderRadius: radius['2xl'],
            padding: spacing.xl,
            borderWidth: 1.5,
            borderColor: theme.primary + '33',
            gap: spacing.sm,
            alignItems: 'center',
          }}
        >
          <Ionicons name="rocket-outline" size={32} color={theme.primary} />
          <Typography variant="h4" align="center">Start Your Free Trial</Typography>
          <Typography variant="caption" color={theme.textSecondary} align="center">
            Unlock all subjects, levels, and AI-powered explanations
          </Typography>
          <View
            style={{
              backgroundColor: theme.primary,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.sm,
              marginTop: spacing.xs,
            }}
          >
            <Typography variant="label" color={theme.buttonPrimaryText}>Upgrade Now →</Typography>
          </View>
        </TouchableOpacity>
      )}
    </>
  );
});
