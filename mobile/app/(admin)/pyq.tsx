// ─── Admin PYQ Management Screen ─────────────────────────────
// Full PYQ (Previous Year Question) management:
//   • Filter bar: Exam → Subject → Topic → Year → Paper
//   • Stats header: total PYQs, year range, available papers
//   • Paginated card list with amber PYQ badges + delete swipe
//   • Bulk import sheet: metadata pre-filled at top (year, paper, level)
//     then file picker → CSV/JSON parse → preview → submit

import { useState, useCallback, useMemo } from 'react';
import {
  View, ScrollView, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { BulkImportModal } from '../../src/components/admin/BulkImportModal';
import { useGlobalUI } from '../../src/contexts/GlobalUIContext';
import { adminApi } from '../../src/services/api';
import { useQueryClient } from '@tanstack/react-query';
import type { ParsedFlashcard } from '../../src/utils/csvParser';
import {
  useAdminExams,
  useAdminPYQ,
  useAdminPYQMeta,
  useAdminPYQBulkImport,
  useAdminDeletePYQCard,
  type PYQCard,
  type PYQFilters,
} from '../../src/hooks/useAdminContent';
import { useExamSubjects } from '../../src/hooks/useSubjects';

// ─── Sub-components ───────────────────────────────────────────

function FilterChip({
  label, selected, onPress,
}: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        borderWidth: 1.5,
        borderColor: selected ? '#F59E0B' : theme.border,
        backgroundColor: selected ? '#F59E0B18' : theme.card,
      }}
    >
      <Typography variant="caption" color={selected ? '#F59E0B' : theme.textSecondary}>
        {label}
      </Typography>
    </TouchableOpacity>
  );
}

