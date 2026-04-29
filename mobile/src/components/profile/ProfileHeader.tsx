// ─── ProfileHeader ────────────────────────────────────────────
// Avatar card with name, email, role badge, and edit button.
// Extracted from ProfileScreen for memoization and clarity.

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { CoinDisplay } from '../CoinDisplay';

interface ProfileHeaderProps {
  name: string;
  enrollmentId?: string;
  email: string;
  avatarUri: string | null;
  isAdmin: boolean;
  coins: number;
  onEditPress: () => void;
  onCoinsPress: () => void;
  onCartPress: () => void;
}

export const ProfileHeader = React.memo(function ProfileHeader({
  name,
  enrollmentId,
  email,
  avatarUri,
  isAdmin,
  coins,
  onEditPress,
  onCoinsPress,
  onCartPress,
}: ProfileHeaderProps) {
  const { theme } = useTheme();

  return (
    <>
      {/* Top bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h3">Profile</Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity onPress={onCoinsPress}>
            <CoinDisplay coins={coins} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onCartPress}
            style={{
              width: 44, height: 44, borderRadius: radius.full,
              backgroundColor: theme.cardAlt, borderWidth: 1.5, borderColor: theme.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="cart-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Avatar card */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.base }}>
          <Avatar uri={avatarUri} name={name} size="lg" />
          <View style={{ flex: 1 }}>
            <Typography variant="h4">{name}</Typography>
            {!!enrollmentId && (
              <Typography variant="caption" color={theme.textTertiary}>
                ID: {enrollmentId}
              </Typography>
            )}
            <Typography variant="caption" color={theme.textTertiary}>{email}</Typography>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <Badge label={isAdmin ? 'Admin' : 'Student'} variant={isAdmin ? 'warning' : 'primary'} size="sm" />
            </View>
          </View>
          <TouchableOpacity
            onPress={onEditPress}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="pencil-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </Card>
    </>
  );
});
