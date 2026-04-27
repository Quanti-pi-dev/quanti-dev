// ─── GlobalUIContext ─────────────────────────────────────────
// Unified context for all in-app feedback UI:
//   • showToast()  — temporary, non-blocking notification (top of screen)
//   • showAlert()  — blocking confirmation/info dialog (replaces Alert.alert)
//
// Both surfaces render as premium glassmorphic cards with spring animations.
// Wire <GlobalUIProvider> directly inside <SafeAreaProvider> in _layout.tsx.

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { GlassToastStack } from '../components/ui/GlassToast';
import { GlassAlertModal } from '../components/ui/GlassAlert';

// ─── Toast Types ─────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

// ─── Alert Types ─────────────────────────────────────────────

export type AlertType = 'info' | 'error' | 'warning' | 'destructive';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  /** defaults to 'default' */
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
}

// ─── Context Shape ───────────────────────────────────────────

interface GlobalUIContextValue {
  /** Show a temporary toast notification */
  showToast: (message: string, type?: ToastType) => void;
  /** Show a blocking alert/confirmation dialog */
  showAlert: (options: AlertOptions) => void;
}

const GlobalUIContext = createContext<GlobalUIContextValue>({
  showToast: () => {},
  showAlert: () => {},
});

export const useGlobalUI = () => useContext(GlobalUIContext);

// ─── Provider ────────────────────────────────────────────────

let toastCounter = 0;

export function GlobalUIProvider({ children }: { children: React.ReactNode }) {
  // ── Toast state ──
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // ── Alert state ──
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);

  // We store a resolve ref so the alert imperative API can work correctly
  // even if the component re-renders between show and dismiss.
  const alertOptionsRef = useRef<AlertOptions | null>(null);

  // ── Toast API ──
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]); // max 3
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Alert API ──
  const showAlert = useCallback((options: AlertOptions) => {
    alertOptionsRef.current = options;
    setAlertOptions(options);
    setAlertVisible(true);
  }, []);

  const handleAlertDismiss = useCallback(() => {
    setAlertVisible(false);
    // Clear after animation completes
    setTimeout(() => setAlertOptions(null), 350);
  }, []);

  return (
    <GlobalUIContext.Provider value={{ showToast, showAlert }}>
      {children}

      {/* Toast stack renders on top of everything */}
      <View style={styles.overlay} pointerEvents="box-none">
        <GlassToastStack toasts={toasts} onDismiss={dismissToast} />
      </View>

      {/* Alert modal */}
      {alertOptions && (
        <GlassAlertModal
          visible={alertVisible}
          options={alertOptions}
          onDismiss={handleAlertDismiss}
        />
      )}
    </GlobalUIContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
});
