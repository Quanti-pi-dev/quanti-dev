// \u2500\u2500\u2500 Active Study Pact Detail Screen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Shows the requesting user's active study pact group progress:
// each member's daily minutes studied vs target, streak days,
// overall completion rate, and the pact's remaining days.
//
// Psychology (Blueprint \u00a73.2 \u2014 Social Accountability):
//   Seeing peers' real-time progress creates both positive social
//   proof (seeing members succeed) and gentle shame pressure (seeing
//   members miss). This dual-incentive structure makes the pact
//   2\u00d7 more effective than self-directed study goals alone.
//
// Accessible from:
//   - Social screen header "Pact" button (via router.push)
//   - Push notification deep-link with action='study_pact'

import { useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { fetchActivePact } from '../../src/services/behavioral-contracts';
import type { StudyPact, StudyPactMember } from '../../src/services/behavioral-contracts';

// \u2500\u2500\u2500 Progress Bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function AnimatedProgressBar({
  progress,
  color,
  height = 8,
}: {
  progress: number;  // 0\u20131
  color: string;
  height?: number;
}) {
  const width = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` as unknown as number }));

  useEffect(() => {
    width.value = withTiming(Math.min(progress, 1), { duration: 700 });
  }, [progress]);

  return (
    <View
      style={{
        height,
        borderRadius: radius.full,
        backgroundColor: 'rgba(255,255,255,0.12)',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          style,
          { height, borderRadius: radius.full, backgroundColor: color },
        ]}
      />
    </View>
  );
}

// \u2500\u2500\u2500 Member Row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function MemberRow({
  member,
  index,
}: {
  member: StudyPactMember;
  index: number;
}) {
  const { theme } = useTheme();
  const progress = member.dailyTarget > 0
    ? Math.min(member.todayMinutes / member.dailyTarget, 1)
    : 0;

  const statusColor = member.metTargetToday
    ? theme.success
    : member.todayMinutes > 0
    ? '#F59E0B'
    : theme.textTertiary;

  const statusIcon: 'checkmark-circle' | 'time-outline' | 'moon-outline' = member.metTargetToday
    ? 'checkmark-circle'
    : member.todayMinutes > 0
    ? 'time-outline'
    : 'moon-outline';

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(300)}
      style={{
        backgroundColor: theme.card,
        borderRadius: radius.xl,
        padding: spacing.base,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: member.metTargetToday ? theme.success + '44' : theme.border,
      }}
    >
      {/* Name + status badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {/* Avatar placeholder */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.primaryMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography style={{ fontSize: 16 }}>
            {member.displayName.slice(0, 1).toUpperCase()}
          </Typography>
        </View>

        <View style={{ flex: 1 }}>
          <Typography variant="label">{member.displayName}</Typography>
          <Typography variant="caption" color={theme.textTertiary}>
            {member.streak > 0 ? `\uD83D\uDD25 ${member.streak}-day streak` : 'No streak yet'}
          </Typography>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={statusIcon} size={16} color={statusColor} />
          <Typography variant="captionBold" color={statusColor}>
            {member.metTargetToday
              ? 'Done!'
              : member.todayMinutes > 0
              ? `${member.todayMinutes}m`
              : 'Not started'}
          </Typography>
        </View>
      </View>

      {/* Daily progress bar */}
      <View style={{ gap: 4 }}>
        <AnimatedProgressBar progress={progress} color={statusColor} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Typography variant="caption" color={theme.textTertiary}>
            {member.todayMinutes} min studied
          </Typography>
          <Typography variant="caption" color={theme.textTertiary}>
            Goal: {member.dailyTarget} min
          </Typography>
        </View>
      </View>
    </Animated.View>
  );
}

// \u2500\u2500\u2500 Screen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export default function PactDetailScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const { data: pact, isLoading, isError, refetch } = useQuery<StudyPact | null>({
    queryKey: ['active-pact'],
    queryFn: fetchActivePact,
    staleTime: 2 * 60 * 1000, // 2-minute cache
    refetchOnWindowFocus: true,
  });

  // \u2500\u2500\u2500 Derived stats \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const daysRemaining = pact
    ? Math.max(0, Math.ceil((new Date(pact.endsAt).getTime() - Date.now()) / 86400000))
    : 0;

  const membersCompleted = pact?.members.filter((m) => m.metTargetToday).length ?? 0;
  const totalMembers = pact?.members.length ?? 0;

  const STATUS_CONFIG: Record<
    StudyPact['status'],
    { label: string; color: string; emoji: string }
  > = {
    pending:   { label: 'Starting soon',    color: '#F59E0B', emoji: '\u23F3' },
    active:    { label: 'Active',           color: theme.success, emoji: '\uD83D\uDD25' },
    completed: { label: 'Completed \uD83C\uDF89',   color: theme.primary, emoji: '\uD83C\uDF89' },
    broken:    { label: 'Pact broken',      color: theme.error, emoji: '\uD83D\uDCA9' },
  };

  const statusConfig = pact ? (STATUS_CONFIG[pact.status] ?? STATUS_CONFIG['active']) : STATUS_CONFIG['active'];

  // \u2500\u2500\u2500 Skeleton / Error / No pact states \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <Skeleton width="60%" height={28} borderRadius={radius.md} />
          <Skeleton width="100%" height={72} borderRadius={radius.xl} />
          <Skeleton width="100%" height={72} borderRadius={radius.xl} />
          <Skeleton width="100%" height={72} borderRadius={radius.xl} />
        </View>
      );
    }

    if (isError || !pact) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing['2xl'],
            gap: spacing.lg,
          }}
        >
          <Typography style={{ fontSize: 56 }}>\uD83E\uDD1D</Typography>
          <Typography variant="h4" align="center">No active pact</Typography>
          <Typography variant="body" color={theme.textSecondary} align="center">
            Create a study pact with friends to boost accountability and study together.
          </Typography>
          <TouchableOpacity
            onPress={() => router.push('/social/create-pact' as never)}
            accessibilityRole="button"
            accessibilityLabel="Create a pact"
            style={{
              backgroundColor: theme.primary,
              borderRadius: radius.full,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
            }}
          >
            <Typography variant="label" color={theme.buttonPrimaryText}>
              Start a Pact
            </Typography>
          </TouchableOpacity>
        </View>
      );
    }

    const overallProgress = totalMembers > 0 ? membersCompleted / totalMembers : 0;

    return (
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} tintColor={theme.primary} />
        }
      >
        {/* \u2500\u2500 Pact header card \u2500\u2500 */}
        <Animated.View
          entering={FadeInDown.duration(350)}
          style={{
            backgroundColor: theme.card,
            borderRadius: radius['2xl'],
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: statusConfig.color + '44',
            gap: spacing.md,
          }}
        >
          {/* Title row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <Typography style={{ fontSize: 32 }}>\uD83E\uDD1D</Typography>
            <View style={{ flex: 1 }}>
              <Typography variant="h4">{pact.name}</Typography>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
                <View
                  style={{
                    backgroundColor: statusConfig.color + '22',
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                  }}
                >
                  <Typography variant="captionBold" color={statusConfig.color} style={{ fontSize: 10 }}>
                    {statusConfig.label.toUpperCase()}
                  </Typography>
                </View>
              </View>
            </View>
          </View>

          {/* Stats row */}
          {[
            { icon: 'calendar-outline' as const, label: 'Duration', value: `${pact.durationDays} days` },
            { icon: 'time-outline' as const, label: 'Daily target', value: `${pact.dailyTarget} min` },
            { icon: 'hourglass-outline' as const, label: 'Days remaining', value: `${daysRemaining}` },
          ].map((stat) => (
            <View key={stat.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name={stat.icon} size={16} color={theme.textTertiary} />
              <Typography variant="body" color={theme.textSecondary} style={{ flex: 1 }}>
                {stat.label}
              </Typography>
              <Typography variant="label" color={theme.text}>{stat.value}</Typography>
            </View>
          ))}

          {/* Today's group progress */}
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Typography variant="captionBold" color={theme.textSecondary}>
                TODAY'S GROUP PROGRESS
              </Typography>
              <Typography variant="captionBold" color={theme.primary}>
                {membersCompleted}/{totalMembers} done
              </Typography>
            </View>
            <AnimatedProgressBar progress={overallProgress} color={theme.primary} height={10} />
          </View>
        </Animated.View>

        {/* \u2500\u2500 My status callout \u2500\u2500 */}
        {pact.myStatus && (
          <Animated.View
            entering={FadeInDown.delay(100).duration(300)}
            style={{
              backgroundColor:
                pact.myStatus === 'met'
                  ? theme.success + '18'
                  : pact.myStatus === 'at_risk'
                  ? '#F59E0B18'
                  : theme.error + '18',
              borderRadius: radius.xl,
              padding: spacing.base,
              borderWidth: 1,
              borderColor:
                pact.myStatus === 'met'
                  ? theme.success + '44'
                  : pact.myStatus === 'at_risk'
                  ? '#F59E0B44'
                  : theme.error + '44',
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <Typography style={{ fontSize: 24 }}>
              {pact.myStatus === 'met' ? '\u2705' : pact.myStatus === 'at_risk' ? '\u26A0\uFE0F' : '\uD83D\uDCA9'}
            </Typography>
            <View style={{ flex: 1 }}>
              <Typography variant="label">
                {pact.myStatus === 'met'
                  ? "You've hit today's target!"
                  : pact.myStatus === 'at_risk'
                  ? "You're at risk of missing today"
                  : 'Pact broken — study to recover'}
              </Typography>
              {pact.myStatus !== 'met' && (
                <Typography variant="caption" color={theme.textSecondary}>
                  {pact.myStatus === 'at_risk'
                    ? 'Quick \u2014 a short session now will keep the pact alive.'
                    : 'Your pact members are counting on you.'}
                </Typography>
              )}
            </View>
          </Animated.View>
        )}

        {/* \u2500\u2500 Members \u2500\u2500 */}
        <View style={{ gap: spacing.sm }}>
          <Typography variant="overline" color={theme.textTertiary}>
            MEMBERS
          </Typography>
          {pact.members.map((member, i) => (
            <MemberRow key={member.userId} member={member} index={i} />
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <ScreenWrapper>
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
        <Typography variant="h3" style={{ flex: 1 }}>
          Study Pact
        </Typography>
        {pact && (
          <TouchableOpacity
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Refresh pact data"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {renderContent()}
    </ScreenWrapper>
  );
}
