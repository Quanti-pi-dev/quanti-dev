// ─── Admin Content (Exam Management) ─────────────────────────
// Live CRUD: list, create, edit, delete, publish/unpublish exams.
// Drill-through to per-exam subject management.
// Uses centralized hooks, Zod form validation, and toast notifications.

import { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, Alert, ActivityIndicator, Modal, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
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
  useAdminExams,
  useTogglePublished,
  useCreateExam,
  useUpdateExam,
  useDeleteExam,
  AdminExam,
} from '../../src/hooks/useAdminContent';
import { useQueryClient } from '@tanstack/react-query';
import { examFormSchema, type ExamFormValues } from '../../src/utils/adminSchemas';


const DEFAULT_VALUES: ExamFormValues = {
  title: '',
  description: '',
  category: '',
  durationMinutes: '30',
};

export default function ContentScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminExams(page);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    setRefreshing(false);
  }, [queryClient]);
  const togglePublished = useTogglePublished();
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const deleteExam = useDeleteExam();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingExam, setEditingExam] = useState<AdminExam | null>(null);

  // ── react-hook-form (Component C) ───────────────────────────
  const { control, handleSubmit, reset, formState: { errors } } = useForm<ExamFormValues>({
    resolver: zodResolver(examFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // ── Search & Filter ───────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  const allExams = data?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  const exams = useMemo(() => {
    let filtered = allExams;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q),
      );
    }
    if (statusFilter === 'published') filtered = filtered.filter((e) => e.isPublished);
    if (statusFilter === 'draft') filtered = filtered.filter((e) => !e.isPublished);
    return filtered;
  }, [allExams, searchQuery, statusFilter]);

  function openCreate() {
    setEditingExam(null);
    reset(DEFAULT_VALUES);
    setModalVisible(true);
  }

  function openEdit(exam: AdminExam) {
    setEditingExam(exam);
    reset({
      title: exam.title,
      description: exam.description,
      category: exam.category,
      durationMinutes: String(exam.durationMinutes),
    });
    setModalVisible(true);
  }

  function onFormSubmit(data: ExamFormValues) {
    const payload = {
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category.trim(),
      durationMinutes: parseInt(data.durationMinutes, 10),
    };

    if (editingExam) {
      updateExam.mutate({ id: editingExam.id, payload }, {
        onSuccess: () => { setModalVisible(false); showToast('Exam updated successfully'); },
        onError: (err) => showToast(err instanceof Error ? err.message : 'Failed to update exam', 'error'),
      });
    } else {
      createExam.mutate(payload, {
        onSuccess: () => { setModalVisible(false); showToast('Exam created successfully'); },
        onError: (err) => showToast(err instanceof Error ? err.message : 'Failed to create exam', 'error'),
      });
    }
  }

  function confirmDelete(exam: AdminExam) {
    Alert.alert(
      'Delete Exam',
      `Are you sure you want to permanently delete "${exam.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteExam.mutate(exam.id, {
            onSuccess: () => showToast('Exam deleted'),
            onError: () => showToast('Failed to delete exam', 'error'),
          }),
        },
      ],
    );
  }

  const isSaving = createExam.isPending || updateExam.isPending;

  return (
    <ScreenWrapper>
      <Header
        showBack
        title="Manage Exams"
        rightAction={
          <Button variant="ghost" size="sm" onPress={openCreate}>+ New</Button>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['4xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {/* ── Search & Filter ── */}
        <Input
          placeholder="Search by title or category…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Ionicons name="search-outline" size={18} color={theme.textTertiary} />}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['all', 'published', 'draft'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setStatusFilter(s)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
                borderWidth: 1.5,
                borderColor: statusFilter === s ? theme.primary : theme.border,
                backgroundColor: statusFilter === s ? theme.primary + '22' : theme.card,
              }}
            >
              <Typography
                variant="caption"
                color={statusFilter === s ? theme.primary : theme.textSecondary}
              >
                {s === 'all' ? 'All' : s === 'published' ? '✅ Published' : '📝 Draft'}
              </Typography>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading && (
          <View style={{ alignItems: 'center', paddingTop: spacing['2xl'] }}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: spacing.sm }}>
              Loading exams…
            </Typography>
          </View>
        )}

        {isError && (
          <Card>
            <Typography variant="body" align="center" color={theme.error}>
              Failed to load exams. Check your connection.
            </Typography>
          </Card>
        )}

        {!isLoading && !isError && exams.length === 0 && (
          <Card>
            <Typography variant="body" align="center" color={theme.textTertiary}>
              No exams yet. Tap "+ New" to create your first exam.
            </Typography>
          </Card>
        )}

        {exams.map((exam) => (
          <View
            key={exam.id}
            style={{
              backgroundColor: theme.card,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: exam.isPublished ? theme.primary + '66' : theme.border,
              overflow: 'hidden',
            }}
          >
            {/* Exam header */}
            <View style={{ padding: spacing.lg, gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Typography variant="label">{exam.title}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>{exam.category}</Typography>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <View style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                    borderRadius: radius.full,
                    backgroundColor: exam.isPublished ? theme.primary + '22' : theme.cardAlt,
                  }}>
                    <Typography
                      variant="caption"
                      color={exam.isPublished ? theme.primary : theme.textTertiary}
                    >
                      {exam.isPublished ? 'Live' : 'Draft'}
                    </Typography>
                  </View>
                </View>
              </View>
              <Typography variant="bodySmall" color={theme.textSecondary} numberOfLines={2}>
                {exam.description}
              </Typography>
            </View>

            <Divider />

            {/* Action row */}
            <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.sm, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Ionicons name="people-outline" size={14} color={theme.textSecondary} />}
                onPress={() => router.push(`/(admin)/exams/${exam.id}/subjects?title=${encodeURIComponent(exam.title)}` as never)}
              >
                Subjects
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Ionicons name={exam.isPublished ? 'eye-off-outline' : 'eye-outline'} size={14} color={theme.textSecondary} />}
                loading={togglePublished.isPending && togglePublished.variables === exam.id}
                onPress={() => togglePublished.mutate(exam.id)}
              >
                {exam.isPublished ? 'Unpublish' : 'Publish'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Ionicons name="pencil-outline" size={14} color={theme.textSecondary} />}
                onPress={() => openEdit(exam)}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Ionicons name="trash-outline" size={14} color="#FFFFFF" />}
                onPress={() => confirmDelete(exam)}
              >
                Delete
              </Button>
            </View>
          </View>
        ))}

        {/* ── Pagination ── */}
        {(page > 1 || (pagination && pagination.total > pagination.pageSize)) && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: spacing.lg,
          }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              icon={<Ionicons name="chevron-back" size={14} color={theme.textSecondary} />}
              onPress={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Typography variant="caption" color={theme.textTertiary}>
              Page {page}{totalPages > 1 ? ` of ${totalPages}` : ''}
            </Typography>
            <Button
              variant="secondary"
              size="sm"
              disabled={!pagination || page >= totalPages}
              icon={<Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />}
              onPress={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </View>
        )}
      </ScrollView>

      {/* ── Create / Edit Modal ── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: theme.border,
          }}>
            <Typography variant="h4">{editingExam ? 'Edit Exam' : 'New Exam'}</Typography>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
            keyboardShouldPersistTaps="handled"
          >
            <Controller control={control} name="title" render={({ field: { onChange, value } }) => (
              <Input label="Title *" placeholder="e.g. Number System" value={value} onChangeText={onChange} error={errors.title?.message} />
            )} />
            <Controller control={control} name="category" render={({ field: { onChange, value } }) => (
              <Input label="Category *" placeholder="e.g. Quantitative Aptitude" value={value} onChangeText={onChange} error={errors.category?.message} />
            )} />
            <Controller control={control} name="description" render={({ field: { onChange, value } }) => (
              <Input label="Description *" placeholder="Brief description of this exam" value={value} onChangeText={onChange} multiline numberOfLines={3} error={errors.description?.message} />
            )} />
            <Controller control={control} name="durationMinutes" render={({ field: { onChange, value } }) => (
              <Input label="Duration (minutes)" placeholder="30" value={value} onChangeText={onChange} keyboardType="number-pad" error={errors.durationMinutes?.message} />
            )} />

            <Button fullWidth size="lg" loading={isSaving} onPress={handleSubmit(onFormSubmit)}
              icon={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}>
              {editingExam ? 'Update Exam' : 'Create Exam'}
            </Button>
          </ScrollView>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}
