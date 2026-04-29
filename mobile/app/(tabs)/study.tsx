// ─── Study Dashboard (Educator Hub) ──────────────────────────
// The Study tab is now a personalized learning dashboard, not a
// plain exam directory. It surfaces:
//   1. Header — greeting + streak summary
//   2. Current Subjects — subjects the user actively studies
//   3. Pick Up Where You Left Off — recent deck sessions
//   4. Recommended For You — AI-curated decks (from /ai/recommendations)
//   5. Discover More — all available decks, quick horizontal scroll
// The old exam grid lives at /explore-exams, linked via Profile.

import { useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { TrialPassBanner } from '../../src/components/subscription/TrialPassBanner';
import { SubjectProgressCard } from '../../src/components/study/SubjectProgressCard';
import { RecentDeckCard } from '../../src/components/study/RecentDeckCard';
import { RecommendedDeckCard } from '../../src/components/study/RecommendedDeckCard';
import { useLevelProgressSummary } from '../../src/hooks/useGamification';
import { useRecentSessions } from '../../src/hooks/useProgress';
import { useRecommendations } from '../../src/hooks/useAI';
import { useDecks } from '../../src/hooks/useDecks';
import { useAuth } from '../../src/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import type { Deck } from '@kd/shared';

// ─── Accent palette reused for discover decks ─────────────────
const DECK_ACCENTS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#14B8A6', '#3B82F6', '#EF4444'];

// ─── Section header ───────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  icon,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  action?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
        <View
          style={{
            width: 30, height: 30, borderRadius: radius.md,
            backgroundColor: theme.primaryMuted,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={15} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Typography variant="label">{title}</Typography>
          {subtitle && (
            <Typography variant="caption" color={theme.textTertiary}>{subtitle}</Typography>
          )}
        </View>
      </View>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Typography variant="caption" color={theme.primary}>{action}</Typography>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Skeleton rows for loading states ─────────────────────────

function HorizontalSkeletons({ count = 3, width = 172, height = 160 }: { count?: number; width?: number; height?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} width={width} height={height} borderRadius={radius['2xl']} />
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Discover Deck tile (inline mini-card) ────────────────────

function DiscoverDeckTile({ deck, accent, onPress }: { deck: Deck; accent: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`${deck.title} deck`}
      style={{
        width: 150,
        backgroundColor: theme.card,
        borderRadius: radius.xl,
        padding: spacing.md,
        borderWidth: 1.5,
        borderColor: accent + '33',
        gap: spacing.xs,
        shadowColor: accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View
        style={{
          width: 38, height: 38, borderRadius: radius.lg,
          backgroundColor: accent + '18',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="copy-outline" size={18} color={accent} />
      </View>
      <Typography variant="label" numberOfLines={2} style={{ lineHeight: 16, fontSize: 12 }}>
        {deck.title}
      </Typography>
      <Typography variant="caption" color={accent + 'BB'} numberOfLines={1} style={{ fontSize: 10 }}>
        {deck.tags?.[1] ?? deck.category}
      </Typography>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function StudyScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // ── Data ──────────────────────────────────────────────────
  const { data: levelSummary, isLoading: isSubjectsLoading } = useLevelProgressSummary();
  const { data: recentSessions, isLoading: isRecentLoading } = useRecentSessions(5);
  const { data: recommendations, isLoading: isRecsLoading } = useRecommendations();
  const { data: decksPages, isLoading: isDecksLoading } = useDecks(12);

  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'Student';
  const firstName = displayName.split(' ')[0] ?? displayName;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? `Good morning, ${firstName} 👋` : hour < 17 ? `Good afternoon, ${firstName} 👋` : `Good evening, ${firstName} 👋`;

  const subjects = useMemo(() => (levelSummary ?? []).slice(0, 10), [levelSummary]);
  const recentDecks = useMemo(() => (recentSessions ?? []).slice(0, 5), [recentSessions]);
  const recs = useMemo(() => (recommendations ?? []).slice(0, 8), [recommendations]);
  const discoverDecks = useMemo(
    () => decksPages?.pages.flatMap((p) => p.data) ?? [],
    [decksPages],
  );

  const hasSubjects = subjects.length > 0;
  const hasRecent = recentDecks.length > 0;
  const hasRecs = recs.length > 0;

  // ── Pull-to-refresh ───────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['progress'] });
    await queryClient.invalidateQueries({ queryKey: ['ai'] });
    await queryClient.invalidateQueries({ queryKey: ['decks'] });
    setRefreshing(false);
  }, [queryClient]);

  // ── Navigation helpers ────────────────────────────────────
  function handleDeckPress(deckId: string) {
    router.push(`/flashcards/${deckId}` as never);
  }

  function handleSubjectPress(examId: string, examTitle: string) {
    router.push(`/exams/${examId}/subjects?title=${encodeURIComponent(examTitle)}` as never);
  }

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing['4xl'] + spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* ── Header ─────────────────────────────────────── */}
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.base, gap: spacing.sm }}>
          <Typography variant="h3">{greeting}</Typography>
          <Typography variant="body" color={theme.textSecondary}>
            {hasSubjects
              ? `You're studying ${subjects.length} subject${subjects.length > 1 ? 's' : ''}. Keep it up!`
              : 'Start exploring exams to build your personalised study plan.'}
          </Typography>

          <TrialPassBanner />

          {/* Quick Stats Row */}
          {hasSubjects && (
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                marginTop: spacing.xs,
              }}
            >
              <View
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                  backgroundColor: '#6366F118',
                  borderRadius: radius.xl,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: '#6366F130',
                }}
              >
                <Ionicons name="school-outline" size={18} color="#6366F1" />
                <View>
                  <Typography variant="h3" color="#6366F1" style={{ fontSize: 18 }}>{subjects.length}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>Subjects</Typography>
                </View>
              </View>
              <View
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                  backgroundColor: '#10B98118',
                  borderRadius: radius.xl,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: '#10B98130',
                }}
              >
                <Ionicons name="layers-outline" size={18} color="#10B981" />
                <View>
                  <Typography variant="h3" color="#10B981" style={{ fontSize: 18 }}>{recentDecks.length}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>Recent</Typography>
                </View>
              </View>
              <View
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                  backgroundColor: '#F59E0B18',
                  borderRadius: radius.xl,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: '#F59E0B30',
                }}
              >
                <Ionicons name="sparkles" size={18} color="#F59E0B" />
                <View>
                  <Typography variant="h3" color="#F59E0B" style={{ fontSize: 18 }}>{recs.length}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>For You</Typography>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── Section 1: Current Subjects ─────────────────── */}
        <View style={{ marginTop: spacing['2xl'], gap: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.xl }}>
            <SectionHeader
              title="Your Current Subjects"
              subtitle={hasSubjects ? 'Tap a card to continue' : undefined}
              icon="book-outline"
            />
          </View>

          {isSubjectsLoading ? (
            <View style={{ paddingHorizontal: spacing.xl }}>
              <HorizontalSkeletons count={3} width={172} height={160} />
            </View>
          ) : !hasSubjects ? (
            <View
              style={{
                marginHorizontal: spacing.xl,
                backgroundColor: theme.cardAlt,
                borderRadius: radius.xl,
                padding: spacing.xl,
                alignItems: 'center',
                gap: spacing.sm,
                borderWidth: 1,
                borderColor: theme.border,
                borderStyle: 'dashed',
              }}
            >
              <Ionicons name="school-outline" size={36} color={theme.textTertiary} />
              <Typography variant="label" color={theme.textSecondary} align="center">
                No subjects yet
              </Typography>
              <Typography variant="caption" color={theme.textTertiary} align="center">
                Start studying an exam to see your active subjects here.
              </Typography>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md, flexDirection: 'row' }}
            >
              {subjects.map((s, i) => (
                <SubjectProgressCard
                  key={`${s.examId}-${s.subjectId}`}
                  subjectName={s.subjectName}
                  examName={s.examName}
                  levelIndex={s.levelIndex}
                  correctAnswers={s.correctAnswers}
                  accentIndex={i}
                  onPress={() => handleSubjectPress(s.examId, s.examName)}
                  animDelay={i * 60}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Section 2: Pick Up Where You Left Off ────────── */}
        {(hasRecent || isRecentLoading) && (
          <View style={{ marginTop: spacing['2xl'], gap: spacing.md }}>
            <View style={{ paddingHorizontal: spacing.xl }}>
              <SectionHeader
                title="Pick Up Where You Left Off"
                subtitle="Continue your last sessions"
                icon="time-outline"
              />
            </View>

            <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
              {isRecentLoading ? (
                <>
                  <Skeleton height={72} borderRadius={radius.xl} />
                  <Skeleton height={72} borderRadius={radius.xl} />
                </>
              ) : (
                recentDecks.map((session, i) => (
                  <RecentDeckCard
                    key={`${session.deckId}-${i}`}
                    deckId={session.deckId}
                    deckTitle={session.deckTitle}
                    cardsStudied={session.cardsStudied}
                    correctAnswers={session.correctAnswers}
                    endedAt={session.endedAt}
                    onResume={handleDeckPress}
                    index={i}
                  />
                ))
              )}
            </View>
          </View>
        )}

        {/* ── Section 3: AI Recommended For You ───────────── */}
        <View style={{ marginTop: spacing['2xl'], gap: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.xl }}>
            <SectionHeader
              title="Recommended For You"
              subtitle="Curated by AI based on your progress"
              icon="sparkles"
            />
          </View>

          {isRecsLoading ? (
            <View style={{ paddingHorizontal: spacing.xl }}>
              <HorizontalSkeletons count={3} width={220} height={170} />
            </View>
          ) : !hasRecs ? (
            <View style={{ paddingHorizontal: spacing.xl }}>
              <View
                style={{
                  backgroundColor: '#6366F108',
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  borderWidth: 1,
                  borderColor: '#6366F120',
                }}
              >
                <Ionicons name="sparkles" size={24} color="#6366F1" />
                <View style={{ flex: 1 }}>
                  <Typography variant="label" color="#6366F1">Study more to unlock AI picks</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>
                    Complete a few sessions and we'll recommend the best decks for you.
                  </Typography>
                </View>
              </View>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md, flexDirection: 'row' }}
            >
              {recs.map((rec, i) => (
                <RecommendedDeckCard
                  key={rec.deckId}
                  deckId={rec.deckId}
                  title={rec.title}
                  reason={rec.reason}
                  priority={rec.priority}
                  suggestedCards={rec.suggestedCards}
                  accentIndex={i}
                  onPress={handleDeckPress}
                  animDelay={i * 70}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Section 4: Discover More Decks ──────────────── */}
        <View style={{ marginTop: spacing['2xl'], gap: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.xl }}>
            <SectionHeader
              title="Discover More"
              subtitle="Popular flashcard decks"
              icon="compass-outline"
              action="See all decks →"
              onAction={() => router.push('/explore-decks' as never)}
            />
          </View>

          {isDecksLoading ? (
            <View style={{ paddingHorizontal: spacing.xl }}>
              <HorizontalSkeletons count={4} width={150} height={120} />
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md, flexDirection: 'row' }}
            >
              {discoverDecks.slice(0, 12).map((deck, i) => (
                <DiscoverDeckTile
                  key={deck.id}
                  deck={deck}
                  accent={DECK_ACCENTS[i % DECK_ACCENTS.length]!}
                  onPress={() => handleDeckPress(deck.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Tournaments quick-link ───────────────────────── */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing['2xl'] }}>
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
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
