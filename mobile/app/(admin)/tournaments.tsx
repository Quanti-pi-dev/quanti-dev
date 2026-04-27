// ─── Admin Tournaments Screen ─────────────────────────────────
// Full CRUD for tournaments: list, create, edit, delete.
// Follows the established admin panel pattern (badges, plans).

import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useGlobalUI } from '../../src/contexts/GlobalUIContext';
import { spacing, radius, typography } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/services/api';

// ─── Types ──────────────────────────────────────────────────

interface Tournament {
  _id: string;
  name: string;
  description: string;
  entryFeeCoins: number;
  requiredTier: number;
  maxParticipants: number;
  startsAt: string;
  endsAt: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  prizeDescription: string;
  prizeCoins: number;
  rules: string;
  deckId: string | null;
  examId: string | null;
  entryCount: number;
  createdAt: string;
}

// ─── API Hooks ──────────────────────────────────────────────

function useAdminTournaments() {
  return useQuery({
    queryKey: ['admin', 'tournaments'],
    queryFn: async () => {
      const { data } = await api.get('/admin/tournaments');
      return (data?.data ?? []) as Tournament[];
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  draft: '#F59E0B',
  completed: '#6B7280',
  cancelled: '#EF4444',
};

const TIER_LABELS: Record<number, string> = { 0: 'Free', 1: 'Basic', 2: 'Pro', 3: 'Master' };

// ─── Create/Edit Form ────────────────────────────────────────

interface FormData {
  name: string;
  description: string;
  entryFeeCoins: string;
  requiredTier: string;
  maxParticipants: string;
  startsAt: string;
  endsAt: string;
  prizeDescription: string;
  prizeCoins: string;
  rules: string;
  status: Tournament['status'];
}

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  entryFeeCoins: '0',
  requiredTier: '0',
  maxParticipants: '0',
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  prizeDescription: '',
  prizeCoins: '0',
  rules: '',
  status: 'draft',
};

function tournamentToForm(t: Tournament): FormData {
  return {
    name: t.name,
    description: t.description,
    entryFeeCoins: String(t.entryFeeCoins),
    requiredTier: String(t.requiredTier),
    maxParticipants: String(t.maxParticipants),
    startsAt: t.startsAt,
    endsAt: t.endsAt,
    prizeDescription: t.prizeDescription,
    prizeCoins: String(t.prizeCoins),
    rules: t.rules,
    status: t.status,
  };
}

// ─── Screen ──────────────────────────────────────────────────

export default function AdminTournamentsScreen() {
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  const queryClient = useQueryClient();
  const { data: tournaments, isLoading, refetch } = useAdminTournaments();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  // ─── Mutations ─────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post('/admin/tournaments', body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
      setModalVisible(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const { data } = await api.put(`/admin/tournaments/${id}`, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
      setModalVisible(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/admin/tournaments/${id}`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tournaments'] });
    },
  });

  // ─── Handlers ──────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((t: Tournament) => {
    setEditingId(t._id);
    setForm(tournamentToForm(t));
    setModalVisible(true);
  }, []);

  const handleDelete = useCallback((t: Tournament) => {
    showAlert({
      title: 'Delete Tournament',
      message: `Are you sure you want to delete "${t.name}"?`,
      type: 'destructive',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(t._id),
        },
      ],
    });
  }, [deleteMutation]);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      entryFeeCoins: parseInt(form.entryFeeCoins, 10) || 0,
      requiredTier: parseInt(form.requiredTier, 10) || 0,
      maxParticipants: parseInt(form.maxParticipants, 10) || 0,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      prizeDescription: form.prizeDescription.trim(),
      prizeCoins: parseInt(form.prizeCoins, 10) || 0,
      rules: form.rules.trim(),
      ...(editingId ? { status: form.status } : {}),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  }, [form, editingId, createMutation, updateMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ─── Render ────────────────────────────────────────────────

  return (
    <ScreenWrapper>
      <Header showBack title="Tournaments" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['4xl'], gap: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} tintColor={theme.primary} />
        }
      >
        {/* Create button */}
        <Button onPress={openCreate}>+ New Tournament</Button>

        {/* Tournament count */}
        <Typography variant="caption" color={theme.textTertiary}>
          {(tournaments ?? []).length} tournament{(tournaments ?? []).length !== 1 ? 's' : ''}
        </Typography>

        {isLoading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: spacing['2xl'] }} />
        ) : (
          (tournaments ?? []).map((t) => {
            const statusColor = STATUS_COLORS[t.status] ?? theme.textTertiary;
            return (
              <Card key={t._id} style={{ gap: spacing.sm }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Typography variant="label">{t.name}</Typography>
                    {t.description ? (
                      <Typography variant="caption" color={theme.textSecondary} numberOfLines={2}>
                        {t.description}
                      </Typography>
                    ) : null}
                  </View>
                  <View style={{
                    paddingHorizontal: spacing.sm, paddingVertical: 2,
                    borderRadius: radius.full,
                    backgroundColor: statusColor + '22',
                  }}>
                    <Typography variant="caption" color={statusColor}>
                      {t.status.toUpperCase()}
                    </Typography>
                  </View>
                </View>

                {/* Info */}
                <View style={{ gap: spacing.xs }}>
                  <Typography variant="caption" color={theme.textTertiary}>
                    📅 {formatDate(t.startsAt)} → {formatDate(t.endsAt)}
                  </Typography>
                  <Typography variant="caption" color={theme.textTertiary}>
                    👥 {t.entryCount}{t.maxParticipants > 0 ? `/${t.maxParticipants}` : ''} entered
                    {t.entryFeeCoins > 0 ? ` · 🪙 ${t.entryFeeCoins} entry` : ' · Free'}
                    {t.prizeCoins > 0 ? ` · 🏆 ${t.prizeCoins} prize` : ''}
                  </Typography>
                  {t.requiredTier > 0 && (
                    <Typography variant="caption" color={theme.textTertiary}>
                      🛡️ {TIER_LABELS[t.requiredTier]}+ only
                    </Typography>
                  )}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                  <TouchableOpacity
                    onPress={() => openEdit(t)}
                    style={{
                      flex: 1, paddingVertical: spacing.sm, borderRadius: radius.lg,
                      backgroundColor: theme.primary + '18', alignItems: 'center',
                    }}
                  >
                    <Typography variant="caption" color={theme.primary}>Edit</Typography>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(t)}
                    style={{
                      flex: 1, paddingVertical: spacing.sm, borderRadius: radius.lg,
                      backgroundColor: '#EF444418', alignItems: 'center',
                    }}
                  >
                    <Typography variant="caption" color="#EF4444">Delete</Typography>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* ── Create / Edit Modal ── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            padding: spacing.xl, paddingTop: spacing['2xl'],
          }}>
            <Typography variant="h4">
              {editingId ? 'Edit Tournament' : 'New Tournament'}
            </Typography>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['4xl'] }}>
            <FormField
              label="Name *"
              value={form.name}
              onChangeText={(v) => setForm(f => ({ ...f, name: v }))}
              placeholder="e.g. Weekly Quiz Championship"
            />
            <FormField
              label="Description"
              value={form.description}
              onChangeText={(v) => setForm(f => ({ ...f, description: v }))}
              multiline
              placeholder="What is this tournament about?"
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Entry Fee (coins)"
                  value={form.entryFeeCoins}
                  onChangeText={(v) => setForm(f => ({ ...f, entryFeeCoins: v }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Prize (coins)"
                  value={form.prizeCoins}
                  onChangeText={(v) => setForm(f => ({ ...f, prizeCoins: v }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Max Participants (0=∞)"
                  value={form.maxParticipants}
                  onChangeText={(v) => setForm(f => ({ ...f, maxParticipants: v }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Required Tier (0-3)"
                  value={form.requiredTier}
                  onChangeText={(v) => setForm(f => ({ ...f, requiredTier: v }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <FormField
              label="Prize Description"
              value={form.prizeDescription}
              onChangeText={(v) => setForm(f => ({ ...f, prizeDescription: v }))}
              placeholder="e.g. Top scorer wins 500 coins!"
            />
            <FormField
              label="Rules"
              value={form.rules}
              onChangeText={(v) => setForm(f => ({ ...f, rules: v }))}
              multiline
              placeholder="Tournament rules..."
            />

            {editingId && (
              <View style={{ gap: spacing.xs }}>
                <Typography variant="caption" color={theme.textTertiary}>Status</Typography>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {(['draft', 'active', 'completed', 'cancelled'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setForm(f => ({ ...f, status: s }))}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.lg,
                        backgroundColor: form.status === s ? (STATUS_COLORS[s] ?? theme.primary) + '22' : theme.cardAlt,
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="caption"
                        color={form.status === s ? STATUS_COLORS[s] ?? theme.primary : theme.textTertiary}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={{ marginTop: spacing.md }}>
              <Button
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : editingId ? 'Update Tournament' : 'Create Tournament'}
              </Button>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

// ─── Reusable form field ─────────────────────────────────────

function FormField({
  label, value, onChangeText, placeholder, multiline, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Typography variant="caption" color={theme.textTertiary}>{label}</Typography>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          backgroundColor: theme.cardAlt,
          borderRadius: radius.lg,
          padding: spacing.md,
          color: theme.text,
          fontFamily: typography.body,
          fontSize: 14,
          ...(multiline ? { minHeight: 80, textAlignVertical: 'top' as const } : {}),
        }}
      />
    </View>
  );
}
