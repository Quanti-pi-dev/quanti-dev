// ─── ExamCard ─────────────────────────────────────────────────
// Exam category card: name, count, progress bar, icon.
// Grid (default) and list layout variants.
// Uses the unified useScalePress hook for consistent press animation.

import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { radius, spacing, typography, shadows } from '../theme/tokens';
import { useScalePress } from '../theme/animations';
import { ProgressBar } from './ui/ProgressBar';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ExamCardProps {
  name: string;
  count: number;
  progress: number; // 0–1
  icon?: IoniconName;
  accent?: string;
  layout?: 'grid' | 'list';
  onPress?: () => void;
  style?: ViewStyle;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const ExamCard = ({
  name,
  count,
  progress,
  icon = 'calculator-outline',
  accent,
  layout = 'grid',
  onPress,
  style,
}: ExamCardProps) => {
  const { theme } = useTheme();
  const color = accent ?? theme.primary;
  const isList = layout === 'list';

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const { animStyle, handlers } = useScalePress(0.96, handlePress);

  return (
    <AnimatedTouchable
      activeOpacity={1}
      style={[
        animStyle,
        {
          backgroundColor: theme.card,
          borderRadius: radius.xl,
          padding: spacing.base,
          ...shadows.sm,
          shadowColor: theme.shadow,
          borderWidth: 1,
          borderColor: theme.borderLight,
          ...(isList
            ? { flexDirection: 'row', alignItems: 'center', gap: spacing.md }
            : { gap: spacing.md }),
        },
        style,
      ]}
      {...handlers}
    >
      {/* Icon */}
      <View
        style={{
          width: isList ? 48 : 52,
          height: isList ? 48 : 52,
          borderRadius: radius.lg,
          backgroundColor: color + '20',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Ionicons name={icon} size={isList ? 22 : 26} color={color} />
      </View>

      {/* Content */}
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text
          style={{
            fontFamily: typography.bodyBold,
            fontSize: typography.base,
            color: theme.text,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>

        <Text
          style={{
            fontFamily: typography.body,
            fontSize: typography.xs,
            color: theme.textTertiary,
          }}
        >
          {count} flashcards
        </Text>

        <ProgressBar progress={progress} height={5} color={color} />
      </View>

      {isList && (
        <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
      )}
    </AnimatedTouchable>
  );
};
