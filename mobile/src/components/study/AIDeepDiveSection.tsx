// ─── AIDeepDiveSection ──────────────────────────────────────
// Contextual AI explanation card shown after answering a flashcard.
//
// Behaviour:
//   - Always starts in standby (CTA button visible) regardless of answer.
//   - User must explicitly tap the CTA to expand and generate an explanation.
//   - On tap (if ai_explanations gate is open): calls Gemini live via
//     POST /ai/explain and shows the response. Falls back to seed text.
//   - When the student answered WRONG and selectedOptionId is available:
//     calls POST /ai/explain-wrong for targeted misconception-aware feedback.
//   - Explanation is cached per-card-per-session in a local Map ref
//     to avoid redundant API calls on revisit.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { RichContent } from '../ui/RichContent';
import { useExplainCard, useExplainWrong } from '../../hooks/useAI';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';
import type { TargetedFeedbackResponse } from '../../services/api-contracts';

type CardAnswer = boolean | 'skipped' | undefined;

interface AIDeepDiveSectionProps {
  answer: CardAnswer;
  /** Seed explanation from the flashcard document (may be empty). */
  explanation: string;
  /** Resets visibility when the card index changes. */
  cardIndex: number;
  /** The flashcard ID — used to fetch a live Gemini explanation. */
  cardId: string;
  /** The option ID the student selected (for targeted feedback on wrong answers). */
  selectedOptionId?: string;
}

