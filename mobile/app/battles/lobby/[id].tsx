// ─── Challenge Lobby ────────────────────────────────────────
// Waiting screen after creating a challenge. Polls for acceptance.
// Auto-navigates to active game when opponent accepts.

import { useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../../src/theme';
import { spacing, radius } from '../../../src/theme/tokens';
import { ScreenWrapper } from '../../../src/components/layout/ScreenWrapper';
import { Typography } from '../../../src/components/ui/Typography';
import { useChallengeDetailPolling, useCancelChallenge } from '../../../src/hooks/useChallenge';

export default function LobbyScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: challenge } = useChallengeDetailPolling(id ?? null);
  const cancelMutation = useCancelChallenge();

  // Pulsing animation for the waiting indicator
  const pulseScale = useSharedValue(1);
  useEffect(() => {
    pulseScale.value = withRepeat(withTiming(1.15, { duration: 1000 }), -1, true);
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  // Auto-navigate when accepted
  useEffect(() => {
    if (challenge?.status === 'accepted') {
      router.replace(`/battles/active/${id}`);
    }
  }, [challenge?.status, id, router]);

  // If challenge is no longer pending (declined/expired), show message
  const isGone = challenge && !['pending', 'accepted'].includes(challenge.status);

  return (
    <ScreenWrapper>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.base,
          paddingBottom: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/battles');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Typography variant="h4">Challenge Lobby</Typography>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing['2xl'] }}>
        {isGone ? (
          <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: spacing.lg }}>
            <Ionicons name="close-circle-outline" size={64} color={theme.error} />
            <Typography variant="h4" style={{ color: theme.error }}>
              Challenge {challenge?.status === 'declined' ? 'Declined' : 'Expired'}
            </Typography>
            <Typography variant="body" style={{ color: theme.textSecondary, textAlign: 'center' }}>
              Your bet has been refunded.
            </Typography>
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)/battles' as never)}
              style={{
                backgroundColor: theme.buttonPrimary,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
              }}
            >
              <Typography variant="bodySemiBold" style={{ color: theme.buttonPrimaryText }}>
                Back to Battles
              </Typography>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <>
            {/* Pulsing waiting indicator */}
            <Animated.View
              style={[
                pulseStyle,
                {
                  width: 100,
                  height: 100,
                  borderRadius: radius.full,
                  backgroundColor: theme.primaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <Ionicons name="hourglass" size={48} color={theme.primary} />
            </Animated.View>

            <Typography variant="h4" style={{ textAlign: 'center' }}>
              Waiting for opponent...
            </Typography>
            <Typography variant="body" style={{ color: theme.textSecondary, textAlign: 'center' }}>
              {challenge?.opponentName ?? 'Your friend'} hasn't responded yet.
              {'\n'}The invite expires in 24 hours.
            </Typography>

            {/* Challenge summary */}
            {challenge && (
              <View
                style={{
                  backgroundColor: theme.card,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  gap: spacing.sm,
                  width: '100%',
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                {[
                  { label: 'Level', value: challenge.level },
                  { label: 'Duration', value: `${challenge.durationSeconds}s` },
                  { label: 'Bet', value: `🪙 ${challenge.betAmount}` },
                  { label: 'Winner Takes', value: `🪙 ${challenge.betAmount * 2}` },
                ].map((r) => (
                  <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Typography variant="body" style={{ color: theme.textSecondary }}>{r.label}</Typography>
                    <Typography variant="bodySemiBold">{r.value}</Typography>
                  </View>
                ))}
              </View>
            )}

            {/* Cancel button */}
            <TouchableOpacity
              onPress={() => id && cancelMutation.mutate(id)}
              disabled={cancelMutation.isPending}
              style={{
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xl,
                borderRadius: radius.md,
                backgroundColor: theme.errorMuted,
              }}
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator size="small" color={theme.error} />
              ) : (
                <Typography variant="bodySemiBold" style={{ color: theme.error }}>
                  Cancel Challenge
                </Typography>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScreenWrapper>
  );
}
