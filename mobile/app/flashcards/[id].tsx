// ─── Flashcard Study Screen ──────────────────────────────
// Loads real cards from the API (by deckId or adaptive mode or subject+level).
// Records each answer to the progress API via useStudySession (incremental sync).
// When examId+subjectId+level params are provided, uses the level-scoped flow
// and shows a LevelUnlockModal when 20 correct answers are reached.
//
// A12: Decomposed into sub-components:
//   - StudyCompletionScreen (results view)
//   - StudyProgressHeader  (progress bar + counter)
//   - AIDeepDiveSection    (explanation overlay)
//   - StudyNavBar          (prev/next navigation)
//   - CoinToast            (floating "+coins" indicator)

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGlobalUI } from '../../src/contexts/GlobalUIContext';

import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { ErrorState } from '../../src/components/ui/ErrorState';
import { FlashCard } from '../../src/components/Flashcard';
import { LevelUnlockModal } from '../../src/components/LevelUnlockModal';
import {
  StudyCompletionScreen,
  StudyProgressHeader,
  AIDeepDiveSection,
  StudyNavBar,
  CoinToast,
} from '../../src/components/study';
import { RouteErrorBoundary } from '../../src/components/ui/RouteErrorBoundary';
import { CardErrorBoundary } from '../../src/components/ui/CardErrorBoundary';
import { useDeckCards } from '../../src/hooks/useDecks';
import { useLevelCards } from '../../src/hooks/useLevelCards';
import { useRecordCompletion } from '../../src/hooks/useProgress';
import { useRecordLevelAnswer } from '../../src/hooks/useSubjects';
import { useStudySession } from '../../src/hooks/useStudySession';
import { useSubmitTournamentScore } from '../../src/hooks/useTournaments';
import { useExamsUsedToday } from '../../src/hooks/useExamsUsedToday';
import { loadStudyState, saveStudyState, clearStudyState } from '../../src/services/studyStateStorage';
import type { Flashcard, SubjectLevel } from '@kd/shared';

// Answer state per card
type CardAnswer = boolean | 'skipped' | undefined;

/** Tracks which option (A/B/C/D → original optionId) was selected per card index. */
type SelectedOptionMap = Record<number, string>;

/** Fisher-Yates (Knuth) shuffle — returns a new array. */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// In-memory cache to preserve study state if the user navigates away temporarily.
// This is the fast path; AsyncStorage is the durable path (survives app kill).
const studyStateCache: Record<string, {
  currentIdx: number;
  answered: CardAnswer[];
  sessionCoinsEarned: number;
}> = {};

// ─── Screen ───────────────────────────────────────────────────