export const AIDeepDiveSection = React.memo(function AIDeepDiveSection({
  answer,
  explanation,
  cardIndex,
  cardId,
  selectedOptionId,
}: AIDeepDiveSectionProps) {
  const { theme } = useTheme();
  const { canUseFeature } = useSubscriptionGate();
  const hasAIExplanations = canUseFeature('ai_explanations');

  const [showDeepDive, setShowDeepDive] = useState(false);
  const [liveExplanation, setLiveExplanation] = useState<string | null>(null);
  const [targetedFeedback, setTargetedFeedback] = useState<TargetedFeedbackResponse | null>(null);

  // Per-session cache: cardId → explanation text
  const cacheRef = useRef<Map<string, string>>(new Map());
  const targetedCacheRef = useRef<Map<string, TargetedFeedbackResponse>>(new Map());

  const explainCard = useExplainCard();
  const explainWrong = useExplainWrong();

  // Stable ref so mutateAsync never appears in useCallback/useEffect deps,
  // preventing the infinite loop: mutation fires → isPending changes →
  // new explainCard object → fetchExplanation rebuilt → useEffect fires again.
  const mutateAsyncRef = useRef(explainCard.mutateAsync);
  useEffect(() => { mutateAsyncRef.current = explainCard.mutateAsync; });

  const mutateWrongRef = useRef(explainWrong.mutateAsync);
  useEffect(() => { mutateWrongRef.current = explainWrong.mutateAsync; });

  // Reset on card change
  useEffect(() => {
    setShowDeepDive(false);
    setLiveExplanation(null);
    setTargetedFeedback(null);
  }, [cardIndex]);

  // The student answered wrong and we have their selected option
  const isWrongAnswer = answer === false && !!selectedOptionId;

  // Fetch live explanation from Gemini (premium) or reveal seed explanation (free).
  // For wrong answers, tries targeted misconception-aware feedback first.
  const fetchExplanation = useCallback(async () => {
    setShowDeepDive(true);

    // Free users: just reveal the seed explanation — no API call needed.
    if (!hasAIExplanations) return;

    // ── Targeted feedback for wrong answers (all users with AI access) ──
    if (isWrongAnswer && selectedOptionId) {
      // Check session cache
      const cachedTargeted = targetedCacheRef.current.get(`${cardId}:${selectedOptionId}`);
      if (cachedTargeted) {
        setTargetedFeedback(cachedTargeted);
        return;
      }

      try {
        const feedback = await mutateWrongRef.current({ cardId, selectedOptionId });
        if (feedback) {
          targetedCacheRef.current.set(`${cardId}:${selectedOptionId}`, feedback);
          setTargetedFeedback(feedback);
          return;
        }
      } catch {
        // Fall through to generic explanation
      }
    }

    // ── Generic explanation (correct answers or targeted failed) ──
    const cached = cacheRef.current.get(cardId);
    if (cached) {
      setLiveExplanation(cached);
      return;
    }

    if (cardId) {
      try {
        const text = await mutateAsyncRef.current(cardId);
        // Guard against empty string — a blank response is not a valid AI explanation.
        if (text && text.trim().length > 0) {
          cacheRef.current.set(cardId, text);
          setLiveExplanation(text);
        }
      } catch {
        // Fall through to seed explanation on network / quota errors
      }
    }
  }, [cardId, hasAIExplanations, isWrongAnswer, selectedOptionId]);

  if (answer === undefined) return null;

  const displayText = liveExplanation ?? explanation;
  const isLoadingLive = explainCard.isPending || explainWrong.isPending;
  const isOpen = showDeepDive;
  const hasTargeted = !!targetedFeedback;

  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
      {/* Standby CTA — shown for all answer states until user taps */}
      {!showDeepDive && (
        <Animated.View entering={FadeInDown.duration(320)}>
          <TouchableOpacity
            onPress={fetchExplanation}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Show AI explanation for this answer"
          >
            <LinearGradient
              colors={isWrongAnswer ? ['#EF4444', '#F97316'] : ['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: radius.xl, padding: 1.5 }}
            >
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: radius.xl - 1,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 36, height: 36, borderRadius: radius.full,
                    backgroundColor: isWrongAnswer ? '#EF444418' : '#6366F118',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={isWrongAnswer ? 'school' : 'sparkles'}
                    size={18}
                    color={isWrongAnswer ? '#EF4444' : '#6366F1'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography variant="label" color={isWrongAnswer ? '#EF4444' : '#6366F1'}>
                    {isWrongAnswer ? 'Why Was I Wrong?' : 'AI Deep Dive'}
                  </Typography>
                  <Typography variant="caption" color={theme.textTertiary}>
                    {isWrongAnswer
                      ? 'Tap to understand your specific mistake'
                      : hasAIExplanations
                        ? 'Tap to get a Gemini-powered explanation'
                        : 'Tap to see the explanation'}
                  </Typography>
                </View>
                <Ionicons name="chevron-forward" size={16} color={isWrongAnswer ? '#EF4444' : '#6366F1'} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Expanded explanation card */}
      {isOpen && (
        <Animated.View entering={FadeInUp.duration(280)}>
          <View
            style={{
              borderRadius: radius.xl,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: hasTargeted ? '#EF444430' : '#6366F130',
            }}
          >
            {/* Header stripe */}
            <LinearGradient
              colors={hasTargeted ? ['#EF4444CC', '#F97316CC'] : ['#6366F1CC', '#8B5CF6CC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <Ionicons
                name={hasTargeted ? 'school' : 'sparkles'}
                size={14}
                color="#FFF"
              />
              <Typography variant="captionBold" color="#FFF" style={{ fontSize: 11, letterSpacing: 0.4, flex: 1 }}>
                {hasTargeted ? 'Your Mistake Explained' : hasAIExplanations && liveExplanation ? 'Gemini Explanation' : 'AI Deep Dive'}
              </Typography>
              {hasAIExplanations && (liveExplanation || hasTargeted) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="logo-google" size={10} color="rgba(255,255,255,0.7)" />
                  <Typography variant="caption" color="rgba(255,255,255,0.7)" style={{ fontSize: 9 }}>
                    Powered by Gemini
                  </Typography>
                </View>
              )}
            </LinearGradient>

            {/* Body */}
            <View
              style={{
                backgroundColor: hasTargeted ? '#EF444408' : '#6366F108',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                minHeight: 60,
                justifyContent: 'center',
              }}
            >
              {isLoadingLive ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <ActivityIndicator size="small" color={hasTargeted ? '#EF4444' : '#6366F1'} />
                  <Typography variant="bodySmall" color={theme.textTertiary}>
                    {isWrongAnswer ? 'Analyzing your mistake…' : 'Generating explanation…'}
                  </Typography>
                </View>
              ) : hasTargeted && targetedFeedback ? (
                // ── Targeted misconception feedback ──────────────
                <View style={{ gap: spacing.sm }}>
                  {/* Misconception callout */}
                  <View
                    style={{
                      backgroundColor: '#EF444412',
                      borderRadius: radius.lg,
                      padding: spacing.sm,
                      borderLeftWidth: 3,
                      borderLeftColor: '#EF4444',
                    }}
                  >
                    <Typography variant="captionBold" color="#EF4444" style={{ marginBottom: 2 }}>
                      What went wrong
                    </Typography>
                    <Typography variant="bodySmall" color={theme.textSecondary}>
                      {targetedFeedback.misconception}
                    </Typography>
                  </View>

                  {/* Targeted explanation */}
                  <RichContent variant="bodySmall" color={theme.textSecondary}>
                    {targetedFeedback.explanation}
                  </RichContent>

                  {/* Memory trick */}
                  {targetedFeedback.memoryTrick && (
                    <View
                      style={{
                        backgroundColor: '#10B98112',
                        borderRadius: radius.lg,
                        padding: spacing.sm,
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: spacing.xs,
                      }}
                    >
                      <Typography style={{ fontSize: 14 }}>💡</Typography>
                      <View style={{ flex: 1 }}>
                        <Typography variant="captionBold" color="#10B981">
                          Memory Trick
                        </Typography>
                        <Typography variant="bodySmall" color={theme.textSecondary}>
                          {targetedFeedback.memoryTrick}
                        </Typography>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                // ── Generic explanation ──────────────────────────
                <RichContent
                  variant="bodySmall"
                  color={theme.textSecondary}
                >
                  {displayText || 'No additional explanation is available for this card.'}
                </RichContent>
              )}
            </View>

            {/* Re-generate button (only for ai_explanations users) */}
            {hasAIExplanations && !isLoadingLive && (
              <TouchableOpacity
                onPress={async () => {
                  // Force-refresh: clear cache entry and re-fetch
                  // Keep old text visible during refetch to avoid blank flash
                  cacheRef.current.delete(cardId);
                  if (selectedOptionId) {
                    targetedCacheRef.current.delete(`${cardId}:${selectedOptionId}`);
                  }
                  setTargetedFeedback(null);
                  setLiveExplanation(null);

                  // Re-fetch
                  if (isWrongAnswer && selectedOptionId) {
                    try {
                      const feedback = await mutateWrongRef.current({ cardId, selectedOptionId });
                      if (feedback) {
                        targetedCacheRef.current.set(`${cardId}:${selectedOptionId}`, feedback);
                        setTargetedFeedback(feedback);
                        return;
                      }
                    } catch {
                      // Fall through
                    }
                  }

                  try {
                    const text = await mutateAsyncRef.current(cardId);
                    if (text && text.trim().length > 0) {
                      cacheRef.current.set(cardId, text);
                      setLiveExplanation(text);
                    }
                  } catch {
                    // Keep existing explanation on failure
                  }
                }}
                style={{
                  backgroundColor: hasTargeted ? '#EF444408' : '#6366F108',
                  borderTopWidth: 1,
                  borderTopColor: hasTargeted ? '#EF444420' : '#6366F120',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <Ionicons name="refresh-outline" size={12} color={hasTargeted ? '#EF4444' : '#6366F1'} />
                <Typography variant="caption" color={hasTargeted ? '#EF4444' : '#6366F1'}>
                  Regenerate
                </Typography>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
});
