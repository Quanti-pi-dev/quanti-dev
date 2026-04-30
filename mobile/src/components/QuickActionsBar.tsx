// ─── QuickActionsBar ─────────────────────────────────────────
// Horizontal row of quick-tap action buttons for the Home screen.
// Each button has an icon, label, and optional badge (e.g. coin count).
// Features: press-scale animation, themed glass-style backgrounds.

import { View, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { radius, spacing } from '../theme/tokens';
import { Typography } from './ui/Typography';

interface QuickAction {
  icon: keyof typeof Ionicons['glyphMap'];
  label: string;
  color: string;
  onPress: () => void;
  badge?: string;
}

interface QuickActionsBarProps {
  actions: QuickAction[];
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function ActionButton({ icon, label, color, onPress, badge }: QuickAction) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { stiffness: 400, damping: 18 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 300, damping: 20 });
  };
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        animStyle,
        {
          flex: 1,
          alignItems: 'center',
          gap: spacing.xs + 2,
        },
      ]}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.xl,
          backgroundColor: color + '14',
          borderWidth: 1,
          borderColor: color + '28',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Ionicons name={icon} size={22} color={color} />
        {badge && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: color,
              borderRadius: radius.full,
              minWidth: 18,
              height: 18,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Typography
              variant="caption"
              color="#FFFFFF"
              style={{ fontSize: 9, fontWeight: '700' }}
            >
              {badge}
            </Typography>
          </View>
        )}
      </View>
      <Typography
        variant="caption"
        color={theme.textSecondary}
        align="center"
        style={{ fontSize: 10, fontWeight: '500' }}
      >
        {label}
      </Typography>
    </AnimatedTouchable>
  );
}

export function QuickActionsBar({ actions }: QuickActionsBarProps) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {actions.map((action) => (
        <ActionButton key={action.label} {...action} />
      ))}
    </View>
  );
}
