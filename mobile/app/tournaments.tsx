// ─── Tournaments Screen ──────────────────────────────────────
// Lists active + upcoming tournaments. Entry with coin escrow.

import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../src/theme';
import { spacing, radius } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Header } from '../src/components/layout/Header';
import { Typography } from '../src/components/ui/Typography';
import { Card } from '../src/components/ui/Card';
import { ErrorState } from '../src/components/ui/ErrorState';
import { CoinDisplay } from '../src/components/CoinDisplay';
import { useTournaments, useEnterTournament } from '../src/hooks/useTournaments';
import { useCoinBalance } from '../src/hooks/useGamification';
import type { Tournament } from '../src/services/tournament.service';

// ─── Helpers ─────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TIER_LABELS: Record<number, string> = { 0: 'Free', 1: 'Basic', 2: 'Pro', 3: 'Master' };
const STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  draft: '#F59E0B',
  completed: '#6B7280',
  cancelled: '#EF4444',
};

// ─── Tournament Card ─────────────────────────────────────────

function TournamentCard({
  tournament,
  onEnter,
  onView,
  entering,
  coins,
}: {
  tournament: Tournament;
  onEnter: (t: Tournament) => void;
  onView: (t: Tournament) => void;
  entering: boolean;
  coins: number;
}) {
  const { theme } = useTheme();
  const isActive = tournament.status === 'active';
  const isFull = tournament.maxParticipants > 0 && tournament.entryCount >= tournament.maxParticipants;
  const canAfford = coins >= tournament.entryFeeCoins;
  const hasEntered = tournament.hasEntered === true;
  const statusColor = STATUS_COLORS[tournament.status] ?? theme.textTertiary;

  return (
    <TouchableOpacity onPress={() => onView(tournament)} activeOpacity={0.85}>
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ gap: spacing.sm }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Typography variant="h4">{tournament.name}</Typography>
            {tournament.description ? (
              <Typography variant="bodySmall" color={theme.textSecondary} numberOfLines={2}>
                {tournament.description}
              </Typography>
            ) : null}
          </View>
          <View style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: radius.full,
            backgroundColor: statusColor + '22',
          }}>
            <Typography variant="caption" color={statusColor}>
              {tournament.status.toUpperCase()}
            </Typography>
          </View>
        </View>

        {/* Info grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <InfoChip icon="calendar-outline" label={`${formatDate(tournament.startsAt)} — ${formatDate(tournament.endsAt)}`} />
          <InfoChip icon="people-outline" label={`${tournament.entryCount}${tournament.maxParticipants > 0 ? '/' + tournament.maxParticipants : ''} entered`} />
          {tournament.entryFeeCoins > 0 && (
            <InfoChip icon="logo-usd" label={`${tournament.entryFeeCoins} coins entry`} />
          )}
          {tournament.prizeCoins > 0 && (
            <InfoChip icon="trophy-outline" label={`${tournament.prizeCoins} coins prize`} />
          )}
          {tournament.requiredTier > 0 && (
            <InfoChip icon="shield-outline" label={`${TIER_LABELS[tournament.requiredTier]}+ only`} />
          )}
        </View>

        {/* Prize */}
        {tournament.prizeDescription ? (
          <View style={{
            backgroundColor: '#F59E0B18',
            padding: spacing.sm,
            borderRadius: radius.md,
          }}>
            <Typography variant="caption" color="#F59E0B">
              🏆 {tournament.prizeDescription}
            </Typography>
          </View>
        ) : null}

        {/* Action button */}
        {isActive && hasEntered ? (
          <View style={{
            backgroundColor: '#10B98118',
            paddingVertical: spacing.sm,
            borderRadius: radius.lg,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.xs,
          }}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Typography variant="label" color="#10B981">Entered — Tap to Play</Typography>
          </View>
        ) : isActive && !isFull ? (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onEnter(tournament); }}
            disabled={entering || !canAfford}
            activeOpacity={0.8}
            style={{
              backgroundColor: canAfford ? theme.primary : theme.cardAlt,
              paddingVertical: spacing.sm,
              borderRadius: radius.lg,
              alignItems: 'center',
              opacity: entering ? 0.6 : 1,
            }}
          >
            <Typography variant="label" color={canAfford ? '#FFFFFF' : theme.textTertiary}>
              {entering
                ? 'Entering…'
                : tournament.entryFeeCoins > 0
                  ? `Enter (${tournament.entryFeeCoins} coins)`
                  : 'Enter Free'}
            </Typography>
          </TouchableOpacity>
        ) : isFull ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xs }}>
            <Typography variant="caption" color={theme.textTertiary}>Tournament is full</Typography>
          </View>
        ) : null}
      </View>
    </Card>
    </TouchableOpacity>
  );
}

function InfoChip({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: theme.cardAlt, borderRadius: radius.md,
      paddingHorizontal: spacing.sm, paddingVertical: 3,
    }}>
      <Ionicons name={icon} size={12} color={theme.textTertiary} />
      <Typography variant="caption" color={theme.textSecondary}>{label}</Typography>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────

export default function TournamentsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { data: tournaments, isLoading, isError, refetch } = useTournaments();
  const { data: coinData } = useCoinBalance();
  const enterMutation = useEnterTournament();
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const coins = coinData?.balance ?? 0;

  const handleView = useCallback((tournament: Tournament) => {
    router.push({
      pathname: '/tournaments/[id]' as never,
      params: { id: tournament._id },
    });
  }, [router]);

  const handleEnter = useCallback((tournament: Tournament) => {
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
            setEnteringId(tournament._id);
            try {
              const result = await enterMutation.mutateAsync(tournament._id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('🎉 Entered!', result.message);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Could not enter tournament.';
              Alert.alert('Entry Failed', msg);
            } finally {
              setEnteringId(null);
            }
          },
        },
      ],
    );
  }, [enterMutation]);

  return (
    <ScreenWrapper>
      <Header showBack title="Tournaments" />

      {isError ? (
        <ErrorState
          message="Could not load tournaments."
          onRetry={() => void refetch()}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: spacing.xl,
            paddingBottom: spacing['4xl'],
          }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => void refetch()}
              tintColor={theme.primary}
            />
          }
        >
          {/* Balance bar */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: spacing.lg,
          }}>
            <Typography variant="bodySmall" color={theme.textTertiary}>
              {(tournaments ?? []).length} tournament{(tournaments ?? []).length !== 1 ? 's' : ''} available
            </Typography>
            <CoinDisplay coins={coins} size="md" />
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: spacing['2xl'] }} />
          ) : (tournaments ?? []).length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing['3xl'] }}>
              <Ionicons name="trophy-outline" size={48} color={theme.textTertiary} />
              <Typography variant="body" color={theme.textTertiary} style={{ marginTop: spacing.md, textAlign: 'center' }}>
                No tournaments running right now.{'\n'}Check back soon!
              </Typography>
            </View>
          ) : (
            (tournaments ?? []).map((t) => (
              <TournamentCard
                key={t._id}
                tournament={t}
                onEnter={handleEnter}
                onView={handleView}
                entering={enteringId === t._id}
                coins={coins}
              />
            ))
          )}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}
