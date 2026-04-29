// ─── Admin Plan Management ───────────────────────────────────
// Full CRUD for subscription plans: list, create, edit, toggle active, delete.
// Uses react-hook-form + Zod validation and toast notifications.

import { useState, useMemo, useCallback } from 'react';
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
  useAdminPlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
} from '../../src/hooks/useAdminSubscriptions';
import { useQueryClient } from '@tanstack/react-query';
import type { Plan, PlanFeatures } from '@kd/shared';
import type { CreatePlanInput } from '../../src/services/api-contracts';
import { planFormSchema, type PlanFormValues } from '../../src/utils/adminSchemas';

// ─── Constants ───────────────────────────────────────────────

type Tier = 1 | 2 | 3;
type Cycle = 'weekly' | 'monthly';

const TIERS: { value: Tier; label: string; color: string }[] = [
  { value: 1, label: 'Basic', color: '#10B981' },
  { value: 2, label: 'Pro', color: '#6366F1' },
  { value: 3, label: 'Premium', color: '#F59E0B' },
];

const CYCLES: { value: Cycle; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const DEFAULT_FEATURES: PlanFeatures = {
  max_decks: -1,
  max_exams_per_day: -1,
  max_subjects_per_exam: -1,
  max_level: -1,
  ai_explanations: true,
  offline_access: false,
  priority_support: false,
  advanced_analytics: false,
  deep_insights: false,
  mastery_radar: false,
};

const DEFAULT_VALUES: PlanFormValues = {
  slug: '',
  displayName: '',
  tier: 1,
  billingCycle: 'monthly',
  pricePaise: '',
  trialDays: '0',
  sortOrder: '0',
  isActive: true,
  features: { ...DEFAULT_FEATURES },
};

function formatPrice(paise: number): string {
  const rupees = paise / 100;
  return rupees % 1 === 0 ? `₹${rupees.toFixed(0)}` : `₹${rupees.toFixed(2)}`;
}

// ─── Component ───────────────────────────────────────────────

export default function PlansScreen() {
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  const { data: plans = [], isLoading, isError } = useAdminPlans();
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    setRefreshing(false);
  }, [qc]);
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const formTier = watch('tier');
  const formCycle = watch('billingCycle');
  const formIsActive = watch('isActive');
  const formFeatures = watch('features');
  const formPricePaise = watch('pricePaise');
  const tierInfo = TIERS.find((t) => t.value === formTier)!;

  const filtered = useMemo(() => {
    if (filter === 'active') return plans.filter((p) => p.isActive);
    if (filter === 'inactive') return plans.filter((p) => !p.isActive);
    return plans;
  }, [plans, filter]);

  // ── Helpers ─────────────────────────────────────────────────

  function openCreate() {
    setEditingPlan(null);
    reset(DEFAULT_VALUES);
    setShowFeatures(false);
    setModalVisible(true);
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    reset({
      slug: plan.slug,
      displayName: plan.displayName,
      tier: plan.tier,
      billingCycle: plan.billingCycle,
      pricePaise: String(plan.pricePaise),
      trialDays: String(plan.trialDays),
      sortOrder: String(plan.sortOrder),
      isActive: plan.isActive,
      features: { ...DEFAULT_FEATURES, ...plan.features },
    });
    setShowFeatures(false);
    setModalVisible(true);
  }

  function onFormSubmit(data: PlanFormValues) {
    const payload: CreatePlanInput = {
      slug: data.slug.trim().toLowerCase().replace(/\s+/g, '-'),
      displayName: data.displayName.trim(),
      tier: data.tier,
      billingCycle: data.billingCycle,
      pricePaise: parseInt(data.pricePaise, 10),
      features: data.features,
      trialDays: parseInt(data.trialDays, 10),
      isActive: data.isActive,
      sortOrder: parseInt(data.sortOrder, 10) || 0,
    };

    if (editingPlan) {
      updatePlan.mutate({ id: editingPlan.id, input: payload }, {
        onSuccess: () => { setModalVisible(false); showToast('Plan updated'); },
        onError: (err) => showToast(err instanceof Error ? err.message : 'Failed to update plan', 'error'),
      });
    } else {
      createPlan.mutate(payload, {
        onSuccess: () => { setModalVisible(false); showToast('Plan created'); },
        onError: (err) => showToast(err instanceof Error ? err.message : 'Failed to create plan', 'error'),
      });
    }
  }

  function confirmDelete(plan: Plan) {
    showAlert({
      title: 'Deactivate Plan',
      message: `This will deactivate "${plan.displayName}". It won't be available for new subscribers. Continue?`,
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () => deletePlan.mutate(plan.id, {
            onSuccess: () => showToast('Plan deactivated'),
            onError: (err) => showToast(err instanceof Error ? err.message : 'Failed to deactivate plan', 'error'),
          }),
        },
      ],
    });
  }

  function updateFeature<K extends keyof PlanFeatures>(key: K, value: PlanFeatures[K]) {
    setValue('features', { ...formFeatures, [key]: value });
  }

  const isSaving = createPlan.isPending || updatePlan.isPending;

  // ── Render ──────────────────────────────────────────────────

  return (
    <ScreenWrapper>
      <Header
        showBack
        title="Subscription Plans"
        rightAction={<Button variant="ghost" size="sm" onPress={openCreate}>+ New</Button>}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['4xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {/* Filter bar */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
                borderWidth: 1.5,
                borderColor: filter === f ? theme.primary : theme.border,
                backgroundColor: filter === f ? theme.primary + '22' : theme.card,
              }}
            >
              <Typography variant="caption" color={filter === f ? theme.primary : theme.textSecondary}>
                {f === 'all' ? 'All' : f === 'active' ? '✅ Active' : '⏸️ Inactive'}
              </Typography>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading && (
          <View style={{ alignItems: 'center', paddingTop: spacing['2xl'] }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {isError && (
          <Card><Typography variant="body" align="center" color={theme.error}>Failed to load plans.</Typography></Card>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <Card><Typography variant="body" align="center" color={theme.textTertiary}>No plans found. Tap "+ New" to create one.</Typography></Card>
        )}

        {filtered.map((plan) => {
          const tier = TIERS.find((t) => t.value === plan.tier);
          return (
            <View
              key={plan.id}
              style={{
                backgroundColor: theme.card,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: plan.isActive ? tier?.color + '66' : theme.border,
                overflow: 'hidden',
              }}
            >
              <View style={{ padding: spacing.lg, gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Typography variant="label">{plan.displayName}</Typography>
                    <Typography variant="caption" color={theme.textTertiary}>{plan.slug}</Typography>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    <View style={{
                      paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full,
                      backgroundColor: (tier?.color ?? '#888') + '22',
                    }}>
                      <Typography variant="caption" color={tier?.color ?? '#888'}>{tier?.label ?? `T${plan.tier}`}</Typography>
                    </View>
                    <View style={{
                      paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full,
                      backgroundColor: plan.isActive ? theme.primary + '22' : theme.cardAlt,
                    }}>
                      <Typography variant="caption" color={plan.isActive ? theme.primary : theme.textTertiary}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </Typography>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs }}>
                  <Typography variant="body" style={{ fontWeight: '700' }}>{formatPrice(plan.pricePaise)}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>/{plan.billingCycle === 'weekly' ? 'wk' : 'mo'}</Typography>
                  {plan.trialDays > 0 && (
                    <View style={{
                      paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.full,
                      backgroundColor: '#10B98122',
                    }}>
                      <Typography variant="caption" color="#10B981">{plan.trialDays}d trial</Typography>
                    </View>
                  )}
                </View>

                {/* Feature summary */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                  {plan.features.ai_explanations && (
                    <View style={{ paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: theme.cardAlt }}>
                      <Typography variant="caption" color={theme.textSecondary}>AI</Typography>
                    </View>
                  )}
                  {plan.features.offline_access && (
                    <View style={{ paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: theme.cardAlt }}>
                      <Typography variant="caption" color={theme.textSecondary}>Offline</Typography>
                    </View>
                  )}
                  {plan.features.advanced_analytics && (
                    <View style={{ paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: theme.cardAlt }}>
                      <Typography variant="caption" color={theme.textSecondary}>Analytics</Typography>
                    </View>
                  )}
                  {plan.features.deep_insights && (
                    <View style={{ paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: theme.cardAlt }}>
                      <Typography variant="caption" color={theme.textSecondary}>Deep</Typography>
                    </View>
                  )}
                  {plan.features.mastery_radar && (
                    <View style={{ paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: theme.cardAlt }}>
                      <Typography variant="caption" color={theme.textSecondary}>Radar</Typography>
                    </View>
                  )}
                  <View style={{ paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: theme.cardAlt }}>
                    <Typography variant="caption" color={theme.textSecondary}>
                      Lvl {plan.features.max_level === -1 ? '∞' : plan.features.max_level}
                    </Typography>
                  </View>
                </View>

                {/* Razorpay sync status — shows whether this plan has a Razorpay Plan ID */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                  {plan.razorpayPlanId ? (
                    <>
                      <View style={{ paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: '#10B98122' }}>
                        <Typography variant="caption" color="#10B981">⚡ Razorpay synced</Typography>
                      </View>
                      <Typography variant="caption" color={theme.textTertiary}>{plan.razorpayPlanId}</Typography>
                    </>
                  ) : (
                    <View style={{ paddingHorizontal: spacing.xs, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: theme.cardAlt }}>
                      <Typography variant="caption" color={theme.textTertiary}>⏳ Razorpay sync pending (lazy on first checkout)</Typography>
                    </View>
                  )}
                </View>
              </View>

              <Divider />

              <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.sm }}>
                <Button variant="secondary" size="sm" icon={<Ionicons name="pencil-outline" size={14} color={theme.textSecondary} />} onPress={() => openEdit(plan)}>Edit</Button>
                {plan.isActive && (
                  <Button variant="danger" size="sm" icon={<Ionicons name="pause-outline" size={14} color="#FFFFFF" />} onPress={() => confirmDelete(plan)}>Deactivate</Button>
                )}
                {!plan.isActive && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Ionicons name="play-outline" size={14} color="#10B981" />}
                    onPress={() => updatePlan.mutate({ id: plan.id, input: { isActive: true } }, {
                      onSuccess: () => showToast('Plan reactivated'),
                    })}
                  >
                    Reactivate
                  </Button>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Create / Edit Modal ── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <ScreenWrapper style={{ backgroundColor: theme.background }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: theme.border,
          }}>
            <Typography variant="h4">{editingPlan ? 'Edit Plan' : 'New Plan'}</Typography>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }} keyboardShouldPersistTaps="handled">
            <Controller control={control} name="displayName" render={({ field: { onChange, value } }) => (
              <Input label="Display Name *" placeholder="e.g. Pro Monthly" value={value} onChangeText={onChange} error={errors.displayName?.message} />
            )} />
            <Controller control={control} name="slug" render={({ field: { onChange, value } }) => (
              <Input
                label={editingPlan ? 'Slug (cannot be changed)' : 'Slug *'}
                placeholder="e.g. pro-monthly" value={value}
                onChangeText={onChange}
                autoCapitalize="none" autoCorrect={false}
                editable={!editingPlan}
                error={errors.slug?.message}
              />
            )} />

            {/* Tier selector */}
            <View style={{ gap: spacing.sm }}>
              <Typography variant="label">{editingPlan ? 'Tier (cannot be changed)' : 'Tier'}</Typography>
              <View style={{ flexDirection: 'row', gap: spacing.sm, opacity: editingPlan ? 0.5 : 1 }}>
                {TIERS.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    disabled={!!editingPlan}
                    onPress={() => setValue('tier', t.value)}
                    style={{
                      flex: 1, paddingVertical: spacing.sm, borderRadius: radius.lg, alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: formTier === t.value ? t.color : theme.border,
                      backgroundColor: formTier === t.value ? t.color + '22' : theme.card,
                    }}
                  >
                    <Typography variant="caption" color={formTier === t.value ? t.color : theme.textSecondary}>
                      {t.label}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Billing cycle selector */}
            <View style={{ gap: spacing.sm }}>
              <Typography variant="label">{editingPlan ? 'Billing Cycle (cannot be changed)' : 'Billing Cycle'}</Typography>
              <View style={{ flexDirection: 'row', gap: spacing.sm, opacity: editingPlan ? 0.5 : 1 }}>
                {CYCLES.map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    disabled={!!editingPlan}
                    onPress={() => setValue('billingCycle', c.value)}
                    style={{
                      flex: 1, paddingVertical: spacing.sm, borderRadius: radius.lg, alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: formCycle === c.value ? theme.primary : theme.border,
                      backgroundColor: formCycle === c.value ? theme.primary + '22' : theme.card,
                    }}
                  >
                    <Typography variant="caption" color={formCycle === c.value ? theme.primary : theme.textSecondary}>
                      {c.label}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Controller control={control} name="pricePaise" render={({ field: { onChange, value } }) => (
              <Input
                label="Price (paise) *" placeholder="e.g. 9900 = ₹99"
                value={value} onChangeText={onChange}
                keyboardType="number-pad"
                leftIcon={<Ionicons name="cash-outline" size={16} color={theme.textTertiary} />}
                error={errors.pricePaise?.message}
              />
            )} />
            {formPricePaise && !isNaN(parseInt(formPricePaise, 10)) && (
              <Typography variant="caption" color={theme.primary} style={{ marginTop: -spacing.sm }}>
                = {formatPrice(parseInt(formPricePaise, 10))}
              </Typography>
            )}

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Controller control={control} name="trialDays" render={({ field: { onChange, value } }) => (
                  <Input label="Trial Days" placeholder="0" value={value} onChangeText={onChange} keyboardType="number-pad" error={errors.trialDays?.message} />
                )} />
              </View>
              <View style={{ flex: 1 }}>
                <Controller control={control} name="sortOrder" render={({ field: { onChange, value } }) => (
                  <Input label="Sort Order" placeholder="0" value={value} onChangeText={onChange} keyboardType="number-pad" />
                )} />
              </View>
            </View>

            {/* Active toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="label">Active</Typography>
              <Switch value={formIsActive} onValueChange={(v) => setValue('isActive', v)} trackColor={{ true: theme.primary }} />
            </View>

            {/* Features section */}
            <TouchableOpacity
              onPress={() => setShowFeatures(!showFeatures)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: spacing.sm,
              }}
            >
              <Typography variant="label">Features</Typography>
              <Ionicons name={showFeatures ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textTertiary} />
            </TouchableOpacity>

            {showFeatures && (
              <Card>
                <View style={{ gap: spacing.md }}>
                  <Input
                    label="Max Decks (-1 = unlimited)" placeholder="-1"
                    value={String(formFeatures.max_decks)}
                    onChangeText={(v) => updateFeature('max_decks', parseInt(v, 10) || -1)}
                    keyboardType="number-pad"
                  />
                  <Input
                    label="Max Exams/Day (-1 = unlimited)" placeholder="-1"
                    value={String(formFeatures.max_exams_per_day)}
                    onChangeText={(v) => updateFeature('max_exams_per_day', parseInt(v, 10) || -1)}
                    keyboardType="number-pad"
                  />
                  <Input
                    label="Max Subjects/Exam (-1 = unlimited)" placeholder="-1"
                    value={String(formFeatures.max_subjects_per_exam)}
                    onChangeText={(v) => updateFeature('max_subjects_per_exam', parseInt(v, 10) || -1)}
                    keyboardType="number-pad"
                  />
                  <Input
                    label="Max Level (-1 = all, 1-6 = cap)" placeholder="-1"
                    value={String(formFeatures.max_level)}
                    onChangeText={(v) => updateFeature('max_level', parseInt(v, 10) || -1)}
                    keyboardType="number-pad"
                  />
                  <Divider />
                  {([
                    { key: 'ai_explanations' as const, label: 'AI Explanations' },
                    { key: 'offline_access' as const, label: 'Offline Access' },
                    { key: 'priority_support' as const, label: 'Priority Support' },
                    { key: 'advanced_analytics' as const, label: 'Advanced Analytics' },
                    { key: 'deep_insights' as const, label: 'Deep Insights (Pro+)' },
                    { key: 'mastery_radar' as const, label: 'Mastery Radar (Master)' },
                  ]).map(({ key, label }) => (
                    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="body">{label}</Typography>
                      <Switch value={formFeatures[key]} onValueChange={(v) => updateFeature(key, v)} trackColor={{ true: tierInfo.color }} />
                    </View>
                  ))}
                </View>
              </Card>
            )}

            <Button
              fullWidth size="lg" loading={isSaving} onPress={handleSubmit(onFormSubmit)}
              icon={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}
            >
              {editingPlan ? 'Update Plan' : 'Create Plan'}
            </Button>
          </ScrollView>
        </ScreenWrapper>
      </Modal>
    </ScreenWrapper>
  );
}
