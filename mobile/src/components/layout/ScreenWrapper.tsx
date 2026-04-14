// ─── ScreenWrapper ───────────────────────────────────────────
// SafeAreaView + status bar + themed background.
// Optional keyboard-avoiding mode for forms.


import {
  View,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme';

interface ScreenWrapperProps {
  children: React.ReactNode;
  scroll?: boolean;
  keyboardAvoiding?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function ScreenWrapper({
  children,
  scroll = false,
  keyboardAvoiding = false,
  style,
  contentStyle,
}: ScreenWrapperProps) {
  const { theme, isDark } = useTheme();

  const inner = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ flexGrow: 1, paddingBottom: 24 }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );

  const wrapped = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      {inner}
    </KeyboardAvoidingView>
  ) : inner;

  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: theme.background }, style]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {wrapped}
    </SafeAreaView>
  );
}
