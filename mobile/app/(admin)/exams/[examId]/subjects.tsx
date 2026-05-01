// ─── Admin: Exam Subject Management ──────────────────────────
// Attach/detach/reorder subjects for an exam.
// Also create new subjects and auto-attach them.

import { useState } from 'react';
import { View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../../src/theme';
import { useGlobalUI } from '../../../../src/contexts/GlobalUIContext';
import { spacing, radius } from '../../../../src/theme/tokens';
import { ScreenWrapper } from '../../../../src/components/layout/ScreenWrapper';
import { Header } from '../../../../src/components/layout/Header';
import { Typography } from '../../../../src/components/ui/Typography';
import { Button } from '../../../../src/components/ui/Button';
import { Input } from '../../../../src/components/ui/Input';
import { Card } from '../../../../src/components/ui/Card';
import { Divider } from '../../../../src/components/ui/Divider';
import {
  useAdminExamSubjects,
  useAdminSubjects,
  useReorderSubject,
  useRemoveSubjectFromExam,
  AdminSubject,
} from '../../../../src/hooks/useAdminContent';
import { adminApi } from '../../../../src/services/api';
import { DraggableList } from '../../../../src/components/admin/DraggableList';
import { IconPickerGrid } from '../../../../src/components/admin/IconPickerGrid';
import { resolveSubjectIcon } from '../../../../src/constants/subject-icons';
import { useToast } from '../../../../src/contexts/ToastContext';

// ─── Accent colour palette for new subjects ──────────────────
const ACCENT_COLOURS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#14B8A6', '#8B5CF6', '#EF4444', '#3B82F6'];

export default function ExamSubjectsScreen() {
  const { examId, title } = useLocalSearchParams<{ examId: string; title?: string }>();
  const { theme } = useTheme();
  const { showAlert } = useGlobalUI();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // ── Remote data ────────────────────────────────────────────
  const { data: examSubjects = [], isLoading: loadingSubjects } = useAdminExamSubjects(examId);
  const { data: allSubjects = [], isLoading: loadingAll } = useAdminSubjects();
  const reorder = useReorderSubject();
  const remove = useRemoveSubjectFromExam();

  // ── Attach existing subject ─────────────────────────────────
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [attaching, setAttaching] = useState(false);

  // ── Create new subject + auto-attach ───────────────────────
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIconName, setNewIconName] = useState('');
  const [newAccent, setNewAccent] = useState(ACCENT_COLOURS[0]!);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const attachedSubjectIds = new Set(examSubjects.map((es) => es.subjectId));
  const attachableSubjects = allSubjects.filter((s) => !attachedSubjectIds.has(s.id));

  // ── Handlers ───────────────────────────────────────────────

  async function handleAttach() {
    if (!selectedSubjectId) return;
    setAttaching(true);
    try {
      await adminApi.post(`/exams/${examId}/subjects`, { subjectId: selectedSubjectId });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'exam-subjects', examId] });
      setSelectedSubjectId('');
      showToast('Subject attached');
    } catch {
      showToast('Failed to attach subject', 'error');
    } finally {
      setAttaching(false);
    }
  }

  function confirmRemove(subjectId: string, name: string) {
    showAlert({
      title: 'Remove Subject',
      message: `Remove "${name}" from this exam?`,
      type: 'destructive',
      buttons: [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => remove.mutate({ examId, subjectId }, {
          onSuccess: () => showToast('Subject removed'),
          onError: () => showToast('Failed to remove subject', 'error'),
        }),
      },
    ],
    });
  }

  async function handleCreateAndAttach() {
    if (!newName.trim()) { setCreateError('Name is required.'); return; }
    setCreateError('');
    setCreating(true);

    let newSubjectId: string | null = null;
    try {
      // Step 1 — create the subject
      const { data: createRes } = await adminApi.post('/subjects', {
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        iconName: newIconName.trim() || undefined,
        accent: newAccent,
      });
      newSubjectId = createRes.data.id as string;

      // Step 2 — link it to this exam
      await adminApi.post(`/exams/${examId}/subjects`, { subjectId: newSubjectId });

      void queryClient.invalidateQueries({ queryKey: ['admin', 'exam-subjects', examId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'subjects'] });

      // Reset form on full success
      setNewName('');
      setNewDescription('');
      setNewIconName('');
      setNewAccent(ACCENT_COLOURS[0]!);
      setShowCreateForm(false);
    } catch (err: unknown) {
      if (newSubjectId) {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'subjects'] });
        setCreateError(
          'Subject was created but could not be linked to this exam. ' +
          'You can attach it manually using "Attach Existing Subject" above.',
        );
      } else {
        setCreateError(err instanceof Error ? err.message : 'Failed to create subject.');
      }
    } finally {
      setCreating(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <ScreenWrapper>
      <Header showBack title={`${title ?? 'Exam'} — Subjects`} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
      >

        {/* ── Attached subjects ─────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h4">Attached Subjects</Typography>
            {examSubjects.length > 1 && (
              <Typography variant="caption" color={theme.textTertiary}>
                ✋ Long-press to reorder
              </Typography>
            )}
          </View>

          {loadingSubjects && <ActivityIndicator color={theme.primary} style={{ alignSelf: 'flex-start' }} />}

          {!loadingSubjects && examSubjects.length === 0 && (
            <Typography variant="bodySmall" color={theme.textTertiary}>
              No subjects attached yet. Attach or create one below.
            </Typography>
          )}

          {examSubjects.length > 0 && (
            <DraggableList
              data={examSubjects}
              keyExtractor={(es) => es.id}
              itemHeight={130}
              onReorder={(fromIndex, toIndex) => {
                const item = examSubjects[fromIndex];
                if (item) {
                  reorder.mutate({ examId, subjectId: item.subjectId, order: toIndex });
                }
              }}
              renderItem={(es) => {
                const subject = es.subject as AdminSubject | null;
                const accent = subject?.accent ?? theme.primary;
                return (
                  <View
                    style={{
                      backgroundColor: theme.card,
                      borderRadius: radius.xl,
                      borderWidth: 1,
                      borderColor: theme.border,
                      overflow: 'hidden',
                      marginBottom: spacing.sm,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md }}>
                      {/* Drag handle */}
                      <View style={{ alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                        <Ionicons name="reorder-three-outline" size={22} color={theme.textSecondary} />
                      </View>

                      {/* Subject icon */}
                      <View
                        style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: accent + '22',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Ionicons
                          name={(subject?.iconName ?? resolveSubjectIcon(subject?.name ?? '')) as never}
                          size={18}
                          color={accent}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Typography variant="label">{subject?.name ?? es.subjectId}</Typography>
                        {subject?.description && (
                          <Typography variant="caption" color={theme.textTertiary} numberOfLines={1}>
                            {subject.description}
                          </Typography>
                        )}
                      </View>
                    </View>

                    <Divider />

                    <View style={{ flexDirection: 'row', padding: spacing.sm, gap: spacing.sm }}>
                      <Button
                        variant="secondary" size="sm"
                        icon={<Ionicons name="list-outline" size={13} color={theme.textSecondary} />}
                        onPress={() => {
                          const queryParams = new URLSearchParams();
                          queryParams.append('title', subject?.name ?? 'Subject');
                          if (subject?.accent) queryParams.append('accent', subject.accent);
                          queryParams.append('examId', examId);
                          router.push(`/(admin)/subjects/${es.subjectId}/levels?${queryParams.toString()}` as never);
                        }}
                      >
                        Levels
                      </Button>
                      <Button
                        variant="danger" size="sm"
                        icon={<Ionicons name="remove-circle-outline" size={13} color="#FFFFFF" />}
                        onPress={() => confirmRemove(es.subjectId, subject?.name ?? 'this subject')}
                      >
                        Remove
                      </Button>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>

        <Divider />

        {/* ── Attach existing subject ───────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <Typography variant="h4">Attach Existing Subject</Typography>

          {loadingAll ? (
            <ActivityIndicator color={theme.primary} style={{ alignSelf: 'flex-start' }} />
          ) : attachableSubjects.length === 0 ? (
            <Typography variant="bodySmall" color={theme.textTertiary}>
              All subjects are already attached to this exam.
            </Typography>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {attachableSubjects.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setSelectedSubjectId(prev => prev === s.id ? '' : s.id)}
                      style={{
                        paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
                        borderRadius: radius.full, borderWidth: 1.5,
                        borderColor: selectedSubjectId === s.id ? theme.primary : theme.border,
                        backgroundColor: selectedSubjectId === s.id ? theme.primary + '22' : theme.card,
                      }}
                    >
                      <Typography variant="caption" color={selectedSubjectId === s.id ? theme.primary : theme.textSecondary}>
                        {s.name}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Button
                variant="primary" size="md" loading={attaching}
                disabled={!selectedSubjectId} onPress={handleAttach}
                icon={<Ionicons name="link-outline" size={16} color="#FFFFFF" />}
              >
                Attach Selected
              </Button>
            </View>
          )}
        </View>

        <Divider />

        {/* ── Create new subject ────────────────────────────── */}
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h4">Create New Subject</Typography>
            <TouchableOpacity onPress={() => setShowCreateForm(v => !v)}>
              <Ionicons name={showCreateForm ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {showCreateForm && (
            <Card>
              <View style={{ gap: spacing.md }}>
                <Input label="Name *" placeholder="e.g. Number Theory" value={newName} onChangeText={setNewName} />
                <Input label="Description" placeholder="Brief description (optional)" value={newDescription} onChangeText={setNewDescription} />
                <IconPickerGrid selected={newIconName} onSelect={setNewIconName} accentColor={newAccent} />

                {/* Accent colour picker */}
                <View style={{ gap: spacing.xs }}>
                  <Typography variant="label">Accent Colour</Typography>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {ACCENT_COLOURS.map((colour) => (
                      <TouchableOpacity
                        key={colour}
                        onPress={() => setNewAccent(colour)}
                        style={{
                          width: 32, height: 32, borderRadius: 16,
                          backgroundColor: colour,
                          borderWidth: newAccent === colour ? 3 : 0,
                          borderColor: theme.text,
                        }}
                      />
                    ))}
                  </View>
                </View>

                {createError ? (
                  <Typography variant="bodySmall" color={theme.error} align="center">{createError}</Typography>
                ) : null}

                <Button fullWidth size="md" loading={creating} onPress={handleCreateAndAttach}
                  icon={<Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />}>
                  Create & Attach
                </Button>
              </View>
            </Card>
          )}
        </View>

      </ScrollView>
    </ScreenWrapper>
  );
}
