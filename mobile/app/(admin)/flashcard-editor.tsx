// ─── Admin Flashcard Editor ───────────────────────────────────
// Lists existing cards for a (subjectId, level) pair.
// Create, edit, and delete MCQ flashcards within the level deck.

import { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Divider } from '../../src/components/ui/Divider';
import {
  useAdminLevelCards,
  useAddLevelCard,
  useUpdateLevelCard,
  useDeleteLevelCard,
  AdminFlashcard,
} from '../../src/hooks/useAdminContent';
import { BulkImportModal } from '../../src/components/admin/BulkImportModal';
import { ParsedFlashcard } from '../../src/utils/csvParser';
import { adminApi } from '../../src/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../src/contexts/ToastContext';

type OptionKey = 'A' | 'B' | 'C' | 'D';
const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];

interface CardForm {
  question: string;
  options: Record<OptionKey, string>;
  correctKey: OptionKey;
  explanation: string;
}

const BLANK_FORM: CardForm = {
  question: '',
  options: { A: '', B: '', C: '', D: '' },
  correctKey: 'A',
  explanation: '',
};

export default function FlashcardEditorScreen() {
  const { subjectId, level, topicSlug, title } = useLocalSearchParams<{
    subjectId: string;
    level: string;
    topicSlug: string;
    title?: string;
  }>();
  const { theme } = useTheme();

  const { showToast } = useToast();

  const [editingCard, setEditingCard] = useState<AdminFlashcard | null>(null);
  const [form, setForm] = useState<CardForm>(BLANK_FORM);
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const queryClient = useQueryClient();

  const { data: levelData, isLoading } = useAdminLevelCards(subjectId, level, topicSlug);
  const addCard = useAddLevelCard();
  const updateCard = useUpdateLevelCard();
  const deleteCard = useDeleteLevelCard();

  const cards = levelData?.cards ?? [];

  function openCreate() {
    setEditingCard(null);
    setForm(BLANK_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(card: AdminFlashcard) {
    // Map each option's text into the A/B/C/D slots by position.
    // This is safe because we always write options in A→D order on create.
    const options: Record<OptionKey, string> = { A: '', B: '', C: '', D: '' };
    card.options.forEach((o, i) => {
      const key = OPTION_KEYS[i];
      if (key) options[key] = o.text;
    });

    // Find the letter whose stored option.id matches the card's correctAnswerId.
    // Fallback to 'A' only if the stored id is somehow not found.
    const matchIndex = card.options.findIndex((o) => o.id === card.correctAnswerId);
    const correctKey: OptionKey = matchIndex >= 0 && matchIndex < OPTION_KEYS.length
      ? OPTION_KEYS[matchIndex]!
      : 'A';

    setEditingCard(card);
    setForm({ question: card.question, options, correctKey, explanation: card.explanation ?? '' });
    setFormError('');
    setShowForm(true);
  }

  function confirmDelete(card: AdminFlashcard) {
    Alert.alert('Delete Card', 'Remove this flashcard permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => deleteCard.mutate({ subjectId, level, topicSlug, cardId: card.id }),
      },
    ]);
  }

  async function handleSave() {
    if (!form.question.trim()) { setFormError('Question is required.'); return; }
    const filled = OPTION_KEYS.filter((k) => form.options[k].trim());
    if (filled.length < 2) { setFormError('At least 2 options are required.'); return; }
    setFormError('');

    const cardOptions = OPTION_KEYS.filter((k) => form.options[k].trim())
      .map((k) => ({ id: k, text: form.options[k].trim() }));

    // Validate that the chosen correct answer slot is actually filled in
    if (!form.options[form.correctKey].trim()) {
      setFormError('The selected correct answer option cannot be empty.');
      return;
    }

    const payload = {
      question: form.question.trim(),
      options: cardOptions,
      correctAnswerId: form.correctKey,
      // Send null explicitly — the backend schema is nullable, not optional-undefined
      explanation: form.explanation.trim() || null,
    };

    try {
      if (editingCard) {
        await updateCard.mutateAsync({ subjectId, level, topicSlug, cardId: editingCard.id, updates: payload });
      } else {
        await addCard.mutateAsync({ subjectId, level, topicSlug, card: payload });
      }
      setShowForm(false);
      setForm(BLANK_FORM);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    }
  }

  // ── Bulk import handler (W2: uses bulk endpoint instead of N requests) ──
  async function handleBulkSubmit(
    cards: ParsedFlashcard[],
    onProgress?: (current: number, total: number, inserted: number) => void,
  ) {
    const batchSize = 100;
    const totalBatches = Math.ceil(cards.length / batchSize);
    let totalCreated = 0;
    const errors: string[] = [];

    for (let i = 0; i < cards.length; i += batchSize) {
      const batchIndex = Math.floor(i / batchSize) + 1;
      const batch = cards.slice(i, i + batchSize);
      try {
        const { data } = await adminApi.post(
          `/subjects/${subjectId}/levels/${level}/cards/bulk`,
          { cards: batch },
          { params: { topicSlug } },
        );
        totalCreated += (data?.data?.created ?? batch.length);
      } catch (err: unknown) {
        errors.push(`Batch ${batchIndex}: ${(err as Error).message ?? 'Failed'}`);
      }
      onProgress?.(batchIndex, totalBatches, totalCreated);
    }

    void queryClient.invalidateQueries({ queryKey: ['admin', 'level-cards', subjectId, level, topicSlug] });

    if (errors.length > 0) {
      showToast(`${totalCreated} cards imported, ${errors.length} batch(es) failed`, 'error');
    } else {
      showToast(`${totalCreated} cards imported successfully`);
    }
  }

  const isSaving = addCard.isPending || updateCard.isPending;
  const screenTitle = title ?? `${level} — Cards`;

  // ── FlatList item renderer (virtualized for large decks) ──
  const renderCardItem = useCallback(({ item: card }: { item: AdminFlashcard }) => (
    <View
      style={{
        backgroundColor: theme.card, borderRadius: radius.xl,
        borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
      }}
    >
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <Typography variant="label" numberOfLines={2}>{card.question}</Typography>
        {card.options.map((opt) => (
          <View key={opt.id} style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
            <Ionicons
              name={opt.id === card.correctAnswerId ? 'checkmark-circle' : 'ellipse-outline'}
              size={14}
              color={opt.id === card.correctAnswerId ? theme.success : theme.textTertiary}
            />
            <Typography variant="caption" color={opt.id === card.correctAnswerId ? theme.success : theme.textSecondary}>
              {opt.text}
            </Typography>
          </View>
        ))}
      </View>
      <Divider />
      <View style={{ flexDirection: 'row', padding: spacing.sm, gap: spacing.sm }}>
        <Button variant="secondary" size="sm" onPress={() => openEdit(card)}
          icon={<Ionicons name="pencil-outline" size={13} color={theme.textSecondary} />}>
          Edit
        </Button>
        <Button variant="danger" size="sm"
          loading={deleteCard.isPending && (deleteCard.variables as { cardId: string } | undefined)?.cardId === card.id}
          onPress={() => confirmDelete(card)}
          icon={<Ionicons name="trash-outline" size={13} color="#FFFFFF" />}>
          Delete
        </Button>
      </View>
    </View>
  ), [theme, deleteCard.isPending, deleteCard.variables]);

  return (
    <ScreenWrapper keyboardAvoiding>
      <Header
        showBack
        title={screenTitle}
        rightAction={
          !showForm
            ? (
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <Button variant="ghost" size="sm" onPress={() => setShowBulkImport(true)}>Bulk</Button>
                <Button variant="ghost" size="sm" onPress={openCreate}>+ Add</Button>
              </View>
            )
            : undefined
        }
      />

      <FlatList
        data={isLoading ? [] : cards}
        keyExtractor={(item) => item.id}
        renderItem={renderCardItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={15}
        windowSize={7}
        ListHeaderComponent={
          <>
            {/* ── Card Form ── */}
            {showForm && (
              <Card>
                <View style={{ gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h4">{editingCard ? 'Edit Card' : 'New Card'}</Typography>
                    <TouchableOpacity onPress={() => setShowForm(false)}>
                      <Ionicons name="close" size={22} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>

                  <Input placeholder="Enter question text…" value={form.question} onChangeText={(v) => setForm(f => ({ ...f, question: v }))} multiline numberOfLines={3} label="Question *" />

                  <Typography variant="label">Options</Typography>
                  {OPTION_KEYS.map((key) => (
                    <View key={key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                      <TouchableOpacity
                        onPress={() => setForm(f => ({ ...f, correctKey: key }))}
                        style={{
                          width: 32, height: 32, borderRadius: radius.full, borderWidth: 2,
                          borderColor: form.correctKey === key ? theme.success : theme.border,
                          backgroundColor: form.correctKey === key ? theme.successLight : 'transparent',
                          alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, flexShrink: 0,
                        }}
                      >
                        {form.correctKey === key && <Ionicons name="checkmark" size={16} color={theme.success} />}
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Input
                          label={`Option ${key}`}
                          placeholder={`Enter option ${key}…`}
                          value={form.options[key]}
                          onChangeText={(v) => setForm(f => ({ ...f, options: { ...f.options, [key]: v } }))}
                        />
                      </View>
                    </View>
                  ))}

                  <Input label="Explanation" placeholder="One-line explanation of the correct answer…" value={form.explanation} onChangeText={(v) => setForm(f => ({ ...f, explanation: v }))} multiline numberOfLines={2} />

                  {formError ? <Typography variant="bodySmall" color={theme.error} align="center">{formError}</Typography> : null}

                  <Button fullWidth loading={isSaving} onPress={handleSave} size="lg"
                    icon={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}>
                    {editingCard ? 'Update Card' : 'Save Card'}
                  </Button>
                </View>
              </Card>
            )}

            {/* ── Card count header ── */}
            {!isLoading && cards.length > 0 && (
              <Typography variant="overline" color={theme.textTertiary}>
                {cards.length} {cards.length === 1 ? 'card' : 'cards'}
              </Typography>
            )}
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: spacing.xl }}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : !showForm ? (
            <Card>
              <Typography variant="body" align="center" color={theme.textTertiary}>
                No cards in this level yet. Tap "+ Add Card" to create the first one.
              </Typography>
            </Card>
          ) : null
        }
      />

      <BulkImportModal
        visible={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onSubmit={handleBulkSubmit}
      />
    </ScreenWrapper>
  );
}
