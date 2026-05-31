// ─── Progressive Profile Tiers Screen ────────────────────────
// Shows the user's current tier, XP progress, and which features
// are locked behind higher tiers.
//
// Psychology (Blueprint §4.1 — Progressive Profile):
//   Tier progression creates an "endowed progress effect" — users
//   who can see features just out of reach will study more to unlock
//   them. The profile becomes a record of effort that feels personal
//   and worth protecting.
//
// Tiers: Rookie → Scholar → Expert → Legend
//   Each tier unlocks real UI features (analytics, pact creation,
//   weekly reels, leaderboard placement, etc.)

import React, { useEffect } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../src/theme';
import { spacing, radius } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Typography } from '../src/components/ui/Typography';
import { Skeleton } from '../src/components/ui/Skeleton';
import {
  fetchProfileUnlockStatus,
  type ProfileUnlockStatus,
  type ProfileTier,
  type ProfileFeatureUnlock,
} from '../src/services/behavioral-contracts';

// ─── Tier Config ──────────────────────────────────────────────

const TIER_CONFIG: Record<
  ProfileTier,
  { gradient: [string, string]; emoji: string; description: string }
> = {
  Rookie: {
    gradient: ['#6B7280', '#9CA3AF'],
    emoji: '🌱',
    description: 'Just getting started — the world is yours',
  },
  Scholar: {
    gradient: ['#2563EB', '#3B82F6'],
    emoji: '📚',
    description: 'Building real foundations — keep it consistent',
  },
  Expert: {
    gradient: ['#7C3AED', '#8B5CF6'],
    emoji: '⚡',
    description: 'Deep knowledge — others look up to you',
  },
  Legend: {
    gradient: ['#D97706', '#F59E0B'],
    emoji: '🏆',
    description: 'Platform master — the highest tier',
  },
};

const TIER_ORDER: ProfileTier[] = ['Rookie', 'Scholar', 'Expert', 'Legend'];

// ─── XP Progress Bar ─────────────────────────────────────────

