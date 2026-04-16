// ─── Admin: Subject Topic & Level Browser ────────────────────
// Dynamic topic management with full CRUD:
//   • Create new topics (slug + display name)
//   • Edit existing topics (rename, slug)
//   • Delete topics (blocked if decks exist)
//
// Subject → [Topics CRUD] → [6 Levels] → Flashcard Editor

import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../src/theme';
import { spacing, radius } from '../../../../src/theme/tokens';
import { ScreenWrapper } from '../../../../src/components/layout/ScreenWrapper';
import { Header } from '../../../../src/components/layout/Header';
import { Typography } from '../../../../src/components/ui/Typography';
import { Button } from '../../../../src/components/ui/Button';
import { Input } from '../../../../src/components/ui/Input';
import {
  useAdminLevelCards,
  useAdminSubjectTopics,
  useCreateTopic,
  useUpdateTopic,
  useDeleteTopic,
  type TopicEntry,
} from '../../../../src/hooks/useAdminContent';
import { useToast } from '../../../../src/contexts/ToastContext';
import { SUBJECT_LEVELS } from '@kd/shared';
import type { SubjectLevel } from '@kd/shared';

// ─── Level meta ───────────────────────────────────────────────

const LEVEL_META: Record<SubjectLevel, { icon: string; colour: string }> = {
  Beginner:  { icon: 'leaf-outline',    colour: '#10B981' },
  Rookie:    { icon: 'rocket-outline',  colour: '#6366F1' },
  Skilled:   { icon: 'flash-outline',   colour: '#8B5CF6' },
  Competent: { icon: 'trophy-outline',  colour: '#F59E0B' },
  Expert:    { icon: 'star-outline',    colour: '#EC4899' },
  Master:    { icon: 'diamond-outline', colour: '#EF4444' },
};

// ─── Slug helper (auto-generate from display name) ────────────

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Level row (fetches card count for topic+level) ───────────

function LevelRow({
  subjectId, level, topicSlug, subjectName: _subjectName, topicName: _topicName, onPress,
}: {
  subjectId: string; level: SubjectLevel; topicSlug: string;
  subjectName: string; topicName: string; onPress: () => void;
}) {
  const { theme } = useTheme();
  const { data, isLoading } = useAdminLevelCards(subjectId, level, topicSlug);
  const meta = LEVEL_META[level];
  const cardCount = data?.cardCount ?? 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: theme.background,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: theme.border,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginLeft: spacing.lg,
      }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: radius.full,
        backgroundColor: meta.colour + '22',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={meta.icon as never} size={18} color={meta.colour} />
      </View>

      <View style={{ flex: 1 }}>
        <Typography variant="bodySmall">{level}</Typography>
        <Typography variant="caption" color={theme.textTertiary}>
          {isLoading ? 'Loading…' : `${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`}
        </Typography>
      </View>

      <View style={{
        paddingHorizontal: spacing.sm, paddingVertical: 2,
        borderRadius: radius.full,
        backgroundColor: cardCount > 0 ? '#10B98122' : theme.cardAlt,
      }}>
        <Typography variant="caption" color={cardCount > 0 ? '#10B981' : theme.textTertiary}>
          {cardCount > 0 ? '✓ Seeded' : 'Empty'}
        </Typography>
      </View>

      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
    </TouchableOpacity>
  );
}

// ─── Topic accordion row (with edit/delete) ───────────────────

