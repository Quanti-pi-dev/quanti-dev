// ─── BulkImportModal ─────────────────────────────────────────
// Modal for importing flashcards from JSON or CSV files.
// Admin picks a file via expo-document-picker, we parse it,
// preview the results, and submit in bulk with progress tracking.

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  Modal,
  TouchableOpacity,
  Alert,
  Animated,
  Keyboard,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  parseCSV,
  parseJSON,
  ParsedFlashcard,
  ParseResult,
} from '../../utils/csvParser';

// ─── Types ───────────────────────────────────────────────────

interface BulkImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (
    cards: ParsedFlashcard[],
    onProgress?: (currentBatch: number, totalBatches: number, insertedSoFar: number) => void,
  ) => Promise<void>;
}

type FileFormat = 'json' | 'csv';

interface UploadProgress {
  currentBatch: number;
  totalBatches: number;
  insertedSoFar: number;
}

// ─── Component ───────────────────────────────────────────────

export function BulkImportModal({ visible, onClose, onSubmit }: BulkImportModalProps) {
  const { theme } = useTheme();

  const [format, setFormat] = useState<FileFormat>('csv');
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [batchErrors, setBatchErrors] = useState<string[]>([]);

  // Animated progress bar width
  const progressAnim = useRef(new Animated.Value(0)).current;

  const reset = useCallback(() => {
    setFileName(null);
    setResult(null);
    setSubmitted(false);
    setProgress(null);
    setBatchErrors([]);
    progressAnim.setValue(0);
  }, [progressAnim]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  // ── File Picker ────────────────────────────────────────────
  const handlePickFile = useCallback(async () => {
    try {
      const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
      const result = await DocumentPicker.getDocumentAsync({
        type: mimeType,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];

      // Guard: reject files over 5 MB to prevent UI freeze
      const MAX_FILE_BYTES = 5 * 1024 * 1024;
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        setResult({
          cards: [],
          errors: [`File too large (${(asset.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`],
        });
        setFileName(asset.name ?? 'file');
        return;
      }

      setFileName(asset.name ?? 'file');

      // Read the file contents using the new File API
      const file = new ExpoFile(asset.uri);
      const content = await file.text();

      // Parse based on chosen format
      const parsed = format === 'csv' ? parseCSV(content) : parseJSON(content);
      setResult(parsed);
    } catch (err) {
      Alert.alert('File Error', 'Could not read the selected file. Please try again.');
    }
  }, [format]);

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!result || result.cards.length === 0) return;
    setSubmitting(true);
    setProgress(null);
    setBatchErrors([]);
    progressAnim.setValue(0);

    try {
      await onSubmit(result.cards, (currentBatch, totalBatches, insertedSoFar) => {
        setProgress({ currentBatch, totalBatches, insertedSoFar });
        // Animate progress bar
        const pct = currentBatch / totalBatches;
        Animated.timing(progressAnim, {
          toValue: pct,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
      setSubmitted(true);
    } catch (err: unknown) {
      Alert.alert(
        'Upload Failed',
        err instanceof Error ? err.message : 'Failed to upload cards. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [result, onSubmit, progressAnim]);

  const progressPct = progress ? Math.round((progress.currentBatch / progress.totalBatches) * 100) : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* ── Header ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: theme.border,
        }}>
          <Typography variant="h4">Bulk Import Cards</Typography>
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
              <Typography variant="caption" color={theme.textTertiary}>
                {format === 'csv'
                  ? 'Headers: question, optionA, optionB, optionC, optionD, correctAnswer, explanation\ncorrectAnswer must be A, B, C, or D.'
                  : '[{ "question": "...", "options": [{"id": "A", "text": "..."}], "correctAnswerId": "A", "explanation": "..." }]'}
              </Typography>
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
                Max 5 MB · {format.toUpperCase()} format
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
                  <Typography variant="h3" color={theme.success}>{result.cards.length}</Typography>
                  <Typography variant="caption" color={theme.textTertiary}>Valid Cards</Typography>
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

              {/* Card preview */}
              {result.cards.length > 0 && (
                <View style={{ gap: spacing.sm }}>
                  <Typography variant="overline" color={theme.textTertiary}>
                    Preview (first 5)
                  </Typography>
                  {result.cards.slice(0, 5).map((card, i) => (
                    <Card key={i}>
                      <View style={{ gap: spacing.xs }}>
                        <Typography variant="label" numberOfLines={2}>
                          {i + 1}. {card.question}
                        </Typography>
                        {card.options.map((opt) => (
                          <View key={opt.id} style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
                            <Ionicons
                              name={opt.id === card.correctAnswerId ? 'checkmark-circle' : 'ellipse-outline'}
                              size={14}
                              color={opt.id === card.correctAnswerId ? theme.success : theme.textTertiary}
                            />
                            <Typography
                              variant="caption"
                              color={opt.id === card.correctAnswerId ? theme.success : theme.textSecondary}
                            >
                              {opt.text}
                            </Typography>
                          </View>
                        ))}
                      </View>
                    </Card>
                  ))}
                  {result.cards.length > 5 && (
                    <Typography variant="caption" color={theme.textTertiary} align="center">
                      … and {result.cards.length - 5} more cards
                    </Typography>
                  )}
                </View>
              )}

              {/* ── Progress Bar (Component D) ── */}
              {submitting && progress && (
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="label" color={theme.primary}>
                      Uploading…
                    </Typography>
                    <Typography variant="caption" color={theme.textTertiary}>
                      Batch {progress.currentBatch}/{progress.totalBatches} · {progressPct}%
                    </Typography>
                  </View>
                  <View style={{
                    height: 8,
                    borderRadius: radius.full,
                    backgroundColor: theme.border,
                    overflow: 'hidden',
                  }}>
                    <Animated.View style={{
                      height: '100%',
                      borderRadius: radius.full,
                      backgroundColor: theme.primary,
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    }} />
                  </View>
                  <Typography variant="caption" color={theme.textSecondary} align="center">
                    {progress.insertedSoFar} cards inserted so far
                  </Typography>
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
                    {progress?.insertedSoFar ?? result.cards.length} cards imported successfully!
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
                  disabled={result.cards.length === 0}
                  onPress={handleSubmit}
                  icon={<Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />}
                >
                  {`Import ${result.cards.length} Cards`}
                </Button>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
