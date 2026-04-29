// ─── Explore Exams Screen ─────────────────────────────────────
// Full exam directory grid — accessible via "Explore more exams"
// button on the Profile screen. Shows all exams in a 2-col grid
// with search, category filters, and subscription gating.

import { useState, useMemo } from 'react';
import { View, ScrollView, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { spacing, radius } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Typography } from '../src/components/ui/Typography';
import { Input } from '../src/components/ui/Input';
import { Chip } from '../src/components/ui/Chip';
import { Skeleton } from '../src/components/ui/Skeleton';
import { DailyLimitBanner } from '../src/components/subscription/DailyLimitBanner';
import { TrialPassBanner } from '../src/components/subscription/TrialPassBanner';
import { useSubscriptionGate } from '../src/hooks/useSubscriptionGate';
import { useExams } from '../src/hooks/useExams';
import { useExamsUsedToday } from '../src/hooks/useExamsUsedToday';
import { useFadeInUp } from '../src/theme/animations';
import Animated from 'react-native-reanimated';
import type { Exam } from '@kd/shared';

const FREE_PREVIEW_COUNT = 3;

const EXAM_ACCENTS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#EF4444', '#3B82F6', '#14B8A6',
];

function ExamCardSkeleton() {
  return <Skeleton height={140} borderRadius={radius['2xl']} />;
}

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
          shadowColor: accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isLocked ? 0 : 0.12,
          shadowRadius: 10,
          elevation: isLocked ? 0 : 3,
        }}
      >
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

        <Typography variant="label" numberOfLines={2} style={{ lineHeight: 18 }}>
          {exam.title}
        </Typography>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Typography variant="caption" color={theme.textTertiary}>
            {isLocked
              ? 'Upgrade to unlock'
              : (exam.questionCount > 0 ? `${exam.questionCount} q` : exam.category)}
          </Typography>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ExploreExamsScreen() {
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
        {/* Back row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Typography variant="h3">Explore Exams</Typography>
        </View>

        <TrialPassBanner />

        {(limitReached || oneRemaining) && (
          <DailyLimitBanner examsUsedToday={examsUsedToday} limitReached={limitReached} />
        )}

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
