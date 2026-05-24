// ─── Institute Home Screen ─────────────────────────────────────────
// Lists the student's active memberships. For each institute shows:
//   - Institute name + role
//   - Assigned tests (live/scheduled) with status chips
//   - Quick navigation to take a test
// If not yet a member → shows "Join" prompt.

import { useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Typography } from '../../src/components/ui/Typography';
import { Skeleton } from '../../src/components/ui/Skeleton';
import {
  fetchMyMemberships,
  fetchInstituteTests,
  type InstituteMembership,
  type InstituteTest,
} from '../../src/services/api-contracts';

// ── Status chip config ──────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Upcoming',  color: '#fbbf24', bg: 'rgba(245,158,11,0.15)' },
  live:      { label: '🔴 Live',   color: '#4ade80', bg: 'rgba(34,197,94,0.15)'  },
  closed:    { label: 'Closed',    color: '#f87171', bg: 'rgba(239,68,68,0.15)'  },
  graded:    { label: 'Graded',    color: '#a5b4fc', bg: 'rgba(99,102,241,0.15)' },
};

// ── Sub: Tests card list for one membership ─────────────────────

function InstituteSection({
  membership,
  index,
}: {
  membership: InstituteMembership;
  index: number;
}) {
  const { theme } = useTheme();
  const router = useRouter();

  const { data: tests, isLoading } = useQuery({
    queryKey: ['institute-tests', membership.instituteId],
    queryFn:  () => fetchInstituteTests(membership.instituteId),
    staleTime: 60_000,
  });

  const visibleTests = (tests ?? []).filter(t => t.status === 'live' || t.status === 'scheduled');

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).springify()}
      style={{
        marginBottom: spacing.lg,
        backgroundColor: theme.surface.secondary,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: theme.border.default,
        overflow: 'hidden',
      }}
    >
      {/* Institute header */}
      <LinearGradient
        colors={['rgba(99,102,241,0.18)', 'rgba(139,92,246,0.10)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <View style={{
          width: 44, height: 44, borderRadius: radius.lg,
          backgroundColor: 'rgba(99,102,241,0.25)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="school" size={22} color="#a5b4fc" />
        </View>
        <View style={{ flex: 1 }}>
          <Typography variant="h3" color={theme.text.primary} numberOfLines={1}>
            {membership.instituteName}
          </Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
            <Typography variant="caption" color="#a5b4fc">
              {membership.role.replace('_', ' ')}
            </Typography>
            {membership.studentUid && (
              <Typography variant="caption" color={theme.text.tertiary}>
                · #{membership.studentUid}
              </Typography>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* Tests list */}
      <View style={{ padding: spacing.md }}>
        {isLoading ? (
          <>
            <Skeleton height={70} style={{ borderRadius: radius.lg, marginBottom: spacing.sm }} />
            <Skeleton height={70} style={{ borderRadius: radius.lg }} />
          </>
        ) : visibleTests.length === 0 ? (
          <View style={{
            paddingVertical: spacing.xl,
            alignItems: 'center', gap: spacing.sm,
          }}>
            <Ionicons name="clipboard-outline" size={28} color={theme.text.tertiary} />
            <Typography variant="body" color={theme.text.tertiary} style={{ textAlign: 'center' }}>
              No active tests right now
            </Typography>
            <Typography variant="caption" color={theme.text.tertiary} style={{ textAlign: 'center' }}>
              Check back when your educator publishes a test
            </Typography>
          </View>
        ) : (
          visibleTests.map(test => (
            <TestRow
              key={test.id}
              test={test}
              onPress={() => router.push(`/institute/tests/${test.id}?instituteId=${membership.instituteId}`)}
            />
          ))
        )}
        {/* Leaderboard link */}
        <TouchableOpacity
          onPress={() => router.push(
            `/institute/leaderboard?instituteId=${membership.instituteId}&instituteName=${encodeURIComponent(membership.instituteName)}` as never,
          )}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
            borderTopWidth: 1, borderTopColor: 'rgba(99,102,241,0.1)',
            marginTop: spacing.xs,
          }}
        >
          <Ionicons name="trophy-outline" size={14} color="#a5b4fc" />
          <Typography variant="caption" color="#a5b4fc" style={{ fontWeight: '600' }}>
            View Leaderboard
          </Typography>
          <Ionicons name="chevron-forward" size={12} color="#a5b4fc" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}


