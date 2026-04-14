// ─── Admin Subscription Management ───────────────────────────
// List, filter, grant, and manage user subscriptions.

import { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, Alert, ActivityIndicator, Modal, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { Divider } from '../../src/components/ui/Divider';
import {
  useAdminSubscriptions,
  useAdminPlans,
  useGrantSubscription,
  usePatchSubscription,
  useSearchUsers,
} from '../../src/hooks/useAdminSubscriptions';
import { useQueryClient } from '@tanstack/react-query';
import type { SubscriptionStatus, UserProfile } from '@kd/shared';
import { useToast } from '../../src/contexts/ToastContext';

// ─── Constants ───────────────────────────────────────────────

const STATUS_FILTERS: { value: SubscriptionStatus | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: '#888888' },
  { value: 'active', label: 'Active', color: '#10B981' },
  { value: 'trialing', label: 'Trial', color: '#6366F1' },
  { value: 'past_due', label: 'Past Due', color: '#F59E0B' },
  { value: 'canceled', label: 'Canceled', color: '#EF4444' },
  { value: 'expired', label: 'Expired', color: '#6B7280' },
];

function statusColor(status: SubscriptionStatus): string {
  return STATUS_FILTERS.find((f) => f.value === status)?.color ?? '#888';
}

function daysUntil(dateStr: string): string {
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return 'today';
  return `${days}d left`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────

export default function SubscriptionsScreen() {
  const { theme } = useTheme();
  const { showToast } = useToast();

  // ── State ──────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');
  const [grantModalVisible, setGrantModalVisible] = useState(false);

  // Grant modal state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [grantError, setGrantError] = useState('');
  const [overlapSub, setOverlapSub] = useState(false);

  // ── Queries ────────────────────────────────────────────────
  const activeStatus = statusFilter === 'all' ? undefined : statusFilter;
  const { data, isLoading, isError } = useAdminSubscriptions(page, activeStatus);
  const { data: plans = [] } = useAdminPlans();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
    setRefreshing(false);
  }, [queryClient]);
  const activePlans = useMemo(() => plans.filter((p) => p.isActive), [plans]);
  const grantMutation = useGrantSubscription();
  const patchMutation = usePatchSubscription();
  const { data: searchResults = [] } = useSearchUsers(userSearchQuery);

  const subscriptions = data?.subscriptions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  // ── Grant handlers ─────────────────────────────────────────

  function openGrant() {
    setSelectedUser(null);
    setSelectedPlanId('');
    setUserSearchQuery('');
    setAdminNotes('');
    setGrantError('');
    setOverlapSub(false);
    setGrantModalVisible(true);
  }

  function handleGrant(overwrite = false) {
    if (!selectedUser) { setGrantError('Please select a user.'); return; }
    if (!selectedPlanId) { setGrantError('Please select a plan.'); return; }
    setGrantError('');

    grantMutation.mutate(
      {
        userId: selectedUser.id,
        planId: selectedPlanId,
        adminNotes: adminNotes.trim() || undefined,
        overwriteExisting: overwrite,
      },
      {
        onSuccess: () => {
          setGrantModalVisible(false);
          setOverlapSub(false);
          showToast('Subscription granted successfully');
        },
        onError: (err: unknown) => {
          const error = err as Error & { response?: { data?: { error?: { code?: string; existingSubscription?: unknown } } } };
          // Check for 409 ALREADY_ACTIVE from the axios response
          const apiError = error.response?.data?.error;
          if (apiError?.code === 'ALREADY_ACTIVE') {
            setOverlapSub(true);
            setGrantError('User already has an active subscription. Replace it?');
          } else {
            setGrantError(error.message || 'Failed to grant subscription.');
          }
        },
      },
    );
  }

  function handleStatusAction(subId: string, status: SubscriptionStatus) {
    const labels: Record<string, string> = {
      expired: 'Expire',
      canceled: 'Cancel',
      active: 'Reactivate',
    };
    const warnings: Record<string, string> = {
      expired: 'This will immediately terminate the user\'s access. No prorated refund will be issued automatically.',
      canceled: 'The user will retain access until their current billing period ends.',
      active: 'This will restore the user\'s subscription and access to premium features.',
    };
    Alert.alert(
      `${labels[status] ?? status} Subscription`,
      warnings[status] ?? `Are you sure you want to set this subscription to "${status}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: labels[status] ?? status,
          style: status === 'active' ? 'default' : 'destructive',
          onPress: () => patchMutation.mutate({ id: subId, input: { status } }, {
            onSuccess: () => showToast(`Subscription ${labels[status]?.toLowerCase() ?? status}d`),
            onError: (err) => showToast((err as Error).message ?? 'Failed to update subscription', 'error'),
          }),
        },
      ],
    );
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <ScreenWrapper>
      <Header
        showBack
        title="Subscriptions"
        rightAction={<Button variant="ghost" size="sm" onPress={openGrant}>+ Grant</Button>}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['4xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {/* Status filter bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => { setStatusFilter(f.value as SubscriptionStatus | 'all'); setPage(1); }}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
                borderWidth: 1.5,
                borderColor: statusFilter === f.value ? f.color : theme.border,
                backgroundColor: statusFilter === f.value ? f.color + '22' : theme.card,
              }}
            >
              <Typography variant="caption" color={statusFilter === f.value ? f.color : theme.textSecondary}>
                {f.label}
              </Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Total count */}
        <Typography variant="caption" color={theme.textTertiary}>{total} subscription(s)</Typography>

        {isLoading && (
          <View style={{ alignItems: 'center', paddingTop: spacing['2xl'] }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {isError && (
          <Card><Typography variant="body" align="center" color={theme.error}>Failed to load subscriptions.</Typography></Card>
        )}

        {!isLoading && !isError && subscriptions.length === 0 && (
          <Card><Typography variant="body" align="center" color={theme.textTertiary}>No subscriptions found.</Typography></Card>
        )}

        {subscriptions.map((sub) => {
          const sc = statusColor(sub.status);
          return (
            <View
              key={sub.id}
              style={{
                backgroundColor: theme.card,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: sc + '44',
                overflow: 'hidden',
              }}
            >
              <View style={{ padding: spacing.lg, gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Typography variant="label" numberOfLines={1}>
                      {(sub as unknown as Record<string, unknown>).userDisplayName
                        ? String((sub as unknown as Record<string, unknown>).userDisplayName)
                        : `User: ${sub.userId.slice(0, 8)}…`}
                    </Typography>
                    <Typography variant="caption" color={theme.textTertiary} numberOfLines={1}>
                      {(sub as unknown as Record<string, unknown>).userEmail
                        ? String((sub as unknown as Record<string, unknown>).userEmail)
                        : sub.userId}
                    </Typography>
                    <Typography variant="caption" color={theme.textSecondary}>
                      {(sub as unknown as Record<string, unknown>).planDisplayName
                        ? `Plan: ${String((sub as unknown as Record<string, unknown>).planDisplayName)}`
                        : `Plan: ${sub.planId.slice(0, 8)}…`}
                    </Typography>
                  </View>
                  <View style={{
                    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full,
                    backgroundColor: sc + '22',
                  }}>
                    <Typography variant="caption" color={sc} style={{ fontWeight: '600' }}>
                      {sub.status}
                    </Typography>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs }}>
                  <Typography variant="caption" color={theme.textSecondary}>
                    Ends: {formatDate(sub.currentPeriodEnd)}
                  </Typography>
                  <View style={{
                    paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.sm,
                    backgroundColor: theme.cardAlt,
                  }}>
                    <Typography variant="caption" color={theme.textSecondary}>
                      {daysUntil(sub.currentPeriodEnd)}
                    </Typography>
                  </View>
                  {sub.cancelAtPeriodEnd && (
                    <View style={{
                      paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.sm,
                      backgroundColor: '#EF444422',
                    }}>
                      <Typography variant="caption" color="#EF4444">Cancels at end</Typography>
                    </View>
                  )}
                </View>
              </View>

              <Divider />

              <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.sm, flexWrap: 'wrap' }}>
                {(sub.status === 'active' || sub.status === 'trialing') && (
                  <Button variant="danger" size="sm" onPress={() => handleStatusAction(sub.id, 'canceled')}>Cancel</Button>
                )}
                {(sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') && (
                  <Button variant="secondary" size="sm" onPress={() => handleStatusAction(sub.id, 'expired')}>Expire</Button>
                )}
                {sub.status === 'canceled' && (
                  <Button variant="secondary" size="sm" icon={<Ionicons name="refresh-outline" size={14} color={theme.textSecondary} />} onPress={() => handleStatusAction(sub.id, 'active')}>Reactivate</Button>
                )}
              </View>
            </View>
          );
        })}

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.lg }}>
            <Button variant="secondary" size="sm" disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Typography variant="caption" color={theme.textTertiary}>Page {page} of {totalPages}</Typography>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </View>
        )}
      </ScrollView>

      {/* ── Grant Subscription Modal ── */}
      <Modal visible={grantModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: theme.border,
          }}>
            <Typography variant="h4">Grant Subscription</Typography>
            <TouchableOpacity onPress={() => setGrantModalVisible(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }} keyboardShouldPersistTaps="handled">
            {/* User search */}
            <View style={{ gap: spacing.sm }}>
              <Typography variant="label">Search User by Email *</Typography>
              <Input
                placeholder="Type at least 2 characters…"
                value={userSearchQuery}
                onChangeText={(v) => {
                  setUserSearchQuery(v);
                  setSelectedUser(null);
                  setOverlapSub(false);
                  setGrantError('');
                }}
                leftIcon={<Ionicons name="search-outline" size={18} color={theme.textTertiary} />}
                autoCapitalize="none"
              />
              {/* Search results */}
              {userSearchQuery.length >= 2 && !selectedUser && searchResults.length > 0 && (
                <Card>
                  {searchResults.map((u, idx) => (
                    <View key={u.id}>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedUser(u);
                          setUserSearchQuery(u.email);
                          setOverlapSub(false);
                          setGrantError('');
                        }}
                        style={{ paddingVertical: spacing.sm }}
                      >
                        <Typography variant="label">{u.displayName}</Typography>
                        <Typography variant="caption" color={theme.textTertiary}>{u.email}</Typography>
                      </TouchableOpacity>
                      {idx < searchResults.length - 1 && <Divider />}
                    </View>
                  ))}
                </Card>
              )}
              {userSearchQuery.length >= 2 && !selectedUser && searchResults.length === 0 && (
                <Typography variant="caption" color={theme.textTertiary}>No users found.</Typography>
              )}
              {selectedUser && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                  padding: spacing.sm, borderRadius: radius.lg,
                  backgroundColor: theme.primary + '15', borderWidth: 1, borderColor: theme.primary + '44',
                }}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Typography variant="label">{selectedUser.displayName}</Typography>
                    <Typography variant="caption" color={theme.textTertiary}>{selectedUser.email}</Typography>
                  </View>
                  <TouchableOpacity onPress={() => { setSelectedUser(null); setUserSearchQuery(''); }}>
                    <Ionicons name="close-circle" size={20} color={theme.textTertiary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Plan picker */}
            <View style={{ gap: spacing.sm }}>
              <Typography variant="label">Select Plan *</Typography>
              <View style={{ gap: spacing.xs }}>
                {activePlans.map((plan) => (
                  <TouchableOpacity
                    key={plan.id}
                    onPress={() => setSelectedPlanId(plan.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                      padding: spacing.md, borderRadius: radius.lg,
                      borderWidth: 1.5,
                      borderColor: selectedPlanId === plan.id ? theme.primary : theme.border,
                      backgroundColor: selectedPlanId === plan.id ? theme.primary + '15' : theme.card,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Typography variant="label">{plan.displayName}</Typography>
                      <Typography variant="caption" color={theme.textTertiary}>
                        ₹{(plan.pricePaise / 100).toFixed(0)}/{plan.billingCycle === 'weekly' ? 'wk' : 'mo'} · T{plan.tier}
                      </Typography>
                    </View>
                    {selectedPlanId === plan.id && (
                      <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              {activePlans.length === 0 && (
                <Typography variant="caption" color={theme.error}>No active plans available. Create a plan first.</Typography>
              )}
            </View>

            {/* Admin notes */}
            <Input
              label="Admin Notes (optional)" placeholder="Reason for granting…"
              value={adminNotes} onChangeText={setAdminNotes}
              multiline numberOfLines={2}
            />

            {/* Overlap warning */}
            {overlapSub && (
              <Card>
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Ionicons name="warning" size={18} color="#F59E0B" />
                    <Typography variant="label" color="#F59E0B">Existing Subscription Found</Typography>
                  </View>
                  <Typography variant="bodySmall" color={theme.textSecondary}>
                    This user already has an active subscription. Granting a new one will expire the current subscription.
                  </Typography>
                  <Button
                    fullWidth variant="danger" size="md"
                    loading={grantMutation.isPending}
                    onPress={() => handleGrant(true)}
                    icon={<Ionicons name="swap-horizontal-outline" size={16} color="#FFFFFF" />}
                  >
                    Replace Existing Subscription
                  </Button>
                </View>
              </Card>
            )}

            {grantError && !overlapSub ? (
              <Typography variant="bodySmall" color={theme.error} align="center">{grantError}</Typography>
            ) : null}

            {!overlapSub && (
              <Button
                fullWidth size="lg" loading={grantMutation.isPending}
                onPress={() => handleGrant(false)}
                icon={<Ionicons name="gift-outline" size={18} color="#FFFFFF" />}
              >
                Grant Subscription
              </Button>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}
