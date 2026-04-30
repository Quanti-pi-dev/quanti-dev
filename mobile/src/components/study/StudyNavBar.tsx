// ─── StudyNavBar ────────────────────────────────────────────
// Prev / counter / Next navigation bar for flashcard study.
// Improved with press-scale animation, better visual states,
// and a helpful "answer to continue" nudge.

import React, { useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { SPRING_PRESS } from '../../theme/animations';

interface StudyNavBarProps {
  currentIdx: number;
  total: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  isCurrentAnswered: boolean;
  onPrev: () => void;
  onNext: () => void;
}

function NavButton({
  onPress,
  disabled,
  isPrimary,
  icon,
  label,
}: {
  onPress: () => void;
  disabled: boolean;
  isPrimary?: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (!disabled) scale.value = withSpring(0.92, SPRING_PRESS);
  }, [disabled, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_PRESS);
  }, [scale]);

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.full,
          backgroundColor: isPrimary
            ? (disabled ? theme.buttonDisabled : theme.primary)
            : theme.cardAlt,
          borderWidth: 1.5,
          borderColor: isPrimary
            ? (disabled ? theme.buttonDisabled : theme.primary)
            : theme.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.38 : 1,
          shadowColor: isPrimary && !disabled ? theme.primary : 'transparent',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: isPrimary && !disabled ? 4 : 0,
        }}
      >
        <Ionicons
          name={icon}
          size={22}
          color={isPrimary && !disabled ? theme.buttonPrimaryText : theme.text}
        />
      </TouchableOpacity>
    </Animated.View>
  );
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

  const isLastCard = !canGoNext && isCurrentAnswered;

  return (
    <View
      style={{
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xl,
        gap: spacing.sm,
      }}
    >
      {/* Nudge text when unanswered */}
      {!isCurrentAnswered && (
        <Typography
          variant="caption"
          color={theme.textTertiary}
          align="center"
          style={{ fontSize: 11 }}
        >
          Select an answer to continue
        </Typography>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
        <NavButton
          onPress={handlePrev}
          disabled={!canGoPrev}
          icon="arrow-back"
          label="Previous card"
        />

        {/* Center counter with progress dots */}
        <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <Typography variant="label" color={theme.textSecondary}>
            {currentIdx + 1} / {total}
          </Typography>
          {/* Mini dot indicators (up to 8 shown) */}
          {total <= 12 && (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {Array.from({ length: total }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === currentIdx ? 14 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      i < currentIdx
                        ? theme.primary
                        : i === currentIdx
                          ? theme.primary
                          : theme.border,
                    opacity: i === currentIdx ? 1 : i < currentIdx ? 0.7 : 0.35,
                  }}
                />
              ))}
            </View>
          )}
        </View>

        <NavButton
          onPress={handleNext}
          disabled={!nextEnabled}
          isPrimary
          icon={isLastCard ? 'checkmark' : 'arrow-forward'}
          label={nextEnabled ? (isLastCard ? 'Finish session' : 'Next card') : 'Answer this card to continue'}
        />
      </View>
    </View>
  );
});
