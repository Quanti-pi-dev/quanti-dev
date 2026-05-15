// ─── Institute Leaderboard Screen (Student-facing) ────────────────
// Shows the institute's weekly/all-time leaderboard.
// Accessible from the Institute home via a button per institute.

import { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../src/theme';
import { spacing, radius } from '../../../src/theme/tokens';
import { ScreenWrapper } from '../../../src/components/layout/ScreenWrapper';
import { Typography } from '../../../src/components/ui/Typography';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { apiGet } from '../../../src/services/api-contracts';

// ── Types ───────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  userId: string;
  studentUid: string | null;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
  totalParticipants: number;
  updatedAt: string;
}

// ── Podium ───────────────────────────────────────────────────────

function PodiumSlot({ entry, height }: { entry: LeaderboardEntry; height: number }) {
  const { theme } = useTheme();
  const initials = entry.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const isFirst = entry.rank === 1;
  const colors: Record<number, string> = { 1: '#f59e0b', 2: '#9ca3af', 3: '#92400e' };
  const color = colors[entry.rank] ?? '#6366f1';

  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      {isFirst && <Ionicons name="trophy" size={20} color="#f59e0b" />}
      {/* Avatar */}
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: isFirst ? '#f59e0b' : 'rgba(99,102,241,0.3)',
        borderWidth: 2, borderColor: color,
      }}>
        {entry.avatarUrl
          ? null // RN Image would go here
          : <Typography variant="label" color="white" style={{ fontWeight: '800' }}>{initials}</Typography>}
      </View>
      <Typography variant="caption" color={theme.text.primary} style={{ fontWeight: '700', maxWidth: 72 }} numberOfLines={1}>
        {entry.displayName.split(' ')[0]}
      </Typography>
      <Typography variant="caption" color={color} style={{ fontWeight: '800' }}>
        {entry.score.toLocaleString()}
      </Typography>
      {/* Podium block */}
      <View style={{
        width: 72, height, borderRadius: `${radius.md}px 10px 0 0`,
        backgroundColor: color + '22',
        borderWidth: 1, borderColor: color + '40',
        alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing.sm,
      }}>
        <Typography variant="label" color={color} style={{ fontWeight: '800', fontSize: 16 }}>
          #{entry.rank}
        </Typography>
      </View>
    </View>
  );
}

// ── Row ──────────────────────────────────────────────────────────

function LeaderRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const { theme } = useTheme();
  const initials = entry.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const rankColors: Record<number, string> = { 1: '#f59e0b', 2: '#9ca3af', 3: '#92400e' };
  const rankColor = rankColors[entry.rank];

  return (
    <Animated.View entering={FadeInDown.delay(entry.rank * 30).springify()}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
        backgroundColor: isMe ? 'rgba(99,102,241,0.1)' : 'transparent',
        borderBottomWidth: 1, borderBottomColor: theme.border.default + '60',
      }}>
      {/* Rank */}
      <View style={{ width: 28, alignItems: 'center' }}>
        {rankColor ? (
          <Ionicons name={entry.rank === 1 ? 'trophy' : 'medal'} size={18} color={rankColor} />
        ) : (
          <Typography variant="label" color={theme.text.tertiary} style={{ fontWeight: '700' }}>
            {entry.rank}
          </Typography>
        )}
      </View>
      {/* Avatar */}
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: isMe ? '#6366f1' : 'rgba(99,102,241,0.2)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Typography variant="caption" color="white" style={{ fontWeight: '700' }}>{initials}</Typography>
      </View>
      {/* Name */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Typography variant="label" color={isMe ? '#a5b4fc' : theme.text.primary} numberOfLines={1}>
          {entry.displayName} {isMe ? '(You)' : ''}
        </Typography>
        {entry.studentUid && (
          <Typography variant="caption" color={theme.text.tertiary}>#{entry.studentUid}</Typography>
        )}
      </View>
      {/* Score */}
      <View style={{ alignItems: 'flex-end' }}>
        <Typography variant="label" color={isMe ? '#a5b4fc' : theme.text.primary} style={{ fontWeight: '800' }}>
          {entry.score.toLocaleString()}
        </Typography>
        <Typography variant="caption" color={theme.text.tertiary}>pts</Typography>
      </View>
    </Animated.View>
  );
}

