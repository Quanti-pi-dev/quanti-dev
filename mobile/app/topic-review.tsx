// ─── Topic Review Screen ─────────────────────────────────────
// Dedicated flashcard study session for a single topic. Launched
// from Today's Focus (daily plan) and Memory Forecast (review).
//
// Two modes:
//  • daily_plan  — loads cards via the level-cards API (fresh + review mix)
//  • memory_review — loads overdue SM-2 cards via the review-queue API
//
// Both modes use the same FlashCard component and study session
// infrastructure (useStudySession, progress recording).

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGlobalUI } from '../src/contexts/GlobalUIContext';

import { spacing, radius } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Header } from '../src/components/layout/Header';
import { Skeleton } from '../src/components/ui/Skeleton';
import { ErrorState } from '../src/components/ui/ErrorState';
import { FlashCard } from '../src/components/Flashcard';
import {
  StudyCompletionScreen,
  StudyProgressHeader,
  AIDeepDiveSection,
  StudyNavBar,
  CoinToast,
  MasteryDeltaToast,
} from '../src/components/study';
import { RouteErrorBoundary } from '../src/components/ui/RouteErrorBoundary';
import { CardErrorBoundary } from '../src/components/ui/CardErrorBoundary';
import { useRecordCompletion } from '../src/hooks/useProgress';
import { useStudySession } from '../src/hooks/useStudySession';
import { useDailyPlanProgress } from '../src/hooks/useDailyPlanProgress';
import { progressKeys } from '../src/hooks/useProgress';
import { learningProfileKeys } from '../src/hooks/useLearningProfile';
import {
  fetchReviewQueue,
  fetchLevelCards,
  fetchConceptPractice,
  fetchConceptMastery,
  type ReviewQueueCard,
  type TargetedFeedbackResponse,
} from '../src/services/api-contracts';
import type { Flashcard } from '@kd/shared';

// ─── Types ────────────────────────────────────────────────────

type CardAnswer = boolean | 'skipped' | undefined;
type SelectedOptionMap = Record<number, string>;

/** Route params for topic-review. */
interface TopicReviewParams {
  topicSlug: string;
  topicName: string;
  subjectName: string;
  subjectId?: string;
  examId?: string;
  mode: 'daily_plan' | 'memory_review' | 'concept_practice';
  /** Suggested card count from the study plan or memory forecast. */
  cardCount?: string;
  /** BKT concept tag — only used in concept_practice mode. */
  conceptTag?: string;
  /** Human-readable concept name — used in header/completion screen. */
  conceptName?: string;
}

/** Fisher-Yates shuffle. */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Normalizes ReviewQueueCard[] into Flashcard-compatible shape so both
 * modes can share the same FlashCard rendering pipeline.
 */
function reviewCardsToFlashcards(reviewCards: ReviewQueueCard[]): Flashcard[] {
  return reviewCards.map((rc) => ({
    id: rc.cardId,
    deckId: rc.deckId,
    question: rc.question,
    options: rc.answers.map((a) => ({
      id: a.id,
      text: a.text,
      imageUrl: a.imageUrl ?? null,
    })),
    correctAnswerId: rc.correctAnswerId,
    explanation: rc.explanation ?? undefined,
    imageUrl: rc.imageUrl ?? null,
    explanationImageUrl: rc.explanationImageUrl ?? null,
    source: rc.source as string,
    sourceYear: rc.sourceYear ?? null,
    sourcePaper: rc.sourcePaper ?? null,
  })) as unknown as Flashcard[];
}

// ─── Screen ──────────────────────────────────────────────────

