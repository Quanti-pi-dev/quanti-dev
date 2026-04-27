// ─── Admin Config Management ─────────────────────────────────
// Full CRUD screen for platform_config table.
// Admin can view, edit, and add config keys/values.

import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, TextInput,
  RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../src/theme';
import { useGlobalUI } from '../../src/contexts/GlobalUIContext';
import { spacing, radius } from '../../src/theme/tokens';
import { ScreenWrapper } from '../../src/components/layout/ScreenWrapper';
import { Header } from '../../src/components/layout/Header';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { adminApi } from '../../src/services/api';

// ─── Types ───────────────────────────────────────────────────

interface ConfigEntry {
  key: string;
  value: unknown;
  category: string;
  description: string | null;
  updatedAt: string;
}

// ─── API Functions ───────────────────────────────────────────

async function fetchAllConfig(): Promise<ConfigEntry[]> {
  const { data } = await adminApi.get('/config');
  return (data?.data ?? []) as ConfigEntry[];
}

async function updateConfigKey(key: string, value: string, category: string): Promise<void> {
  // Parse JSON values so numbers/booleans are stored correctly
  let parsed: unknown = value;
  try { parsed = JSON.parse(value); } catch { /* keep as raw string */ }
  await adminApi.put(`/config/${key}`, { value: parsed, category });
}

async function deleteConfigKey(key: string): Promise<void> {
  await adminApi.delete(`/config/${key}`);
}

async function createConfigKey(key: string, value: string, description: string): Promise<void> {
  await adminApi.put(`/config/${key}`, { value, category: 'custom', description });
}

// ─── Config Row Component ────────────────────────────────────

function ConfigRow({
  entry,
  onSave,
  onDelete,
  saving,
}: {
  entry: ConfigEntry;
  onSave: (key: string, value: string) => void;
  onDelete: (key: string) => void;
  saving: boolean;
}) {
  const { theme } = useTheme();
  const [editValue, setEditValue] = useState(
    typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value, null, 2),
  );
  const [expanded, setExpanded] = useState(false);
  const displayValue = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
  const changed = editValue !== displayValue;

  return (
    <Card variant="outlined" style={{ marginBottom: spacing.sm }}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <View style={{ flex: 1 }}>
          <Typography variant="label" numberOfLines={1}>{entry.key}</Typography>
          {!expanded && (
            <Typography variant="caption" color={theme.textTertiary} numberOfLines={1}>
              {displayValue}
            </Typography>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textTertiary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {entry.description && (
            <Typography variant="caption" color={theme.textTertiary}>
              {entry.description}
            </Typography>
          )}
          <TextInput
            value={editValue}
            onChangeText={setEditValue}
            multiline
            style={{
              backgroundColor: theme.cardAlt,
              borderRadius: radius.md,
              padding: spacing.sm,
              color: theme.text,
              fontSize: 14,
              fontFamily: 'SpaceMono',
              minHeight: 50,
              borderWidth: 1,
              borderColor: changed ? theme.primary : theme.border,
            }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <TouchableOpacity
              onPress={() => onDelete(entry.key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.md,
                backgroundColor: '#EF444422',
              }}
            >
              <Typography variant="caption" color="#EF4444">Delete</Typography>
            </TouchableOpacity>
            {changed && (
              <TouchableOpacity
                onPress={() => onSave(entry.key, editValue)}
                disabled={saving}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.md,
                  backgroundColor: theme.primary,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Typography variant="caption" color="#FFFFFF">
                  {saving ? 'Saving…' : 'Save'}
                </Typography>
              </TouchableOpacity>
            )}
          </View>
          <Typography variant="caption" color={theme.textTertiary}>
            Last updated: {new Date(entry.updatedAt).toLocaleDateString()}
          </Typography>
        </View>
      )}
    </Card>
  );
}

// ─── Screen ──────────────────────────────────────────────────