function XPBar({ percent }: { percent: number }) {
  const { theme } = useTheme();
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(300, withTiming(percent, { duration: 1000 }));
  }, [percent]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(width.value, 100)}%` as unknown as number,
  }));

  return (
    <View
      style={{
        height: 10,
        backgroundColor: theme.border,
        borderRadius: 5,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          fillStyle,
          {
            height: '100%',
            backgroundColor: theme.primary,
            borderRadius: 5,
          },
        ]}
      />
    </View>
  );
}

// ─── Tier Badge ───────────────────────────────────────────────

function TierBadge({
  tier,
  isCurrent,
  isUnlocked,
  delay,
}: {
  tier: ProfileTier;
  isCurrent: boolean;
  isUnlocked: boolean;
  delay: number;
}) {
  const { theme } = useTheme();
  const config = TIER_CONFIG[tier]!;
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    scale.value = withDelay(delay, withSpring(1, { stiffness: 180, damping: 16 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!config) return null;

  return (
    <Animated.View
      style={[
        style,
        {
          alignItems: 'center',
          flex: 1,
          opacity: isUnlocked ? 1 : 0.4,
        },
      ]}
    >
      <LinearGradient
        colors={config.gradient}
        style={{
          width: isCurrent ? 64 : 52,
          height: isCurrent ? 64 : 52,
          borderRadius: isCurrent ? 32 : 26,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: isCurrent ? 3 : 0,
          borderColor: '#FFFFFF',
        }}
      >
        <Typography style={{ fontSize: isCurrent ? 28 : 22 }}>{config.emoji}</Typography>
      </LinearGradient>
      <Typography
        variant={isCurrent ? 'captionBold' : 'caption'}
        color={isCurrent ? theme.text : theme.textTertiary}
        style={{ marginTop: spacing.xs, textAlign: 'center' }}
      >
        {tier}
      </Typography>
      {isCurrent && (
        <View
          style={{
            backgroundColor: theme.primary,
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            marginTop: 2,
          }}
        >
          <Typography variant="caption" color="#FFFFFF" style={{ fontSize: 9, fontWeight: '700' }}>
            YOU
          </Typography>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Feature Row ──────────────────────────────────────────────

function FeatureRow({
  feature,
  delay,
}: {
  feature: ProfileFeatureUnlock;
  delay: number;
}) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    translateX.value = withDelay(delay, withSpring(0, { stiffness: 160, damping: 16 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const tierConfig = TIER_CONFIG[feature.unlockedAt]!;

  return (
    <Animated.View
      style={[
        style,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.base,
          backgroundColor: feature.isUnlocked ? theme.card : theme.cardAlt,
          borderRadius: radius.xl,
          opacity: feature.isUnlocked ? 1 : 0.65,
        },
      ]}
    >
      {/* Icon circle */}
      <LinearGradient
        colors={feature.isUnlocked && tierConfig ? tierConfig.gradient : ['#6B7280', '#9CA3AF']}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={feature.isUnlocked ? 'checkmark-circle' : 'lock-closed'}
          size={18}
          color="#FFFFFF"
        />
      </LinearGradient>

      {/* Text */}
      <View style={{ flex: 1, gap: 2 }}>
        <Typography
          variant="label"
          color={feature.isUnlocked ? theme.text : theme.textSecondary}
        >
          {feature.label}
        </Typography>
        <Typography variant="caption" color={theme.textTertiary}>
          {feature.description}
        </Typography>
      </View>

      {/* Unlock tier tag */}
      {!feature.isUnlocked && (
        <View
          style={{
            backgroundColor: theme.cardAlt,
            borderRadius: radius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Typography variant="caption" color={theme.textTertiary} style={{ fontSize: 10 }}>
            {feature.unlockedAt}
          </Typography>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function ProfileTiersScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const { data: status, isLoading } = useQuery({
    queryKey: ['profile-tiers'],
    queryFn: fetchProfileUnlockStatus,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !status) {
    return (
      <ScreenWrapper>
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Skeleton width="100%" height={180} borderRadius={radius['2xl']} />
          <Skeleton width="100%" height={60} borderRadius={radius.xl} />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={72} borderRadius={radius.xl} />
          ))}
        </View>
      </ScreenWrapper>
    );
  }

  const currentConfig = TIER_CONFIG[status.currentTier]!;

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.base,
            paddingBottom: spacing.md,
            gap: spacing.md,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Typography variant="h4">Your Profile Tier</Typography>
        </View>

        {/* Hero — current tier card */}
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
          <LinearGradient
            colors={currentConfig.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radius['2xl'],
              padding: spacing.xl,
              gap: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Typography style={{ fontSize: 48 }}>{currentConfig.emoji}</Typography>
              <View style={{ flex: 1 }}>
                <Typography variant="overline" color="rgba(255,255,255,0.7)">
                  CURRENT TIER
                </Typography>
                <Typography variant="h2" color="#FFFFFF" style={{ fontWeight: '800' }}>
                  {status.currentTier}
                </Typography>
                <Typography variant="caption" color="rgba(255,255,255,0.75)">
                  {currentConfig.description}
                </Typography>
              </View>
            </View>

            {/* XP bar */}
            {status.nextTier && (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" color="rgba(255,255,255,0.75)">
                    {status.xpCurrent} XP · {status.xpRequired - status.xpCurrent} to {status.nextTier}
                  </Typography>
                  <Typography variant="captionBold" color="rgba(255,255,255,0.9)">
                    {Math.round(status.percentToNext)}%
                  </Typography>
                </View>
                <View
                  style={{
                    height: 8,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${status.percentToNext}%`,
                      height: '100%',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 4,
                    }}
                  />
                </View>
              </>
            )}
          </LinearGradient>

          {/* Tier progression row */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
            {TIER_ORDER.map((tier, i) => (
              <TierBadge
                key={tier}
                tier={tier}
                isCurrent={tier === status.currentTier}
                isUnlocked={TIER_ORDER.indexOf(tier) <= TIER_ORDER.indexOf(status.currentTier)}
                delay={i * 80}
              />
            ))}
          </View>

          {/* Unlocked features */}
          <View style={{ gap: spacing.sm }}>
            <Typography variant="h4">Unlocked Features</Typography>
            {status.unlockedFeatures.map((f, i) => (
              <FeatureRow key={f.feature} feature={f} delay={i * 60} />
            ))}
          </View>

          {/* Locked features */}
          {status.lockedFeatures.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <Typography variant="h4" color={theme.textSecondary}>
                Coming with higher tiers
              </Typography>
              {status.lockedFeatures.map((f, i) => (
                <FeatureRow
                  key={f.feature}
                  feature={f}
                  delay={status.unlockedFeatures.length * 60 + i * 60}
                />
              ))}
            </View>
          )}

          {/* How to earn XP */}
          <View
            style={{
              backgroundColor: theme.cardAlt,
              borderRadius: radius.xl,
              padding: spacing.base,
              gap: spacing.sm,
            }}
          >
            <Typography variant="label" color={theme.textSecondary}>
              How to earn XP
            </Typography>
            {[
              { icon: 'library-outline',   text: 'Answer a flashcard correctly (+1 XP)' },
              { icon: 'flame-outline',     text: 'Maintain your daily streak (+5 XP/day)' },
              { icon: 'people-outline',    text: 'Complete a study pact (+50 XP)' },
              { icon: 'trophy-outline',    text: 'Win a P2P challenge (+20 XP)' },
              { icon: 'pencil-outline',    text: 'Annotate a flashcard (+2 XP)' },
            ].map((row) => (
              <View
                key={row.text}
                style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}
              >
                <Ionicons name={row.icon as never} size={14} color={theme.textTertiary} />
                <Typography variant="caption" color={theme.textSecondary}>
                  {row.text}
                </Typography>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
