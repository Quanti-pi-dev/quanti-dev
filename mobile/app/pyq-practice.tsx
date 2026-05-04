// ─── PYQ Practice Screen ──────────────────────────────────────
// Student-facing Previous Year Questions practice mode.
// Browse and practice PYQs filtered by year, paper, and subject.
// Each card shows the PYQ badge with year/paper metadata.
// Follows the mock-test screen pattern for card interaction.

import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme';
import { spacing, radius } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Header } from '../src/components/layout/Header';
import { Typography } from '../src/components/ui/Typography';
import { RichContent } from '../src/components/ui/RichContent';
import { Skeleton } from '../src/components/ui/Skeleton';
import {
  fetchPYQMeta,
  fetchPYQPractice,
  type PYQPracticeCard,
} from '../src/services/api-contracts';

// ─── Filter Chip ─────────────────────────────────────────────

function FilterChip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        backgroundColor: active ? color + '18' : theme.cardAlt,
        borderWidth: 1.5,
        borderColor: active ? color + '50' : theme.border,
      }}
    >
      <Typography
        variant="caption"
        color={active ? color : theme.textTertiary}
        style={{ fontWeight: active ? '600' : '400' }}
      >
        {label}
      </Typography>
    </TouchableOpacity>
  );
}

// ─── PYQ Badge ───────────────────────────────────────────────

function PYQBadge({ year, paper }: { year?: number | null; paper?: string | null }) {
  if (!year && !paper) return null;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.full,
        backgroundColor: '#F59E0B14',
        borderWidth: 1,
        borderColor: '#F59E0B30',
      }}
    >
      <Ionicons name="library-outline" size={11} color="#F59E0B" />
      <Typography variant="caption" color="#F59E0B" style={{ fontSize: 11, fontWeight: '600' }}>
        PYQ {year}{paper ? ` · ${paper}` : ''}
      </Typography>
    </View>
  );
}

// ─── Answer Option ───────────────────────────────────────────

