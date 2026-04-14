// ─── EditProfileModal ────────────────────────────────────────
// Modal with avatar picker + name edit form.
// Extracted from ProfileScreen. Manages its own avatar upload state.

import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Avatar } from '../ui/Avatar';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { api } from '../../services/api';

// ─── AvatarPicker (private) ──────────────────────────────────

interface AvatarPickerProps {
  uri: string | null | undefined;
  name: string;
  isUploading: boolean;
  onPress: () => void;
}

function AvatarPicker({ uri, name, isUploading, onPress }: AvatarPickerProps) {
  const { theme } = useTheme();
  const DIM = 96;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={isUploading}
      style={{ alignSelf: 'center', marginBottom: spacing.md }}
    >
      <Avatar uri={uri} name={name} size="xl" />

      {/* Upload spinner overlay */}
      {isUploading && (
        <View
          style={{
            position: 'absolute',
            width: DIM,
            height: DIM,
            borderRadius: radius.full,
            backgroundColor: 'rgba(0,0,0,0.45)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={theme.buttonPrimaryText} />
        </View>
      )}

      {/* Camera badge (hidden while uploading) */}
      {!isUploading && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 28,
            height: 28,
            borderRadius: radius.full,
            backgroundColor: theme.primary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: theme.background,
          }}
        >
          <Ionicons name="camera" size={14} color={theme.buttonPrimaryText} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── EditProfileModal ────────────────────────────────────────

interface EditProfileModalProps {
  visible: boolean;
  name: string;
  avatarUri: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export const EditProfileModal = React.memo(function EditProfileModal({
  visible,
  name,
  avatarUri,
  onClose,
  onSaved,
}: EditProfileModalProps) {
  const { theme } = useTheme();

  const [editName, setEditName] = useState(name);
  const [editSaving, setEditSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);

  // Sync editName when modal opens with a new name
  React.useEffect(() => {
    if (visible) {
      setEditName(name);
      setPendingAvatarUri(null);
    }
  }, [visible, name]);

  // ─── Pick & Upload Avatar (Presigned URL flow) ────────────
  const handlePickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library in Settings to change your avatar.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = (asset.mimeType as 'image/jpeg' | 'image/png' | 'image/webp') ?? 'image/jpeg';

    setPendingAvatarUri(uri);
    setAvatarUploading(true);

    try {
      const presignRes = await api.post<{ data: { uploadUrl: string; cdnUrl: string } }>(
        '/users/avatar/presign',
        { mimeType },
      );
      const { uploadUrl, cdnUrl } = presignRes.data?.data ?? {};
      if (!uploadUrl || !cdnUrl) {
        throw new Error('Missing upload credentials from server.');
      }

      const fileResponse = await fetch(uri);
      const blob = await fileResponse.blob();
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`R2 upload failed: ${uploadResponse.status}`);
      }

      await api.put('/users/avatar', { avatarUrl: cdnUrl });
      await onSaved();
      setPendingAvatarUri(null);
    } catch {
      setPendingAvatarUri(null);
      Alert.alert('Upload Failed', 'Could not update your avatar. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }, [onSaved]);

  // ─── Save Profile (display name) ──────────────────────────
  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    setEditSaving(true);
    try {
      await api.put('/users/profile', { displayName: editName.trim() });
      await onSaved();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not update profile. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  const displayedAvatarUri = pendingAvatarUri ?? avatarUri;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: theme.border,
        }}>
          <Typography variant="h4">Edit Profile</Typography>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <AvatarPicker
            uri={displayedAvatarUri}
            name={name}
            isUploading={avatarUploading}
            onPress={handlePickAvatar}
          />

          <Typography
            variant="caption"
            color={theme.textTertiary}
            align="center"
            style={{ marginTop: -spacing.sm }}
          >
            Tap avatar to change photo
          </Typography>

          <Input
            label="Display Name"
            value={editName}
            onChangeText={setEditName}
            placeholder="Your name"
            leftIcon={<Ionicons name="person-outline" size={18} color={theme.textTertiary} />}
          />

          <Button
            fullWidth
            size="lg"
            loading={editSaving}
            disabled={avatarUploading}
            onPress={handleSaveProfile}
          >
            Save Changes
          </Button>
        </View>
      </View>
    </Modal>
  );
});