export default function FlashcardStudyScreen() {

  const router = useRouter();
  const { showAlert } = useGlobalUI();
  const { id, decks, title, examId, subjectId, level, topicSlug, tournamentId } =
    useLocalSearchParams<{
      id: string;
      decks?: string;
      title?: string;
      examId?: string;
      subjectId?: string;
      level?: string;
      topicSlug?: string;
      tournamentId?: string;
    }>();

  const isLevelMode = !!(examId && subjectId && level && topicSlug);

  // ─── Data fetching ────────────────────────────────────────
  const {
    data: levelData, isLoading: levelLoading,
    isError: levelError, refetch: refetchLevel,
  } = useLevelCards(
    isLevelMode ? examId : undefined,
    isLevelMode ? subjectId : undefined,
    isLevelMode ? level : undefined,
    isLevelMode ? topicSlug : undefined,
  );

  const {
    data: deckCards, isLoading: deckLoading,
    isError: deckIsError, refetch: refetchDeck,
  } = useDeckCards(
    isLevelMode ? '' : id,
    isLevelMode ? undefined : decks,
  );

  const levelCards = levelData?.cards ?? null;
  const levelDeckId = levelData?.deckId ?? null;

  const rawCards = isLevelMode ? levelCards : deckCards;
  const isLoading = isLevelMode ? levelLoading : deckLoading;
  const isError = isLevelMode ? levelError : deckIsError;
  const refetch = isLevelMode ? refetchLevel : refetchDeck;

  // ─── Shuffle cards on each session / "Study Again" ────────
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const cards = useMemo(
    () => (rawCards ? shuffleArray(rawCards) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawCards, shuffleSeed],
  );

  // ─── Effective deckId ─────────────────────────────────────
  const effectiveDeckId = useMemo(() => {
    if (isLevelMode) return levelDeckId;
    return id === 'adaptive' ? null : id;
  }, [isLevelMode, levelDeckId, id]);

  // ─── Progress recording ───────────────────────────────────
  const recordCompletion = useRecordCompletion();
  const recordLevelAnswer = useRecordLevelAnswer();

  const [sessionStarted] = useState(() => new Date().toISOString());
  const session = useStudySession({
    deckId: effectiveDeckId,
    startedAt: sessionStarted,
  });

  // ─── Tournament score submission (FIX H1: must be above early returns) ──
  const submitTournamentScore = useSubmitTournamentScore();
  const tournamentScoreSubmittedRef = useRef(false);

  // ─── Daily limit tracking ─────────────────────────────────
  const { incrementExamsUsedToday } = useExamsUsedToday();
  const dailyLimitIncrementedRef = useRef(false);
  useEffect(() => {
    if (!isLoading && cards && cards.length > 0 && !dailyLimitIncrementedRef.current) {
      dailyLimitIncrementedRef.current = true;
      void incrementExamsUsedToday();
    }
  }, [isLoading, cards, incrementExamsUsedToday]);

  // ─── Card navigation state ────────────────────────────────
  const cacheKey = isLevelMode ? `${examId}-${subjectId}-${level}-${topicSlug}` : id;

  const [currentIdx, setCurrentIdx] = useState(() => studyStateCache[cacheKey]?.currentIdx ?? 0);
  const [answered, setAnswered] = useState<CardAnswer[]>(() => studyStateCache[cacheKey]?.answered ?? []);
  const [sessionCoinsEarned, setSessionCoinsEarned] = useState(() => studyStateCache[cacheKey]?.sessionCoinsEarned ?? 0);
  const [selectedOptionIds, setSelectedOptionIds] = useState<SelectedOptionMap>({});
  // Whether we've attempted to restore state from AsyncStorage yet
  const [restoredFromStorage, setRestoredFromStorage] = useState(!!studyStateCache[cacheKey]);

  // ─── Restore persisted state from AsyncStorage on mount ───
  useEffect(() => {
    // Skip if the in-memory cache already had data (fast-path for back-navigation)
    if (studyStateCache[cacheKey]) {
      setRestoredFromStorage(true);
      return;
    }
    let cancelled = false;
    loadStudyState(cacheKey).then((saved) => {
      if (cancelled) return;
      if (saved && saved.answered.length > 0) {
        setCurrentIdx(saved.currentIdx);
        setAnswered(saved.answered);
        setSessionCoinsEarned(saved.sessionCoinsEarned);
      }
      setRestoredFromStorage(true);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // ─── Sync in-memory cache + persist to AsyncStorage on change ─
  useEffect(() => {
    studyStateCache[cacheKey] = {
      currentIdx,
      answered,
      sessionCoinsEarned,
    };
    // Only persist after initial restore is complete to avoid overwriting
    if (restoredFromStorage) {
      void saveStudyState(cacheKey, {
        currentIdx,
        answered,
        sessionCoinsEarned,
        totalCards: cards?.length ?? 0,
      });
    }
  }, [cacheKey, currentIdx, answered, sessionCoinsEarned, restoredFromStorage, cards?.length]);
  const [unlockModal, setUnlockModal] = useState<{
    visible: boolean;
    newLevel: SubjectLevel | null;
    coinsEarned?: number;
  }>({ visible: false, newLevel: null });

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

  // FIX PF5: Memoize filtered counts to avoid O(n) scan on every render
  const { correctCount, answeredCount, incorrectCount, skippedCount, isComplete } = useMemo(() => {
    const correct = answered.filter((a) => a === true).length;
    const answeredTotal = answered.filter((a) => a !== undefined).length;
    const incorrect = answered.filter((a) => a === false).length;
    const skipped = answered.filter((a) => a === 'skipped').length;
    return {
      correctCount: correct,
      answeredCount: answeredTotal,
      incorrectCount: incorrect,
      skippedCount: skipped,
      isComplete: total > 0 && answeredTotal === total,
    };
  }, [answered, total]);

  // ─── Answer handler ───────────────────────────────────────
  const LETTER_KEYS_ANSWER = ['A', 'B', 'C', 'D'] as const;
  const handleAnswer = useCallback(async (correct: boolean, selectedKey: 'A' | 'B' | 'C' | 'D') => {
    if (!card) return;

    const responseTimeMs = Math.max(1, Date.now() - cardStartTimeRef.current);
    const cardDeckId = isLevelMode
      ? (levelDeckId ?? card.deckId ?? id)
      : (id === 'adaptive' ? (card.deckId ?? id) : id);
    session.recordAnswer(correct, card.id, responseTimeMs);

    // Resolve the letter key (A/B/C/D) back to the original option ID
    const selectedOptionIndex = LETTER_KEYS_ANSWER.indexOf(selectedKey);
    const selectedAnswerId = (card.options ?? [])[selectedOptionIndex]?.id ?? '';

    if (isLevelMode && examId && subjectId && level && topicSlug && levelDeckId) {
      try {
        const result = await recordLevelAnswer.mutateAsync({
          examId,
          subjectId,
          topicSlug,
          level: level as SubjectLevel,
          cardId: card.id,
          selectedAnswerId,
          responseTimeMs,
        });
        if (result.coinsEarned > 0) {
          showCoinToast(result.coinsEarned);
          setSessionCoinsEarned((prev) => prev + result.coinsEarned);
        }
        if (result.justUnlocked && result.newlyUnlockedLevel) {
          setUnlockModal({ visible: true, newLevel: result.newlyUnlockedLevel, coinsEarned: result.coinsEarned });
        }
      } catch {
        // best-effort
      }
    } else {
      recordCompletion.mutate({
        deckId: cardDeckId,
        cardId: card.id,
        correct,
        responseTimeMs,
      });
    }

    setAnswered((prev) => {
      const next = [...prev];
      next[currentIdx] = correct;
      return next;
    });

    // Track which option was selected for targeted feedback
    setSelectedOptionIds((prev) => ({ ...prev, [currentIdx]: selectedAnswerId }));
  }, [card, currentIdx, examId, id, isLevelMode, level, levelDeckId, recordCompletion, recordLevelAnswer, session, showCoinToast, subjectId, topicSlug]);

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

  // ─── Flush on completion (FIX B1: must be above early returns) ──
  // FIX H2: submitTournamentScore removed from deps — it's an unstable mutation
  // object that would cause infinite re-runs. The ref guard prevents duplicates.
  useEffect(() => {
    if (isComplete) {
      session.flush(true);
      // Submit tournament score if playing in tournament mode
      if (tournamentId && !tournamentScoreSubmittedRef.current) {
        tournamentScoreSubmittedRef.current = true;
        submitTournamentScore.mutate({
          id: tournamentId,
          score: correctCount,
          correct: correctCount,
          total,
        });
      }
    }
  }, [isComplete, session, tournamentId, correctCount, total]);

  // FIX U4: Confirm before leaving a session with progress
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
  if (isLoading || !restoredFromStorage) {
    return (
      <ScreenWrapper>
        <Header showBack title={title ?? 'Study'} />
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
        <Header showBack title={title ?? 'Study'} />
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
        <Header showBack title={title ?? 'Study'} />
        <ErrorState
          message="No cards in this deck yet. Check back soon!"
          icon="albums-outline"
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
        title={title ?? 'Study'}
        total={total}
        correctCount={correctCount}
        incorrectCount={incorrectCount}
        skippedCount={skippedCount}
        sessionCoinsEarned={sessionCoinsEarned}
        onStudyAgain={() => {
          setCurrentIdx(0);
          setAnswered([]);
          setSessionCoinsEarned(0);
          setSelectedOptionIds({});
          setShuffleSeed((s) => s + 1); // re-shuffle cards
          delete studyStateCache[cacheKey];
          void clearStudyState(cacheKey);
        }}
      />
    );
  }

  if (!card) return null;

  // Map options to letter keys for the FlashCard component
  const LETTER_KEYS = ['A', 'B', 'C', 'D'] as const;
  const cardOptions = (card.options ?? []).slice(0, 4).map((opt, i) => ({
    key: LETTER_KEYS[i]!,
    text: opt.text,
  }));
  const correctLetterKey = LETTER_KEYS[
    (card.options ?? []).findIndex((o) => o.id === card.correctAnswerId)
  ] ?? LETTER_KEYS[0] ?? 'A';

  // ─── Active study view ────────────────────────────────────
  return (
    <RouteErrorBoundary fallbackTitle="Session Interrupted">
    <ScreenWrapper>
      <Header showBack title={title ?? 'Study'} onBack={handleBack} />

      <StudyProgressHeader
        currentIdx={currentIdx}
        total={total}
        correctCount={correctCount}
      />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        {/* CardErrorBoundary catches render crashes from a single card
            (e.g. malformed data, corrupt LaTeX) and lets the user skip it
            instead of crashing the entire session. */}
        <CardErrorBoundary onSkip={handleSkip}>
          {/* Flashcard */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'] }}>
            <FlashCard
              key={card.id}
              question={card.question}
              options={cardOptions}
              correctKey={correctLetterKey}
              explanation={card.explanation ?? ''}
              imageUrl={card.imageUrl}
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
      />

      {/* Level unlock modal */}
      {unlockModal.newLevel && (
        <LevelUnlockModal
          visible={unlockModal.visible}
          newLevel={unlockModal.newLevel}
          onKeepStudying={() => setUnlockModal({ visible: false, newLevel: null })}
          onNextLevel={() => {
            setUnlockModal({ visible: false, newLevel: null });
            router.back();
          }}
        />
      )}

      {/* Coin toast */}
      {coinToast && (
        <CoinToast amount={coinToast.amount} animationKey={coinToast.key} />
      )}
    </ScreenWrapper>
    </RouteErrorBoundary>
  );
}
