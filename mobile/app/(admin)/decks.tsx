// ─── Admin Deck Browser ──────────────────────────────────────
// List all decks with card counts, paginated. Delete with cascade warning.

import { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useGlobalUI } from '../../src/contexts/GlobalUIContext';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Divider } from '../../src/components/ui/Divider';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Input } from '../../src/components/ui/Input';
import {
  useAdminDecks,
  useDeleteDeck,
  type AdminDeck,
} from '../../src/hooks/useAdminSubscriptions';
import { useQueryClient } from '@tanstack/react-query';

// ─── Category badge colours ──────────────────────────────────

const CATEGORY_COLOURS: Record<string, string> = {
  subject: '#6366F1',
  exam: '#EC4899',
  shop: '#F59E0B',
};

function categoryColour(cat: string): string {
  return CATEGORY_COLOURS[cat.toLowerCase()] ?? '#8B5CF6';
}

export default function DecksScreen() {
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useAdminDecks(page, debouncedSearch);
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['admin', 'decks'] });
    setRefreshing(false);
  }, [qc]);
  const deleteDeck = useDeleteDeck();

  const decks = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pageSize: 50 };
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  function handleDelete(deck: AdminDeck) {
    const msg = deck.cardCount > 0
      ? `Delete "${deck.title}" and its ${deck.cardCount} flashcard(s)? This cannot be undone.`
      : `Delete "${deck.title}"? This cannot be undone.`;

    showAlert({
      title: 'Delete Deck',
      message: msg,
      type: 'destructive',
      buttons: [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteDeck.mutate(deck.id, {
          onSuccess: () => showToast('Deck deleted'),
          onError: (err) => showToast((err as Error).message ?? 'Failed to delete deck', 'error'),
        }),
      },
    ],
    });
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <ScreenWrapper>
      <Header showBack title="Deck Browser" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {/* Header + count */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">
            All Decks {pagination.total > 0 ? `(${pagination.total})` : ''}
          </Typography>
        </View>

        {/* Search bar */}
        <Input
          placeholder="Search by name or ID..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search" size={20} color={theme.textTertiary} />}
          rightIcon={search ? <Ionicons name="close-circle" size={20} color={theme.textTertiary} /> : undefined}
          onRightIconPress={() => setSearch('')}
        />

        {isLoading ? (
          <View style={{ gap: spacing.md }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={100} style={{ borderRadius: radius.xl }} />
            ))}
          </View>
        ) : decks.length === 0 ? (
          <Card variant="outlined">
            <Typography variant="body" color={theme.textSecondary} style={{ textAlign: 'center', paddingVertical: spacing['2xl'] }}>
              No decks found.
            </Typography>
          </Card>
        ) : (
          decks.map((deck) => {
            const catColor = categoryColour(deck.category);
            return (
              <Card key={deck.id} variant="outlined">
                <View style={{ gap: spacing.sm }}>
                  {/* Title row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: radius.lg,
                      backgroundColor: catColor + '20', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name="albums-outline" size={20} color={catColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Typography variant="label" numberOfLines={1}>{deck.title}</Typography>
                      <Typography variant="caption" color={theme.textSecondary} numberOfLines={1}>
                        {deck.description}
                      </Typography>
                    </View>
                  </View>

                  <Divider />

                  {/* Metadata row */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                    <View>
                      <Typography variant="caption" color={theme.textTertiary}>Cards</Typography>
                      <Typography variant="label">{deck.cardCount}</Typography>
                    </View>
                    <View>
                      <Typography variant="caption" color={theme.textTertiary}>Category</Typography>
                      <View style={{
                        paddingHorizontal: spacing.xs, paddingVertical: 2,
                        backgroundColor: catColor + '20', borderRadius: radius.sm, alignSelf: 'flex-start',
                      }}>
                        <Typography variant="caption" color={catColor}>{deck.category}</Typography>
                      </View>
                    </View>
                    <View>
                      <Typography variant="caption" color={theme.textTertiary}>Published</Typography>
                      <Typography variant="label" color={deck.isPublished ? '#10B981' : '#EF4444'}>
                        {deck.isPublished ? 'Yes' : 'No'}
                      </Typography>
                    </View>
                    <View>
                      <Typography variant="caption" color={theme.textTertiary}>Created</Typography>
                      <Typography variant="label">{fmtDate(deck.createdAt)}</Typography>
                    </View>
                  </View>

                  {/* Actions */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => handleDelete(deck)}
                    style={{ marginTop: spacing.xs }}
                  >
                    Delete Deck
                  </Button>
                </View>
              </Card>
            );
          })
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md, marginTop: spacing.md }}>
            <TouchableOpacity
              disabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              style={{ opacity: page <= 1 ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Typography variant="label" color={theme.textSecondary}>
              Page {page} of {totalPages}
            </Typography>
            <TouchableOpacity
              disabled={page >= totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{ opacity: page >= totalPages ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-forward" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
