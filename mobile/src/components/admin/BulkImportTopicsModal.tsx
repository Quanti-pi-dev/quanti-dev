// ─── BulkImportTopicsModal ───────────────────────────────────
// Modal for importing topics from JSON or CSV files for a given subject.
// Admin picks a file via expo-document-picker, we parse it,
// preview the results, and submit in bulk.

import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  parseTopicCSV,
  parseTopicJSON,
  type ParsedTopic,
  type TopicParseResult,
} from '../../utils/topicParser';
import { useGlobalUI } from '../../contexts/GlobalUIContext';

// ─── Types ───────────────────────────────────────────────────

interface BulkImportTopicsModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (topics: ParsedTopic[]) => Promise<void>;
}

type FileFormat = 'json' | 'csv';

// ─── Component ───────────────────────────────────────────────

export function BulkImportTopicsModal({ visible, onClose, onSubmit }: BulkImportTopicsModalProps) {
  const { theme } = useTheme();
  const { showToast } = useGlobalUI();
  const insets = useSafeAreaInsets();

  const [format, setFormat] = useState<FileFormat>('csv');
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<TopicParseResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = useCallback(() => {
    setFileName(null);
    setResult(null);
    setSubmitted(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  // ── File Picker ────────────────────────────────────────────
  const handlePickFile = useCallback(async () => {
    try {
      const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: mimeType,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

      const asset = pickerResult.assets[0];

      // Guard: reject files over 2 MB
      const MAX_FILE_BYTES = 2 * 1024 * 1024;
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        setResult({
          topics: [],
          errors: [`File too large (${(asset.size / 1024 / 1024).toFixed(1)} MB). Maximum is 2 MB.`],
        });
        setFileName(asset.name ?? 'file');
        return;
      }

      setFileName(asset.name ?? 'file');

      // Read the file contents
      const file = new ExpoFile(asset.uri);
      const content = await file.text();

      // Parse based on chosen format
      const parsed = format === 'csv' ? parseTopicCSV(content) : parseTopicJSON(content);
      setResult(parsed);
    } catch {
      showToast('Could not read the selected file. Please try again.', 'error');
    }
  }, [format, showToast]);

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!result || result.topics.length === 0) return;
    setSubmitting(true);

    try {
      await onSubmit(result.topics);
      setSubmitted(true);
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : 'Failed to import topics. Please try again.',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  }, [result, onSubmit, showToast]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* ── Header ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          padding: spacing.xl, paddingTop: Math.max(spacing.xl, insets.top + spacing.md), borderBottomWidth: 1, borderBottomColor: theme.border,
        }}>
          <Typography variant="h4">Bulk Import Topics</Typography>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['4xl'] }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ── Format Toggle ── */}
          <View style={{ gap: spacing.sm }}>
            <Typography variant="label">File Format</Typography>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {(['csv', 'json'] as FileFormat[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => { setFormat(f); reset(); }}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.lg,
                    borderWidth: 1.5,
                    borderColor: format === f ? theme.primary : theme.border,
                    backgroundColor: format === f ? theme.primary + '22' : theme.card,
                    alignItems: 'center',
                    gap: spacing.xs,
                  }}
                >
                  <Ionicons
                    name={f === 'csv' ? 'grid-outline' : 'code-outline'}
                    size={20}
                    color={format === f ? theme.primary : theme.textSecondary}
                  />
                  <Typography
                    variant="label"
                    color={format === f ? theme.primary : theme.textSecondary}
                  >
                    {f.toUpperCase()}
                  </Typography>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Format Hint ── */}
          <Card>
            <View style={{ gap: spacing.xs }}>
              <Typography variant="label" color={theme.primary}>
                {format === 'csv' ? '📊 CSV Format' : '📋 JSON Format'}
              </Typography>
              {format === 'csv' ? (
                <View style={{ gap: spacing.xs }}>
                  {/* Required */}
                  <Typography variant="caption" color={theme.textSecondary} style={{ fontWeight: '600' }}>
                    Required columns:
                  </Typography>
                  <Typography variant="caption" color={theme.textTertiary} style={{ fontFamily: 'monospace' }}>
                    displayName
                  </Typography>
                  {/* Optional */}
                  <Typography variant="caption" color={theme.textSecondary} style={{ fontWeight: '600', marginTop: spacing.xs }}>
                    Optional columns:
                  </Typography>
                  <Typography variant="caption" color={theme.textTertiary} style={{ fontFamily: 'monospace' }}>
                    slug, order
                  </Typography>
                  <Typography variant="caption" color={theme.textTertiary} style={{ marginTop: spacing.xs }}>
                    If slug is omitted, it will be auto-generated from the display name.
                  </Typography>
                  <View style={{ marginTop: spacing.xs, backgroundColor: theme.background, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border }}>
                    <Typography variant="caption" color={theme.textTertiary} style={{ fontFamily: 'monospace' }}>
                      {`displayName,slug,order
Kinematics,kinematics,0
Laws of Motion,,1`}
                    </Typography>
                  </View>
                </View>
              ) : (
                <View style={{ gap: spacing.xs }}>
                  <Typography variant="caption" color={theme.textTertiary}>
                    <Typography variant="caption" style={{ fontWeight: 'bold' }}>slug</Typography> and <Typography variant="caption" style={{ fontWeight: 'bold' }}>order</Typography> are optional. Slugs are auto-generated if omitted.
                  </Typography>
                  <View style={{ backgroundColor: theme.background, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: theme.border }}>
                    <Typography variant="caption" color={theme.textTertiary} style={{ fontFamily: 'monospace' }}>
                      {`[
  {
    "displayName": "Kinematics",
    "slug": "kinematics",
    "order": 0
  },
  {
    "displayName": "Laws of Motion"
  }
]`}
                    </Typography>
                  </View>
                </View>
              )}
            </View>
          </Card>

          {/* ── File Picker / Upload Zone ── */}
          <TouchableOpacity
            onPress={handlePickFile}
            activeOpacity={0.75}
            style={{
              borderRadius: radius.xl,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: fileName ? theme.primary : theme.border,
              backgroundColor: fileName ? theme.primaryMuted : theme.cardAlt,
              padding: spacing.xl,
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <Ionicons
              name={fileName ? 'document-text' : 'cloud-upload-outline'}
              size={32}
              color={fileName ? theme.primary : theme.textTertiary}
            />
            <Typography
              variant="label"
              color={fileName ? theme.primary : theme.textSecondary}
              align="center"
            >
              {fileName ? `📄 ${fileName}` : `Tap to select ${format.toUpperCase()} file`}
            </Typography>
            {!fileName && (
              <Typography variant="caption" color={theme.textTertiary} align="center">
                Max 2 MB · {format.toUpperCase()} format
              </Typography>
            )}
          </TouchableOpacity>

          {/* ── Parse Results ── */}
          {result && (
            <View style={{ gap: spacing.md }}>
              {/* Summary */}
              <View style={{
                flexDirection: 'row', gap: spacing.md, justifyContent: 'center',
              }}>
                <View style={{
                  flex: 1, padding: spacing.md, borderRadius: radius.lg,
                  backgroundColor: theme.success + '18', alignItems: 'center', gap: spacing.xs,
                }}>
                  <Typography variant="h3" color={theme.success}>{result.topics.length}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>Valid Topics</Typography>
                </View>
                {result.errors.length > 0 && (
                  <View style={{
                    flex: 1, padding: spacing.md, borderRadius: radius.lg,
                    backgroundColor: theme.error + '18', alignItems: 'center', gap: spacing.xs,
                  }}>
                    <Typography variant="h3" color={theme.error}>{result.errors.length}</Typography>
                    <Typography variant="caption" color={theme.textTertiary}>Warnings</Typography>
                  </View>
                )}
              </View>

              {/* Errors list */}
              {result.errors.length > 0 && (
                <Card>
                  <View style={{ gap: spacing.xs }}>
                    <Typography variant="label" color={theme.error}>⚠️ Parse Warnings</Typography>
                    {result.errors.slice(0, 10).map((err, i) => (
                      <Typography key={i} variant="caption" color={theme.textTertiary}>
                        • {err}
                      </Typography>
                    ))}
                    {result.errors.length > 10 && (
                      <Typography variant="caption" color={theme.textTertiary}>
                        … and {result.errors.length - 10} more
                      </Typography>
                    )}
                  </View>
                </Card>
              )}

              {/* Topic preview */}
              {result.topics.length > 0 && (
                <View style={{ gap: spacing.sm }}>
                  <Typography variant="overline" color={theme.textTertiary}>
                    Preview (first 10)
                  </Typography>
                  {result.topics.slice(0, 10).map((topic, i) => (
                    <Card key={topic.slug}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                        <View style={{
                          width: 28, height: 28, borderRadius: radius.full,
                          backgroundColor: theme.primary + '22',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Typography variant="caption" color={theme.primary} style={{ fontWeight: '700' }}>
                            {i + 1}
                          </Typography>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Typography variant="label" numberOfLines={1}>
                            {topic.displayName}
                          </Typography>
                          <Typography variant="caption" color={theme.textTertiary}>
                            {topic.slug}{topic.order !== undefined ? ` · order: ${topic.order}` : ''}
                          </Typography>
                        </View>
                      </View>
                    </Card>
                  ))}
                  {result.topics.length > 10 && (
                    <Typography variant="caption" color={theme.textTertiary} align="center">
                      … and {result.topics.length - 10} more topics
                    </Typography>
                  )}
                </View>
              )}

              {/* Submit / Success */}
              {submitted ? (
                <View style={{
                  padding: spacing.lg, borderRadius: radius.xl,
                  backgroundColor: theme.success + '18', alignItems: 'center', gap: spacing.sm,
                }}>
                  <Ionicons name="checkmark-circle" size={36} color={theme.success} />
                  <Typography variant="label" color={theme.success}>
                    {result.topics.length} topics imported successfully!
                  </Typography>
                  <Button variant="secondary" size="md" onPress={handleClose}>
                    Done
                  </Button>
                </View>
              ) : !submitting && (
                <Button
                  fullWidth
                  size="lg"
                  loading={submitting}
                  disabled={result.topics.length === 0}
                  onPress={handleSubmit}
                  icon={<Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />}
                >
                  {`Import ${result.topics.length} Topics`}
                </Button>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
