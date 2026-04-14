// ─── Level Unlock Modal ───────────────────────────────────────
// Shown when a user earns the 20th correct answer in a level,
// instantly unlocking the next level. Chalk/whiteboard themed.

import { View, TouchableOpacity, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTheme } from '@/theme';
import { spacing, radius } from '@/theme/tokens';
import { Typography } from '@/components/ui/Typography';
import type { SubjectLevel } from '@kd/shared';

interface LevelUnlockModalProps {
  visible: boolean;
  newLevel: SubjectLevel;
  onKeepStudying: () => void;
  onNextLevel: () => void;
}

export function LevelUnlockModal({
  visible,
  newLevel,
  onKeepStudying,
  onNextLevel,
}: LevelUnlockModalProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 12, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0.7, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: '#00000066',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <Animated.View
          style={[
            {
              backgroundColor: theme.card,
              borderRadius: radius['2xl'],
              padding: spacing['2xl'],
              width: '100%',
              maxWidth: 360,
              alignItems: 'center',
              gap: spacing.lg,
              // Chalk-border effect
              borderWidth: 2,
              borderColor: theme.primary,
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: 20,
              shadowOpacity: 0.35,
              elevation: 12,
            },
            animStyle,
          ]}
        >
          {/* Badge */}
          <View
            style={{
              width: 72, height: 72, borderRadius: radius.full,
              backgroundColor: theme.primary + '22',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Typography style={{ fontSize: 36 }}>🎉</Typography>
          </View>

          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Typography variant="h3" align="center">Level Unlocked!</Typography>
            <Typography variant="body" align="center" color={theme.textSecondary}>
              You unlocked the{' '}
              <Typography variant="label" color={theme.primary}>{newLevel}</Typography>{' '}
              level. Keep going!
            </Typography>
          </View>

          {/* CTAs */}
          <View style={{ width: '100%', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={onNextLevel}
              activeOpacity={0.85}
              style={{
                backgroundColor: theme.primary,
                borderRadius: radius.xl,
                paddingVertical: spacing.md,
                alignItems: 'center',
              }}
            >
              <Typography variant="label" color="#FFFFFF">
                Start {newLevel} Level →
              </Typography>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onKeepStudying}
              activeOpacity={0.85}
              style={{
                borderWidth: 1.5,
                borderColor: theme.border,
                borderRadius: radius.xl,
                paddingVertical: spacing.md,
                alignItems: 'center',
              }}
            >
              <Typography variant="label" color={theme.textSecondary}>
                Keep Studying This Level
              </Typography>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
