// ─── RecommendedDeckCard ──────────────────────────────────────
// AI-curated deck card for the "Recommended For You" horizontal
// carousel. Glassmorphic design with glowing accent border,
// reason label, a priority indicator star, and a "Start" CTA button.

import { useEffect } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { radius, spacing } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

// ─── Accent palette matching the brand ───────────────────────

const AI_ACCENTS = [
  { color: '#6366F1', grad: ['#6366F1', '#818CF8'] as [string, string] },
  { color: '#8B5CF6', grad: ['#8B5CF6', '#A78BFA'] as [string, string] },
  { color: '#10B981', grad: ['#10B981', '#34D399'] as [string, string] },
  { color: '#F59E0B', grad: ['#F59E0B', '#FCD34D'] as [string, string] },
  { color: '#EC4899', grad: ['#EC4899', '#F472B6'] as [string, string] },
];

// ─── Props ────────────────────────────────────────────────────

export interface RecommendedDeckCardProps {
  deckId: string;
  title: string;
  reason: string;
  priority: number;       // 1 = highest
  suggestedCards?: number;
  accentIndex?: number;
  onPress: (deckId: string) => void;
  animDelay?: number;
}

// ─── Component ────────────────────────────────────────────────

export function RecommendedDeckCard({
  deckId,
  title,
  reason,
  priority,
  suggestedCards,
  accentIndex = 0,
  onPress,
  animDelay = 0,
}: RecommendedDeckCardProps) {
  const { theme } = useTheme();
  const accent = AI_ACCENTS[accentIndex % AI_ACCENTS.length]!;

  // ── Entrance animation ──────────────────────────────────────
  const translateX = useSharedValue(40);
  const opacity = useSharedValue(0);
  useEffect(() => {
    translateX.value = withDelay(animDelay, withSpring(0, { stiffness: 120, damping: 18 }));
    opacity.value = withDelay(animDelay, withTiming(1, { duration: 380 }));
  }, [animDelay]);

  // ── Glow pulse on the AI badge ──────────────────────────────
  const glowOpacity = useSharedValue(0.6);
  useEffect(() => {
    glowOpacity.value = withDelay(
      animDelay + 600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900 }),
          withTiming(0.5, { duration: 900 }),
        ),
        -1,
      ),
    );
  }, [animDelay]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={() => onPress(deckId)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${reason}`}
        style={{
          width: 220,
          borderRadius: radius['2xl'],
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: accent.color + '55',
          shadowColor: accent.color,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 14,
          elevation: 6,
        }}
      >
        {/* Gradient header */}
        <LinearGradient
          colors={[accent.color + 'CC', accent.color + '88']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
            gap: spacing.xs,
          }}
        >
          {/* AI badge row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Animated.View
              style={[
                glowStyle,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  borderRadius: radius.full,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                },
              ]}
            >
              <Ionicons name="sparkles" size={10} color="#FFF" />
              <Typography variant="captionBold" color="#FFF" style={{ fontSize: 9, letterSpacing: 0.4 }}>
                AI Pick
              </Typography>
            </Animated.View>

            {/* Priority stars */}
            {priority === 1 && (
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[0, 1, 2].map((i) => (
                  <Ionicons key={i} name="star" size={10} color="rgba(255,255,255,0.9)" />
                ))}
              </View>
            )}
          </View>

          {/* Title */}
          <Typography variant="label" color="#FFF" numberOfLines={2} style={{ lineHeight: 18, marginTop: 2 }}>
            {title}
          </Typography>
        </LinearGradient>

        {/* Footer */}
        <View
          style={{
            backgroundColor: theme.card,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
            gap: spacing.sm,
          }}
        >
          {/* Reason */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5 }}>
            <Ionicons name="information-circle" size={13} color={accent.color} style={{ marginTop: 1 }} />
            <Typography
              variant="caption"
              color={theme.textSecondary}
              numberOfLines={2}
              style={{ flex: 1, lineHeight: 15 }}
            >
              {reason}
            </Typography>
          </View>

          {/* Footer row: cards count + start button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {suggestedCards != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="layers-outline" size={12} color={theme.textTertiary} />
                <Typography variant="caption" color={theme.textTertiary}>
                  {suggestedCards} cards
                </Typography>
              </View>
            ) : (
              <View />
            )}

            {/* Start CTA */}
            <TouchableOpacity
              onPress={() => onPress(deckId)}
              activeOpacity={0.78}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: accent.color + '18',
                borderRadius: radius.full,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: accent.color + '44',
              }}
            >
              <Typography variant="captionBold" color={accent.color} style={{ fontSize: 10 }}>
                Start
              </Typography>
              <Ionicons name="play" size={9} color={accent.color} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
