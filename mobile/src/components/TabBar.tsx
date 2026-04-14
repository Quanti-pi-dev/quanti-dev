// ─── TabBar ──────────────────────────────────────────────────
// Custom bottom tab bar with animated indicator and board theme.


import { View, Text, TouchableOpacity, Platform, ViewStyle } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { radius, spacing, typography, shadows } from '../theme/tokens';

// ─── Tab Config ───────────────────────────────────────────────

type TabKey = 'index' | 'study' | 'progress' | 'battles' | 'profile';

const TAB_ICONS: Record<TabKey, { active: React.ComponentProps<typeof Ionicons>['name']; inactive: React.ComponentProps<typeof Ionicons>['name']; label: string }> = {
  index: { active: 'home', inactive: 'home-outline', label: 'Home' },
  study: { active: 'book', inactive: 'book-outline', label: 'Study' },
  progress: { active: 'bar-chart', inactive: 'bar-chart-outline', label: 'Progress' },
  battles: { active: 'flash', inactive: 'flash-outline', label: 'Battles' },
  profile: { active: 'person', inactive: 'person-outline', label: 'Profile' },
};

// ─── TabItem Component ───────────────────────────────────────

interface TabItemProps {
  route: BottomTabBarProps['state']['routes'][0];
  isFocused: boolean;
  tabConfig: typeof TAB_ICONS[TabKey];
  theme: ReturnType<typeof useTheme>['theme'];
  navigation: BottomTabBarProps['navigation'];
}

function TabItem({ route, isFocused, tabConfig, theme, navigation }: TabItemProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPress = () => {
    scale.value = withSpring(0.88, { stiffness: 600, damping: 20 }, () => {
      scale.value = withSpring(1, { stiffness: 400, damping: 18 });
    });
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <TouchableOpacity
      key={route.key}
      onPress={onPress}
      activeOpacity={1}
      style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.xs }}
    >
      <Animated.View style={[animStyle, { alignItems: 'center', gap: 3 }]}>
        {isFocused && (
          <View
            style={{
              position: 'absolute',
              top: -spacing.sm,
              width: 32,
              height: 3,
              borderRadius: radius.full,
              backgroundColor: theme.tabBarActive,
            }}
          />
        )}
        <Ionicons
          name={isFocused ? tabConfig.active : tabConfig.inactive}
          size={24}
          color={isFocused ? theme.tabBarActive : theme.tabBarInactive}
        />
        <Text
          style={{
            fontFamily: isFocused ? typography.bodySemiBold : typography.body,
            fontSize: 10,
            color: isFocused ? theme.tabBarActive : theme.tabBarInactive,
          }}
        >
          {tabConfig.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Component ───────────────────────────────────────────────

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.tabBarBackground,
        borderTopWidth: 1,
        borderTopColor: theme.tabBarBorder,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.sm,
        ...shadows.sm,
        shadowColor: theme.shadow,
      }}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const tabKey = route.name as TabKey;
        const tabConfig = TAB_ICONS[tabKey];
        if (!tabConfig) return null;

        return (
          <TabItem
            key={route.key}
            route={route}
            isFocused={isFocused}
            tabConfig={tabConfig}
            theme={theme}
            navigation={navigation}
          />
        );
      })}
    </View>
  );
}
