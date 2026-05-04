// ─── Study Dashboard ──────────────────────────────────────────
// Personalized learning dashboard. Surfaces:
//   1. Header — greeting with time-aware emoji, quick stats
//   2. Today's Focus — daily goal ring, streak, coins, quick actions
//   3. Your Current Subjects — onboarding subjects merged with progress
//   4. Pick Up Where You Left Off — recent deck sessions
//   5. Recommended For You — AI-curated decks
//   6. Discover More — all available decks
// Improvements (UX pass):
//   - Richer greeting header with gradient accent strip
//   - Quick-start "Resume Last" shortcut above subjects when available
//   - Empty state CTAs navigate user forward
//   - Tournaments banner upgraded to gradient card
//   - Better DiscoverDeckTile with progress bar placeholder

import { useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { TrialPassBanner } from '../../src/components/subscription/TrialPassBanner';
import { TodaysFocusSection } from '../../src/components/study/TodaysFocusSection';
import { SubjectProgressCard } from '../../src/components/study/SubjectProgressCard';
import { RecentDeckCard } from '../../src/components/study/RecentDeckCard';
import { RecommendedDeckCard } from '../../src/components/study/RecommendedDeckCard';
import { useRecentSessions } from '../../src/hooks/useProgress';
import { useLevelProgressSummary } from '../../src/hooks/useGamification';
import { useRecommendations } from '../../src/hooks/useAI';
import { useDecks } from '../../src/hooks/useDecks';
import { useAuth } from '../../src/contexts/AuthContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { fetchExamSubjects } from '../../src/services/api-contracts';
import type { Deck, Subject } from '@kd/shared';

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
            width: 32, height: 32, borderRadius: radius.md,
            backgroundColor: theme.primaryMuted,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={16} color={theme.primary} />
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

// ─── Quick-resume bar (shown when recent session exists) ──────

function QuickResumeBar({ deckId, deckTitle, onResume }: { deckId: string; deckTitle: string; onResume: (id: string) => void }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => onResume(deckId)}
      activeOpacity={0.82}
      accessibilityRole="button"
      style={{
        marginHorizontal: spacing.xl,
        borderRadius: radius.xl,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={[theme.primary, theme.primary + 'CC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        <Ionicons name="play-circle" size={22} color="#FFF" />
        <View style={{ flex: 1 }}>
          <Typography variant="captionBold" color="rgba(255,255,255,0.75)" style={{ fontSize: 10 }}>
            CONTINUE STUDYING
          </Typography>
          <Typography variant="label" color="#FFF" numberOfLines={1}>
            {deckTitle}
          </Typography>
        </View>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Discover Deck tile ───────────────────────────────────────

function DiscoverDeckTile({ deck, accent, onPress }: { deck: Deck; accent: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`${deck.title} deck`}
      style={{
        width: 156,
        backgroundColor: theme.card,
        borderRadius: radius.xl,
        padding: spacing.md,
        borderWidth: 1.5,
        borderColor: accent + '33',
        gap: spacing.sm,
        shadowColor: accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View
        style={{
          width: 42, height: 42, borderRadius: radius.lg,
          backgroundColor: accent + '18',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="copy-outline" size={20} color={accent} />
      </View>
      <Typography variant="label" numberOfLines={2} style={{ lineHeight: 16, fontSize: 12 }}>
        {deck.title}
      </Typography>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="pricetag-outline" size={10} color={accent + 'BB'} />
        <Typography variant="caption" color={accent + 'BB'} numberOfLines={1} style={{ fontSize: 10, flex: 1 }}>
          {deck.tags?.[0] ?? deck.category}
        </Typography>
      </View>
      {/* Visual fill-bar (decorative) */}
      <View style={{ height: 3, borderRadius: 2, backgroundColor: accent + '20', overflow: 'hidden' }}>
        <View style={{ height: '100%', width: '40%', backgroundColor: accent, borderRadius: 2 }} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Quick Stat Chip ──────────────────────────────────────────

function StatChip({ icon, value, label, color, bg }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: number | string;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <View
      style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: bg,
        borderRadius: radius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: color + '30',
      }}
    >
      <View
        style={{
          width: 34, height: 34, borderRadius: radius.full,
          backgroundColor: color + '20',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View>
        <Typography variant="h3" color={color} style={{ fontSize: 18 }}>{value}</Typography>
        <Typography variant="caption" color={color + 'AA'} style={{ fontSize: 10 }}>{label}</Typography>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function StudyScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user, preferences } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // ── Onboarding preferences ─────────────────────────────
  const selectedSubjectIds: string[] = preferences?.selectedSubjects ?? [];
  const selectedExamIds: string[] = preferences?.selectedExams ?? [];
  const isOnboarded = selectedSubjectIds.length > 0;
  const primaryExamId = selectedExamIds[0] ?? '';

  // ── Data ──────────────────────────────────────────────────
  const { data: recentSessions, isLoading: isRecentLoading } = useRecentSessions(5);
  const { data: recommendations, isLoading: isRecsLoading } = useRecommendations();
  const { data: decksPages, isLoading: isDecksLoading } = useDecks(12);
  const { data: levelSummary, isLoading: isLevelLoading } = useLevelProgressSummary();

  // ── Fetch full Subject objects for onboarded users ────────
  // This gives us the full Subject metadata (name, description, icon)
  // for subjects the user selected during onboarding, even if they
  // haven't started studying them yet.
  const { data: onboardedSubjects, isLoading: isSubjectsLoading } = useQuery<Subject[]>({
    queryKey: ['study-personalized-subjects', selectedSubjectIds.join(',')],
    queryFn: async () => {
      // Fetch all subjects for each selected exam
      const allSubjects = await Promise.all(
        selectedExamIds.map((eid) => fetchExamSubjects(eid)),
      );
      // Filter to only subjects the user selected during onboarding
      const subjectMap = new Map<string, Subject>();
      for (const batch of allSubjects) {
        for (const s of batch) {
          if (selectedSubjectIds.includes(s.id)) {
            subjectMap.set(s.id, s);
          }
        }
      }
      // Preserve onboarding order
      return selectedSubjectIds
        .map((id) => subjectMap.get(id))
        .filter((s): s is Subject => !!s);
    },
    enabled: isOnboarded && selectedExamIds.length > 0,
    staleTime: 5 * 60_000,
  });

  // ── Build mastery map (subjectId → levelIndex 0–5) ─────────
  const masteryMap = useMemo(() => {
    const map = new Map<string, { levelIndex: number; correctAnswers: number; examId: string; examName: string }>();
    for (const item of levelSummary ?? []) {
      map.set(item.subjectId, {
        levelIndex: item.levelIndex,
        correctAnswers: item.correctAnswers,
        examId: item.examId,
        examName: item.examName,
      });
    }
    return map;
  }, [levelSummary]);

  // ── Merged subject list: onboarded subjects + any extra from progress ──
  // This ensures:
  //   1. All onboarding-selected subjects appear (even with 0 progress)
  //   2. Any subjects studied outside onboarding still show up
  //   3. Subjects with progress sort first, then unstarted subjects
  const mergedSubjects = useMemo(() => {
    type MergedSubject = {
      subjectId: string;
      subjectName: string;
      examId: string;
      examName: string;
      levelIndex: number;
      correctAnswers: number;
      isStarted: boolean;
    };

    const seen = new Set<string>();
    const result: MergedSubject[] = [];

    // First: subjects from onboarding (preserves user's chosen order)
    if (onboardedSubjects) {
      for (const s of onboardedSubjects) {
        const progress = masteryMap.get(s.id);
        seen.add(s.id);
        result.push({
          subjectId: s.id,
          subjectName: s.name,
          examId: progress?.examId ?? primaryExamId,
          examName: progress?.examName ?? '',
          levelIndex: progress?.levelIndex ?? 0,
          correctAnswers: progress?.correctAnswers ?? 0,
          isStarted: !!progress,
        });
      }
    }

    // Second: any subjects from progress that weren't in onboarding
    for (const item of levelSummary ?? []) {
      if (!seen.has(item.subjectId)) {
        seen.add(item.subjectId);
        result.push({
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          examId: item.examId,
          examName: item.examName,
          levelIndex: item.levelIndex,
          correctAnswers: item.correctAnswers,
          isStarted: true,
        });
      }
    }

    // Sort: started subjects first (by level desc), then unstarted
    result.sort((a, b) => {
      if (a.isStarted && !b.isStarted) return -1;
      if (!a.isStarted && b.isStarted) return 1;
      if (a.isStarted && b.isStarted) return b.levelIndex - a.levelIndex;
      return 0;
    });

    return result.slice(0, 12);
  }, [onboardedSubjects, masteryMap, levelSummary, primaryExamId]);

  const hasSubjects = mergedSubjects.length > 0;

  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'Student';
  const firstName = displayName.split(' ')[0] ?? displayName;

  const hour = new Date().getHours();
  const greetingEmoji = hour < 5 ? '🌙' : hour < 12 ? '☀️' : hour < 17 ? '👋' : hour < 21 ? '🌆' : '🌙';
  const greetingWord = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greeting = `${greetingWord}, ${firstName}`;

  const recentDecks = useMemo(() => (recentSessions ?? []).slice(0, 5), [recentSessions]);
  const recs = useMemo(() => (recommendations ?? []).slice(0, 8), [recommendations]);
  const discoverDecks = useMemo(
    () => decksPages?.pages.flatMap((p) => p.data) ?? [],
    [decksPages],
  );

  const hasRecent = recentDecks.length > 0;
  const hasRecs = recs.length > 0;
  const lastSession = recentDecks[0];

  // ── Pull-to-refresh ───────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['progress'] });
    await queryClient.invalidateQueries({ queryKey: ['gamification'] });
    await queryClient.invalidateQueries({ queryKey: ['ai'] });
    await queryClient.invalidateQueries({ queryKey: ['decks'] });
    setRefreshing(false);
  }, [queryClient]);

  // ── Navigation helpers ────────────────────────────────────
  function handleDeckPress(deckId: string) {
    router.push(`/flashcards/${deckId}` as never);
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
          {/* Greeting row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Typography variant="h3">{greeting}</Typography>
                <Typography variant="h3">{greetingEmoji}</Typography>
              </View>
              <Typography variant="body" color={theme.textSecondary}>
                {hasSubjects
                  ? `Tracking ${mergedSubjects.length} subject${mergedSubjects.length > 1 ? 's' : ''} — building your mastery profile`
                  : 'Start exploring exams to build your learning profile.'}
              </Typography>
            </View>
          </View>

          <TrialPassBanner />

          {/* Quick Stats Row */}
          {(hasSubjects || hasRecent) && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              {hasSubjects && (
                <StatChip icon="school-outline" value={mergedSubjects.length} label="Subjects" color="#6366F1" bg="#6366F112" />
              )}
              <StatChip icon="layers-outline" value={recentDecks.length} label="Recent" color="#10B981" bg="#10B98112" />
              <StatChip icon="sparkles" value={recs.length} label="For You" color="#F59E0B" bg="#F59E0B12" />
            </View>
          )}
        </View>

        {/* ── Quick Resume shortcut ─────────────────────── */}
        {lastSession && (
          <View style={{ marginTop: spacing.lg }}>
            <QuickResumeBar
              deckId={lastSession.deckId}
              deckTitle={lastSession.deckTitle}
              onResume={handleDeckPress}
            />
          </View>
        )}

        {/* ── Section 1: Today's Focus ─────────────────────── */}
        <View style={{ marginTop: spacing['2xl'], gap: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.xl }}>
            <SectionHeader
              title="Today's Focus"
              subtitle="Your daily study dashboard"
              icon="today-outline"
            />
          </View>
          <TodaysFocusSection />
        </View>

        {/* ── Section 1.5: Your Current Subjects ─────────────── */}
        <View style={{ marginTop: spacing['2xl'], gap: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.xl }}>
            <SectionHeader
              title="Your Current Subjects"
              subtitle={hasSubjects ? 'Tap a subject to study' : undefined}
              icon="book-outline"
              action={hasSubjects ? 'Manage →' : undefined}
              onAction={hasSubjects ? () => router.push('/explore-exams' as never) : undefined}
            />
          </View>

          {(isSubjectsLoading || isLevelLoading) ? (
            <View style={{ paddingHorizontal: spacing.xl }}>
              <HorizontalSkeletons count={3} width={172} height={160} />
            </View>
          ) : !hasSubjects ? (
            <TouchableOpacity
              onPress={() => router.push('/explore-exams' as never)}
              activeOpacity={0.8}
              style={{
                marginHorizontal: spacing.xl,
                borderRadius: radius.xl,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['#6366F118', '#6366F108']}
                style={{
                  padding: spacing.xl,
                  alignItems: 'center',
                  gap: spacing.sm,
                  borderWidth: 1,
                  borderColor: '#6366F130',
                  borderRadius: radius.xl,
                  borderStyle: 'dashed',
                }}
              >
                <View
                  style={{
                    width: 56, height: 56, borderRadius: radius.full,
                    backgroundColor: '#6366F118',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="add" size={28} color="#6366F1" />
                </View>
                <Typography variant="label" color="#6366F1" align="center">
                  Pick your subjects
                </Typography>
                <Typography variant="caption" color={theme.textTertiary} align="center">
                  Choose an exam and select the subjects you want to study.
                </Typography>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2,
                    backgroundColor: '#6366F1', borderRadius: radius.full,
                    paddingHorizontal: spacing.md, paddingVertical: 6,
                  }}
                >
                  <Typography variant="captionBold" color="#FFF">Explore Exams</Typography>
                  <Ionicons name="arrow-forward" size={12} color="#FFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md, flexDirection: 'row' }}
            >
              {mergedSubjects.map((s, i) => (
                <SubjectProgressCard
                  key={`${s.examId}-${s.subjectId}`}
                  subjectName={s.subjectName}
                  examName={s.isStarted ? s.examName : 'Not started'}
                  levelIndex={s.levelIndex}
                  correctAnswers={s.correctAnswers}
                  accentIndex={i}
                  onPress={() =>
                    router.push(
                      `/exams/${s.examId}/subjects/${s.subjectId}/levels?title=${encodeURIComponent(s.subjectName)}` as never,
                    )
                  }
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
                  <Skeleton height={96} borderRadius={radius.xl} />
                  <Skeleton height={96} borderRadius={radius.xl} />
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
                <View
                  style={{
                    width: 44, height: 44, borderRadius: radius.full,
                    backgroundColor: '#6366F118',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="sparkles" size={22} color="#6366F1" />
                </View>
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

        {/* ── Mock Test CTA ──────────────────────────────────── */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
          <TouchableOpacity
            onPress={() => router.push('/mock-test')}
            activeOpacity={0.85}
            style={{
              borderRadius: radius['2xl'],
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: '#6366F120',
            }}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.lg,
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="document-text" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="label" color="#FFFFFF">Mock Test</Typography>
                <Typography variant="caption" color="rgba(255,255,255,0.7)">
                  Timed exam simulation • NEET scoring
                </Typography>
              </View>
              <Ionicons name="play-circle" size={24} color="rgba(255,255,255,0.9)" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Section 4: Discover More Decks ──────────────── */}
        <View style={{ marginTop: spacing['2xl'], gap: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.xl }}>
            <SectionHeader
              title="Discover More"
              subtitle="Popular flashcard decks"
              icon="compass-outline"
              action="See all →"
              onAction={() => router.push('/explore-decks' as never)}
            />
          </View>

          {isDecksLoading ? (
            <View style={{ paddingHorizontal: spacing.xl }}>
              <HorizontalSkeletons count={4} width={156} height={130} />
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

        {/* ── Tournaments & Battles quick-links ────────────── */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing['2xl'], gap: spacing.sm }}>
          {/* Tournaments */}
          <TouchableOpacity
            onPress={() => router.push('/tournaments')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Tournaments — compete and win coins"
            style={{ borderRadius: radius.xl, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: radius.xl,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  width: 40, height: 40, borderRadius: radius.full,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="trophy" size={20} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="label" color="#FFF">Tournaments</Typography>
                <Typography variant="caption" color="rgba(255,255,255,0.75)">Compete & win coins</Typography>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
