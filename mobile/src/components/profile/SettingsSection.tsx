// ─── SettingsSection ──────────────────────────────────────────
// Preferences card (theme toggle, coin history, notifications, language)
// and Account card (help, terms, sign out).
// Extracted from ProfileScreen for memoization.

import React, { useState } from 'react';
import { View, TouchableOpacity, Switch, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { Divider } from '../ui/Divider';
import { LockedFeatureBanner } from '../subscription/LockedFeature';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── SettingRow (private to this module) ──────────────────────

interface SettingRowProps {
  icon: IoniconName;
  label: string;
  onPress?: () => void;
  right?: React.ReactNode;
}

function SettingRow({ icon, label, onPress, right }: SettingRowProps) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md }}
    >
      <View
        style={{
          width: 36, height: 36, borderRadius: radius.md,
          backgroundColor: theme.primaryMuted, alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color={theme.primary} />
      </View>
      <Typography variant="body" style={{ flex: 1 }}>{label}</Typography>
      {right ?? <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />}
    </TouchableOpacity>
  );
}

// ─── Component ───────────────────────────────────────────────

interface SettingsSectionProps {
  isDark: boolean;
  isAdmin: boolean;
  notificationsEnabled: boolean;
  onToggleTheme: () => void;
  onToggleNotifications: (enabled: boolean) => Promise<void>;
  onLogout: () => void;
}

export const SettingsSection = React.memo(function SettingsSection({
  isDark,
  isAdmin,
  notificationsEnabled,
  onToggleTheme,
  onToggleNotifications,
  onLogout,
}: SettingsSectionProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const [notifLoading, setNotifLoading] = useState(false);

  const handleNotifToggle = async (value: boolean) => {
    setNotifLoading(true);
    try {
      await onToggleNotifications(value);
    } catch {
      Alert.alert('Error', 'Failed to update notification preference.');
    } finally {
      setNotifLoading(false);
    }
  };

  return (
    <>
      {/* Preferences */}
      <Card>
        <View style={{ gap: 0 }}>
          <Typography variant="overline" color={theme.textTertiary} style={{ marginBottom: spacing.sm }}>
            Preferences
          </Typography>
          <SettingRow
            icon="moon-outline"
            label="Dark Mode"
            right={<Switch value={isDark} onValueChange={onToggleTheme} />}
          />
          <Divider />
          <SettingRow
            icon="time-outline"
            label="Coin History"
            onPress={() => router.push('/coins-history')}
          />
          <Divider />
          <SettingRow
            icon="notifications-outline"
            label="Notifications"
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotifToggle}
                disabled={notifLoading}
              />
            }
          />
          <Divider />
          <SettingRow
            icon="language-outline"
            label="Language"
            onPress={() => Alert.alert('Coming Soon', 'Language selection coming soon.')}
          />
          <Divider />
          <LockedFeatureBanner feature="Priority Support — Master plan only" minTier={3} />
        </View>
      </Card>

      {/* Admin panel */}
      {isAdmin && (
        <Card variant="outlined">
          <SettingRow
            icon="shield-outline"
            label="Admin Panel"
            onPress={() => router.push('/(admin)' as any)}
          />
        </Card>
      )}

      {/* Account */}
      <Card>
        <View style={{ gap: 0 }}>
          <Typography variant="overline" color={theme.textTertiary} style={{ marginBottom: spacing.sm }}>
            Account
          </Typography>
          <SettingRow
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => Linking.openURL('mailto:support@quanti-pi.com').catch(() => {})}
          />
          <Divider />
          <SettingRow
            icon="document-text-outline"
            label="Terms & Privacy"
            onPress={() => WebBrowser.openBrowserAsync('https://quanti-pi.com/terms')}
          />
          <Divider />
          <TouchableOpacity
            onPress={onLogout}
            style={{ flexDirection: 'row', alignItems: 'center', paddingTop: spacing.md, gap: spacing.md }}
          >
            <View
              style={{
                width: 36, height: 36, borderRadius: radius.md,
                backgroundColor: theme.errorMuted, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="log-out-outline" size={18} color={theme.error} />
            </View>
            <Typography variant="body" color={theme.error}>Sign Out</Typography>
          </TouchableOpacity>
        </View>
      </Card>
    </>
  );
});