function TestRow({ test, onPress }: { test: InstituteTest; onPress: () => void }) {
  const { theme } = useTheme();
  const cfg = STATUS_CFG[test.status] ?? { label: test.status, color: '#9ca3af', bg: 'rgba(107,114,128,0.15)' };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.lg,
        marginBottom: spacing.xs,
        borderWidth: 1,
        borderColor: test.status === 'live' ? 'rgba(34,197,94,0.2)' : 'transparent',
        backgroundColor: test.status === 'live' ? 'rgba(34,197,94,0.05)' : theme.surface.primary,
      }}
    >
      {/* Test icon */}
      <View style={{
        width: 40, height: 40, borderRadius: radius.md,
        backgroundColor: `${cfg.color}18`,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: `${cfg.color}30`,
      }}>
        <Ionicons name="document-text-outline" size={18} color={cfg.color} />
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Typography variant="label" color={theme.text.primary} numberOfLines={1}>
          {test.title}
        </Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 }}>
          <Typography variant="caption" color={theme.text.tertiary}>
            {test.questionCount}Q · {test.durationMinutes}min
          </Typography>
        </View>
      </View>

      {/* Status + chevron */}
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={{
          paddingHorizontal: spacing.sm, paddingVertical: 3,
          borderRadius: radius.full,
          backgroundColor: cfg.bg,
        }}>
          <Typography variant="caption" color={cfg.color} style={{ fontSize: 11, fontWeight: '600' }}>
            {cfg.label}
          </Typography>
        </View>
        <Ionicons name="chevron-forward" size={14} color={theme.text.tertiary} />
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ─────────────────────────────────────────────────

export default function InstituteHomeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: memberships,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['institute-memberships'],
    queryFn:  fetchMyMemberships,
    // 60 s staleTime — short enough that a just-invalidated cache from
    // the join screen triggers an immediate re-fetch on mount.
    staleTime: 60_000,
  });

  // Refetch whenever this screen comes into focus (e.g., user returns
  // via back button from the join screen without replace()).
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['institute-memberships'] });
    }, [queryClient]),
  );

  const onRefresh = useCallback(() => { void refetch(); }, [refetch]);

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {/* Page header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl }}>
          <View>
            <Typography variant="h1" color={theme.text.primary}>My Institute</Typography>
            <Typography variant="body" color={theme.text.secondary} style={{ marginTop: 2 }}>
              Tests and activities from your institute
            </Typography>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/institute/join')}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
              borderRadius: radius.lg,
              backgroundColor: 'rgba(99,102,241,0.12)',
              borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)',
            }}
          >
            <Ionicons name="add" size={16} color="#a5b4fc" />
            <Typography variant="caption" color="#a5b4fc" style={{ fontWeight: '600' }}>
              Join
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Loading */}
        {isLoading && (
          <>
            <Skeleton height={180} style={{ borderRadius: radius.xl, marginBottom: spacing.lg }} />
            <Skeleton height={180} style={{ borderRadius: radius.xl }} />
          </>
        )}

        {/* Not a member */}
        {!isLoading && (!memberships || memberships.length === 0) && (
          <Animated.View
            entering={FadeInDown.springify()}
            style={{
              alignItems: 'center', paddingVertical: spacing.xl * 2,
              gap: spacing.lg,
            }}
          >
            <LinearGradient
              colors={['rgba(99,102,241,0.2)', 'rgba(139,92,246,0.1)']}
              style={{
                width: 100, height: 100, borderRadius: 30,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)',
              }}
            >
              <Ionicons name="school-outline" size={48} color="#6366f1" />
            </LinearGradient>
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <Typography variant="h2" color={theme.text.primary} style={{ textAlign: 'center' }}>
                Not enrolled yet
              </Typography>
              <Typography variant="body" color={theme.text.secondary} style={{ textAlign: 'center', lineHeight: 22 }}>
                Ask your educator for a join code to access{'\\n'}institute tests and activities
              </Typography>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/institute/join')}
              activeOpacity={0.85}
              style={{ borderRadius: radius.xl, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                  paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
                }}
              >
                <Ionicons name="enter-outline" size={18} color="white" />
                <Typography variant="button" color="white">Enter Join Code</Typography>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Memberships */}
        {(memberships ?? []).map((m, i) => (
          <InstituteSection key={m.id} membership={m} index={i} />
        ))}
      </ScrollView>
    </ScreenWrapper>
  );
}
