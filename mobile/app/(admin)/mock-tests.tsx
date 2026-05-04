// ─── Admin Mock Tests Screen ──────────────────────────────────
// Full CRUD for curated mock test templates: list, create, edit, delete.
// Follows the established admin panel pattern (tournaments, badges, plans).

import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useGlobalUI } from '../../src/contexts/GlobalUIContext';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../src/services/api';

// ─── Types ──────────────────────────────────────────────────

interface MockTest {
  _id: string;
  title: string;
  description: string;
  examId: string;
  cardIds: string[];
  subjectIds: string[];
  cardCount: number;
  timeLimitMinutes: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── API Hook ───────────────────────────────────────────────

function useAdminMockTests() {
  return useQuery({
    queryKey: ['admin', 'mock-tests'],
    queryFn: async () => {
      const { data } = await adminApi.get('/mock-tests');
      return (data?.data ?? []) as MockTest[];
    },
  });
}

// ─── Form ───────────────────────────────────────────────────

interface FormData {
  title: string;
  description: string;
  examId: string;
  cardIds: string;
  subjectIds: string;
  cardCount: string;
  timeLimitMinutes: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: FormData = {
  title: '',
  description: '',
  examId: '',
  cardIds: '',
  subjectIds: '',
  cardCount: '30',
  timeLimitMinutes: '45',
  isActive: true,
  sortOrder: '0',
};

function mockTestToForm(t: MockTest): FormData {
  return {
    title: t.title,
    description: t.description,
    examId: t.examId,
    cardIds: t.cardIds.join(', '),
    subjectIds: t.subjectIds.join(', '),
    cardCount: String(t.cardCount),
    timeLimitMinutes: String(t.timeLimitMinutes),
    isActive: t.isActive,
    sortOrder: String(t.sortOrder),
  };
}

function parseCommaSeparated(input: string): string[] {
  return input
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// ─── Screen ──────────────────────────────────────────────────

export default function AdminMockTestsScreen() {
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  const queryClient = useQueryClient();
  const { data: mockTests, isLoading, refetch } = useAdminMockTests();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  // ─── Mutations ─────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await adminApi.post('/mock-tests', body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'mock-tests'] });
      setModalVisible(false);
      showToast('Mock test created', 'success');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const { data } = await adminApi.put(`/mock-tests/${id}`, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'mock-tests'] });
      setModalVisible(false);
      showToast('Mock test updated', 'success');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await adminApi.delete(`/mock-tests/${id}`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'mock-tests'] });
      showToast('Mock test deleted', 'success');
    },
  });

  // ─── Handlers ──────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((t: MockTest) => {
    setEditingId(t._id);
    setForm(mockTestToForm(t));
    setModalVisible(true);
  }, []);

  const handleDelete = useCallback((t: MockTest) => {
    showAlert({
      title: 'Delete Mock Test',
      message: `Are you sure you want to delete "${t.title}"?`,
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
  }, [deleteMutation, showAlert]);

  const handleSave = useCallback(() => {
    if (!form.title.trim()) {
      showToast('Title is required', 'error');
      return;
    }
    if (!form.examId.trim()) {
      showToast('Exam ID is required', 'error');
      return;
    }

    const body: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      examId: form.examId.trim(),
      cardIds: parseCommaSeparated(form.cardIds),
      subjectIds: parseCommaSeparated(form.subjectIds),
      cardCount: parseInt(form.cardCount, 10) || 30,
      timeLimitMinutes: parseInt(form.timeLimitMinutes, 10) || 45,
      isActive: form.isActive,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  }, [form, editingId, createMutation, updateMutation, showToast]);

  const toggleActive = useCallback((t: MockTest) => {
    updateMutation.mutate({
      id: t._id,
      body: { isActive: !t.isActive },
    });
  }, [updateMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ─── Render ────────────────────────────────────────────────

  return (
    <ScreenWrapper>
      <Header showBack title="Mock Tests" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['4xl'], gap: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} tintColor={theme.primary} />
        }
      >
        {/* Create button */}
        <Button onPress={openCreate}>+ New Mock Test</Button>

        {/* Count */}
        <Typography variant="caption" color={theme.textTertiary}>
          {(mockTests ?? []).length} mock test{(mockTests ?? []).length !== 1 ? 's' : ''}
        </Typography>

        {isLoading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: spacing['2xl'] }} />
        ) : (
          (mockTests ?? []).map((t) => (
            <Card key={t._id} style={{ gap: spacing.sm }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Typography variant="label">{t.title}</Typography>
                  {t.description ? (
                    <Typography variant="caption" color={theme.textSecondary} numberOfLines={2}>
                      {t.description}
                    </Typography>
                  ) : null}
                </View>
                <View style={{
                  paddingHorizontal: spacing.sm, paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: t.isActive ? '#10B98122' : '#6B728022',
                }}>
                  <Typography variant="caption" color={t.isActive ? '#10B981' : '#6B7280'}>
                    {t.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </Typography>
                </View>
              </View>

              {/* Info */}
              <View style={{ gap: spacing.xs }}>
                <Typography variant="caption" color={theme.textTertiary}>
                  📝 {t.cardIds.length > 0 ? `${t.cardIds.length} fixed cards` : `${t.cardCount} sampled cards`}
                  {' · '} ⏱️ {t.timeLimitMinutes > 0 ? `${t.timeLimitMinutes} min` : 'Untimed'}
                </Typography>
                {t.subjectIds.length > 0 && (
                  <Typography variant="caption" color={theme.textTertiary}>
                    📚 {t.subjectIds.length} subject{t.subjectIds.length !== 1 ? 's' : ''} scoped
                  </Typography>
                )}
                <Typography variant="caption" color={theme.textTertiary}>
                  🔢 Sort order: {t.sortOrder}
                </Typography>
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                <TouchableOpacity
                  onPress={() => toggleActive(t)}
                  style={{
                    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.lg,
                    backgroundColor: t.isActive ? '#F59E0B18' : '#10B98118',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" color={t.isActive ? '#F59E0B' : '#10B981'}>
                    {t.isActive ? 'Deactivate' : 'Activate'}
                  </Typography>
                </TouchableOpacity>
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
          ))
        )}
      </ScrollView>

      {/* ── Create / Edit Modal ── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <ScreenWrapper style={{ backgroundColor: theme.background }}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            padding: spacing.xl,
          }}>
            <Typography variant="h4">
              {editingId ? 'Edit Mock Test' : 'New Mock Test'}
            </Typography>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['4xl'] }}>
            <FormField
              label="Title *"
              value={form.title}
              onChangeText={(v) => setForm(f => ({ ...f, title: v }))}
              placeholder="e.g. NEET Physics Full Mock"
            />
            <FormField
              label="Description"
              value={form.description}
              onChangeText={(v) => setForm(f => ({ ...f, description: v }))}
              multiline
              placeholder="What does this mock test cover?"
            />
            <FormField
              label="Exam ID *"
              value={form.examId}
              onChangeText={(v) => setForm(f => ({ ...f, examId: v }))}
              placeholder="MongoDB ObjectId of the exam"
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Card Count"
                  value={form.cardCount}
                  onChangeText={(v) => setForm(f => ({ ...f, cardCount: v }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Time Limit (min)"
                  value={form.timeLimitMinutes}
                  onChangeText={(v) => setForm(f => ({ ...f, timeLimitMinutes: v }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <FormField
              label="Card IDs (comma-separated, optional)"
              value={form.cardIds}
              onChangeText={(v) => setForm(f => ({ ...f, cardIds: v }))}
              multiline
              placeholder="Leave empty to sample from subjects"
            />
            <FormField
              label="Subject IDs (comma-separated, for sampling)"
              value={form.subjectIds}
              onChangeText={(v) => setForm(f => ({ ...f, subjectIds: v }))}
              multiline
              placeholder="Used when Card IDs is empty"
            />
            <FormField
              label="Sort Order"
              value={form.sortOrder}
              onChangeText={(v) => setForm(f => ({ ...f, sortOrder: v }))}
              keyboardType="numeric"
            />

            {/* Active toggle */}
            <View style={{ gap: spacing.xs }}>
              <Typography variant="caption" color={theme.textTertiary}>Status</Typography>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {[true, false].map((val) => (
                  <TouchableOpacity
                    key={String(val)}
                    onPress={() => setForm(f => ({ ...f, isActive: val }))}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.lg,
                      backgroundColor: form.isActive === val
                        ? (val ? '#10B98122' : '#EF444422')
                        : theme.cardAlt,
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      variant="caption"
                      color={form.isActive === val
                        ? (val ? '#10B981' : '#EF4444')
                        : theme.textTertiary}
                    >
                      {val ? 'Active' : 'Inactive'}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Button
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : editingId ? 'Update Mock Test' : 'Create Mock Test'}
              </Button>
            </View>
          </ScrollView>
        </ScreenWrapper>
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
          fontWeight: '400',
          fontSize: 14,
          ...(multiline ? { minHeight: 80, textAlignVertical: 'top' as const } : {}),
        }}
      />
    </View>
  );
}
