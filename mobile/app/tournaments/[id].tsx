// ─── Tournament Detail Screen ──────────────────────────────────
// Shows full tournament info, rules, entry/play CTA, and leaderboard.

import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { ErrorState } from '../../src/components/ui/ErrorState';
import { CoinDisplay } from '../../src/components/CoinDisplay';
import { useTournament, useTournamentLeaderboard, useEnterTournament } from '../../src/hooks/useTournaments';
import { useCoinBalance } from '../../src/hooks/useGamification';
// FIX TD1: Use shared constants instead of inline duplicates
import { TIER_LABELS, formatDate } from '../../src/utils/constants';

// ─── Screen ──────────────────────────────────────────────────

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  // FIX B6: Remove non-null assertions — use safe fallback with enabled guard in hook
  const { data: tournament, isLoading, isError, refetch } = useTournament(id ?? '');
  const { data: leaderboard, isLoading: lbLoading, refetch: refetchLb } = useTournamentLeaderboard(id ?? '');
  const { data: coinData } = useCoinBalance();
  const enterMutation = useEnterTournament();
  const [entering, setEntering] = useState(false);
  const coins = coinData?.balance ?? 0;

  const onRefresh = useCallback(() => {
    void refetch();
    void refetchLb();
  }, [refetch, refetchLb]);

  const handleEnter = useCallback(() => {
    if (!tournament) return;
    const feeMsg = tournament.entryFeeCoins > 0
      ? `\nEntry fee: ${tournament.entryFeeCoins} coins`
      : '\nFree entry';

    Alert.alert(
      'Enter Tournament',
      `Join "${tournament.name}"?${feeMsg}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enter',
          onPress: async () => {
            setEntering(true);
            try {
              const result = await enterMutation.mutateAsync(tournament._id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('🎉 Entered!', result.message);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Could not enter tournament.';
              Alert.alert('Entry Failed', msg);
            } finally {
              setEntering(false);
            }
          },
        },
      ],
    );
  }, [tournament, enterMutation]);

  const handlePlay = useCallback(() => {
    if (!tournament) return;
    // Navigate to the appropriate study flow based on tournament config,
    // passing tournamentId so the flashcard screen can submit scores.
    if (tournament.examId) {
      router.push({
        pathname: '/exams/[examId]/subjects' as const,
        params: { examId: tournament.examId, title: tournament.name, tournamentId: tournament._id },
      });
    } else if (tournament.deckId) {
      router.push({
        pathname: '/flashcards/[id]',
        params: { id: tournament.deckId, title: tournament.name, tournamentId: tournament._id },
      });
    } else {
      Alert.alert('Tournament', 'This tournament does not have a linked exam or deck yet.');
    }
  }, [tournament, router]);

  if (isError) {
    return (
      <ScreenWrapper>
        <Header showBack title="Tournament" />
        <ErrorState message="Could not load tournament." onRetry={() => void refetch()} />
      </ScreenWrapper>
    );
  }

  if (isLoading || !tournament) {
    return (
      <ScreenWrapper>
        <Header showBack title="Tournament" />
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: spacing['3xl'] }} />
      </ScreenWrapper>
    );
  }

  const isActive = tournament.status === 'active';
  const isFull = tournament.maxParticipants > 0 && tournament.entryCount >= tournament.maxParticipants;
  const hasEntered = tournament.hasEntered;
  const canAfford = coins >= tournament.entryFeeCoins;

  return (
    <ScreenWrapper>
      <Header showBack title={tournament.name} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['4xl'], gap: spacing.lg }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* ── Status + Coin balance ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{
            paddingHorizontal: spacing.md, paddingVertical: 4,
            borderRadius: radius.full,
            backgroundColor: isActive ? '#10B98122' : '#6B728022',
          }}>
            <Typography variant="caption" color={isActive ? '#10B981' : '#6B7280'}>
              {tournament.status.toUpperCase()}
            </Typography>
          </View>
          <CoinDisplay coins={coins} size="md" />
        </View>

        {/* ── Description ── */}
        {tournament.description ? (
          <Card>
            <View style={{ gap: spacing.sm }}>
              <Typography variant="label">About</Typography>
              <Typography variant="body" color={theme.textSecondary}>
                {tournament.description}
              </Typography>
            </View>
          </Card>
        ) : null}

        {/* ── Details Grid ── */}
        <Card>
          <View style={{ gap: spacing.md }}>
            <Typography variant="label">Details</Typography>
            <DetailRow icon="calendar-outline" label="Starts" value={formatDate(tournament.startsAt)} />
            <DetailRow icon="calendar-outline" label="Ends" value={formatDate(tournament.endsAt)} />
            <DetailRow
              icon="people-outline"
              label="Participants"
              value={`${tournament.entryCount}${tournament.maxParticipants > 0 ? ' / ' + tournament.maxParticipants : ''}`}
            />
            {tournament.entryFeeCoins > 0 && (
              <DetailRow icon="wallet-outline" label="Entry Fee" value={`${tournament.entryFeeCoins} coins`} />
            )}
            {tournament.requiredTier > 0 && (
              <DetailRow icon="shield-outline" label="Required Plan" value={`${TIER_LABELS[tournament.requiredTier]}+`} />
            )}
          </View>
        </Card>

        {/* ── Prize ── */}
        {(tournament.prizeDescription || tournament.prizeCoins > 0) ? (
          <Card>
            <View style={{ gap: spacing.sm }}>
              <Typography variant="label">🏆 Prize</Typography>
              {tournament.prizeCoins > 0 && (
                <View style={{
                  backgroundColor: '#F59E0B18', padding: spacing.md,
                  borderRadius: radius.lg, alignItems: 'center',
                }}>
                  <Typography variant="h3" color="#F59E0B">{tournament.prizeCoins}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>coins to the winner</Typography>
                </View>
              )}
              {tournament.prizeDescription ? (
                <Typography variant="body" color={theme.textSecondary}>
                  {tournament.prizeDescription}
                </Typography>
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* ── Rules ── */}
        {tournament.rules ? (
          <Card>
            <View style={{ gap: spacing.sm }}>
              <Typography variant="label">📋 Rules</Typography>
              <Typography variant="bodySmall" color={theme.textSecondary}>
                {tournament.rules}
              </Typography>
            </View>
          </Card>
        ) : null}

        {/* ── Action Button ── */}
        {isActive && (
          <View style={{ gap: spacing.sm }}>
            {hasEntered ? (
              // Already entered → show "Play" button
              <TouchableOpacity
                onPress={handlePlay}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#10B981',
                  paddingVertical: spacing.md,
                  borderRadius: radius.xl,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: spacing.sm,
                }}
              >
                <Ionicons name="play-circle" size={22} color="#FFFFFF" />
                <Typography variant="label" color="#FFFFFF">Play Tournament</Typography>
              </TouchableOpacity>
            ) : isFull ? (
              <View style={{
                paddingVertical: spacing.md, borderRadius: radius.xl,
                alignItems: 'center', backgroundColor: theme.cardAlt,
              }}>
                <Typography variant="label" color={theme.textTertiary}>Tournament is Full</Typography>
              </View>
            ) : (
              // Not entered → show "Enter" button
              <TouchableOpacity
                onPress={handleEnter}
                disabled={entering || !canAfford}
                activeOpacity={0.8}
                style={{
                  backgroundColor: canAfford ? theme.primary : theme.cardAlt,
                  paddingVertical: spacing.md,
                  borderRadius: radius.xl,
                  alignItems: 'center',
                  opacity: entering ? 0.6 : 1,
                }}
              >
                <Typography variant="label" color={canAfford ? '#FFFFFF' : theme.textTertiary}>
                  {entering
                    ? 'Entering…'
                    : tournament.entryFeeCoins > 0
                      ? `Enter Tournament (${tournament.entryFeeCoins} coins)`
                      : 'Enter Tournament (Free)'}
                </Typography>
              </TouchableOpacity>
            )}

            {!canAfford && !hasEntered && tournament.entryFeeCoins > 0 && (
              <Typography variant="caption" color="#EF4444" style={{ textAlign: 'center' }}>
                You need {tournament.entryFeeCoins - coins} more coins to enter.
              </Typography>
            )}
          </View>
        )}

        {/* ── Leaderboard ── */}
        <Card>
          <View style={{ gap: spacing.md }}>
            <Typography variant="label">🏅 Leaderboard</Typography>
            {lbLoading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : !leaderboard || leaderboard.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                <Ionicons name="podium-outline" size={36} color={theme.textTertiary} />
                <Typography variant="bodySmall" color={theme.textTertiary} style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                  No scores yet.{'\n'}Be the first to compete!
                </Typography>
              </View>
            ) : (
              leaderboard.map((entry, i) => (
                <View
                  key={entry._id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                    paddingVertical: spacing.sm,
                    borderBottomWidth: i < leaderboard.length - 1 ? 1 : 0,
                    borderBottomColor: theme.border,
                  }}
                >
                  {/* Rank */}
                  <View style={{
                    width: 28, height: 28, borderRadius: radius.full,
                    backgroundColor: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#D97706' : theme.cardAlt,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography variant="caption" color={i < 3 ? '#FFFFFF' : theme.textSecondary}>
                      {i + 1}
                    </Typography>
                  </View>

                  {/* User — FIX U1: show displayName instead of raw userId */}
                  <View style={{ flex: 1 }}>
                    <Typography variant="bodySmall" numberOfLines={1}>
                      {(entry as { displayName?: string }).displayName ?? `User ${entry.userId.substring(0, 8)}`}
                    </Typography>
                    <Typography variant="caption" color={theme.textTertiary}>
                      {entry.answersCorrect}/{entry.answersTotal} correct
                    </Typography>
                  </View>

                  {/* Score */}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Typography variant="label" color={theme.primary}>{entry.score}</Typography>
                    <Typography variant="caption" color={theme.textTertiary}>pts</Typography>
                  </View>
                </View>
              ))
            )}
          </View>
        </Card>
      </ScrollView>
    </ScreenWrapper>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Ionicons name={icon} size={16} color={theme.textTertiary} />
      <Typography variant="bodySmall" color={theme.textTertiary} style={{ width: 100 }}>
        {label}
      </Typography>
      <Typography variant="bodySmall" style={{ flex: 1 }}>{value}</Typography>
    </View>
  );
}