export default function TopicReviewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showAlert } = useGlobalUI();
  const { recordProgress } = useDailyPlanProgress();
  const params = useLocalSearchParams<{
    topicSlug: string;
    topicName: string;
    subjectName: string;
    subjectId?: string;
    examId?: string;
    mode: string;
    cardCount?: string;
    level?: string;          // Bug #5: difficulty-mapped level from the study plan
    conceptTag?: string;
    conceptName?: string;
    startCardId?: string;
    source?: string;
    // ML metadata from TodaysFocusSection SessionCard navigation
    mlPDifficult?: string;   // pDifficult as string (0.00–1.00)
    mlDropoutRisk?: string;  // dropoutRisk as string (0.00–1.00)
    mlModel?: string;        // 'dkt' | 'sakt' | 'bkt'
  }>();
  const {
    topicSlug,
    topicName,
    subjectName,
    subjectId,
    examId,
    mode,
    cardCount,
    level,
    conceptTag,
    conceptName,
    startCardId,
    source,
    mlPDifficult,
    mlDropoutRisk,
    mlModel,
  } = params;

  // Reconstruct mlMeta from URL-encoded params (set by TodaysFocusSection when
  // navigating from an AI-powered study plan session).
  const sessionMlMeta = mlPDifficult != null
    ? {
        pDifficult:   parseFloat(mlPDifficult),
        dropoutRisk:  parseFloat(mlDropoutRisk ?? '0'),
        model:        (mlModel ?? 'bkt') as 'dkt' | 'sakt' | 'bkt',
      }
    : undefined;

  const isReviewMode = mode === 'memory_review';
  const isConceptMode = mode === 'concept_practice';
  // Default to a larger count for review mode so we don't truncate the queue early
  const suggestedCount = cardCount ? parseInt(cardCount, 10) : (isReviewMode ? 100 : 25);

  // Bug #5: Map difficulty-derived level param → deck level.
  // Sessions from the daily plan now pass `level` based on `session.difficulty`:
  //   challenging → 'Advanced', moderate → 'Proficient', easy_review → 'Emerging'
  // Falls back to 'Emerging' for any other mode or missing param.
  const deckLevel = level ?? 'Emerging';
  
  const headerTitle = isConceptMode
    ? (conceptName || topicName || 'Concept Practice')
    : (topicName || topicSlug || 'Study');

  // ─── Data fetching: memory_review mode ─────────────────────
  const {
    data: reviewCards,
    isLoading: reviewLoading,
    isError: reviewError,
    refetch: refetchReview,
  } = useQuery({
    queryKey: ['topic-review', 'review', topicSlug, source],
    queryFn: () => fetchReviewQueue({ topicSlug, source: source as 'pyq' | undefined }),
    enabled: isReviewMode,
    staleTime: 30_000,
  });

  // ─── Data fetching: daily_plan mode ────────────────────────
  // Bug #3: pass suggestedCount as pageSize — only fetch what the plan prescribed.
  // Bug #5: use deckLevel derived from session.difficulty, not the hardcoded 'Emerging'.
  const {
    data: levelData,
    isLoading: levelLoading,
    isError: levelError,
    refetch: refetchLevel,
  } = useQuery({
    queryKey: ['topic-review', 'plan', examId, subjectId, topicSlug, deckLevel],
    queryFn: () => fetchLevelCards(examId!, subjectId!, topicSlug!, deckLevel, suggestedCount),
    enabled: !isReviewMode && !isConceptMode && !!examId && !!subjectId && !!topicSlug,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Data fetching: concept_practice mode ──────────────────
  // Fetches BKT-tag-targeted cards: remediation-first, adaptive-ordered.
  const {
    data: conceptCards,
    isLoading: conceptLoading,
    isError: conceptError,
    refetch: refetchConcept,
  } = useQuery({
    queryKey: ['topic-review', 'concept', conceptTag, topicSlug, subjectId],
    queryFn: () => fetchConceptPractice({
      tag: conceptTag!,
      topicSlug: topicSlug || undefined,
      subjectId: subjectId || undefined,
      limit: suggestedCount,
    }),
    enabled: isConceptMode && !!conceptTag,
    staleTime: 60_000,
  });

  // ─── Normalize cards ──────────────────────────────────────
  const rawCards = useMemo(() => {
    if (isReviewMode) {
      if (!reviewCards || reviewCards.length === 0) return null;
      return reviewCardsToFlashcards(reviewCards);
    }
    if (isConceptMode) {
      if (!conceptCards || conceptCards.length === 0) return null;
      return reviewCardsToFlashcards(conceptCards);
    }
    if (!levelData?.cards || levelData.cards.length === 0) return null;
    return levelData.cards;
  }, [isReviewMode, isConceptMode, reviewCards, conceptCards, levelData]);

  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [cards, setCards] = useState<Flashcard[] | null>(null);

  // Build (or re-build) the card deck from rawCards
  useEffect(() => {
    if (!rawCards) { setCards(null); return; }
    const shuffled = shuffleArray(rawCards);

    // If a startCardId was provided, bring it to the very front
    if (startCardId) {
      const startIndex = shuffled.findIndex(c => c.id === startCardId);
      if (startIndex > 0) {
        const [targetCard] = shuffled.splice(startIndex, 1);
        if (targetCard) shuffled.unshift(targetCard);
      }
    }

    const limited = suggestedCount > 0 ? shuffled.slice(0, suggestedCount) : shuffled;
    setCards(limited);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawCards, shuffleSeed]);

  /**
   * Adaptive re-ranking (Feature 3):
   * After a wrong answer in concept_practice mode, any unplayed cards that
   * share the same BKT conceptTag as the failed card are promoted to directly
   * after the current position. This creates a targeted remediation loop
   * inside the active session without requiring a new network call.
   */
  const promoteConceptCards = useCallback((
    failedCardId: string,
    afterIdx: number,
  ) => {
    if (!isConceptMode) return;
    setCards((prev) => {
      if (!prev) return prev;

      // Identify the failing card's concept tags by inspecting the raw cards
      // (ReviewQueueCard[]). The conceptTag URL param is the primary signal;
      // we use it to find sibling cards that share ANY of the same tags.
      const unplayed = prev.slice(afterIdx + 1);
      const played   = prev.slice(0, afterIdx + 1);

      // In concept_practice mode all cards are already pre-filtered by tag,
      // so all unplayed cards are relevant — we simply sort them so that
      // isRemediation cards (previously failed) float to the top.
      const remediationFirst = [
        ...unplayed.filter((c) => (c as unknown as { isRemediation?: boolean }).isRemediation),
        ...unplayed.filter((c) => !(c as unknown as { isRemediation?: boolean }).isRemediation),
      ];

      return [...played, ...remediationFirst];
    });
  }, [isConceptMode]);

  const isLoading = isConceptMode ? conceptLoading : isReviewMode ? reviewLoading : levelLoading;
  const isError = isConceptMode ? conceptError : isReviewMode ? reviewError : levelError;
  const refetch = isConceptMode ? refetchConcept : isReviewMode ? refetchReview : refetchLevel;

  // ─── Effective deckId for session tracking ─────────────────
  const effectiveDeckId = useMemo(() => {
    if (isReviewMode) {
      // Review cards come from various decks; use null for session tracking
      return null;
    }
    return levelData?.deckId ?? null;
  }, [isReviewMode, levelData]);

  // ─── Progress recording ───────────────────────────────────
  const recordCompletion = useRecordCompletion();
  const [sessionStarted] = useState(() => new Date().toISOString());
  const session = useStudySession({
    deckId: effectiveDeckId,
    startedAt: sessionStarted,
    skipAnswerDetails: false,
  });

  // ─── Card navigation state ────────────────────────────────
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answered, setAnswered] = useState<CardAnswer[]>([]);
  const [sessionCoinsEarned, setSessionCoinsEarned] = useState(0);
  const [selectedOptionIds, setSelectedOptionIds] = useState<SelectedOptionMap>({});

  // ─── AI Deep Dive panel cache (survives card remounts) ────
  // Keyed by cardId. Stores the last known panel state so navigating back
  // restores both the expanded/collapsed state and the fetched AI content.
  const aiDiveStateCache = useRef<Map<string, {
    isOpen: boolean;
    liveExplanation: string | null;
    targetedFeedback: TargetedFeedbackResponse | null;
  }>>(new Map());

  // ─── Response time tracking ───────────────────────────────
  const cardStartTimeRef = useRef(Date.now());
  useEffect(() => {
    cardStartTimeRef.current = Date.now();
  }, [currentIdx]);

  // ─── Coin Toast ───────────────────────────────────────────
  const [coinToast, setCoinToast] = useState<{ amount: number; key: number } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCoinToast = useCallback((amount: number) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setCoinToast({ amount, key: Date.now() });
    toastTimeout.current = setTimeout(() => setCoinToast(null), 1600);
  }, []);

  useEffect(() => () => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
  }, []);

  // ─── Mastery Delta Toast (concept_practice mode only) ─────
  // Tracks the BKT p_mastery BEFORE each answer so we can compute
  // a meaningful delta after the answer is recorded.
  const [masteryToast, setMasteryToast] = useState<{
    key: number;
    current: number;
    previous: number;
  } | null>(null);
  // Snapshot of mastery fetched at the start of the current card
  // so we have a "before" value to diff against.
  const prevMasteryRef = useRef<number | null>(null);

  // Pre-fetch mastery for the active concept when we enter concept_practice mode
  useEffect(() => {
    if (!isConceptMode || !conceptTag) return;
    void fetchConceptMastery(conceptTag).then((res) => {
      prevMasteryRef.current = res.pMastery !== null ? Math.round(res.pMastery * 100) : null;
    }).catch(() => {
      prevMasteryRef.current = null;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, isConceptMode, conceptTag]);

  // ─── Derived values ───────────────────────────────────────
  const total = cards?.length ?? 0;
  const card = cards?.[currentIdx] as Flashcard | undefined;
  const canGoNext = currentIdx < total - 1;
  const canGoPrev = currentIdx > 0;
  const isCurrentAnswered = answered[currentIdx] !== undefined;

  const { correctCount, answeredCount, incorrectCount, skippedCount, isComplete, currentStreak, longestStreak } = useMemo(() => {
    const correct = answered.filter((a) => a === true).length;
    const answeredTotal = answered.filter((a) => a !== undefined).length;
    const incorrect = answered.filter((a) => a === false).length;
    const skipped = answered.filter((a) => a === 'skipped').length;

    let streak = 0;
    for (let i = answered.length - 1; i >= 0; i--) {
      if (answered[i] === undefined) continue;
      if (answered[i] === true) streak++;
      else break;
    }

    let longest = 0;
    let running = 0;
    for (let i = 0; i < answered.length; i++) {
      if (answered[i] === true) {
        running++;
        if (running > longest) longest = running;
      } else if (answered[i] !== undefined) {
        running = 0;
      }
    }

    return {
      correctCount: correct,
      answeredCount: answeredTotal,
      incorrectCount: incorrect,
      skippedCount: skipped,
      isComplete: total > 0 && answeredTotal === total,
      currentStreak: streak,
      longestStreak: longest,
    };
  }, [answered, total]);

  // ─── Answer handler ───────────────────────────────────────
  const LETTER_KEYS = ['A', 'B', 'C', 'D'] as const;
  const handleAnswer = useCallback(async (correct: boolean, selectedKey: 'A' | 'B' | 'C' | 'D') => {
    if (!card) return;

    const responseTimeMs = Math.max(1, Date.now() - cardStartTimeRef.current);
    const cardDeckId = (card as unknown as { deckId?: string }).deckId ?? effectiveDeckId ?? '';
    session.recordAnswer(correct, card.id, responseTimeMs);

    const selectedOptionIndex = LETTER_KEYS.indexOf(selectedKey);
    const selectedAnswerId = (card.options ?? [])[selectedOptionIndex]?.id ?? '';

    // Record completion for SM-2 updates
    recordCompletion.mutate({
      deckId: cardDeckId,
      cardId: card.id,
      correct,
      responseTimeMs,
    });

    setAnswered((prev) => {
      const next = [...prev];
      next[currentIdx] = correct;
      return next;
    });

    setSelectedOptionIds((prev) => ({ ...prev, [currentIdx]: selectedAnswerId }));

    // ── Feature 3: Adaptive re-ranking on wrong answers ──────
    // After a wrong answer in concept_practice mode, promote
    // remaining remediation cards so the student immediately
    // re-encounters the weak concept before moving on.
    if (!correct && isConceptMode) {
      promoteConceptCards(card.id, currentIdx);
    }

    // ── Feature 2: Mid-session mastery delta toast ────────────
    // Fire after a correct answer only (wrong answers don't boost mastery).
    // We wait ~400 ms so the BKT update on the server has time to commit.
    if (correct && isConceptMode && conceptTag) {
      const snapshotBefore = prevMasteryRef.current;
      setTimeout(async () => {
        try {
          const res = await fetchConceptMastery(conceptTag);
          if (res.pMastery !== null) {
            const currentPct  = Math.round(res.pMastery * 100);
            const previousPct = snapshotBefore ?? Math.max(0, currentPct - 4);
            if (currentPct > previousPct) {
              setMasteryToast({ key: Date.now(), current: currentPct, previous: previousPct });
            }
            // Update snapshot for the next card
            prevMasteryRef.current = currentPct;
          }
        } catch {
          // Non-critical — silence network errors
        }
      }, 400);
    }

    // Persist partial progress immediately to AsyncStorage so
    // TodaysStudyPlan can reflect the in-progress state right away.
    if (mode === 'daily_plan' && topicSlug) {
      const newAnswered = answered.filter(a => a !== undefined).length + 1;
      void recordProgress(topicSlug, {
        answered: newAnswered,
        total: suggestedCount,
        isComplete: newAnswered >= suggestedCount,
      });
    }
  }, [card, currentIdx, effectiveDeckId, recordCompletion, session, mode, topicSlug, answered, suggestedCount, recordProgress, isConceptMode, conceptTag, promoteConceptCards]);

  // ─── Skip handler ─────────────────────────────────────────
  const handleSkip = useCallback(() => {
    if (!card) return;
    setAnswered((prev) => {
      const next = [...prev];
      next[currentIdx] = 'skipped';
      return next;
    });
  }, [card, currentIdx]);

  // ─── Navigation ───────────────────────────────────────────
  const goNext = useCallback(() => {
    if (!canGoNext || !isCurrentAnswered) return;
    setCurrentIdx((i) => i + 1);
  }, [canGoNext, isCurrentAnswered]);
  const goPrev = useCallback(() => {
    if (canGoPrev) setCurrentIdx((i) => i - 1);
  }, [canGoPrev]);

  // ─── Flush on completion ──────────────────────────────────
  useEffect(() => {
    if (isComplete) {
      session.flush(true);
      // Mark plan session as fully complete in local store
      if (mode === 'daily_plan' && topicSlug) {
        void recordProgress(topicSlug, {
          answered: total,
          total,
          isComplete: true,
        });
      }
      // Force refetch progress + learning profile so the ring + plan update immediately
      queryClient.invalidateQueries({ queryKey: progressKeys.summary() });
      queryClient.invalidateQueries({ queryKey: learningProfileKeys.all });
    }
  }, [isComplete]);

  // ─── Confirm before leaving ───────────────────────────────
  const handleBack = useCallback(() => {
    const doLeave = () => {
      // Force refetch on leave so TodaysFocusSection ring reflects answered cards
      queryClient.invalidateQueries({ queryKey: progressKeys.summary() });
      queryClient.invalidateQueries({ queryKey: progressKeys.streak() });
      queryClient.invalidateQueries({ queryKey: learningProfileKeys.all });
      router.back();
    };
    if (answeredCount > 0 && !isComplete) {
      showAlert({
        title: 'Leave Session?',
        message: "Your progress so far has been saved, but you haven't finished all cards.",
        type: 'warning',
        buttons: [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: doLeave },
        ],
      });
    } else {
      doLeave();
    }
  }, [answeredCount, isComplete, router, showAlert, queryClient]);

  // ─── Loading state ────────────────────────────────────────
  if (isLoading) {
    return (
      <ScreenWrapper>
        <Header showBack title={headerTitle} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'] }}>
          <Skeleton width={300} height={420} borderRadius={radius['2xl']} />
        </View>
      </ScreenWrapper>
    );
  }

  // ─── Error state ──────────────────────────────────────────
  if (isError) {
    return (
      <ScreenWrapper>
        <Header showBack title={headerTitle} />
        <ErrorState
          message="Could not load cards. Please check your connection and try again."
          onRetry={() => void refetch()}
          icon="alert-circle-outline"
        />
      </ScreenWrapper>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <ScreenWrapper>
        <Header showBack title={headerTitle} />
        <ErrorState
          message={
            isConceptMode
              ? `No practice cards found for "${conceptName || conceptTag}". Try studying the topic directly.`
              : isReviewMode
              ? "No overdue cards for this topic. You're up to date! 🎉"
              : "No cards available for this topic yet."
          }
          icon={isConceptMode ? 'bulb-outline' : isReviewMode ? 'checkmark-done-circle-outline' : 'albums-outline'}
          onRetry={() => router.back()}
          retryLabel="Go Back"
        />
      </ScreenWrapper>
    );
  }

  // ─── Completion screen ────────────────────────────────────
  if (isComplete) {
    return (
      <StudyCompletionScreen
        title={`${headerTitle} — ${subjectName}`}
        total={total}
        correctCount={correctCount}
        incorrectCount={incorrectCount}
        skippedCount={skippedCount}
        sessionCoinsEarned={sessionCoinsEarned}
        deckId={effectiveDeckId}
        longestStreak={longestStreak}
        mlMeta={sessionMlMeta}
        onStudyAgain={() => {
          setCurrentIdx(0);
          setAnswered([]);
          setSessionCoinsEarned(0);
          setSelectedOptionIds({});
          setShuffleSeed((s) => s + 1);
        }}
      />
    );
  }

  if (!card) return null;

  // Map options to letter keys for the FlashCard component
  const cardOptions = (card.options ?? []).slice(0, 4).map((opt, i) => ({
    key: LETTER_KEYS[i]!,
    text: opt.text,
    imageUrl: (opt as unknown as { imageUrl?: string | null }).imageUrl,
  }));
  const correctLetterKey = LETTER_KEYS[
    (card.options ?? []).findIndex((o) => o.id === card.correctAnswerId)
  ] ?? LETTER_KEYS[0] ?? 'A';

  // ─── Restore state for previously answered cards ──────────
  // When the student navigates back to a card they already answered, seed
  // FlashCard with the persisted result so it renders on the back (result) side.
  const persistedAnswer = answered[currentIdx];
  const persistedSelectedOptionId = selectedOptionIds[currentIdx];

  type AnswerKey = 'A' | 'B' | 'C' | 'D';
  const initialAnswerState: 'unanswered' | 'correct' | 'incorrect' | 'skipped' =
    persistedAnswer === true ? 'correct'
    : persistedAnswer === false ? 'incorrect'
    : persistedAnswer === 'skipped' ? 'skipped'
    : 'unanswered';

  // Recover which letter key was originally selected by matching the stored option ID
  const initialSelectedKey: AnswerKey | null = (() => {
    if (!persistedSelectedOptionId) return null;
    const optIdx = (card.options ?? []).findIndex((o) => o.id === persistedSelectedOptionId);
    return optIdx >= 0 ? (LETTER_KEYS[optIdx] ?? null) : null;
  })();

  // ─── Active study view ────────────────────────────────────
  return (
    <RouteErrorBoundary fallbackTitle="Session Interrupted">
    <ScreenWrapper>
      <Header showBack title={headerTitle} onBack={handleBack} />

      <StudyProgressHeader
        currentIdx={currentIdx}
        total={total}
        correctCount={correctCount}
        currentStreak={currentStreak}
        mlMeta={sessionMlMeta}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <CardErrorBoundary onSkip={handleSkip}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'] }}>
            <FlashCard
              key={`${card.id}-${currentIdx}`}
              question={card.question}
              options={cardOptions}
              correctKey={correctLetterKey}
              explanation={card.explanation ?? ''}
              imageUrl={card.imageUrl}
              explanationImageUrl={card.explanationImageUrl}
              initialAnswerState={initialAnswerState}
              initialSelectedKey={initialSelectedKey}
              onAnswer={initialAnswerState === 'unanswered' ? handleAnswer : undefined}
              onSkip={initialAnswerState === 'unanswered' ? handleSkip : undefined}
            />
          </View>

          <AIDeepDiveSection
            answer={answered[currentIdx]}
            explanation={card.explanation ?? ''}
            cardIndex={currentIdx}
            cardId={card.id}
            selectedOptionId={selectedOptionIds[currentIdx]}
            initialOpenState={aiDiveStateCache.current.get(card.id)?.isOpen ?? false}
            initialLiveExplanation={aiDiveStateCache.current.get(card.id)?.liveExplanation ?? null}
            initialTargetedFeedback={aiDiveStateCache.current.get(card.id)?.targetedFeedback ?? null}
            onStateChange={(state) => {
              aiDiveStateCache.current.set(card.id, state);
            }}
          />
        </CardErrorBoundary>
      </ScrollView>

      <StudyNavBar
        currentIdx={currentIdx}
        total={total}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        isCurrentAnswered={isCurrentAnswered}
        onPrev={goPrev}
        onNext={goNext}
        sourceYear={(card as unknown as { sourceYear?: number | null }).sourceYear ?? undefined}
        sourcePaper={(card as unknown as { sourcePaper?: string | null }).sourcePaper ?? undefined}
      />

      {/* Coin toast */}
      {coinToast && (
        <CoinToast amount={coinToast.amount} animationKey={coinToast.key} />
      )}

      {/* Mastery delta toast (concept_practice mode) */}
      {masteryToast && (
        <MasteryDeltaToast
          animationKey={masteryToast.key}
          currentMastery={masteryToast.current}
          previousMastery={masteryToast.previous}
          conceptName={conceptName || conceptTag}
        />
      )}
    </ScreenWrapper>
    </RouteErrorBoundary>
  );
}
