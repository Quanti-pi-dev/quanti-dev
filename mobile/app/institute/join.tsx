// ─── Join Institute Screen ────────────────────────────────────
// Student enters a join code to enrol in an educational institute.
// On success, a Firebase custom claim is set and the student is
// redirected to their institute home.

import { useState, useRef } from 'react';
import {
  View, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme';
import { spacing, radius } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Typography } from '../src/components/ui/Typography';
import { apiPost } from '../src/services/api-contracts';

// ─── Types ──────────────────────────────────────────────────

interface JoinResult {
  member: { role: string; instituteId: string };
  instituteName: string;
}

// ─── Main Screen ─────────────────────────────────────────────

export default function JoinInstituteScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<JoinResult | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError('Please enter a valid join code (at least 4 characters).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiPost<JoinResult>('/institute/join', { code: trimmed });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(result);

      // Immediately bust the memberships cache so the home screen
      // fetches fresh data when we navigate there instead of serving
      // the stale empty list (which has a 5-min staleTime).
      await queryClient.invalidateQueries({ queryKey: ['institute-memberships'] });

      // Give user 1.5 s to see the success banner, then navigate
      setTimeout(() => {
        router.replace('/institute');
      }, 1500);
    } catch (e: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to join. Please check the code and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, padding: spacing.xl }}>

          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40, height: 40, borderRadius: radius.lg,
              backgroundColor: theme.colors.surface,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: spacing.xl,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Hero icon */}
          <Animated.View entering={FadeInDown.delay(50).springify()} style={{ alignItems: 'center', marginBottom: spacing.xl * 1.5 }}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              style={{
                width: 80, height: 80, borderRadius: 24,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: spacing.lg,
              }}
            >
              <Ionicons name="school-outline" size={40} color="white" />
            </LinearGradient>
            <Typography variant="h1" style={{ textAlign: 'center', marginBottom: spacing.xs }}>
              Join Your Institute
            </Typography>
            <Typography variant="body" color={theme.colors.textSecondary} style={{ textAlign: 'center', lineHeight: 22 }}>
              Enter the join code provided by your{'\n'}educator or institute administrator
            </Typography>
          </Animated.View>

          {/* Code input */}
          <Animated.View entering={FadeInDown.delay(120).springify()}>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={t => { setCode(t.toUpperCase()); setError(null); }}
              placeholder="e.g. QPI-2024"
              placeholderTextColor={theme.colors.textDisabled}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              onSubmitEditing={() => void handleJoin()}
              returnKeyType="join"
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: radius.xl,
                padding: spacing.lg,
                fontSize: 22,
                fontWeight: '700',
                color: '#a5b4fc',
                textAlign: 'center',
                letterSpacing: 4,
                borderWidth: 2,
                borderColor: error ? '#ef4444' : code.length > 0 ? '#6366f1' : theme.colors.border,
                marginBottom: spacing.sm,
              }}
            />

            {/* Error message */}
            {error && (
              <Animated.View entering={FadeInDown.springify()} style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: 'rgba(239,68,68,0.1)',
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
                borderRadius: radius.lg, padding: spacing.md,
                marginBottom: spacing.md,
              }}>
                <Ionicons name="alert-circle-outline" size={16} color="#f87171" />
                <Typography variant="caption" color="#f87171" style={{ flex: 1 }}>{error}</Typography>
              </Animated.View>
            )}

            {/* Success message */}
            {success && (
              <Animated.View entering={FadeInDown.springify()} style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: 'rgba(34,197,94,0.1)',
                borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
                borderRadius: radius.lg, padding: spacing.md,
                marginBottom: spacing.md,
              }}>
                <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
                <View>
                  <Typography variant="label" color="#4ade80">
                    Joined {success.instituteName}!
                  </Typography>
                  <Typography variant="caption" color={theme.colors.textSecondary}>
                    Redirecting you now…
                  </Typography>
                </View>
              </Animated.View>
            )}

            {/* Join button */}
            <TouchableOpacity
              onPress={() => void handleJoin()}
              disabled={loading || !!success || code.trim().length < 4}
              activeOpacity={0.8}
              style={{ borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.sm }}
            >
              <LinearGradient
                colors={loading || code.trim().length < 4 ? ['#3a3a5c', '#3a3a5c'] : ['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{
                  height: 56, alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: spacing.sm,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="enter-outline" size={20} color="white" />
                    <Typography variant="button" color="white">Join Institute</Typography>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Info footer */}
          <Animated.View entering={FadeInUp.delay(200).springify()} style={{
            marginTop: 'auto', paddingTop: spacing.xl,
            alignItems: 'center', gap: spacing.sm,
          }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
              backgroundColor: theme.colors.surface,
              borderRadius: radius.xl, padding: spacing.md,
              borderWidth: 1, borderColor: theme.colors.border,
            }}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#6366f1" />
              <Typography variant="caption" color={theme.colors.textSecondary}>
                Your progress syncs automatically with your institute
              </Typography>
            </View>
          </Animated.View>

        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}