// ── Main screen ──────────────────────────────────────────────────

export default function InstituteLeaderboardScreen() {
  const { instituteId, instituteName } = useLocalSearchParams<{ instituteId: string; instituteName: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const [type, setType] = useState<'weekly' | 'global'>('weekly');

  const { data, isLoading, refetch, isRefetching } = useQuery<LeaderboardData>({
    queryKey: ['institute-leaderboard', instituteId, type],
    queryFn: () => apiGet<LeaderboardData>(
      `/institute/${instituteId}/leaderboard?type=${type}&limit=50`,
    ),
    staleTime: 2 * 60_000,
    enabled: !!instituteId,
  });

  const onRefresh = useCallback(() => { void refetch(); }, [refetch]);

  const entries = data?.entries ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const podiumOrder = top3.length >= 3 ? [top3[1]!, top3[0]!, top3[2]!] : top3;

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={{
        paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        borderBottomWidth: 1, borderBottomColor: theme.border.default,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.text.secondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Typography variant="h3" color={theme.text.primary}>Leaderboard</Typography>
          {instituteName && (
            <Typography variant="caption" color={theme.text.tertiary} numberOfLines={1}>{instituteName}</Typography>
          )}
        </View>
        {/* Type toggle */}
        <View style={{
          flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.lg,
          backgroundColor: theme.surface.secondary, borderWidth: 1, borderColor: theme.border.default,
        }}>
          {(['weekly', 'global'] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setType(t)}
              style={{
                paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.md,
                backgroundColor: type === t ? '#6366f1' : 'transparent',
              }}>
              <Typography variant="caption" color={type === t ? 'white' : theme.text.tertiary}
                style={{ fontWeight: '600' }}>
                {t === 'weekly' ? '🔥 Week' : '🌍 All'}
              </Typography>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {isLoading ? (
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height={60} style={{ borderRadius: radius.lg }} />
            ))}
          </View>
        ) : entries.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl * 2, gap: spacing.lg }}>
            <LinearGradient colors={['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.05)']}
              style={{ width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trophy-outline" size={36} color="#6366f1" />
            </LinearGradient>
            <Typography variant="body" color={theme.text.secondary} style={{ textAlign: 'center' }}>
              No rankings yet. Complete tests to appear here!
            </Typography>
          </View>
        ) : (
          <>
            {/* Podium */}
            {top3.length === 3 && (
              <LinearGradient
                colors={['rgba(99,102,241,0.15)', 'transparent']}
                style={{
                  paddingTop: spacing.xl, paddingBottom: spacing.md,
                  paddingHorizontal: spacing.xl,
                  flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: spacing.md,
                }}
              >
                {podiumOrder.map((e, i) => (
                  <PodiumSlot key={e.userId} entry={e} height={i === 1 ? 80 : 56} />
                ))}
              </LinearGradient>
            )}

            {/* Full list */}
            <View style={{
              marginHorizontal: spacing.lg, borderRadius: radius.xl, overflow: 'hidden',
              borderWidth: 1, borderColor: theme.border.default,
              backgroundColor: theme.surface.secondary, marginBottom: spacing.xl,
            }}>
              {entries.map(entry => (
                <LeaderRow
                  key={entry.userId}
                  entry={entry}
                  isMe={entry.userId === data?.userRank?.userId}
                />
              ))}
            </View>

            {/* My rank (if outside top list) */}
            {data?.userRank && !entries.find(e => e.userId === data.userRank?.userId) && (
              <View style={{
                marginHorizontal: spacing.lg, marginBottom: spacing.xl,
                borderRadius: radius.xl, overflow: 'hidden',
                borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
              }}>
                <View style={{ padding: spacing.sm }}>
                  <Typography variant="caption" color={theme.text.tertiary} style={{ textAlign: 'center', marginBottom: spacing.xs }}>
                    Your ranking
                  </Typography>
                  <LeaderRow entry={data.userRank} isMe />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