function PYQCardRow({
  card, onDelete,
}: { card: PYQCard; onDelete: (id: string) => void }) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const correctOpt = card.options.find((o) => o.id === card.correctAnswerId);

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: '#F59E0B22',
        overflow: 'hidden',
        marginBottom: spacing.sm,
      }}
    >
      {/* Header */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row', alignItems: 'flex-start',
          padding: spacing.md, gap: spacing.sm,
        }}
      >
        {/* PYQ amber badge */}
        <View style={{
          backgroundColor: '#F59E0B18',
          borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
          alignSelf: 'flex-start', flexShrink: 0,
        }}>
          <Typography style={{ fontSize: 9, color: '#F59E0B', fontWeight: '700' }}>
            {card.sourceYear ?? '—'}
            {card.sourcePaper ? `·${card.sourcePaper}` : ''}
          </Typography>
        </View>

        <Typography variant="bodySmall" color={theme.text} style={{ flex: 1, lineHeight: 18 }} numberOfLines={expanded ? undefined : 2}>
          {card.question}
        </Typography>

        <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14} color={theme.textTertiary}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded: options + delete */}
      {expanded && (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs }}>
          {card.options.map((opt) => (
            <View key={opt.id} style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
              <Ionicons
                name={opt.id === card.correctAnswerId ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={opt.id === card.correctAnswerId ? '#10B981' : theme.textTertiary}
              />
              <Typography
                variant="caption"
                color={opt.id === card.correctAnswerId ? '#10B981' : theme.textSecondary}
                style={{ flex: 1 }}
              >
                {opt.id}. {opt.text}
              </Typography>
            </View>
          ))}

          {card.explanation && (
            <View style={{
              backgroundColor: '#6366F108', borderRadius: radius.md,
              padding: spacing.sm, marginTop: spacing.xs,
            }}>
              <Typography variant="caption" color={theme.textTertiary} style={{ lineHeight: 17 }}>
                💡 {card.explanation}
              </Typography>
            </View>
          )}

          {/* Tags */}
          {card.tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
              {card.tags.map((t) => (
                <View key={t} style={{ backgroundColor: '#10B98118', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Typography style={{ fontSize: 9, color: '#10B981' }}>{t}</Typography>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={() => onDelete(card.id)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
              alignSelf: 'flex-end', marginTop: spacing.xs,
              backgroundColor: '#EF444418', borderRadius: radius.md,
              paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
            }}
          >
            <Ionicons name="trash-outline" size={13} color="#EF4444" />
            <Typography variant="caption" color="#EF4444">Delete</Typography>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── PYQ Import Sheet (pre-filled metadata) ─────────────────

interface PYQImportSheetProps {
  visible: boolean;
  onClose: () => void;
  preSelectedSubjectId?: string;
  preSelectedTopicSlug?: string;
  preSelectedLevel?: string;
}

const LEVELS = ['Beginner', 'Rookie', 'Skilled', 'Competent', 'Expert', 'Master'];

function PYQImportSheet({
  visible, onClose,
  preSelectedSubjectId, preSelectedTopicSlug, preSelectedLevel,
}: PYQImportSheetProps) {
  const { theme } = useTheme();
  const { showToast } = useGlobalUI();
  const queryClient = useQueryClient();
  const bulkImport = useAdminPYQBulkImport();

  const [examId, setExamId] = useState('');
  const [subjectId, setSubjectId] = useState(preSelectedSubjectId ?? '');
  const [topicSlug, setTopicSlug] = useState(preSelectedTopicSlug ?? '');
  const [level, setLevel] = useState(preSelectedLevel ?? 'Rookie');
  const [sourceYear, setSourceYear] = useState(new Date().getFullYear().toString());
  const [sourcePaper, setSourcePaper] = useState('');
  const [examLabel, setExamLabel] = useState('');
  const [showFilePicker, setShowFilePicker] = useState(false);

  const { data: examsData } = useAdminExams(1);
  const exams = examsData?.data ?? [];
  const { data: subjects } = useExamSubjects(examId);
  const subjectsList = subjects ?? [];

  const metaComplete = examId && subjectId.trim() && topicSlug.trim() && level && sourceYear.trim();

  async function handleImport(cards: ParsedFlashcard[]) {
    const year = parseInt(sourceYear, 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      showToast('Please enter a valid year (e.g. 2022)', 'error');
      return;
    }
    const result = await bulkImport.mutateAsync({
      examId,
      subjectId: subjectId.trim(),
      topicSlug: topicSlug.trim(),
      level,
      sourceYear: year,
      sourcePaper: sourcePaper.trim() || undefined,
      examLabel: examLabel.trim() || undefined,
      cards: cards.map((c) => ({
        question: c.question,
        options: c.options,
        correctAnswerId: c.correctAnswerId,
        explanation: c.explanation ?? undefined,
      })),
    });
    showToast(`${result.created} PYQ cards imported for ${year}${sourcePaper ? ` — ${sourcePaper}` : ''}`);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'pyq'] });
    setShowFilePicker(false);
    onClose();
  }

  return (
    <>
      <Modal visible={visible && !showFilePicker} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          {/* Header */}
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: spacing.xl,
              paddingTop: spacing['2xl'],
              paddingBottom: spacing.xl,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Typography variant="captionBold" color="rgba(255,255,255,0.8)" style={{ letterSpacing: 1 }}>
                  ADMIN
                </Typography>
                <Typography variant="h4" color="#FFFFFF">Import PYQs</Typography>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView
            contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Step 1: Target */}
            <Card>
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>1</Typography>
                  </View>
                  <Typography variant="label">Target Location</Typography>
                </View>

              {/* Exam picker */}
                <View style={{ gap: spacing.xs }}>
                  <Typography variant="label" color={theme.textSecondary}>Exam</Typography>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {exams.map((e: { id: string; title: string }) => (
                        <FilterChip
                          key={e.id} label={e.title}
                          selected={examId === e.id}
                          onPress={() => { setExamId(e.id); setSubjectId(''); }}
                        />
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Subject picker (loads after exam selected) */}
                {examId ? (
                  <View style={{ gap: spacing.xs }}>
                    <Typography variant="label" color={theme.textSecondary}>Subject</Typography>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        {subjectsList.map((s) => (
                          <FilterChip
                            key={s.id} label={s.name}
                            selected={subjectId === s.id}
                            onPress={() => setSubjectId(s.id)}
                          />
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                ) : (
                  <Input
                    label="Subject ID"
                    value={subjectId}
                    onChangeText={setSubjectId}
                    placeholder="Select an exam first"
                    editable={false}
                  />
                )}
                <Input
                  label="Topic Slug"
                  value={topicSlug}
                  onChangeText={setTopicSlug}
                  placeholder="e.g. kinematics"
                  autoCapitalize="none"
                />

                {/* Level selector */}
                <View style={{ gap: spacing.xs }}>
                  <Typography variant="label" color={theme.textSecondary}>Level</Typography>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {LEVELS.map((l) => (
                        <FilterChip
                          key={l} label={l}
                          selected={level === l}
                          onPress={() => setLevel(l)}
                        />
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </Card>

            {/* Step 2: PYQ Metadata */}
            <Card>
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>2</Typography>
                  </View>
                  <Typography variant="label">PYQ Metadata</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>(applied to all cards)</Typography>
                </View>

                <Input
                  label="Year *"
                  value={sourceYear}
                  onChangeText={setSourceYear}
                  placeholder="e.g. 2022"
                  keyboardType="numeric"
                  maxLength={4}
                />
                <Input
                  label="Paper"
                  value={sourcePaper}
                  onChangeText={setSourcePaper}
                  placeholder="e.g. Paper 1, Shift 2 (optional)"
                />
                <Input
                  label="Exam Label"
                  value={examLabel}
                  onChangeText={setExamLabel}
                  placeholder="e.g. JEE Main (optional, for deck description)"
                />
              </View>
            </Card>

            {/* Step 3: Upload file */}
            <TouchableOpacity
              onPress={() => { if (metaComplete) setShowFilePicker(true); }}
              disabled={!metaComplete}
              activeOpacity={0.8}
              style={{
                borderRadius: radius.xl,
                overflow: 'hidden',
                opacity: metaComplete ? 1 : 0.4,
              }}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'center', gap: spacing.sm,
                  paddingVertical: spacing.lg,
                }}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
                <Typography variant="label" color="#FFF">
                  {metaComplete ? `Pick CSV / JSON File for ${sourceYear}` : 'Fill in all required fields first'}
                </Typography>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* File picker modal — opens after metadata is confirmed */}
      <BulkImportModal
        visible={showFilePicker}
        onClose={() => setShowFilePicker(false)}
        onSubmit={handleImport}
      />
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

export default function AdminPYQScreen() {
  const { theme } = useTheme();
  const { showAlert } = useGlobalUI();
  const deleteCard = useAdminDeletePYQCard();

  // ── Filters state ──────────────────────────────────────────
  const [filters, setFilters] = useState<PYQFilters>({ page: 1, pageSize: 30 });
  const [showImport, setShowImport] = useState(false);

  // Exam picker (for scoping meta)
  const { data: examsData } = useAdminExams(1);
  const exams = examsData?.data ?? [];

  // PYQ data
  const { data: pyqData, isLoading, isFetching } = useAdminPYQ(filters);
  const { data: meta } = useAdminPYQMeta(filters.examId, filters.subjectId);
  const cards = pyqData?.cards ?? [];
  const pagination = pyqData?.pagination;

  // ── Delete handler ────────────────────────────────────────
  const handleDelete = useCallback((cardId: string) => {
    showAlert({
      title: 'Delete PYQ Card?',
      message: 'This cannot be undone.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => void deleteCard.mutateAsync(cardId),
        },
      ],
    });
  }, [showAlert, deleteCard]);

  return (
    <ScreenWrapper>
      <Header showBack title="PYQ Manager" />

      {/* ── Stats header ── */}
      <LinearGradient
        colors={['#F59E0B18', '#F59E0B04']}
        style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Typography variant="h3" color="#F59E0B">
              {meta?.total ?? '—'}
            </Typography>
            <Typography variant="caption" color={theme.textTertiary}>Total PYQ Cards</Typography>
          </View>

          {meta && meta.years.length > 0 && (
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Typography variant="label" color={theme.text}>
                {meta.years[meta.years.length - 1]}–{meta.years[0]}
              </Typography>
              <Typography variant="caption" color={theme.textTertiary}>Year Range</Typography>
            </View>
          )}

          {meta && meta.papers.length > 0 && (
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Typography variant="label" color={theme.text}>{meta.papers.length}</Typography>
              <Typography variant="caption" color={theme.textTertiary}>Papers</Typography>
            </View>
          )}

          <Button
            size="sm"
            onPress={() => setShowImport(true)}
            icon={<Ionicons name="add" size={16} color="#FFF" />}
            style={{ backgroundColor: '#F59E0B', borderColor: '#F59E0B' }}
          >
            Import
          </Button>
        </View>
      </LinearGradient>

      {/* ── Filter bar ── */}
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm }}>
        {/* Exam filter */}
        {exams.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <FilterChip
                label="All Exams"
                selected={!filters.examId}
                onPress={() => setFilters((f) => ({ ...f, examId: undefined, page: 1 }))}
              />
              {exams.map((e: { id: string; title: string }) => (
                <FilterChip
                  key={e.id} label={e.title}
                  selected={filters.examId === e.id}
                  onPress={() => setFilters((f) => ({ ...f, examId: e.id, page: 1 }))}
                />
              ))}
            </View>
          </ScrollView>
        )}

        {/* Year filter */}
        {meta && meta.years.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <FilterChip
                label="All Years"
                selected={!filters.year}
                onPress={() => setFilters((f) => ({ ...f, year: null, page: 1 }))}
              />
              {meta.years.map((y) => (
                <FilterChip
                  key={y} label={String(y)}
                  selected={filters.year === y}
                  onPress={() => setFilters((f) => ({ ...f, year: y, page: 1 }))}
                />
              ))}
            </View>
          </ScrollView>
        )}

        {/* Paper filter */}
        {meta && meta.papers.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <FilterChip
                label="All Papers"
                selected={!filters.paper}
                onPress={() => setFilters((f) => ({ ...f, paper: null, page: 1 }))}
              />
              {meta.papers.map((p) => (
                <FilterChip
                  key={p} label={p}
                  selected={filters.paper === p}
                  onPress={() => setFilters((f) => ({ ...f, paper: p, page: 1 }))}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* ── Card list ── */}
      {isLoading ? (
        <View style={{ padding: spacing.xl, gap: spacing.sm }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={72} borderRadius={radius.xl} />
          ))}
        </View>
      ) : cards.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.lg }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="library-outline" size={28} color="#F59E0B" />
          </View>
          <Typography variant="label" align="center">No PYQ cards yet</Typography>
          <Typography variant="caption" color={theme.textTertiary} align="center">
            Tap "Import" to bulk-import previous year questions.
          </Typography>
          <Button onPress={() => setShowImport(true)} size="md" style={{ backgroundColor: '#F59E0B', borderColor: '#F59E0B' }}>
            Import PYQs
          </Button>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            isFetching ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm }}>
                <ActivityIndicator size="small" color="#F59E0B" />
                <Typography variant="caption" color={theme.textTertiary}>Refreshing…</Typography>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <PYQCardRow card={item} onDelete={handleDelete} />
          )}
          ListFooterComponent={
            pagination && (pagination.hasNextPage || pagination.hasPreviousPage) ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.md, gap: spacing.sm }}>
                <Button
                  variant="secondary" size="sm"
                  disabled={!pagination.hasPreviousPage}
                  onPress={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                >
                  ← Prev
                </Button>
                <Typography variant="caption" color={theme.textTertiary} style={{ alignSelf: 'center' }}>
                  Page {pagination.page} of {pagination.totalPages}
                </Typography>
                <Button
                  variant="secondary" size="sm"
                  disabled={!pagination.hasNextPage}
                  onPress={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                >
                  Next →
                </Button>
              </View>
            ) : null
          }
        />
      )}

      {/* PYQ Import Sheet */}
      <PYQImportSheet
        visible={showImport}
        onClose={() => setShowImport(false)}
      />
    </ScreenWrapper>
  );
}
