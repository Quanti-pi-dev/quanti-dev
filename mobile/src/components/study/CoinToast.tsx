// ─── CoinToast ──────────────────────────────────────────────
// Floating animated toast that shows "+N" coins earned.
// Extracted from FlashcardStudyScreen (FIX A12).

import React, { useEffect } from 'react';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { spacing, radius, shadows } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

interface CoinToastProps {
  amount: number;
  /** Unique key to trigger re-entrance animation */
  animationKey: number;
}

export const CoinToast = React.memo(function CoinToast({ amount, animationKey }: CoinToastProps) {
  const { theme } = useTheme();

  // Celebrate coin earning with haptic feedback
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [animationKey]);

  return (
    <Animated.View
      key={animationKey}
      entering={FadeInDown.duration(200).springify()}
      exiting={FadeOutUp.duration(300)}
      style={{
        position: 'absolute',
        bottom: 100,
        alignSelf: 'center',
        backgroundColor: theme.coin,
        borderRadius: radius.full,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        ...shadows.md,
        shadowColor: theme.shadow,
      }}
    >
      <Typography variant="body" color={theme.buttonPrimaryText}>🪙</Typography>
      <Typography variant="body" color={theme.buttonPrimaryText} style={{ fontWeight: '700' }}>
        +{amount}
      </Typography>
    </Animated.View>
  );
});