export default function AdminConfigScreen() {
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data: configs, isLoading, refetch } = useQuery<ConfigEntry[]>({
    queryKey: ['admin-config'],
    queryFn: fetchAllConfig,
    staleTime: 1000 * 60,
  });

  const saveMutation = useMutation({
    mutationFn: ({ key, value, category }: { key: string; value: string; category: string }) => updateConfigKey(key, value, category),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-config'] });
      setSavingKey(null);
      showToast('Config value updated successfully.', 'success');
    },
    onError: (err: Error) => {
      setSavingKey(null);
      showAlert({
        title: 'Error',
        message: err.message,
        type: 'info',
        buttons: [{ text: 'OK' }],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => deleteConfigKey(key),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-config'] });
      showToast('Config key removed.', 'success');
    },
    onError: (err: Error) => showAlert({
      title: 'Error',
      message: err.message,
      type: 'info',
      buttons: [{ text: 'OK' }],
    }),
  });

  const createMutation = useMutation({
    mutationFn: () => createConfigKey(newKey, newValue, newDesc),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-config'] });
      setShowAdd(false);
      setNewKey('');
      setNewValue('');
      setNewDesc('');
      showToast('New config key added.', 'success');
    },
    onError: (err: Error) => showAlert({
      title: 'Error',
      message: err.message,
      type: 'info',
      buttons: [{ text: 'OK' }],
    }),
  });

  const handleSave = useCallback((key: string, value: string) => {
    const entry = (configs ?? []).find((c) => c.key === key);
    setSavingKey(key);
    saveMutation.mutate({ key, value, category: entry?.category ?? 'general' });
  }, [saveMutation, configs]);

  const handleDelete = useCallback((key: string) => {
    showAlert({
      title: 'Delete Config',
      message: `Are you sure you want to delete "${key}"?`,
      type: 'destructive',
      buttons: [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(key) },
    ],
    });
  }, [deleteMutation]);

  const filtered = (configs ?? []).filter(
    (c) => c.key.toLowerCase().includes(search.toLowerCase()) ||
      (c.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <ScreenWrapper>
      <Header showBack title="Platform Config" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Search + Add */}
        <View style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
          alignItems: 'center',
        }}>
          <View style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.cardAlt,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.md,
            gap: spacing.xs,
          }}>
            <Ionicons name="search" size={16} color={theme.textTertiary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search configs..."
              placeholderTextColor={theme.textTertiary}
              style={{ flex: 1, color: theme.text, paddingVertical: spacing.sm, fontSize: 14 }}
            />
          </View>
          <TouchableOpacity
            onPress={() => setShowAdd(!showAdd)}
            style={{
              backgroundColor: theme.primary,
              width: 40,
              height: 40,
              borderRadius: radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={showAdd ? 'close' : 'add'} size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Add New Config */}
        {showAdd && (
          <Card style={{ marginHorizontal: spacing.xl, marginBottom: spacing.md }}>
            <View style={{ gap: spacing.sm }}>
              <Typography variant="label">Add New Config Key</Typography>
              <TextInput
                value={newKey}
                onChangeText={setNewKey}
                placeholder="config_key_name"
                placeholderTextColor={theme.textTertiary}
                style={{
                  backgroundColor: theme.cardAlt, borderRadius: radius.md,
                  padding: spacing.sm, color: theme.text, fontSize: 14,
                }}
              />
              <TextInput
                value={newValue}
                onChangeText={setNewValue}
                placeholder="Value"
                placeholderTextColor={theme.textTertiary}
                multiline
                style={{
                  backgroundColor: theme.cardAlt, borderRadius: radius.md,
                  padding: spacing.sm, color: theme.text, fontSize: 14, minHeight: 50,
                }}
              />
              <TextInput
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="Description (optional)"
                placeholderTextColor={theme.textTertiary}
                style={{
                  backgroundColor: theme.cardAlt, borderRadius: radius.md,
                  padding: spacing.sm, color: theme.text, fontSize: 14,
                }}
              />
              <TouchableOpacity
                onPress={() => createMutation.mutate()}
                disabled={!newKey || !newValue || createMutation.isPending}
                style={{
                  backgroundColor: theme.primary,
                  borderRadius: radius.md,
                  paddingVertical: spacing.sm,
                  alignItems: 'center',
                  opacity: (!newKey || !newValue) ? 0.5 : 1,
                }}
              >
                <Typography variant="label" color="#FFFFFF">
                  {createMutation.isPending ? 'Creating…' : 'Create'}
                </Typography>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Config list */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => void refetch()}
              tintColor={theme.primary}
            />
          }
        >
          <Typography variant="caption" color={theme.textTertiary} style={{ marginBottom: spacing.md }}>
            {filtered.length} config{filtered.length !== 1 ? 's' : ''} · tap to expand
          </Typography>

          {isLoading ? (
            <View style={{ gap: spacing.sm }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} height={60} borderRadius={radius.lg} />
              ))}
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing['2xl'] }}>
              <Typography variant="body" color={theme.textTertiary}>
                {search ? 'No configs match your search' : 'No configs found'}
              </Typography>
            </View>
          ) : (
            filtered.map((entry) => (
              <ConfigRow
                key={entry.key}
                entry={entry}
                onSave={handleSave}
                onDelete={handleDelete}
                saving={savingKey === entry.key}
              />
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}
