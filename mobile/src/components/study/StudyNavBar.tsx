// ─── StudyNavBar ────────────────────────────────────────────
// Prev / counter / Next navigation bar for flashcard study.
// Extracted from FlashcardStudyScreen (FIX A12).

import React, { useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

interface StudyNavBarProps {
  currentIdx: number;
  total: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  isCurrentAnswered: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export const StudyNavBar = React.memo(function StudyNavBar({
  currentIdx,
  total,
  canGoPrev,
  canGoNext,
  isCurrentAnswered,
  onPrev,
  onNext,
}: StudyNavBarProps) {
  const { theme } = useTheme();
  const nextEnabled = canGoNext && isCurrentAnswered;

  const handlePrev = useCallback(() => {
    if (!canGoPrev) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPrev();
  }, [canGoPrev, onPrev]);

  const handleNext = useCallback(() => {
    if (!nextEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNext();
  }, [nextEnabled, onNext]);

  return (
    <View
      style={{
        flexDirection: 'row', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingBottom: spacing.xl,
        gap: spacing.md, alignItems: 'center',
      }}
    >
      <TouchableOpacity
        onPress={handlePrev} disabled={!canGoPrev}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Previous card"
        accessibilityState={{ disabled: !canGoPrev }}
        style={{
          width: 52, height: 52, borderRadius: radius.full,
          backgroundColor: theme.cardAlt, borderWidth: 1.5, borderColor: theme.border,
          alignItems: 'center', justifyContent: 'center', opacity: canGoPrev ? 1 : 0.35,
        }}
      >
        <Ionicons name="arrow-back" size={22} color={theme.text} />
      </TouchableOpacity>

      <Typography variant="label" color={theme.textTertiary}>
        {currentIdx + 1} / {total}
      </Typography>

      <TouchableOpacity
        onPress={handleNext}
        disabled={!nextEnabled}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={nextEnabled ? 'Next card' : 'Answer this card to continue'}
        accessibilityState={{ disabled: !nextEnabled }}
        style={{
          width: 52, height: 52, borderRadius: radius.full,
          backgroundColor: nextEnabled ? theme.primary : theme.cardAlt,
          borderWidth: 1.5,
          borderColor: nextEnabled ? theme.primary : theme.border,
          alignItems: 'center', justifyContent: 'center',
          opacity: nextEnabled ? 1 : 0.35,
        }}
      >
        <Ionicons
          name="arrow-forward" size={22}
          color={nextEnabled ? theme.buttonPrimaryText : theme.text}
        />
      </TouchableOpacity>
    </View>
  );
});
