// ─── Explore Decks Screen ─────────────────────────────────────
// Full deck directory list — accessible via "See all decks"
// button on the Study dashboard. Shows all decks with search
// and category filters.

import { useState, useMemo } from 'react';
import { View, ScrollView, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { spacing, radius } from '../src/theme/tokens';
import { ScreenWrapper } from '../src/components/layout/ScreenWrapper';
import { Typography } from '../src/components/ui/Typography';
import { Input } from '../src/components/ui/Input';
import { Chip } from '../src/components/ui/Chip';
import { Skeleton } from '../src/components/ui/Skeleton';
import { useDecks } from '../src/hooks/useDecks';
import { useFadeInUp } from '../src/theme/animations';
import Animated from 'react-native-reanimated';
import type { Deck } from '@kd/shared';

const DECK_ACCENTS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#EF4444', '#3B82F6', '#14B8A6',
];

function DeckCardSkeleton() {
  return <Skeleton height={100} borderRadius={radius['2xl']} />;
}

function DeckTile({
  deck, accent, onPress, index,
}: {
  deck: Deck; accent: string; onPress: () => void; index: number;
}) {
  const { theme } = useTheme();
  const { animStyle } = useFadeInUp({ delay: Math.min(index * 40, 250) });

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${deck.title} deck`}
        style={{
          backgroundColor: theme.card,
          borderRadius: radius['2xl'],
          padding: spacing.lg,
          borderWidth: 1.5,
          borderColor: accent + '33',
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          shadowColor: accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View
          style={{
            width: 46, height: 46, borderRadius: radius.xl,
            backgroundColor: accent + '18',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="copy-outline" size={22} color={accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="label" numberOfLines={2}>
            {deck.title}
          </Typography>
          {deck.category && (
            <Typography variant="caption" color={theme.textTertiary}>
              {deck.category}
            </Typography>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ExploreDecksScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const { data: decksPages, isLoading, fetchNextPage, hasNextPage } = useDecks(20);

  const allDecks: Deck[] = decksPages?.pages.flatMap((p: { data: Deck[] }) => p.data) ?? [];

  const categories = useMemo(() => {
    const raw = allDecks.map((d) => d.category).filter((c): c is string => Boolean(c));
    const unique = [...new Set(raw)].sort();
    return ['All', ...unique];
  }, [allDecks]);

  const filtered = useMemo(() =>
    allDecks.filter((d) => {
      const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase());
      const matchesCat = activeCategory === 'All' || d.category === activeCategory;
      return matchesSearch && matchesCat;
    }),
  [allDecks, search, activeCategory]);

  return (
    <ScreenWrapper>
      {/* ── Header ── */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.base, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Typography variant="h3">Explore Decks</Typography>
        </View>

        <Input
          placeholder="Search decks…"
          value={search}
          onChangeText={setSearch}
          leftIcon={<Ionicons name="search-outline" size={18} color={theme.textTertiary} />}
          rightIcon={search ? <Ionicons name="close-circle" size={18} color={theme.textTertiary} /> : undefined}
          onRightIconPress={() => setSearch('')}
        />

        {categories.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xl }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl }}>
              {categories.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  active={activeCategory === cat}
                  onPress={() => setActiveCategory(cat)}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* ── Deck List ── */}
      {isLoading ? (
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <DeckCardSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          onEndReached={() => { if (hasNextPage) void fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          renderItem={({ item, index }) => (
            <DeckTile
              deck={item}
              accent={DECK_ACCENTS[index % DECK_ACCENTS.length]!}
              onPress={() => router.push(`/flashcards/${item.id}` as never)}
              index={index}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing['4xl'] }}>
              <Ionicons name="copy-outline" size={48} color={theme.textTertiary} />
              <Typography variant="body" color={theme.textTertiary} align="center" style={{ marginTop: spacing.md }}>
                {search ? 'No decks match your search' : 'No decks available yet'}
              </Typography>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
}
