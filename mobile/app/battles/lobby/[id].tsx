// ─── Challenge Lobby ────────────────────────────────────────
// Waiting screen after creating a challenge. Polls for acceptance.
// Improvements:
//  - Premium radial pulse animation with concentric rings
//  - Challenger vs. you VS card
//  - Challenge details in a styled summary card
//  - Better declined/expired state design

import { useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn, FadeInDown,
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../src/theme';
import { spacing, radius } from '../../../src/theme/tokens';
import { ScreenWrapper } from '../../../src/components/layout/ScreenWrapper';
import { Typography } from '../../../src/components/ui/Typography';
import { useChallengeDetailPolling, useCancelChallenge } from '../../../src/hooks/useChallenge';

// ─── Pulsing rings animation ──────────────────────────────────
function PulseRings({ color }: { color: string }) {
  const ring1 = useSharedValue(1);
  const ring2 = useSharedValue(1);
  const ring3 = useSharedValue(1);

  useEffect(() => {
    ring1.value = withRepeat(
      withSequence(withTiming(1.6, { duration: 1200 }), withTiming(1, { duration: 0 })),
      -1,
    );
    ring2.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(1.6, { duration: 1200 }),
        withTiming(1, { duration: 0 }),
      ),
      -1,
    );
    ring3.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(1.6, { duration: 1200 }),
        withTiming(1, { duration: 0 }),
      ),
      -1,
    );
  }, []);

  const makeStyle = (val: { value: number }, baseSize: number) =>
    useAnimatedStyle(() => ({
      width: baseSize * val.value,
      height: baseSize * val.value,
      borderRadius: (baseSize * val.value) / 2,
      opacity: 1.8 - val.value,
      position: 'absolute',
      backgroundColor: color,
    }));

  const s1 = makeStyle(ring1, 120);
  const s2 = makeStyle(ring2, 120);
  const s3 = makeStyle(ring3, 120);

  return (
    <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={s3} />
      <Animated.View style={s2} />
      <Animated.View style={s1} />
      <View
        style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: color,
          alignItems: 'center', justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <Ionicons name="hourglass" size={36} color="#FFF" />
      </View>
    </View>
  );
}

export default function LobbyScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: challenge } = useChallengeDetailPolling(id ?? null);
  const cancelMutation = useCancelChallenge();

  useEffect(() => {
    if (challenge?.status === 'accepted') {
      router.replace(`/battles/active/${id}`);
    }
  }, [challenge?.status, id, router]);

  const isGone = challenge && !['pending', 'accepted'].includes(challenge.status);
  const isDeclined = challenge?.status === 'declined';

  return (
    <ScreenWrapper>
      {/* ── Header ── */}
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
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/battles');
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Typography variant="h4">Challenge Lobby</Typography>
          <Typography variant="caption" color={theme.textTertiary}>
            Waiting for response...
          </Typography>
        </View>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing['2xl'] }}>
        {isGone ? (
          /* ── Declined / Expired state ── */
          <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: spacing.lg, width: '100%' }}>
            <View
              style={{
                width: 88, height: 88, borderRadius: radius.full,
                backgroundColor: theme.errorMuted,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: theme.error + '44',
              }}
            >
              <Ionicons name="close-circle" size={44} color={theme.error} />
            </View>
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Typography variant="h3" color={theme.error}>
                Challenge {isDeclined ? 'Declined' : 'Expired'}
              </Typography>
              <Typography variant="body" color={theme.textSecondary} align="center">
                Your bet has been refunded.{'\n'}Try challenging someone else!
              </Typography>
            </View>
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)/battles' as never)}
              style={{ borderRadius: radius.xl, overflow: 'hidden', width: '100%' }}
            >
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: spacing.lg,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: spacing.sm,
                }}
              >
                <Ionicons name="arrow-back" size={16} color="#FFF" />
                <Typography variant="label" color="#FFF">Back to Battles</Typography>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <>
            {/* ── Pulse animation ── */}
            <Animated.View entering={FadeIn.duration(400)}>
              <PulseRings color="#6366F133" />
            </Animated.View>

            {/* ── Status text ── */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ alignItems: 'center', gap: spacing.xs }}>
              <Typography variant="h4" align="center">Waiting for opponent...</Typography>
              <Typography variant="body" color={theme.textSecondary} align="center">
                {challenge?.opponentName ?? 'Your friend'} hasn't responded yet.{'\n'}Invite expires in 24 hours.
              </Typography>
            </Animated.View>

            {/* ── Challenge summary card ── */}
            {challenge && (
              <Animated.View entering={FadeInDown.delay(350).duration(400)} style={{ width: '100%' }}>
                <View
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: radius.xl,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <LinearGradient
                    colors={['#6366F118', '#8B5CF608']}
                    style={{
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                    }}
                  >
                    <Ionicons name="flash" size={14} color="#6366F1" />
                    <Typography variant="label" color="#6366F1" style={{ fontSize: 12 }}>Challenge Details</Typography>
                  </LinearGradient>
                  <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                    {[
                      { icon: 'bar-chart-outline' as const, label: 'Level', value: challenge.level },
                      { icon: 'timer-outline' as const, label: 'Duration', value: `${Math.round(challenge.durationSeconds / 60)} min` },
                      { icon: 'cash-outline' as const, label: 'Your Bet', value: `🪙 ${challenge.betAmount}` },
                      { icon: 'trophy-outline' as const, label: 'Winner Takes', value: `🪙 ${challenge.betAmount * 2}` },
                    ].map((r, i) => (
                      <View key={r.label}>
                        {i > 0 && <View style={{ height: 1, backgroundColor: theme.border, marginVertical: spacing.xs }} />}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <Ionicons name={r.icon} size={14} color={theme.textTertiary} />
                          <Typography variant="body" color={theme.textSecondary} style={{ flex: 1 }}>
                            {r.label}
                          </Typography>
                          <Typography variant="label">{r.value}</Typography>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── Cancel button ── */}
            <TouchableOpacity
              onPress={() => id && cancelMutation.mutate(id)}
              disabled={cancelMutation.isPending}
              style={{
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xl,
                borderRadius: radius.xl,
                backgroundColor: theme.errorMuted,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                borderWidth: 1,
                borderColor: theme.error + '44',
              }}
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator size="small" color={theme.error} />
              ) : (
                <>
                  <Ionicons name="close" size={16} color={theme.error} />
                  <Typography variant="label" color={theme.error}>Cancel Challenge</Typography>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScreenWrapper>
  );
}
