// ─── FlashCard ────────────────────────────────────────────────
// Two-sided MCQ flashcard with:
// - Front: question + 4 MCQ options + optional skip button
// - Back: correct answer highlight + explanation
// - 3D Y-axis flip animation (Reanimated)
// - Correct (green) / Incorrect (red) / Skipped (blue) border glow pulse
//
// Audit fixes:
// - 4.2: onSkip prop + skip button
// - 3.4: Typography for all text (no raw Text elements)
// - 2.2: Memoized card dimensions

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  useWindowDimensions,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { radius, spacing, typography, shadows } from '../theme/tokens';
import { Typography } from './ui/Typography';
import { useGlowPulse, TIMING_FLIP } from '../theme/animations';

// ─── Types ────────────────────────────────────────────────────

interface Option {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

interface FlashCardProps {
  question: string;
  options: Option[];
  correctKey: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  style?: ViewStyle;
  onAnswer?: (correct: boolean, selectedKey: 'A' | 'B' | 'C' | 'D') => void;
  onSkip?: () => void;
}

type AnswerState = 'unanswered' | 'correct' | 'incorrect' | 'skipped';

// ─── Component ───────────────────────────────────────────────

export function FlashCard({
  question,
  options,
  correctKey,
  explanation,
  style,
  onAnswer,
  onSkip,
}: FlashCardProps) {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  // FIX 2.2: Memoize card dimensions
  const { cardWidth, cardHeight } = useMemo(() => ({
    cardWidth: windowWidth - spacing['3xl'] * 2,
    cardHeight: (windowWidth - spacing['3xl'] * 2) * 1.35,
  }), [windowWidth]);

  const [selectedKey, setSelectedKey] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered');

  // Store timeout id to clear on unmount
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    };
  }, []);

  const flip = useSharedValue(0);
  const { glowStyle, pulse } = useGlowPulse();

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: 'hidden' as const,
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    backfaceVisibility: 'hidden' as const,
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  }));

  const glowColor = answerState === 'correct' ? theme.glowCorrect
    : answerState === 'incorrect' ? theme.glowWrong
    : answerState === 'skipped' ? theme.glowSkip
    : 'transparent';

  const handleFlipToBack = useCallback(() => {
    flip.value = withTiming(1, TIMING_FLIP);
    pulse();
  }, [flip, pulse]);

  const handleSelectOption = (key: 'A' | 'B' | 'C' | 'D') => {
    if (answerState !== 'unanswered') return;

    setSelectedKey(key);
    const correct = key === correctKey;
    setAnswerState(correct ? 'correct' : 'incorrect');
    Haptics.notificationAsync(
      correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );

    // Brief pause then flip — store ref so we can clear on unmount
    flipTimerRef.current = setTimeout(() => handleFlipToBack(), 600);
    onAnswer?.(correct, key);
  };

  // FIX 4.2: Skip handler
  const handleSkip = () => {
    if (answerState !== 'unanswered') return;
    setAnswerState('skipped');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flipTimerRef.current = setTimeout(() => handleFlipToBack(), 400);
    onSkip?.();
  };

  const optionStyles = (key: 'A' | 'B' | 'C' | 'D') => {
    const isSelected = selectedKey === key;
    const isCorrect = key === correctKey;

    let bg = theme.cardAlt;
    let border: string = theme.border;
    let textColor: string = theme.text;

    if (answerState === 'skipped' && isCorrect) {
      // Highlight correct answer when skipped
      bg = theme.successLight;
      border = theme.glowCorrect;
      textColor = theme.success;
    } else if (isSelected && answerState === 'correct') {
      bg = theme.successLight;
      border = theme.glowCorrect;
      textColor = theme.success;
    } else if (isSelected && answerState === 'incorrect') {
      bg = theme.errorLight;
      border = theme.glowWrong;
      textColor = theme.error;
    }

    return { bg, border, textColor };
  };

  return (
    <View style={[{ width: cardWidth, height: cardHeight }, style]}>
      {/* Glow border */}
      <Animated.View
        style={[
          glowStyle,
          {
            position: 'absolute',
            inset: -4,
            borderRadius: radius['2xl'] + 4,
            borderWidth: 3,
            borderColor: glowColor,
            zIndex: 10,
          },
        ]}
        pointerEvents="none"
      />

      {/* Front */}
      <Animated.View
        pointerEvents={answerState === 'unanswered' ? 'auto' : 'none'}
        style={[
          frontStyle,
          {
            width: '100%',
            height: '100%',
            backgroundColor: theme.card,
            borderRadius: radius['2xl'],
            padding: spacing.xl,
            ...shadows.lg,
            shadowColor: theme.shadow,
            gap: spacing.base,
            borderWidth: 1,
            borderColor: theme.border,
          },
        ]}
      >
        {/* Question */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Typography
            variant="h4"
            align="center"
            style={{ lineHeight: typography.lg * 1.4 }}
          >
            {question}
          </Typography>
        </View>

        {/* Options */}
        <View style={{ gap: spacing.sm }}>
          {options?.map((opt) => {
            const s = optionStyles(opt.key);
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => handleSelectOption(opt.key)}
                disabled={answerState !== 'unanswered'}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: s.bg,
                  borderRadius: radius.lg,
                  borderWidth: 1.5,
                  borderColor: s.border,
                  padding: spacing.md,
                  gap: spacing.sm,
                }}
              >
                {/* Key bubble */}
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.full,
                    backgroundColor: theme.primaryMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="caption" color={theme.primary} style={{ fontWeight: '700' }}>
                    {opt.key}
                  </Typography>
                </View>

                <Typography variant="bodySmall" color={s.textColor} style={{ flex: 1 }}>
                  {opt.text}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Skip button (FIX 4.2) */}
        {onSkip && answerState === 'unanswered' && (
          <TouchableOpacity
            onPress={handleSkip}
            style={{
              alignSelf: 'center',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.xs,
            }}
          >
            <Typography variant="caption" color={theme.textTertiary}>
              Skip this card →
            </Typography>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Back */}
      <Animated.View
        pointerEvents={answerState === 'unanswered' ? 'none' : 'auto'}
        style={[
          backStyle,
          {
            backgroundColor: theme.card,
            borderRadius: radius['2xl'],
            padding: spacing.xl,
            ...shadows.lg,
            shadowColor: theme.shadow,
            gap: spacing.lg,
            borderWidth: 1,
            borderColor: answerState === 'correct' ? theme.glowCorrect
              : answerState === 'skipped' ? theme.glowSkip
              : theme.glowWrong,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        {/* Result indicator */}
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.full,
            backgroundColor: answerState === 'correct' ? theme.successLight
              : answerState === 'skipped' ? theme.primaryMuted
              : theme.errorLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="h2">
            {answerState === 'correct' ? '✓' : answerState === 'skipped' ? '→' : '✗'}
          </Typography>
        </View>

        <Typography
          variant="h3"
          color={answerState === 'correct' ? theme.success
            : answerState === 'skipped' ? theme.skip
            : theme.error}
          align="center"
        >
          {answerState === 'correct' ? 'Correct!' : answerState === 'skipped' ? 'Skipped' : 'Not quite'}
        </Typography>

        <View
          style={{
            backgroundColor: theme.successLight,
            borderRadius: radius.lg,
            padding: spacing.md,
            borderLeftWidth: 3,
            borderLeftColor: theme.success,
            width: '100%',
          }}
        >
          <Typography variant="label" color={theme.success} style={{ marginBottom: 4 }}>
            Answer: {correctKey}
          </Typography>
          {explanation && (
            <Typography variant="bodySmall" color={theme.textSecondary} style={{ lineHeight: typography.sm * 1.5 }}>
              {explanation}
            </Typography>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