function TopicRow({
  subjectId, subjectName, topic, accent, router, onEdit, onDelete,
}: {
  subjectId: string; subjectName: string;
  topic: TopicEntry;
  accent: string;
  router: ReturnType<typeof useRouter>;
  onEdit: (topic: TopicEntry) => void;
  onDelete: (topic: TopicEntry) => void;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={{
      backgroundColor: theme.card,
      borderRadius: radius['2xl'],
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    }}>
      {/* Topic header — tap to expand/collapse */}
      <TouchableOpacity
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row', alignItems: 'center',
          padding: spacing.lg, gap: spacing.md,
        }}
      >
        <View style={{
          width: 8, height: 8, borderRadius: 4, backgroundColor: accent,
        }} />
        <View style={{ flex: 1 }}>
          <Typography variant="label">{topic.displayName}</Typography>
          <Typography variant="caption" color={theme.textTertiary}>{topic.slug}</Typography>
        </View>

        {/* Edit button */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onEdit(topic); }}
          hitSlop={8}
          style={{ padding: spacing.xs }}
        >
          <Ionicons name="pencil-outline" size={16} color={theme.primary} />
        </TouchableOpacity>

        {/* Delete button */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onDelete(topic); }}
          hitSlop={8}
          style={{ padding: spacing.xs }}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>

        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18} color={theme.textTertiary}
        />
      </TouchableOpacity>

      {/* Level rows — visible when expanded */}
      {open && (
        <View style={{ paddingBottom: spacing.md, gap: spacing.xs }}>
          {(SUBJECT_LEVELS as SubjectLevel[]).map((level) => (
            <LevelRow
              key={level}
              subjectId={subjectId}
              level={level}
              topicSlug={topic.slug}
              subjectName={subjectName}
              topicName={topic.displayName}
              onPress={() =>
                router.push({
                  pathname: '/(admin)/flashcard-editor',
                  params: {
                    subjectId,
                    level,
                    topicSlug: topic.slug,
                    title: `${topic.displayName} — ${level}`,
                  },
                } as never)
              }
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Create / Edit Topic Modal ────────────────────────────────

function TopicFormModal({
  visible, onClose, onSubmit, editing, submitting,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { displayName: string; slug: string }) => void;
  editing: TopicEntry | null;   // null = create mode
  submitting: boolean;
}) {
  const { theme } = useTheme();
  const [displayName, setDisplayName] = useState(editing?.displayName ?? '');
  const [slug, setSlug] = useState(editing?.slug ?? '');
  const [autoSlug, setAutoSlug] = useState(!editing); // auto-generate slug in create mode

  // Reset state when modal opens with new data
  const [lastEditing, setLastEditing] = useState<TopicEntry | null>(null);
  if (editing !== lastEditing) {
    setLastEditing(editing);
    setDisplayName(editing?.displayName ?? '');
    setSlug(editing?.slug ?? '');
    setAutoSlug(!editing);
  }

  function handleNameChange(text: string) {
    setDisplayName(text);
    if (autoSlug) setSlug(toSlug(text));
  }

  function handleSubmit() {
    if (!displayName.trim() || !slug.trim()) return;
    onSubmit({ displayName: displayName.trim(), slug: slug.trim() });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{
        flex: 1, justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)', padding: spacing.xl,
      }}>
        <View style={{
          width: '100%', maxWidth: 420,
          backgroundColor: theme.card,
          borderRadius: radius['2xl'],
          padding: spacing.xl,
          gap: spacing.md,
        }}>
          <Typography variant="h3">
            {editing ? 'Edit Topic' : 'New Topic'}
          </Typography>

          <Input
            label="Display Name"
            placeholder="e.g. Kinematics"
            value={displayName}
            onChangeText={handleNameChange}
          />

          <Input
            label="Slug (kebab-case)"
            placeholder="e.g. kinematics"
            value={slug}
            onChangeText={(text) => { setSlug(text); setAutoSlug(false); }}
          />

          <Typography variant="caption" color={theme.textTertiary}>
            Slugs must be lowercase, kebab-case (e.g. "laws-of-motion"). Used as the deck identifier.
          </Typography>

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" onPress={onClose} fullWidth>Cancel</Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={handleSubmit}
                disabled={submitting || !displayName.trim() || !slug.trim()}
                loading={submitting}
                fullWidth
              >
                {editing ? 'Save' : 'Create'}
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function SubjectLevelsScreen() {
  const { subjectId, title, accent } = useLocalSearchParams<{
    subjectId: string; title?: string; accent?: string;
  }>();
  const { theme } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();

  // Fetch topics from dynamic MongoDB API
  const { data: topicData, isLoading: loadingTopics } = useAdminSubjectTopics(subjectId);
  const subjectName = topicData?.subjectName ?? title ?? 'Subject';
  const topics = topicData?.topics ?? [];
  const subjectAccent = accent ?? theme.primary;

  // CRUD mutations
  const createTopic = useCreateTopic();
  const updateTopic = useUpdateTopic();
  const deleteTopic = useDeleteTopic();

  // Modal state
  const [formVisible, setFormVisible] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicEntry | null>(null);

  function openCreate() {
    setEditingTopic(null);
    setFormVisible(true);
  }

  function openEdit(topic: TopicEntry) {
    setEditingTopic(topic);
    setFormVisible(true);
  }

  function handleFormSubmit(formData: { displayName: string; slug: string }) {
    if (editingTopic?.id) {
      // Update
      updateTopic.mutate(
        { subjectId, topicId: editingTopic.id, updates: formData },
        {
          onSuccess: () => { setFormVisible(false); showToast('Topic updated'); },
          onError: () => showToast('Failed to update topic', 'error'),
        },
      );
    } else {
      // Create
      createTopic.mutate(
        { subjectId, ...formData },
        {
          onSuccess: () => { setFormVisible(false); showToast('Topic created'); },
          onError: () => showToast('Failed to create topic', 'error'),
        },
      );
    }
  }

  function confirmDelete(topic: TopicEntry) {
    Alert.alert(
      'Delete Topic',
      `Delete "${topic.displayName}"?\n\nThis will fail if the topic has existing decks with flashcards.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => {
            if (!topic.id) return;
            deleteTopic.mutate(
              { subjectId, topicId: topic.id },
              {
                onSuccess: () => showToast('Topic deleted'),
                onError: (err) => {
                  const msg = err instanceof Error ? err.message : 'Failed to delete topic';
                  showToast(msg, 'error');
                },
              },
            );
          },
        },
      ],
    );
  }

  return (
    <ScreenWrapper>
      <Header showBack title={`${subjectName} — Topics`} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing['4xl'] }}
      >
        {/* Instruction + Add button row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Typography variant="bodySmall" color={theme.textTertiary} style={{ flex: 1 }}>
            Manage topics for this subject. Tap a topic to expand its 6 level decks.
          </Typography>
          <TouchableOpacity
            onPress={openCreate}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
              backgroundColor: theme.primary,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.xl,
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Typography variant="caption" color="#fff" style={{ fontWeight: '600' }}>
              Add Topic
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Topic count badge */}
        {!loadingTopics && topics.length > 0 && (
          <View style={{
            alignSelf: 'flex-start',
            backgroundColor: theme.primary + '15',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderRadius: radius.full,
          }}>
            <Typography variant="caption" color={theme.primary}>
              {topics.length} topic{topics.length !== 1 ? 's' : ''}
            </Typography>
          </View>
        )}

        {/* Loading / Empty / List */}
        {loadingTopics ? (
          <View style={{ alignItems: 'center', paddingTop: spacing['2xl'] }}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: spacing.sm }}>
              Loading topics…
            </Typography>
          </View>
        ) : topics.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: spacing['2xl'], gap: spacing.md }}>
            <Ionicons name="albums-outline" size={48} color={theme.textTertiary} />
            <Typography variant="body" color={theme.textTertiary} align="center">
              No topics yet for "{subjectName}".
            </Typography>
            <Typography variant="bodySmall" color={theme.textTertiary} align="center">
              Tap "Add Topic" above to create one.
            </Typography>
          </View>
        ) : (
          topics.map((topic) => (
            <TopicRow
              key={topic.slug}
              subjectId={subjectId}
              subjectName={subjectName}
              topic={topic}
              accent={subjectAccent}
              router={router}
              onEdit={openEdit}
              onDelete={confirmDelete}
            />
          ))
        )}
      </ScrollView>

      {/* Create / Edit modal */}
      <TopicFormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        onSubmit={handleFormSubmit}
        editing={editingTopic}
        submitting={createTopic.isPending || updateTopic.isPending}
      />
    </ScreenWrapper>
  );
}
