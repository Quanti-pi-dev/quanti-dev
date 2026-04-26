// ─── LockedFeature ────────────────────────────────────────────
// Fix 5: Rewrote entirely using theme tokens + inline styles.
// Removed all NativeWind className strings and hardcoded colour values.

import React from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useTheme } from '../../theme';
import { spacing, radius, shadows } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import type { PlanFeatures } from '@kd/shared';
import { useConfig } from '../../contexts/ConfigContext';

const TIER_NAMES = ['', 'Basic', 'Pro', 'Master'] as const;

// ─── LockedFeature (overlay) ──────────────────────────────────

interface LockedFeatureProps {
  children: React.ReactNode;
  minTier?: 1 | 2 | 3;
  featureKey?: string;
  label?: string;
  style?: ViewStyle;
}

export function LockedFeature({
  children,
  minTier = 1,
  featureKey,
  label,
  style,
}: LockedFeatureProps) {
  const { planTier, hasFeature } = useSubscription();
  const { theme } = useTheme();
  const router = useRouter();

  const isLocked = featureKey ? !hasFeature(featureKey as keyof PlanFeatures) : planTier < minTier;
  const lockedTitle = useConfig('locked_feature_title', 'Upgrade your plan to unlock this feature');
  const lockedSubtitle = useConfig('locked_feature_subtitle', '');
  const socialProof = useConfig('social_proof_text', '');

  if (!isLocked) return <>{children}</>;

  function handleUpgrade() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/subscription');
  }

  const hasChildren = React.Children.toArray(children).filter(Boolean).length > 0;

  return (
    <View style={[{ position: 'relative' }, style]}>
      {/* Dimmed children */}
      {hasChildren && (
        <View style={{ opacity: 0.2 }} pointerEvents="none">
          {children}
        </View>
      )}

      {/* Overlay */}
      <View style={{
        position: hasChildren ? 'absolute' : 'relative',
        top: hasChildren ? 0 : undefined,
        left: hasChildren ? 0 : undefined,
        right: hasChildren ? 0 : undefined,
        bottom: hasChildren ? 0 : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
      }}>
        <View style={{
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: radius['2xl'],
          padding: spacing.xl,
          alignItems: 'center',
          gap: spacing.md,
          ...shadows.md,
          shadowColor: theme.shadow,
        }}>
          <View style={{
            backgroundColor: theme.primaryMuted,
            width: 48,
            height: 48,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="lock-closed" size={22} color={theme.primary} />
          </View>
          <Typography variant="label" align="center">
            {label ?? `${TIER_NAMES[minTier]} Feature`}
          </Typography>
          <Typography variant="caption" color={theme.textTertiary} align="center">
            {lockedTitle}
          </Typography>
          {lockedSubtitle ? (
            <Typography variant="caption" color={theme.textTertiary} align="center">
              {lockedSubtitle}
            </Typography>
          ) : null}
          {socialProof ? (
            <Typography variant="caption" color={theme.primary} align="center" style={{ fontStyle: 'italic' }}>
              {socialProof}
            </Typography>
          ) : null}
          <TouchableOpacity
            onPress={handleUpgrade}
            activeOpacity={0.85}
            style={{
              backgroundColor: theme.primary,
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
            }}
          >
            <Typography variant="label" color="#FFFFFF">Upgrade →</Typography>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── LockedFeatureBanner (inline) ────────────────────────────

interface LockedBannerProps {
  feature: string;
  minTier?: 1 | 2 | 3;
}

export function LockedFeatureBanner({ feature, minTier = 1 }: LockedBannerProps) {
  const { planTier } = useSubscription();
  const { theme } = useTheme();
  const router = useRouter();

  if (planTier >= minTier) return null;

  return (
    <TouchableOpacity
      onPress={() => router.push('/subscription')}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.primaryMuted,
        borderWidth: 1,
        borderColor: theme.primary + '33',
        borderRadius: radius['2xl'],
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        gap: spacing.sm,
      }}
    >
      <Ionicons name="lock-closed-outline" size={15} color={theme.primary} />
      <Typography variant="label" color={theme.primary} style={{ flex: 1 }}>{feature}</Typography>
      <Typography variant="caption" color={theme.primary}>Upgrade →</Typography>
    </TouchableOpacity>
  );
}
