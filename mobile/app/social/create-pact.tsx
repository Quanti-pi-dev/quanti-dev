// ─── Study Pact — Create Wizard ───────────────────────────────
// Social accountability: create a timed study contract with friends.
//
// Psychology (Blueprint §3.2 — Social Accountability):
//   Public commitment + daily progress visibility creates real
//   consequences for slacking. The FOMO of "letting your pact down"
//   is a far stronger motivator than app reminders alone.
//
// Flow: Name → Duration → Target → Invite friends → Confirm

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { createStudyPact } from '../../src/services/behavioral-contracts';
import { fetchFriends } from '../../src/services/api-contracts';

// ─── Local type (UserSummary is not barrel-exported from @kd/shared) ────
type UserSummary = {
  id: string;
  displayName: string;
  enrollmentId?: string;
  avatarUrl?: string | null;
};

// ─── Types ────────────────────────────────────────────────────

type Step = 'details' | 'invite' | 'confirm';

const DURATIONS: Array<{ value: 3 | 7 | 14; label: string; sub: string }> = [
  { value: 3,  label: '3-Day Sprint',    sub: 'Perfect for a topic blitz' },
  { value: 7,  label: '7-Day Classic',   sub: 'The gold standard' },
  { value: 14, label: '14-Day Deep Dive', sub: 'For serious mastery' },
];

const TARGETS: Array<{ value: number; label: string }> = [
  { value: 10, label: '10 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
];

// ─── Step Components ──────────────────────────────────────────

function OptionPill<T>({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        borderRadius: radius.xl,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.primary : theme.border,
        backgroundColor: selected ? theme.primaryMuted : theme.card,
        padding: spacing.md,
        gap: spacing.xs,
      }}
      activeOpacity={0.75}
    >
      <Typography variant="label" color={selected ? theme.primary : theme.text}>
        {label}
      </Typography>
      {sub && (
        <Typography variant="caption" color={theme.textTertiary}>
          {sub}
        </Typography>
      )}
    </TouchableOpacity>
  );
}

function FriendRow({
  friend,
  selected,
  onToggle,
}: {
  friend: UserSummary;
  selected: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.base,
        backgroundColor: selected ? theme.primaryMuted : theme.card,
        borderRadius: radius.xl,
        borderWidth: selected ? 1.5 : 0,
        borderColor: selected ? theme.primary : 'transparent',
      }}
      activeOpacity={0.75}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="person" size={20} color={theme.primary} />
      </View>
      <Typography variant="body" style={{ flex: 1 }}>
        {friend.displayName ?? friend.id}
      </Typography>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? theme.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
      </View>
    </TouchableOpacity>
  );
}

// ─── Step Indicators ─────────────────────────────────────────

const STEP_LABELS: Record<Step, number> = { details: 1, invite: 2, confirm: 3 };

