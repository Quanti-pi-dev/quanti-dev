// ─── Admin Shop Editor ────────────────────────────────────────
// Full CRUD for reward shop items: flashcard_pack and theme only.
// Uses centralized hooks, Zod form validation, and toast notifications.

import { useState } from 'react';
import { View, ScrollView, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from '../../src/theme';
import { useGlobalUI } from '../../src/contexts/GlobalUIContext';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Divider } from '../../src/components/ui/Divider';
import {
  useAdminShopItems,
  useCreateShopItem,
  useUpdateShopItem,
  useDeleteShopItem,
} from '../../src/hooks/useAdminShop';
import { shopItemFormSchema, type ShopItemFormValues } from '../../src/utils/adminSchemas';
import type { ShopItem } from '@kd/shared';
import { DeckPickerModal } from '../../src/components/admin/DeckPickerModal';
import { ImageUploadButton } from '../../src/components/admin/ImageUploadButton';

// ─── Phase 2 categories ───────────────────────────────────
type ItemCategory = 'flashcard_pack' | 'theme' | 'power_up';
const CATEGORIES: { key: ItemCategory; label: string; icon: string; hint: string }[] = [
  { key: 'flashcard_pack', label: '📦 Flashcard Pack', icon: 'library-outline', hint: 'Links to a deck in MongoDB' },
  { key: 'theme',          label: '🎨 Theme',          icon: 'color-palette-outline', hint: 'Applies a visual theme key' },
  { key: 'power_up',      label: '⚡ Power-Up',       icon: 'flash-outline', hint: 'Consumable items (Streak Freeze, etc.)' },
];

const DEFAULT_VALUES: ShopItemFormValues = {
  name: '', description: '', imageUrl: '', price: '', category: 'flashcard_pack',
  deckId: '', cardCount: '', themeKey: '',
};