function AnswerOption({
  text, index, selected, correct, showResult, onPress,
}: {
  text: string; index: number; selected: boolean; correct: boolean;
  showResult: boolean; onPress: () => void;
}) {
  const { theme, isDark } = useTheme();
  const labels = ['A', 'B', 'C', 'D'];

  const bg = showResult
    ? correct
      ? (isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)')
      : selected
        ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)')
        : theme.cardAlt
    : selected
      ? (isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)')
      : theme.cardAlt;

  const border = showResult
    ? correct ? '#10B981' : selected ? '#EF4444' : theme.border
    : selected ? '#F59E0B' : theme.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={showResult}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
        borderRadius: radius.xl, backgroundColor: bg,
        borderWidth: 1.5, borderColor: border + '50',
      }}
    >
      <View
        style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: selected ? (showResult ? (correct ? '#10B981' : '#EF4444') : '#F59E0B') + '22' : theme.cardAlt,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Typography
          variant="label"
          color={selected ? (showResult ? (correct ? '#10B981' : '#EF4444') : '#F59E0B') : theme.textTertiary}
          style={{ fontSize: 13 }}
        >
          {labels[index]}
        </Typography>
      </View>
      <RichContent variant="body" color={theme.text} style={{ flex: 1, fontSize: 14 }}>
        {text}
      </RichContent>
      {showResult && correct && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
      {showResult && selected && !correct && <Ionicons name="close-circle" size={18} color="#EF4444" />}
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function PYQPracticeScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { examId } = useLocalSearchParams<{ examId?: string }>();

  // Filter state
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Practice state
  const [practicing, setPracticing] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  // Fetch PYQ metadata for filters
  const { data: meta, isLoading: metaLoading } = useQuery({
    queryKey: ['pyqMeta', examId],
    queryFn: () => fetchPYQMeta({ examId }),
    staleTime: 60_000,
  });

  // Fetch PYQ cards with current filters
  const queryParams = useMemo(() => ({
    examId,
    subjectId: selectedSubject ?? undefined,
    year: selectedYear ? String(selectedYear) : undefined,
    paper: selectedPaper ?? undefined,
    pageSize: '50',
  }), [examId, selectedSubject, selectedYear, selectedPaper]);

  const { data: practiceData, isLoading: cardsLoading, refetch } = useQuery({
    queryKey: ['pyqPractice', queryParams],
    queryFn: () => fetchPYQPractice(queryParams),
    staleTime: 0,
  });

  const cards = practiceData?.cards ?? [];
  const totalAvailable = practiceData?.pagination.totalItems ?? 0;
  const currentCard = cards[currentIdx];

  // ─── Handlers ─────────────────────────────────────────────

  const startPractice = useCallback(() => {
    setPracticing(true);
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setRevealed(false);
    setStats({ correct: 0, total: 0 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleSelect = useCallback((optionId: string) => {
    if (revealed) return;
    setSelectedAnswer(optionId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [revealed]);

  const handleReveal = useCallback(() => {
    if (!selectedAnswer || !currentCard) return;
    const isCorrect = selectedAnswer === currentCard.correctAnswerId;
    setRevealed(true);
    setStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    Haptics.notificationAsync(
      isCorrect
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
  }, [selectedAnswer, currentCard]);

  const handleNext = useCallback(() => {
    if (currentIdx < cards.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setRevealed(false);
    } else {
      // End of set
      setPracticing(false);
    }
  }, [currentIdx, cards.length]);

  const exitPractice = useCallback(() => {
    setPracticing(false);
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setRevealed(false);
  }, []);

  // ─── Loading ──────────────────────────────────────────────

  if (metaLoading) {
    return (
      <ScreenWrapper>
        <Header showBack title="Previous Year Questions" />
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <Skeleton height={100} borderRadius={radius['2xl']} />
          <Skeleton height={44} borderRadius={radius.full} />
          <Skeleton height={44} borderRadius={radius.full} />
          <Skeleton height={200} borderRadius={radius['2xl']} />
        </View>
      </ScreenWrapper>
    );
  }

  // ─── Summary (shown when practice ends) ────────────────────

  if (!practicing && stats.total > 0) {
    const score = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const gradeColor = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

    return (
      <ScreenWrapper>
        <Header showBack title="PYQ Results" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
        >
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={{
              borderRadius: radius['2xl'], overflow: 'hidden',
              borderWidth: 1, borderColor: gradeColor + '25',
            }}>
              <LinearGradient
                colors={[gradeColor + (isDark ? '18' : '10'), gradeColor + '05']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}
              >
                <Typography style={{ fontSize: 48 }}>
                  {score >= 80 ? '🏆' : score >= 50 ? '💪' : '📚'}
                </Typography>
                <Typography variant="h2" color={theme.text}>{score}%</Typography>
                <Typography variant="body" color={gradeColor}>
                  {stats.correct} / {stats.total} correct
                </Typography>

                {selectedYear && (
                  <PYQBadge year={selectedYear} paper={selectedPaper} />
                )}
              </LinearGradient>
            </View>
          </Animated.View>

          <View style={{ gap: spacing.sm }}>
            <TouchableOpacity
              onPress={startPractice}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: spacing.sm, backgroundColor: '#F59E0B', borderRadius: radius.xl,
                paddingVertical: spacing.md + 2,
              }}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Typography variant="label" color="#FFFFFF">Practice Again</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setStats({ correct: 0, total: 0 }); }}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: spacing.sm, backgroundColor: theme.cardAlt, borderRadius: radius.xl,
                paddingVertical: spacing.md + 2, borderWidth: 1, borderColor: theme.border,
              }}
            >
              <Ionicons name="options-outline" size={18} color={theme.textSecondary} />
              <Typography variant="label" color={theme.textSecondary}>Change Filters</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: spacing.sm, backgroundColor: theme.cardAlt, borderRadius: radius.xl,
                paddingVertical: spacing.md + 2, borderWidth: 1, borderColor: theme.border,
              }}
            >
              <Ionicons name="arrow-back" size={18} color={theme.textSecondary} />
              <Typography variant="label" color={theme.textSecondary}>Back to Study</Typography>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  // ─── Practice Mode ─────────────────────────────────────────

  if (practicing && currentCard) {
    return (
      <ScreenWrapper>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
          borderBottomWidth: 1, borderBottomColor: theme.border,
        }}>
          <Typography variant="label" color={theme.text}>
            Q {currentIdx + 1}/{cards.length}
          </Typography>
          <PYQBadge year={currentCard.sourceYear} paper={currentCard.sourcePaper} />
          <TouchableOpacity onPress={exitPractice} activeOpacity={0.7}
            style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: '#EF444418' }}>
            <Typography variant="caption" color="#EF4444">Exit</Typography>
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <View style={{ height: 3, backgroundColor: theme.border }}>
          <View style={{
            height: '100%', backgroundColor: '#F59E0B',
            width: `${((currentIdx + 1) / cards.length) * 100}%`,
            borderRadius: 2,
          }} />
        </View>

        {/* Score strip */}
        <View style={{
          flexDirection: 'row', justifyContent: 'center', gap: spacing.lg,
          paddingVertical: spacing.xs, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        }}>
          <Typography variant="caption" color="#10B981">✓ {stats.correct}</Typography>
          <Typography variant="caption" color="#EF4444">✗ {stats.total - stats.correct}</Typography>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
        >
          <Animated.View entering={FadeIn.duration(200)} key={currentIdx}>
            {/* Topic + Subject */}
            {(currentCard.topicName || currentCard.subjectName) && (
              <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.xs }}>
                {currentCard.subjectName ? (
                  <View style={{
                    paddingHorizontal: spacing.sm, paddingVertical: 2,
                    borderRadius: radius.full,
                    backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)',
                  }}>
                    <Typography variant="caption" color={theme.primary} style={{ fontSize: 11 }}>
                      {currentCard.subjectName}
                    </Typography>
                  </View>
                ) : null}
                {currentCard.topicName ? (
                  <View style={{
                    paddingHorizontal: spacing.sm, paddingVertical: 2,
                    borderRadius: radius.full,
                    backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.06)',
                  }}>
                    <Typography variant="caption" color="#F59E0B" style={{ fontSize: 11 }}>
                      {currentCard.topicName}
                    </Typography>
                  </View>
                ) : null}
              </View>
            )}

            <RichContent variant="h4" color={theme.text} style={{ lineHeight: 26 }}>
              {currentCard.question}
            </RichContent>

            {/* Options */}
            <View style={{ gap: spacing.sm }}>
              {currentCard.answers.map((ans, i) => (
                <AnswerOption
                  key={ans.id}
                  text={ans.text}
                  index={i}
                  selected={selectedAnswer === ans.id}
                  correct={ans.id === currentCard.correctAnswerId}
                  showResult={revealed}
                  onPress={() => handleSelect(ans.id)}
                />
              ))}
            </View>

            {/* Explanation */}
            {revealed && currentCard.explanation && (
              <Animated.View entering={FadeInDown.delay(100).duration(300)}>
                <View style={{
                  padding: spacing.md, borderRadius: radius.xl,
                  backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
                  borderWidth: 1, borderColor: theme.primary + '20',
                  gap: spacing.xs,
                }}>
                  <Typography variant="captionBold" color={theme.primary}>Explanation</Typography>
                  <RichContent variant="body" color={theme.textSecondary} style={{ fontSize: 13, lineHeight: 20 }}>
                    {currentCard.explanation}
                  </RichContent>
                </View>
              </Animated.View>
            )}
          </Animated.View>

          {/* Action button */}
          <View>
            {!revealed ? (
              <TouchableOpacity
                onPress={handleReveal}
                disabled={!selectedAnswer}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: spacing.sm, paddingVertical: spacing.md,
                  borderRadius: radius.xl,
                  backgroundColor: selectedAnswer ? '#F59E0B' : theme.border,
                }}
              >
                <Ionicons name="eye" size={18} color="#FFFFFF" />
                <Typography variant="label" color="#FFFFFF">
                  {selectedAnswer ? 'Check Answer' : 'Select an option'}
                </Typography>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: spacing.sm, paddingVertical: spacing.md,
                  borderRadius: radius.xl, backgroundColor: theme.primary,
                }}
              >
                <Typography variant="label" color="#FFFFFF">
                  {currentIdx < cards.length - 1 ? 'Next Question' : 'See Results'}
                </Typography>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  // ─── Browse / Filter Screen ─────────────────────────────────

  const years = meta?.years ?? [];
  const papers = meta?.papers ?? [];
  const subjects = meta?.subjects ?? [];
  const totalPYQs = meta?.total ?? 0;

  return (
    <ScreenWrapper>
      <Header showBack title="Previous Year Questions" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={{
            borderRadius: radius['2xl'], overflow: 'hidden',
            borderWidth: 1, borderColor: '#F59E0B20',
          }}>
            <LinearGradient
              colors={['#F59E0B' + (isDark ? '15' : '10'), '#F59E0B05']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}
            >
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="library" size={30} color="#F59E0B" />
              </View>
              <Typography variant="h3" align="center">Practice PYQs</Typography>
              <Typography variant="body" color={theme.textSecondary} align="center">
                Master previous year questions to ace your exam
              </Typography>
              <View style={{
                flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs,
              }}>
                <View style={{ alignItems: 'center' }}>
                  <Typography variant="h4" color="#F59E0B">{totalPYQs}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>Questions</Typography>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Typography variant="h4" color="#F59E0B">{years.length}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>Years</Typography>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Typography variant="h4" color="#F59E0B">{papers.length}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>Papers</Typography>
                </View>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Subject filter */}
        {subjects.length > 1 && (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <Typography variant="overline" color={theme.textTertiary} style={{ marginBottom: spacing.sm }}>
              Subject
            </Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <FilterChip
                  label="All Subjects"
                  active={!selectedSubject}
                  color="#F59E0B"
                  onPress={() => setSelectedSubject(null)}
                />
                {subjects.map(s => (
                  <FilterChip
                    key={s.id}
                    label={s.name}
                    active={selectedSubject === s.id}
                    color="#6366F1"
                    onPress={() => setSelectedSubject(selectedSubject === s.id ? null : s.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        )}

        {/* Year filter */}
        {years.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <Typography variant="overline" color={theme.textTertiary} style={{ marginBottom: spacing.sm }}>
              Year
            </Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <FilterChip
                  label="All Years"
                  active={!selectedYear}
                  color="#F59E0B"
                  onPress={() => setSelectedYear(null)}
                />
                {years.map(y => (
                  <FilterChip
                    key={y}
                    label={String(y)}
                    active={selectedYear === y}
                    color="#F59E0B"
                    onPress={() => setSelectedYear(selectedYear === y ? null : y)}
                  />
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        )}

        {/* Paper filter */}
        {papers.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <Typography variant="overline" color={theme.textTertiary} style={{ marginBottom: spacing.sm }}>
              Paper
            </Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <FilterChip
                  label="All Papers"
                  active={!selectedPaper}
                  color="#F59E0B"
                  onPress={() => setSelectedPaper(null)}
                />
                {papers.map(p => (
                  <FilterChip
                    key={p}
                    label={p}
                    active={selectedPaper === p}
                    color="#8B5CF6"
                    onPress={() => setSelectedPaper(selectedPaper === p ? null : p)}
                  />
                ))}
              </View>
            </ScrollView>
          </Animated.View>
        )}

        {/* Card count + Start */}
        <Animated.View entering={FadeInDown.delay(400).duration(300)}>
          <View style={{
            padding: spacing.lg, borderRadius: radius.xl,
            backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
            gap: spacing.md,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body" color={theme.textSecondary}>
                Questions matching filters
              </Typography>
              {cardsLoading ? (
                <ActivityIndicator size="small" color="#F59E0B" />
              ) : (
                <Typography variant="h4" color="#F59E0B">{totalAvailable}</Typography>
              )}
            </View>

            {selectedYear && (
              <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                <PYQBadge year={selectedYear} paper={selectedPaper} />
              </View>
            )}

            <TouchableOpacity
              onPress={startPractice}
              disabled={cards.length === 0 || cardsLoading}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: spacing.sm, paddingVertical: spacing.md + 2,
                borderRadius: radius.xl,
                backgroundColor: cards.length > 0 ? '#F59E0B' : theme.border,
              }}
            >
              <Ionicons name="play-circle" size={20} color="#FFFFFF" />
              <Typography variant="label" color="#FFFFFF">
                {cardsLoading ? 'Loading…' : cards.length > 0 ? `Start Practice (${cards.length} Qs)` : 'No PYQs found'}
              </Typography>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Empty state hint */}
        {totalPYQs === 0 && !metaLoading && (
          <View style={{
            padding: spacing.lg, borderRadius: radius.xl,
            backgroundColor: '#F59E0B08', borderWidth: 1, borderColor: '#F59E0B20',
            alignItems: 'center', gap: spacing.sm,
          }}>
            <Ionicons name="information-circle-outline" size={24} color="#F59E0B" />
            <Typography variant="body" color={theme.textSecondary} align="center">
              No previous year questions available for your subjects yet. Check back later!
            </Typography>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
