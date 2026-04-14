// ─── AIDeepDiveSection ──────────────────────────────────────
// Contextual AI explanation card shown after answering.
// Shows a nudge for incorrect answers, inline explanation otherwise.
// Extracted from FlashcardStudyScreen (FIX A12).

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { LockedFeature } from '../subscription/LockedFeature';

type CardAnswer = boolean | 'skipped' | undefined;

interface AIDeepDiveSectionProps {
  answer: CardAnswer;
  explanation: string;
  /** Resets visibility when the card index changes */
  cardIndex: number;
}

export const AIDeepDiveSection = React.memo(function AIDeepDiveSection({
  answer,
  explanation,
  cardIndex,
}: AIDeepDiveSectionProps) {
  const { theme } = useTheme();
  const [showDeepDive, setShowDeepDive] = useState(false);

  // Reset on card change
  useEffect(() => {
    setShowDeepDive(false);
  }, [cardIndex]);

  if (answer === undefined) return null;

  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.base }}>
      {answer === false && !showDeepDive && (
        <Animated.View entering={FadeInDown.delay(800).duration(300)}>
          <LockedFeature featureKey="ai_explanations" label="AI Deep Dive — Pro & Master feature">
            <TouchableOpacity
              onPress={() => setShowDeepDive(true)}
              style={{
                backgroundColor: theme.primaryMuted,
                borderRadius: radius.xl,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <Ionicons name="bulb-outline" size={20} color={theme.primary} />
              <Typography variant="label" color={theme.primary}>
                Need help? Tap for AI Deep Dive
              </Typography>
            </TouchableOpacity>
          </LockedFeature>
        </Animated.View>
      )}
      {(showDeepDive || answer === true || answer === 'skipped') && (
        <LockedFeature featureKey="ai_explanations" label="AI Deep Dive — Pro & Master feature">
          <View style={{ backgroundColor: theme.primaryMuted, borderRadius: radius.xl, padding: spacing.md, gap: spacing.xs }}>
            <Typography variant="label" color={theme.primary}>💡 AI Deep Dive</Typography>
            <Typography variant="bodySmall" color={theme.textSecondary}>
              {explanation}
            </Typography>
          </View>
        </LockedFeature>
      )}
    </View>
  );
});
