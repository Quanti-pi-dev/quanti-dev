// ─── Admin Coupon Management ─────────────────────────────────
// Full CRUD for coupons: list, create, toggle active, delete (with redemption guard).
// Uses react-hook-form + Zod validation and toast notifications.

import { useState, useCallback } from 'react';
import { View, ScrollView, ActivityIndicator, Modal, TouchableOpacity, Switch, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '../../src/theme';
import { useGlobalUI } from '../../src/contexts/GlobalUIContext';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { Divider } from '../../src/components/ui/Divider';
import {
  useAdminCoupons,
  useCreateCoupon,
  usePatchCoupon,
  useDeleteCoupon,
} from '../../src/hooks/useAdminSubscriptions';
import { useQueryClient } from '@tanstack/react-query';
import type { Coupon } from '@kd/shared';
import { couponFormSchema, type CouponFormValues } from '../../src/utils/adminSchemas';

// ─── Form ───────────────────────────────────────────────────

const DEFAULT_VALUES: CouponFormValues = {
  code: '',
  discountType: 'percentage',
  discountValue: '',
  maxDiscountPaise: '',
  minOrderPaise: '0',
  maxUses: '',
  maxUsesPerUser: '1',
  validUntil: '',
  firstTimeOnly: false,
};

export default function CouponsScreen() {
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  const { data: coupons = [], isLoading } = useAdminCoupons();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    setRefreshing(false);
  }, [qc]);
  const createCoupon = useCreateCoupon();
  const patchCoupon = usePatchCoupon();
  const deleteCoupon = useDeleteCoupon();

  const [showModal, setShowModal] = useState(false);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const discountType = watch('discountType');
  const firstTimeOnly = watch('firstTimeOnly');

  function openCreate() {
    reset(DEFAULT_VALUES);
    setShowModal(true);
  }

  function onFormSubmit(data: CouponFormValues) {
    createCoupon.mutate({
      code: data.code.toUpperCase(),
      discountType: data.discountType,
      discountValue: parseInt(data.discountValue, 10),
      maxDiscountPaise: data.maxDiscountPaise ? parseInt(data.maxDiscountPaise, 10) : undefined,
      minOrderPaise: parseInt(data.minOrderPaise || '0', 10),
      maxUses: data.maxUses ? parseInt(data.maxUses, 10) : undefined,
      maxUsesPerUser: parseInt(data.maxUsesPerUser || '1', 10),
      validUntil: data.validUntil || undefined,
      firstTimeOnly: data.firstTimeOnly,
    }, {
      onSuccess: () => { setShowModal(false); showToast('Coupon created'); },
      onError: (err) => showToast((err as Error).message ?? 'Failed to create coupon', 'error'),
    });
  }

  async function toggleActive(coupon: Coupon) {
    try {
      await patchCoupon.mutateAsync({ id: coupon.id, input: { isActive: !coupon.isActive } });
      showToast(`Coupon ${coupon.isActive ? 'deactivated' : 'activated'}`);
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to update coupon', 'error');
    }
  }

  function handleDelete(coupon: Coupon) {
    showAlert({
      title: 'Delete Coupon',
      message: `Delete "${coupon.code}"? This cannot be undone.\n\n${coupon.currentUses > 0 ? '⚠️ This coupon has redemptions — the server will reject deletion. Deactivate it instead.' : ''}`,
      type: 'destructive',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCoupon.mutate(coupon.id, {
            onSuccess: () => showToast('Coupon deleted'),
            onError: (err) => {
              const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
                ?? (err as Error).message ?? 'Failed to delete coupon';
              showToast(msg, 'error');
            },
          }),
        },
      ],
    });
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <ScreenWrapper>
      <Header showBack title="Coupon Management" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">Coupons ({coupons.length})</Typography>
          <Button variant="primary" size="sm" onPress={openCreate}>+ New Coupon</Button>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: spacing['2xl'] }} />
        ) : coupons.length === 0 ? (
          <Card variant="outlined">
            <Typography variant="body" color={theme.textSecondary} style={{ textAlign: 'center', paddingVertical: spacing['2xl'] }}>
              No coupons yet. Tap "+ New Coupon" to create one.
            </Typography>
          </Card>
        ) : (
          coupons.map((coupon) => {
            const isExpired = coupon.validUntil && new Date(coupon.validUntil) < new Date();
            const statusColor = !coupon.isActive ? theme.textTertiary : isExpired ? '#EF4444' : '#10B981';
            const statusLabel = !coupon.isActive ? 'Inactive' : isExpired ? 'Expired' : 'Active';

            return (
              <Card key={coupon.id} variant="outlined">
                <View style={{ gap: spacing.sm }}>
                  {/* Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{
                        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
                        backgroundColor: theme.primary + '15', borderRadius: radius.md,
                      }}>
                        <Typography variant="label" color={theme.primary} style={{ fontFamily: 'monospace' }}>
                          {coupon.code}
                        </Typography>
                      </View>
                      <View style={{
                        paddingHorizontal: spacing.xs, paddingVertical: 2,
                        backgroundColor: statusColor + '20', borderRadius: radius.sm,
                      }}>
                        <Typography variant="caption" color={statusColor}>{statusLabel}</Typography>
                      </View>
                    </View>
                    <Switch
                      value={coupon.isActive}
                      onValueChange={() => toggleActive(coupon)}
                      trackColor={{ false: theme.border, true: theme.primary + '60' }}
                      thumbColor={coupon.isActive ? theme.primary : theme.textTertiary}
                    />
                  </View>

                  <Divider />

                  {/* Details */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                    <View style={{ minWidth: '40%' }}>
                      <Typography variant="caption" color={theme.textTertiary}>Discount</Typography>
                      <Typography variant="label">
                        {coupon.discountType === 'percentage'
                          ? `${coupon.discountValue}%`
                          : `₹${(coupon.discountValue / 100).toFixed(0)}`}
                      </Typography>
                    </View>
                    <View style={{ minWidth: '40%' }}>
                      <Typography variant="caption" color={theme.textTertiary}>Redemptions</Typography>
                      <Typography variant="label">
                        {coupon.currentUses}{coupon.maxUses !== null ? ` / ${coupon.maxUses}` : ' / ∞'}
                      </Typography>
                    </View>
                    <View style={{ minWidth: '40%' }}>
                      <Typography variant="caption" color={theme.textTertiary}>Valid Until</Typography>
                      <Typography variant="label">{fmtDate(coupon.validUntil)}</Typography>
                    </View>
                    <View style={{ minWidth: '40%' }}>
                      <Typography variant="caption" color={theme.textTertiary}>Per User</Typography>
                      <Typography variant="label">{coupon.maxUsesPerUser}×</Typography>
                    </View>
                    {coupon.firstTimeOnly && (
                      <View style={{
                        paddingHorizontal: spacing.xs, paddingVertical: 2,
                        backgroundColor: '#F59E0B20', borderRadius: radius.sm, alignSelf: 'flex-start',
                      }}>
                        <Typography variant="caption" color="#F59E0B">First-time only</Typography>
                      </View>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => handleDelete(coupon)}
                      style={{ flex: 1 }}
                    >
                      Delete
                    </Button>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* ── Create Modal ─────────────────────────────────────── */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
            padding: spacing.xl, maxHeight: '90%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <Typography variant="h4">New Coupon</Typography>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: spacing.md }}>
                <Controller control={control} name="code" render={({ field: { onChange, value } }) => (
                  <Input label="Code" value={value} onChangeText={onChange} placeholder="e.g. WELCOME20" autoCapitalize="characters" error={errors.code?.message} />
                )} />

                {/* Discount Type */}
                <View>
                  <Typography variant="label" style={{ marginBottom: spacing.xs }}>Discount Type</Typography>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {(['percentage', 'fixed_amount'] as const).map((dt) => (
                      <TouchableOpacity
                        key={dt}
                        onPress={() => setValue('discountType', dt)}
                        style={{
                          flex: 1, paddingVertical: spacing.sm,
                          backgroundColor: discountType === dt ? theme.primary + '20' : theme.card,
                          borderWidth: 1, borderColor: discountType === dt ? theme.primary : theme.border,
                          borderRadius: radius.md, alignItems: 'center',
                        }}
                      >
                        <Typography variant="caption" color={discountType === dt ? theme.primary : theme.text}>
                          {dt === 'percentage' ? '% Percentage' : '₹ Fixed'}
                        </Typography>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Controller control={control} name="discountValue" render={({ field: { onChange, value } }) => (
                  <Input
                    label={discountType === 'percentage' ? 'Discount (%)' : 'Discount (paise)'}
                    value={value}
                    onChangeText={onChange}
                    keyboardType="numeric"
                    placeholder={discountType === 'percentage' ? 'e.g. 20' : 'e.g. 5000'}
                    error={errors.discountValue?.message}
                  />
                )} />

                {discountType === 'percentage' && (
                  <Controller control={control} name="maxDiscountPaise" render={({ field: { onChange, value } }) => (
                    <Input label="Max Discount (paise)" value={value ?? ''} onChangeText={onChange} keyboardType="numeric" placeholder="e.g. 10000" />
                  )} />
                )}

                <Controller control={control} name="minOrderPaise" render={({ field: { onChange, value } }) => (
                  <Input label="Min Order (paise)" value={value ?? ''} onChangeText={onChange} keyboardType="numeric" placeholder="0" />
                )} />
                <Controller control={control} name="maxUses" render={({ field: { onChange, value } }) => (
                  <Input label="Max Uses (total)" value={value ?? ''} onChangeText={onChange} keyboardType="numeric" placeholder="∞ (blank = unlimited)" />
                )} />
                <Controller control={control} name="maxUsesPerUser" render={({ field: { onChange, value } }) => (
                  <Input label="Max Uses Per User" value={value ?? ''} onChangeText={onChange} keyboardType="numeric" placeholder="1" />
                )} />
                <Controller control={control} name="validUntil" render={({ field: { onChange, value } }) => (
                  <Input label="Valid Until (ISO)" value={value ?? ''} onChangeText={onChange} placeholder="e.g. 2026-12-31T23:59:59Z" autoCapitalize="none" />
                )} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="label">First-time users only</Typography>
                  <Switch
                    value={firstTimeOnly}
                    onValueChange={(v) => setValue('firstTimeOnly', v)}
                    trackColor={{ false: theme.border, true: theme.primary + '60' }}
                    thumbColor={firstTimeOnly ? theme.primary : theme.textTertiary}
                  />
                </View>

                <Button variant="primary" onPress={handleSubmit(onFormSubmit)} loading={createCoupon.isPending} style={{ marginTop: spacing.md }}>
                  Create Coupon
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}
