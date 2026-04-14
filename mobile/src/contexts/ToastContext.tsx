// ─── Toast Notification System ────────────────────────────────
// Lightweight, non-blocking toast notifications for the admin panel.
// Replaces Alert.alert for success/error feedback.
// Pure Animated + SafeAreaView — no third-party deps.

import React, { createContext, useContext, useCallback, useState, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../components/ui/Typography';
import { radius, spacing } from '../theme/tokens';

// ─── Types ───────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

// ─── Config ──────────────────────────────────────────────────

const TOAST_DURATION = 3000;

const TOAST_CONFIG: Record<ToastType, { icon: string; bg: string; border: string; text: string }> = {
  success: { icon: 'checkmark-circle', bg: '#05966920', border: '#05966966', text: '#059669' },
  error:   { icon: 'alert-circle',     bg: '#EF444420', border: '#EF444466', text: '#EF4444' },
  info:    { icon: 'information-circle', bg: '#6366F120', border: '#6366F166', text: '#6366F1' },
};

// ─── Individual Toast ────────────────────────────────────────

function Toast({ message, type, onDismiss }: { message: string; type: ToastType; onDismiss: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const config = TOAST_CONFIG[type];

  React.useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, TOAST_DURATION);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.toast, { opacity: fadeAnim, transform: [{ translateY }], backgroundColor: config.bg, borderColor: config.border }]}>
      <Ionicons name={config.icon as never} size={20} color={config.text} />
      <Typography variant="label" color={config.text} style={{ flex: 1 }} numberOfLines={2}>
        {message}
      </Typography>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color={config.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Provider ────────────────────────────────────────────────

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]); // keep max 3
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View
        style={[styles.container, { top: insets.top + (Platform.OS === 'ios' ? 4 : 8) }]}
        pointerEvents="box-none"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onDismiss={() => dismiss(toast.id)}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    gap: spacing.xs,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 6,
  },
});
