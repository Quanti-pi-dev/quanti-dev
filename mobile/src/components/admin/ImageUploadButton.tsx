// ─── ImageUploadButton ───────────────────────────────────────
// Reusable component that replaces a text-input "Image URL" field
// with a visual image-picker and direct R2 upload.
// Reuses the same presigned-URL pattern from EditProfileModal.

import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { adminApi } from '../../services/api';
import { useGlobalUI } from '../../contexts/GlobalUIContext';

// ─── Types ───────────────────────────────────────────────────

interface ImageUploadButtonProps {
  /** Current image URL (either CDN URL or empty) */
  currentUrl: string;
  /** Callback when a new image is uploaded to CDN */
  onUploaded: (cdnUrl: string) => void;
  /** Callback when image is removed */
  onRemoved?: () => void;
  /** Label shown above the button */
  label?: string;
  /** Placeholder text when no image is set */
  placeholder?: string;
}

// ─── Component ───────────────────────────────────────────────

export function ImageUploadButton({
  currentUrl,
  onUploaded,
  onRemoved,
  label = 'Image',
  placeholder = 'Tap to upload an image',
}: ImageUploadButtonProps) {
  const { theme } = useTheme();
  const { showAlert, showToast } = useGlobalUI();
  const [uploading, setUploading] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const hasImage = currentUrl?.startsWith('http://') || currentUrl?.startsWith('https://');
  const displayUri = previewUri ?? (hasImage ? currentUrl : null);

  const handlePick = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert({
        title: 'Permission Required',
        message: 'Please allow access to your photo library in Settings.',
        type: 'info',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // Updated from deprecated MediaTypeOptions (FIX H11)
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = (asset.mimeType as 'image/jpeg' | 'image/png' | 'image/webp') ?? 'image/jpeg';

    setPreviewUri(uri);
    setUploading(true);

    try {
      // Get presigned URL from admin upload endpoint
      const presignRes = await adminApi.post<{ data: { uploadUrl: string; cdnUrl: string } }>(
        '/upload/presign',
        { mimeType },
      );
      const { uploadUrl, cdnUrl } = presignRes.data?.data ?? {};
      if (!uploadUrl || !cdnUrl) {
        throw new Error('Missing upload credentials from server.');
      }

      // Upload binary directly to R2
      const fileResponse = await fetch(uri);
      const blob = await fileResponse.blob();
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      onUploaded(cdnUrl);
    } catch {
      setPreviewUri(null);
      showToast('Could not upload image. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  return (
    <View style={{ gap: spacing.xs }}>
      {label && (
        <Typography variant="label" color={theme.textSecondary}>
          {label}
        </Typography>
      )}

      {displayUri ? (
        /* ── Image preview (no nested touchables) ── */
        <View
          style={{
            borderRadius: radius.xl,
            borderWidth: 1.5,
            borderColor: theme.border,
            backgroundColor: theme.card,
            overflow: 'hidden',
            height: 160,
          }}
        >
          <Image
            source={{ uri: displayUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={{ duration: 300, effect: 'cross-dissolve' }}
            cachePolicy="memory-disk"
          />
          {/* Overlay controls when uploading */}
          {uploading && (
            <View style={{
              position: 'absolute', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Typography variant="caption" color="#FFFFFF" style={{ marginTop: spacing.sm }}>
                Uploading…
              </Typography>
            </View>
          )}
          {/* Action badges — flat, no nesting */}
          {!uploading && (
            <View style={{ position: 'absolute', bottom: spacing.sm, right: spacing.sm, flexDirection: 'row', gap: spacing.xs }}>
              {onRemoved && (
                <TouchableOpacity
                  onPress={() => { setPreviewUri(null); onRemoved(); }}
                  style={{
                    backgroundColor: theme.error,
                    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
                    borderRadius: radius.full,
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                  }}
                >
                  <Ionicons name="trash" size={12} color="#FFFFFF" />
                  <Typography variant="caption" color="#FFFFFF">Remove</Typography>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handlePick}
                style={{
                  backgroundColor: theme.primary,
                  paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
                  borderRadius: radius.full,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                }}
              >
                <Ionicons name="camera" size={12} color="#FFFFFF" />
                <Typography variant="caption" color="#FFFFFF">Change</Typography>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        /* ── Empty state (single touchable) ── */
        <TouchableOpacity
          onPress={handlePick}
          disabled={uploading}
          activeOpacity={0.75}
          style={{
            borderRadius: radius.xl,
            borderWidth: 1.5,
            borderColor: theme.border,
            borderStyle: 'dashed',
            backgroundColor: theme.card,
            overflow: 'hidden',
            height: 80,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Ionicons name="cloud-upload-outline" size={28} color={theme.textTertiary} />
            <Typography variant="caption" color={theme.textTertiary}>
              {placeholder}
            </Typography>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}
