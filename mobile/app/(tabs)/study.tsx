// ─── Study Screen (Exam Grid) ─────────────────────────────────
// Shows all exams in a 2-column grid. Tapping navigates to the
// Exam → Subject → Level → Flashcard study flow.
// Feature gates: exams beyond FREE_PREVIEW (tier 1+), daily limit enforcement.

import { useState, useMemo } from 'react';
import {
  View, ScrollView, FlatList, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Input } from '../../src/components/ui/Input';
import { Chip } from '../../src/components/ui/Chip';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { DailyLimitBanner } from '../../src/components/subscription/DailyLimitBanner';
import { TrialPassBanner } from '../../src/components/subscription/TrialPassBanner';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { useExams } from '../../src/hooks/useExams';
import { useExamsUsedToday } from '../../src/hooks/useExamsUsedToday';
import { useFadeInUp } from '../../src/theme/animations';
import Animated from 'react-native-reanimated';
import type { Exam } from '@kd/shared';

// CATEGORIES now derived dynamically from real exam data (see useMemo below)
const FREE_PREVIEW_COUNT = 3;


// Cycling accent palette consistent with the brand's extended colour range
const EXAM_ACCENTS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#14B8A6'];

// ─── Skeleton card ──────────────────────────────────────────
function ExamCardSkeleton() {
  return <Skeleton height={140} borderRadius={radius['2xl']} />;
}

// ─── Single exam card tile ───────────────────────────────────
function ExamTile({
  exam, accent, onPress, isLocked, index,
}: {
  exam: Exam; accent: string; onPress: () => void; isLocked: boolean; index: number;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const { animStyle } = useFadeInUp({ delay: Math.min(index * 55, 330) });

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]}>
      <TouchableOpacity
        onPress={isLocked ? () => router.push('/subscription') : onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ disabled: isLocked }}
        accessibilityLabel={isLocked ? `${exam.title}. Locked — upgrade to unlock` : exam.title}
        style={{
          flex: 1,
          backgroundColor: theme.card,
          borderRadius: radius['2xl'],
          padding: spacing.lg,
          borderWidth: 1.5,
          borderColor: isLocked ? theme.border : accent + '33',
          gap: spacing.sm,
          opacity: isLocked ? 0.6 : 1,
          // Neumorphic shadow
          shadowColor: accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isLocked ? 0 : 0.12,
          shadowRadius: 10,
          elevation: isLocked ? 0 : 3,
        }}
      >
        {/* Icon badge */}
        <View
          style={{
            width: 44, height: 44, borderRadius: radius.xl,
            backgroundColor: isLocked ? theme.cardAlt : accent + '18',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons
            name={isLocked ? 'lock-closed-outline' : 'library-outline'}
            size={20}
            color={isLocked ? theme.textTertiary : accent}
          />
        </View>

        {/* Title */}
        <Typography
          variant="label"
          numberOfLines={2}
          style={{ lineHeight: 18 }}
        >
          {exam.title}
        </Typography>

        {/* Meta row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Typography variant="caption" color={theme.textTertiary}>
            {isLocked ? 'Upgrade to unlock' : (exam.questionCount > 0 ? `${exam.questionCount} q` : exam.category)}
          </Typography>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Screen ──────────────────────────────────────────────────
export default function StudyScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const { examsUsedToday } = useExamsUsedToday();

  const { isSubscribed, isDailyLimitReached, maxExamsPerDay } = useSubscriptionGate();
  const { data: apiExamsPages, isLoading, fetchNextPage, hasNextPage } = useExams();

  const allExams: Exam[] = apiExamsPages?.pages.flatMap((p: { data: Exam[] }) => p.data) ?? [];
  const limitReached = isDailyLimitReached(examsUsedToday);
  const oneRemaining = !limitReached && maxExamsPerDay !== -1 && examsUsedToday === maxExamsPerDay - 1;

  // Fix 16: derive categories dynamically from real exam data
  const categories = useMemo(() => {
    const raw = allExams.map((e) => e.category).filter((c): c is string => Boolean(c));
    const unique = [...new Set(raw)].sort();
    return ['All', ...unique];
  }, [allExams]);

  const filtered = useMemo(() =>
    allExams.filter((e) => {
      const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase());
      const matchesCat = activeCategory === 'All' || e.category === activeCategory;
      return matchesSearch && matchesCat;
    }),
  [allExams, search, activeCategory]);

  function handleExamPress(exam: Exam) {
    if (limitReached) return;
    router.push(`/exams/${exam.id}/subjects?title=${encodeURIComponent(exam.title)}` as never);
  }

  return (
    <ScreenWrapper>
      {/* ── Header ── */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.base, gap: spacing.md }}>
        <Typography variant="h3">Study</Typography>

        <TrialPassBanner />

        {(limitReached || oneRemaining) && (
          <DailyLimitBanner examsUsedToday={examsUsedToday} limitReached={limitReached} />
        )}

        {/* Tournament quick-link */}
        <TouchableOpacity
          onPress={() => router.push('/tournaments')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Tournaments — compete and win coins"
          style={{
            backgroundColor: '#6366F112',
            borderWidth: 1,
            borderColor: '#6366F130',
            borderRadius: radius.xl,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Ionicons name="trophy" size={18} color="#6366F1" />
          <View style={{ flex: 1 }}>
            <Typography variant="label" color="#6366F1">Tournaments</Typography>
            <Typography variant="caption" color={theme.textTertiary}>Compete & win coins</Typography>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#6366F1" />
        </TouchableOpacity>

        <Input
          placeholder="Search exams…"
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search-outline" size={18} color={theme.textTertiary} />}
          rightIcon={search ? <Ionicons name="close-circle" size={18} color={theme.textTertiary} /> : undefined}
          onRightIconPress={() => setSearch('')}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xl }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl }}>
            {categories.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                active={activeCategory === cat}
                onPress={() => setActiveCategory(cat)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {/* ── Exam Grid ── */}
      {isLoading ? (
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md }}>
              <ExamCardSkeleton />
              <ExamCardSkeleton />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => { if (hasNextPage) void fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          renderItem={({ item, index }) => (
            <ExamTile
              exam={item}
              accent={EXAM_ACCENTS[index % EXAM_ACCENTS.length]!}
              isLocked={!isSubscribed && index >= FREE_PREVIEW_COUNT}
              onPress={() => handleExamPress(item)}
              index={index}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing['4xl'] }}>
              <Ionicons name="library-outline" size={48} color={theme.textTertiary} />
              <Typography variant="body" color={theme.textTertiary} align="center" style={{ marginTop: spacing.md }}>
                {search ? 'No exams match your search' : 'No exams available yet'}
              </Typography>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
}