function hasValidImage(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

// ─── Component ───────────────────────────────────────────────

export default function ShopEditorScreen() {
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [showDeckPicker, setShowDeckPicker] = useState(false);
  const [selectedDeckTitle, setSelectedDeckTitle] = useState<string | null>(null);

  // ── Hooks (Component A) ─────────────────────────────────────
  const { data: items = [], isLoading, isError } = useAdminShopItems();
  const createShopItem = useCreateShopItem();
  const updateShopItem = useUpdateShopItem();
  const deleteShopItem = useDeleteShopItem();

  // ── react-hook-form (Component C) ───────────────────────────
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<ShopItemFormValues>({
    resolver: zodResolver(shopItemFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const category = watch('category');
  const deckId = watch('deckId');

  // ── Helpers ─────────────────────────────────────────────────
  function openCreate() {
    setEditingItem(null);
    reset(DEFAULT_VALUES);
    setSelectedDeckTitle(null);
    setModalVisible(true);
  }

  function openEdit(item: ShopItem) {
    setEditingItem(item);
    reset({
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl ?? '',
      price: String(item.price),
      category: item.category as ItemCategory,
      deckId: item.deckId ?? '',
      cardCount: item.cardCount != null ? String(item.cardCount) : '',
      themeKey: item.themeKey ?? '',
    });
    setSelectedDeckTitle(null);
    setModalVisible(true);
  }

  function confirmDelete(item: ShopItem) {
    showAlert({
      title: 'Delete Item',
      message: `Remove "${item.name}" from the shop?`,
      type: 'destructive',
      buttons: [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => deleteShopItem.mutate(item.id, {
          onSuccess: () => showToast('Item deleted successfully'),
          onError: () => showToast('Failed to delete item', 'error'),
        }),
      },
    ],
    });
  }

  function onFormSubmit(data: ShopItemFormValues) {
    const payload: Record<string, unknown> = {
      name: data.name.trim(),
      description: data.description.trim(),
      imageUrl: data.imageUrl?.trim() || null,
      price: parseInt(data.price, 10),
      category: data.category,
    };
    if (data.category === 'flashcard_pack') {
      payload.deckId = data.deckId?.trim();
      if (data.cardCount?.trim()) payload.cardCount = parseInt(data.cardCount, 10);
    }
    if (data.category === 'theme') {
      payload.themeKey = data.themeKey?.trim();
    }

    if (editingItem) {
      updateShopItem.mutate({ id: editingItem.id, payload }, {
        onSuccess: () => { setModalVisible(false); showToast('Item updated successfully'); },
        onError: (err) => showToast(err instanceof Error ? err.message : 'Failed to update', 'error'),
      });
    } else {
      createShopItem.mutate(payload, {
        onSuccess: () => { setModalVisible(false); showToast('Item created successfully'); },
        onError: (err) => showToast(err instanceof Error ? err.message : 'Failed to create', 'error'),
      });
    }
  }

  const isSaving = createShopItem.isPending || updateShopItem.isPending;

  // ── Render ──────────────────────────────────────────────────
  return (
    <ScreenWrapper>
      <Header showBack title="Manage Rewards" rightAction={
        <Button variant="ghost" size="sm" onPress={openCreate}>+ New</Button>
      } />

      {isLoading && (
        <View style={{ alignItems: 'center', paddingTop: spacing['2xl'] }}>
          <ActivityIndicator size="large" color={theme.coin} />
        </View>
      )}

      {isError && (
        <View style={{ padding: spacing.xl }}>
          <Card>
            <Typography variant="body" align="center" color={theme.error}>
              Failed to load shop items.
            </Typography>
          </Card>
        </View>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <View style={{ padding: spacing.xl }}>
          <Card>
            <Typography variant="body" align="center" color={theme.textTertiary}>
              No shop items yet. Tap "+ New" to add one.
            </Typography>
          </Card>
        </View>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['4xl'] }}
        >
          {CATEGORIES.map((cat) => {
            const catItems = items.filter((i) => i.category === cat.key);
            if (catItems.length === 0) return null;
            return (
              <View key={cat.key}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Ionicons name={cat.icon as never} size={18} color={theme.textSecondary} />
                  <Typography variant="label" color={theme.textSecondary}>{cat.label}</Typography>
                </View>
                <Card>
                  {catItems.map((item, idx) => (
                    <View key={item.id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md }}>
                        {hasValidImage(item.imageUrl) ? (
                          <Image
                            source={{ uri: item.imageUrl }}
                            style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: theme.cardAlt }}
                            contentFit="cover"
                            transition={{ duration: 250, effect: 'cross-dissolve' }}
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <View style={{
                            width: 40, height: 40, borderRadius: radius.full,
                            backgroundColor: theme.coin + '22', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Ionicons name={cat.icon as never} size={20} color={theme.coin} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Typography variant="label">{item.name}</Typography>
                          <Typography variant="caption" color={theme.textTertiary} numberOfLines={1}>{item.description}</Typography>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2, flexWrap: 'wrap' }}>
                            <Typography variant="caption" color={theme.coin}>🪙 {item.price}</Typography>
                            {item.deckId && (
                              <Typography variant="caption" color={theme.textTertiary}>deck:{item.deckId.slice(0, 8)}…</Typography>
                            )}
                            {item.cardCount != null && (
                              <Typography variant="caption" color={theme.textTertiary}>{item.cardCount} cards</Typography>
                            )}
                            {item.themeKey && (
                              <Typography variant="caption" color={theme.primary}>key:{item.themeKey}</Typography>
                            )}
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                          <Button variant="secondary" size="sm" onPress={() => openEdit(item)}>Edit</Button>
                          <Button variant="danger" size="sm" loading={deleteShopItem.isPending} onPress={() => confirmDelete(item)}>Del</Button>
                        </View>
                      </View>
                      {idx < catItems.length - 1 && <Divider />}
                    </View>
                  ))}
                </Card>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: theme.border,
          }}>
            <Typography variant="h4">{editingItem ? 'Edit Item' : 'New Shop Item'}</Typography>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['4xl'] }} keyboardShouldPersistTaps="handled">
            {/* Common fields */}
            <Controller control={control} name="name" render={({ field: { onChange, value } }) => (
              <Input label="Name *" placeholder="e.g. Statistics Flashcard Pack" value={value} onChangeText={onChange} error={errors.name?.message} />
            )} />
            <Controller control={control} name="description" render={({ field: { onChange, value } }) => (
              <Input label="Description *" placeholder="Short description shown in shop" value={value} onChangeText={onChange} error={errors.description?.message} />
            )} />
            <Controller control={control} name="price" render={({ field: { onChange, value } }) => (
              <Input
                label="Coin Price *" placeholder="e.g. 200" value={value}
                onChangeText={onChange} keyboardType="number-pad" error={errors.price?.message}
                leftIcon={<Ionicons name="ellipse" size={16} color={theme.coin} />}
              />
            )} />
            <Controller control={control} name="imageUrl" render={({ field: { onChange, value } }) => (
              <ImageUploadButton
                label="Item Image (optional)"
                currentUrl={value ?? ''}
                onUploaded={onChange}
                placeholder="Tap to upload an image from camera roll"
              />
            )} />

            {/* Category selector */}
            <View style={{ gap: spacing.sm }}>
              <Typography variant="label">Category</Typography>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity key={cat.key} onPress={() => setValue('category', cat.key)}
                    style={{
                      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
                      borderRadius: radius.full, borderWidth: 1.5,
                      borderColor: category === cat.key ? theme.primary : theme.border,
                      backgroundColor: category === cat.key ? theme.primary + '22' : theme.card,
                    }}>
                    <Typography variant="caption" color={category === cat.key ? theme.primary : theme.textSecondary}>
                      {cat.label}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </View>
              <Typography variant="caption" color={theme.textTertiary}>
                {CATEGORIES.find((c) => c.key === category)?.hint ?? ''}
              </Typography>
            </View>

            {/* Flashcard pack fields */}
            {category === 'flashcard_pack' && (
              <>
                <View style={{ gap: spacing.xs }}>
                  <Typography variant="label" color={theme.textSecondary}>Linked Deck *</Typography>
                  <Button
                    fullWidth
                    variant="secondary"
                    size="lg"
                    onPress={() => setShowDeckPicker(true)}
                    icon={<Ionicons name="library-outline" size={18} color={theme.textSecondary} />}
                  >
                    {selectedDeckTitle ?? (deckId ? `Deck: ${deckId.slice(0, 12)}…` : 'Select a Deck')}
                  </Button>
                  {errors.deckId?.message && (
                    <Typography variant="caption" color={theme.error}>{errors.deckId.message}</Typography>
                  )}
                </View>
                <Controller control={control} name="cardCount" render={({ field: { onChange, value } }) => (
                  <Input
                    label="Card Count (optional)" placeholder="e.g. 45"
                    value={value ?? ''} onChangeText={onChange} keyboardType="number-pad"
                  />
                )} />
              </>
            )}

            {/* Theme fields */}
            {category === 'theme' && (
              <Controller control={control} name="themeKey" render={({ field: { onChange, value } }) => (
                <Input
                  label="Theme Key * (code identifier)" placeholder="e.g. dark_ocean or warm_amber"
                  value={value ?? ''} onChangeText={onChange}
                  autoCapitalize="none" autoCorrect={false}
                  error={errors.themeKey?.message}
                />
              )} />
            )}

            <Button
              fullWidth size="lg" loading={isSaving} onPress={handleSubmit(onFormSubmit)}
              icon={<Ionicons name="save-outline" size={18} color="#FFFFFF" />}
            >
              {editingItem ? 'Update Item' : 'Add to Shop'}
            </Button>
          </ScrollView>
        </View>
      </Modal>

      <DeckPickerModal
        visible={showDeckPicker}
        onClose={() => setShowDeckPicker(false)}
        selectedDeckId={deckId}
        onSelect={(deck) => {
          setValue('deckId', deck.id);
          setValue('cardCount', String(deck.cardCount));
          setSelectedDeckTitle(`${deck.title} (${deck.cardCount} cards)`);
        }}
      />
    </ScreenWrapper>
  );
}
