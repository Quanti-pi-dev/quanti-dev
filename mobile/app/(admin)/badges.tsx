// ─── Admin Badge Management ─────────────────────────────────
// Full CRUD for badges: list, create, edit, delete.
// Uses react-hook-form + Zod validation and toast notifications.

import { useState, useCallback } from 'react';
import { View, ScrollView, Alert, ActivityIndicator, Modal, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { Divider } from '../../src/components/ui/Divider';
import { useToast } from '../../src/contexts/ToastContext';
import {
  useAdminBadges,
  useCreateBadge,
  useUpdateBadge,
  useDeleteBadge,
  type AdminBadge,
} from '../../src/hooks/useAdminSubscriptions';
import { useQueryClient } from '@tanstack/react-query';
import { badgeFormSchema, type BadgeFormValues } from '../../src/utils/adminSchemas';

// ─── Form ───────────────────────────────────────────────────

const DEFAULT_VALUES: BadgeFormValues = { name: '', description: '', iconUrl: '', criteria: '' };

export default function BadgesScreen() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { data: badges = [], isLoading } = useAdminBadges();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['admin', 'badges'] });
    setRefreshing(false);
  }, [qc]);
  const createBadge = useCreateBadge();
  const updateBadge = useUpdateBadge();
  const deleteBadge = useDeleteBadge();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminBadge | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<BadgeFormValues>({
    resolver: zodResolver(badgeFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const isSaving = createBadge.isPending || updateBadge.isPending;

  function openCreate() {
    setEditing(null);
    reset(DEFAULT_VALUES);
    setShowModal(true);
  }

  function openEdit(badge: AdminBadge) {
    setEditing(badge);
    reset({
      name: badge.name,
      description: badge.description,
      iconUrl: badge.iconUrl,
      criteria: badge.criteria,
    });
    setShowModal(true);
  }

  function onFormSubmit(data: BadgeFormValues) {
    if (editing) {
      updateBadge.mutate({ id: editing.id, updates: data }, {
        onSuccess: () => { setShowModal(false); showToast('Badge updated'); },
        onError: (err) => showToast((err as Error).message ?? 'Failed to update badge', 'error'),
      });
    } else {
      createBadge.mutate(data, {
        onSuccess: () => { setShowModal(false); showToast('Badge created'); },
        onError: (err) => showToast((err as Error).message ?? 'Failed to create badge', 'error'),
      });
    }
  }

  function handleDelete(badge: AdminBadge) {
    Alert.alert('Delete Badge', `Delete "${badge.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteBadge.mutate(badge.id, {
          onSuccess: () => showToast('Badge deleted'),
          onError: (err) => showToast((err as Error).message ?? 'Failed to delete badge', 'error'),
        }),
      },
    ]);
  }

  return (
    <ScreenWrapper>
      <Header showBack title="Badge Management" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">Badges ({badges.length})</Typography>
          <Button variant="primary" size="sm" onPress={openCreate}>+ New Badge</Button>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: spacing['2xl'] }} />
        ) : badges.length === 0 ? (
          <Card variant="outlined">
            <Typography variant="body" color={theme.textSecondary} style={{ textAlign: 'center', paddingVertical: spacing['2xl'] }}>
              No badges yet. Tap "+ New Badge" to create one.
            </Typography>
          </Card>
        ) : (
          badges.map((badge) => (
            <Card key={badge.id} variant="outlined">
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: radius.full,
                    backgroundColor: theme.primary + '20', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="ribbon-outline" size={20} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="label">{badge.name}</Typography>
                    <Typography variant="caption" color={theme.textSecondary}>{badge.description}</Typography>
                  </View>
                </View>

                <Divider />

                <View style={{ gap: spacing.xs }}>
                  <Typography variant="caption" color={theme.textTertiary}>
                    Criteria: {badge.criteria}
                  </Typography>
                  <Typography variant="caption" color={theme.textTertiary}>
                    Icon URL: {badge.iconUrl.length > 40 ? badge.iconUrl.slice(0, 40) + '…' : badge.iconUrl}
                  </Typography>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  <Button variant="secondary" size="sm" onPress={() => openEdit(badge)} style={{ flex: 1 }}>
                    Edit
                  </Button>
                  <Button variant="secondary" size="sm" onPress={() => handleDelete(badge)} style={{ flex: 1 }}>
                    Delete
                  </Button>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* ── Create / Edit Modal ──────────────────────────────── */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
            padding: spacing.xl, maxHeight: '85%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <Typography variant="h4">{editing ? 'Edit Badge' : 'New Badge'}</Typography>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.md }}>
                <Controller control={control} name="name" render={({ field: { onChange, value } }) => (
                  <Input label="Name" value={value} onChangeText={onChange} placeholder="e.g. Weekly Champion" error={errors.name?.message} />
                )} />
                <Controller control={control} name="description" render={({ field: { onChange, value } }) => (
                  <Input label="Description" value={value} onChangeText={onChange} placeholder="Awarded when..." multiline error={errors.description?.message} />
                )} />
                <Controller control={control} name="iconUrl" render={({ field: { onChange, value } }) => (
                  <Input label="Icon URL" value={value} onChangeText={onChange} placeholder="https://cdn.example.com/badge.png" autoCapitalize="none" error={errors.iconUrl?.message} />
                )} />
                <Controller control={control} name="criteria" render={({ field: { onChange, value } }) => (
                  <Input label="Criteria" value={value} onChangeText={onChange} placeholder="e.g. complete_7_day_streak" autoCapitalize="none" error={errors.criteria?.message} />
                )} />

                <Button variant="primary" onPress={handleSubmit(onFormSubmit)} loading={isSaving} style={{ marginTop: spacing.md }}>
                  {editing ? 'Save Changes' : 'Create Badge'}
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}