function StepIndicator({ current }: { current: Step }) {
  const { theme } = useTheme();
  const steps: Step[] = ['details', 'invite', 'confirm'];
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
      {steps.map((s, i) => {
        const done = STEP_LABELS[s] < STEP_LABELS[current];
        const active = s === current;
        return (
          <React.Fragment key={s}>
            <View
              style={{
                width: active ? 28 : 24,
                height: active ? 28 : 24,
                borderRadius: 14,
                backgroundColor: done
                  ? theme.success
                  : active
                  ? theme.primary
                  : theme.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {done ? (
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              ) : (
                <Typography variant="captionBold" color="#FFFFFF">
                  {i + 1}
                </Typography>
              )}
            </View>
            {i < steps.length - 1 && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: done ? theme.success : theme.border,
                  borderRadius: 1,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function CreatePactScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  // ─── State ───────────────────────────────────────────────
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [duration, setDuration] = useState<3 | 7 | 14>(7);
  const [dailyTarget, setDailyTarget] = useState(20);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  // ─── Friends query ────────────────────────────────────────
  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: fetchFriends,
    staleTime: 60_000,
  });

  // ─── Mutation ─────────────────────────────────────────────
  const { mutate: submit, isPending } = useMutation({
    mutationFn: () =>
      createStudyPact({
        name: name.trim() || 'Study Pact',
        dailyTarget,
        durationDays: duration,
        memberFirebaseUids: selectedFriendIds,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['active-pact'] });
      router.back();
    },
    onError: () => {
      Alert.alert('Error', 'Could not create pact. Please try again.');
    },
  });

  const toggleFriend = (id: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id].slice(0, 4),
    );
  };

  const nextStep = () => {
    if (step === 'details') setStep('invite');
    else if (step === 'invite') setStep('confirm');
    else submit();
  };

  const backStep = () => {
    if (step === 'invite') setStep('details');
    else if (step === 'confirm') setStep('invite');
    else router.back();
  };

  const canAdvance =
    step === 'details'
      ? name.trim().length >= 2
      : step === 'invite'
      ? selectedFriendIds.length >= 1
      : true;

  // ─── Render ───────────────────────────────────────────────

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            onPress={backStep}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Typography variant="h4">Create a Study Pact</Typography>
            <Typography variant="caption" color={theme.textTertiary}>
              Study together, stay accountable
            </Typography>
          </View>
        </View>

        {/* Step indicator */}
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
          <StepIndicator current={step} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing['3xl'],
            gap: spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Step 1: Details ─────────────────────────────── */}
          {step === 'details' && (
            <>
              <View style={{ gap: spacing.sm }}>
                <Typography variant="label" color={theme.textSecondary}>
                  Pact name
                </Typography>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. JEE Physics Warriors"
                  placeholderTextColor={theme.textPlaceholder}
                  maxLength={50}
                  style={{
                    backgroundColor: theme.card,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: name.length > 0 ? theme.primary : theme.border,
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.md,
                    color: theme.text,
                    fontSize: 16,
                  }}
                  accessibilityLabel="Pact name"
                />
              </View>

              <View style={{ gap: spacing.sm }}>
                <Typography variant="label" color={theme.textSecondary}>
                  Duration
                </Typography>
                {DURATIONS.map((d) => (
                  <OptionPill
                    key={d.value}
                    label={d.label}
                    sub={d.sub}
                    selected={duration === d.value}
                    onPress={() => setDuration(d.value)}
                  />
                ))}
              </View>

              <View style={{ gap: spacing.sm }}>
                <Typography variant="label" color={theme.textSecondary}>
                  Daily study target
                </Typography>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {TARGETS.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => setDailyTarget(t.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: dailyTarget === t.value }}
                      style={{
                        paddingHorizontal: spacing.base,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.full,
                        borderWidth: dailyTarget === t.value ? 2 : 1,
                        borderColor: dailyTarget === t.value ? theme.primary : theme.border,
                        backgroundColor: dailyTarget === t.value ? theme.primaryMuted : theme.card,
                      }}
                    >
                      <Typography
                        variant="label"
                        color={dailyTarget === t.value ? theme.primary : theme.text}
                      >
                        {t.label}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* ─── Step 2: Invite friends ───────────────────────── */}
          {step === 'invite' && (
            <>
              <View style={{ gap: spacing.xs }}>
                <Typography variant="label" color={theme.textSecondary}>
                  Select up to 4 friends
                </Typography>
                <Typography variant="caption" color={theme.textTertiary}>
                  Everyone in the pact can see each other's daily progress
                </Typography>
              </View>

              {friendsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} width="100%" height={72} borderRadius={radius.xl} />
                ))
              ) : !friends || friends.length === 0 ? (
                <View
                  style={{
                    alignItems: 'center',
                    padding: spacing['2xl'],
                    backgroundColor: theme.cardAlt,
                    borderRadius: radius['2xl'],
                    gap: spacing.md,
                  }}
                >
                  <Ionicons name="people-outline" size={40} color={theme.textTertiary} />
                  <Typography variant="body" color={theme.textSecondary} align="center">
                    No friends yet — add some from the Social tab first
                  </Typography>
                </View>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {friends.map((friend) => (
                    <FriendRow
                      key={friend.id}
                      friend={friend}
                      selected={selectedFriendIds.includes(friend.id)}
                      onToggle={() => toggleFriend(friend.id)}
                    />
                  ))}
                </View>
              )}
            </>
          )}

          {/* ─── Step 3: Confirm ──────────────────────────────── */}
          {step === 'confirm' && (
            <>
              <View
                style={{
                  backgroundColor: theme.primaryMuted,
                  borderRadius: radius['2xl'],
                  borderWidth: 1.5,
                  borderColor: theme.primary + '33',
                  padding: spacing.xl,
                  gap: spacing.md,
                }}
              >
                <Typography variant="h4" color={theme.primary}>
                  🤝 {name.trim() || 'Study Pact'}
                </Typography>

                {[
                  { icon: 'calendar-outline', label: 'Duration', value: `${duration} days` },
                  { icon: 'time-outline', label: 'Daily Target', value: `${dailyTarget} min/day` },
                  { icon: 'people-outline', label: 'Members', value: `You + ${selectedFriendIds.length} friend${selectedFriendIds.length !== 1 ? 's' : ''}` },
                ].map((row) => (
                  <View
                    key={row.label}
                    style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}
                  >
                    <Ionicons name={row.icon as never} size={16} color={theme.primary} />
                    <Typography variant="body" color={theme.textSecondary} style={{ flex: 1 }}>
                      {row.label}
                    </Typography>
                    <Typography variant="label" color={theme.text}>
                      {row.value}
                    </Typography>
                  </View>
                ))}
              </View>

              <View
                style={{
                  backgroundColor: theme.cardAlt,
                  borderRadius: radius.xl,
                  padding: spacing.base,
                  flexDirection: 'row',
                  gap: spacing.md,
                  alignItems: 'flex-start',
                }}
              >
                <Ionicons name="information-circle-outline" size={18} color={theme.textTertiary} />
                <Typography variant="caption" color={theme.textSecondary} style={{ flex: 1 }}>
                  All members will receive a notification when the pact starts. Miss two days in a row and the pact breaks — daily accountability keeps everyone on track.
                </Typography>
              </View>
            </>
          )}
        </ScrollView>

        {/* Bottom CTA */}
        <View
          style={{
            paddingHorizontal: spacing.xl,
            paddingBottom: Platform.OS === 'ios' ? spacing['2xl'] : spacing.xl,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.divider,
            backgroundColor: theme.background,
          }}
        >
          <Button
            onPress={nextStep}
            variant="primary"
            loading={isPending}
            disabled={!canAdvance || isPending}
          >
            {step === 'details'
              ? 'Next: Invite Friends'
              : step === 'invite'
              ? 'Next: Review'
              : 'Create Pact 🤝'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}
