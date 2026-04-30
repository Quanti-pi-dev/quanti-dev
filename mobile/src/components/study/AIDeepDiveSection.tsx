// ─── AIDeepDiveSection ──────────────────────────────────────
// Contextual AI explanation card shown after answering.
// Improved: richer "expand" CTA for incorrect, better open state design,
// animated reveal, and gradient header stripe.

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

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

  const isOpen = showDeepDive || answer === true || answer === 'skipped';

  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
      {/* Incorrect + not expanded: show a more prominent CTA */}
      {answer === false && !showDeepDive && (
        <Animated.View entering={FadeInDown.delay(700).duration(320)}>
          <TouchableOpacity
            onPress={() => setShowDeepDive(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Show AI explanation for this answer"
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: radius.xl,
                padding: 1.5,
              }}
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
                  <Ionicons name="bulb" size={18} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography variant="label" color="#6366F1">
                    AI Deep Dive
                  </Typography>
                  <Typography variant="caption" color={theme.textTertiary}>
                    Tap to understand why this answer is correct
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
              <Typography variant="captionBold" color="#FFF" style={{ fontSize: 11, letterSpacing: 0.4 }}>
                AI Deep Dive
              </Typography>
            </LinearGradient>

            {/* Body */}
            <View
              style={{
                backgroundColor: '#6366F108',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
              }}
            >
              <Typography
                variant="bodySmall"
                color={theme.textSecondary}
                style={{ lineHeight: 20 }}
              >
                {explanation || 'No additional explanation is available for this card.'}
              </Typography>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
});
