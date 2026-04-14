// ─── StudyProgressHeader ────────────────────────────────────
// Shows "Card X of Y" + correct count + progress bar.
// Extracted from FlashcardStudyScreen (FIX A12).

import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { ProgressBar } from '../ui/ProgressBar';

interface StudyProgressHeaderProps {
  currentIdx: number;
  total: number;
  correctCount: number;
}

export const StudyProgressHeader = React.memo(function StudyProgressHeader({
  currentIdx,
  total,
  correctCount,
}: StudyProgressHeaderProps) {
  const { theme } = useTheme();
  const progress = total > 0 ? (currentIdx + 1) / total : 0;

  return (
    <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Typography variant="caption" color={theme.textTertiary}>
          Card {currentIdx + 1} of {total}
        </Typography>
        <Typography variant="label" color={theme.primary}>
          {correctCount} correct
        </Typography>
      </View>
      <ProgressBar progress={progress} height={6} />
    </View>
  );
});
