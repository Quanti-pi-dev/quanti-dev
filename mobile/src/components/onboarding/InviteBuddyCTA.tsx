// ─── Invite a Study Buddy CTA ───────────────────────────────
// Phase 4: Social viral loop — lets students invite friends
// directly from the onboarding completion screen via the
// native share sheet with a deep link.
//
// Psychology: Social Accountability (Cialdini) — publicly
// committing to a study partner increases follow-through.
// Viral loop: invited friends enter the same onboarding flow.

import { useCallback, useState } from 'react';
import { View, Share, Platform, TouchableOpacity } from 'react-native';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, radius } from '../../theme/tokens';
import { Typography } from '../ui/Typography';

interface InviteBuddyCTAProps {
  /** User ID for the referral link */
  userId?: string;
  /** Display name for the share message */
  displayName?: string;
  /** Animation delay (ms) from parent */
  delay?: number;
}

export function InviteBuddyCTA({
  userId,
  displayName,
  delay = 1900,
}: InviteBuddyCTAProps) {
  const { theme, isDark } = useTheme();
  const [shared, setShared] = useState(false);
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleInvite = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withTiming(0.95, { duration: 80 }),
      withSpring(1, { stiffness: 400, damping: 15 }),
    );

    const deepLink = userId
      ? `https://quantipi.app/invite?ref=${userId}`
      : 'https://quantipi.app';

    const name = displayName?.split(' ')[0] ?? 'your friend';
    const message = Platform.select({
      ios: `Hey! I just started using Quanti-Pi to study. Join me and we can challenge each other! 🚀\n\n${deepLink}`,
      default: `Hey! ${name} is inviting you to study together on Quanti-Pi. Challenge each other and stay accountable! 🚀\n\n${deepLink}`,
    });

    try {
      const result = await Share.share(
        {
          message,
          ...(Platform.OS === 'ios' ? { url: deepLink } : {}),
        },
        {
          dialogTitle: 'Invite a Study Buddy',
          subject: 'Join me on Quanti-Pi!',
        },
      );

      if (result.action === Share.sharedAction) {
        setShared(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // User cancelled or share failed — non-critical
    }
  }, [userId, displayName, scale]);

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} style={[animStyle]}>
      <TouchableOpacity
        onPress={handleInvite}
        activeOpacity={0.85}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          backgroundColor: isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.06)',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.lg,
          borderRadius: radius.xl,
          borderWidth: 1.5,
          borderColor: isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.15)',
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.full,
            backgroundColor: isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={shared ? 'checkmark-circle' : 'people'}
            size={18}
            color="#8B5CF6"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Typography variant="bodySemiBold" color="#8B5CF6">
            {shared ? 'Invite sent! 🎉' : 'Invite a Study Buddy 👥'}
          </Typography>
          <Typography variant="caption" color={theme.textTertiary}>
            {shared
              ? 'Share with more friends to build your study squad'
              : 'Challenge a friend — you both earn bonus coins'}
          </Typography>
        </View>
        <Ionicons
          name="share-outline"
          size={20}
          color="#8B5CF6"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}
