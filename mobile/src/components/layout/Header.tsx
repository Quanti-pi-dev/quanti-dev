// ─── Header ──────────────────────────────────────────────────
// Screen header: optional back button + title + optional right action.


import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { spacing, typography } from '../../theme/tokens';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export function Header({ title, showBack = false, onBack, rightAction, style }: HeaderProps) {
  const { theme } = useTheme();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.md,
          minHeight: 56,
        },
        style,
      ]}
    >
      {/* Left: back button */}
      <View style={{ minWidth: 40, flexShrink: 0 }}>
        {showBack && (
          <TouchableOpacity onPress={handleBack} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Center: title */}
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm }}>
        {title && (
          <Text
            numberOfLines={1}
            style={{
              fontWeight: '700',
              fontSize: typography.lg,
              color: theme.text,
            }}
          >
            {title}
          </Text>
        )}
      </View>

      {/* Right: action */}
      <View style={{ minWidth: 40, alignItems: 'flex-end', flexShrink: 0 }}>
        {rightAction}
      </View>
    </View>
  );
}
