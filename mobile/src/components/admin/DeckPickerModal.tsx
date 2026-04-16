// ─── DeckPickerModal ─────────────────────────────────────────
// Searchable picker for selecting a deck by name instead of
// manually entering a MongoDB ObjectId.

import React, { useState, useMemo } from 'react';
import {
  View,
  FlatList,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { api } from '../../services/api';
import type { Deck } from '@kd/shared';

// ─── Types ───────────────────────────────────────────────────

interface DeckPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (deck: { id: string; title: string; cardCount: number }) => void;
  selectedDeckId?: string;
}

// ─── Component ───────────────────────────────────────────────

export function DeckPickerModal({ visible, onClose, onSelect, selectedDeckId }: DeckPickerModalProps) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');

  const { data: decks = [], isLoading } = useQuery<Deck[]>({
    queryKey: ['admin', 'deck-picker'],
    queryFn: async () => {
      const { data } = await api.get('/decks', { params: { pageSize: 200 } });
      return (data?.data ?? []) as Deck[];
    },
    enabled: visible,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return decks ?? [];
    const q = search.toLowerCase();
    return (decks ?? []).filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q),
    );
  }, [decks, search]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: theme.border,
        }}>
          <Typography variant="h4">Select a Deck</Typography>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={{ padding: spacing.xl, paddingBottom: 0 }}>
          <Input
            placeholder="Search by title or category…"
            value={search}
            onChangeText={setSearch}
            leftIcon={<Ionicons name="search-outline" size={18} color={theme.textTertiary} />}
          />
        </View>

        {/* Deck List */}
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingTop: spacing['2xl'] }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(deck) => deck.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing['4xl'] }}
            ListEmptyComponent={
              <Card>
                <Typography variant="body" align="center" color={theme.textTertiary}>
                  {search ? 'No decks matching your search.' : 'No decks available.'}
                </Typography>
              </Card>
            }
            renderItem={({ item: deck }) => {
              const isSelected = deck.id === selectedDeckId;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect({ id: deck.id, title: deck.title, cardCount: deck.cardCount ?? 0 });
                    onClose();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderRadius: radius.xl,
                    borderWidth: 1.5,
                    borderColor: isSelected ? theme.primary : theme.border,
                    backgroundColor: isSelected ? theme.primary + '15' : theme.card,
                    gap: spacing.md,
                  }}
                >
                  <View style={{
                    width: 42, height: 42, borderRadius: radius.lg,
                    backgroundColor: isSelected ? theme.primary + '22' : theme.cardAlt,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons
                      name="library-outline"
                      size={20}
                      color={isSelected ? theme.primary : theme.textTertiary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="label">{deck.title}</Typography>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 2 }}>
                      {deck.category && (
                        <Typography variant="caption" color={theme.textTertiary}>
                          {deck.category}
                        </Typography>
                      )}
                      <Typography variant="caption" color={theme.textTertiary}>
                        • {deck.cardCount ?? 0} cards
                      </Typography>
                    </View>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}
