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
import { useQuery } from '@tanstack/react-query';
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
} from '../src/components/study';
import { RouteErrorBoundary } from '../src/components/ui/RouteErrorBoundary';
import { CardErrorBoundary } from '../src/components/ui/CardErrorBoundary';
import { useRecordCompletion } from '../src/hooks/useProgress';
import { useStudySession } from '../src/hooks/useStudySession';
import { fetchReviewQueue, fetchLevelCards, fetchConceptPractice, type ReviewQueueCard } from '../src/services/api-contracts';
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
  const { showAlert } = useGlobalUI();
  const params = useLocalSearchParams<{
    topicSlug: string;
    topicName: string;
    subjectName: string;
    subjectId?: string;
    examId?: string;
    mode: string;
    cardCount?: string;
    conceptTag?: string;
    conceptName?: string;
  }>();
  const {
    topicSlug,
    topicName,
    subjectName,
    subjectId,
    examId,
    mode,
    cardCount,
    conceptTag,
    conceptName,
  } = params;

  const suggestedCount = parseInt(cardCount ?? '25', 10);
  const isReviewMode = mode === 'memory_review';
  const isConceptMode = mode === 'concept_practice';
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
    queryKey: ['topic-review', 'review', topicSlug],
    queryFn: () => fetchReviewQueue({ topicSlug }),
    enabled: isReviewMode && !!topicSlug,
    staleTime: 30_000,
  });

  // ─── Data fetching: daily_plan mode ────────────────────────
  // For daily plan, we fetch level cards at the lowest level ('Emerging')
  // so the student gets a mix of the topic's cards.
  const {
    data: levelData,
    isLoading: levelLoading,
    isError: levelError,
    refetch: refetchLevel,
  } = useQuery({
    queryKey: ['topic-review', 'plan', examId, subjectId, topicSlug],
    queryFn: () => fetchLevelCards(examId!, subjectId!, topicSlug!, 'Emerging'),
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
  const cards = useMemo(() => {
    if (!rawCards) return null;
    const shuffled = shuffleArray(rawCards);
    // Limit to suggested card count when available
    return suggestedCount > 0
      ? shuffled.slice(0, suggestedCount)
      : shuffled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawCards, shuffleSeed, suggestedCount]);

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
  }, [card, currentIdx, effectiveDeckId, recordCompletion, session]);

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
    }
  }, [isComplete, session]);

  // ─── Confirm before leaving ───────────────────────────────
  const handleBack = useCallback(() => {
    if (answeredCount > 0 && !isComplete) {
      showAlert({
        title: 'Leave Session?',
        message: "Your progress so far has been saved, but you haven't finished all cards.",
        type: 'warning',
        buttons: [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => router.back() },
        ],
      });
    } else {
      router.back();
    }
  }, [answeredCount, isComplete, router, showAlert]);

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
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <CardErrorBoundary onSkip={handleSkip}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'] }}>
            <FlashCard
              key={card.id}
              question={card.question}
              options={cardOptions}
              correctKey={correctLetterKey}
              explanation={card.explanation ?? ''}
              imageUrl={card.imageUrl}
              explanationImageUrl={card.explanationImageUrl}
              onAnswer={handleAnswer}
              onSkip={handleSkip}
            />
          </View>

          <AIDeepDiveSection
            answer={answered[currentIdx]}
            explanation={card.explanation ?? ''}
            cardIndex={currentIdx}
            cardId={card.id}
            selectedOptionId={selectedOptionIds[currentIdx]}
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
    </ScreenWrapper>
    </RouteErrorBoundary>
  );
}
