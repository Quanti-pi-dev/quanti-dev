// ─── AIDeepDiveSection ──────────────────────────────────────
// Contextual AI explanation card shown after answering a flashcard.
//
// Behaviour:
//   - Correct / skipped: explanation auto-expands immediately.
//   - Incorrect: shows a prominent CTA; user taps to request explanation.
//   - On tap (if ai_explanations gate is open): calls Gemini live via
//     POST /ai/explain and shows the response. Falls back to seed text.
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
import { useExplainCard } from '../../hooks/useAI';
import { useSubscriptionGate } from '../../hooks/useSubscriptionGate';

type CardAnswer = boolean | 'skipped' | undefined;

interface AIDeepDiveSectionProps {
  answer: CardAnswer;
  /** Seed explanation from the flashcard document (may be empty). */
  explanation: string;
  /** Resets visibility when the card index changes. */
  cardIndex: number;
  /** The flashcard ID — used to fetch a live Gemini explanation. */
  cardId: string;
}

export const AIDeepDiveSection = React.memo(function AIDeepDiveSection({
  answer,
  explanation,
  cardIndex,
  cardId,
}: AIDeepDiveSectionProps) {
  const { theme } = useTheme();
  const { canUseFeature } = useSubscriptionGate();
  const hasAIExplanations = canUseFeature('ai_explanations');

  const [showDeepDive, setShowDeepDive] = useState(false);
  const [liveExplanation, setLiveExplanation] = useState<string | null>(null);

  // Per-session cache: cardId → explanation text
  const cacheRef = useRef<Map<string, string>>(new Map());

  const explainCard = useExplainCard();

  // Reset on card change
  useEffect(() => {
    setShowDeepDive(false);
    setLiveExplanation(null);
  }, [cardIndex]);

  // Auto-expand for correct / skipped answers
  useEffect(() => {
    if (answer === true || answer === 'skipped') {
      setShowDeepDive(true);
    }
  }, [answer]);

  // Fetch live explanation from Gemini
  const fetchExplanation = useCallback(async () => {
    setShowDeepDive(true);

    // Serve from session cache if available
    const cached = cacheRef.current.get(cardId);
    if (cached) {
      setLiveExplanation(cached);
      return;
    }

    if (hasAIExplanations && cardId) {
      try {
        const text = await explainCard.mutateAsync(cardId);
        if (text) {
          cacheRef.current.set(cardId, text);
          setLiveExplanation(text);
        }
      } catch {
        // Fall through to seed explanation
      }
    }
  }, [cardId, hasAIExplanations, explainCard]);

  if (answer === undefined) return null;

  const displayText = liveExplanation ?? explanation;
  const isLoadingLive = explainCard.isPending;
  const isOpen = showDeepDive;

  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
      {/* Incorrect + not expanded: prominent CTA */}
      {answer === false && !showDeepDive && (
        <Animated.View entering={FadeInDown.delay(700).duration(320)}>
          <TouchableOpacity
            onPress={fetchExplanation}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Show AI explanation for this answer"
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
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
                    backgroundColor: '#6366F118',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="sparkles" size={18} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography variant="label" color="#6366F1">
                    AI Deep Dive
                  </Typography>
                  <Typography variant="caption" color={theme.textTertiary}>
                    {hasAIExplanations
                      ? 'Tap to get a Gemini-powered explanation'
                      : 'Tap to see the explanation'}
                  </Typography>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6366F1" />
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
              borderColor: '#6366F130',
            }}
          >
            {/* Header stripe */}
            <LinearGradient
              colors={['#6366F1CC', '#8B5CF6CC']}
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
              <Ionicons name="sparkles" size={14} color="#FFF" />
              <Typography variant="captionBold" color="#FFF" style={{ fontSize: 11, letterSpacing: 0.4, flex: 1 }}>
                {hasAIExplanations && liveExplanation ? 'Gemini Explanation' : 'AI Deep Dive'}
              </Typography>
              {hasAIExplanations && liveExplanation && (
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
                backgroundColor: '#6366F108',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                minHeight: 60,
                justifyContent: 'center',
              }}
            >
              {isLoadingLive ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Typography variant="bodySmall" color={theme.textTertiary}>
                    Generating explanation…
                  </Typography>
                </View>
              ) : (
                <Typography
                  variant="bodySmall"
                  color={theme.textSecondary}
                  style={{ lineHeight: 20 }}
                >
                  {displayText || 'No additional explanation is available for this card.'}
                </Typography>
              )}
            </View>

            {/* Re-generate button (only for ai_explanations users) */}
            {hasAIExplanations && !isLoadingLive && (
              <TouchableOpacity
                onPress={async () => {
                  // Force-refresh: clear cache entry and re-fetch
                  cacheRef.current.delete(cardId);
                  setLiveExplanation(null);
                  try {
                    const text = await explainCard.mutateAsync(cardId);
                    if (text) {
                      cacheRef.current.set(cardId, text);
                      setLiveExplanation(text);
                    }
                  } catch {
                    // ignore
                  }
                }}
                style={{
                  backgroundColor: '#6366F108',
                  borderTopWidth: 1,
                  borderTopColor: '#6366F120',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <Ionicons name="refresh-outline" size={12} color="#6366F1" />
                <Typography variant="caption" color="#6366F1">
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
