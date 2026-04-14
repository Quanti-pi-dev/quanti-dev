// ─── ThemeContext ────────────────────────────────────────────
// Provides theme tokens + dark/light mode switching.

import {  createContext, useContext, useState, useEffect, useMemo, useCallback  } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, type Theme } from './tokens';

// ─── Context Shape ────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: 'light' | 'dark' | 'system') => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

// ─── Provider ─────────────────────────────────────────────────

type ThemeMode = 'light' | 'dark' | 'system';
const THEME_STORAGE_KEY = 'theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Rehydrate persisted preference on mount (FIX A15)
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
    }).catch(() => {});
  }, []);

  // Wrapper that persists to AsyncStorage
  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(THEME_STORAGE_KEY, m).catch(() => {});
  }, []);

  const isDark = useMemo(() => {
    if (mode === 'system') return systemColorScheme === 'dark';
    return mode === 'dark';
  }, [mode, systemColorScheme]);

  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = useCallback(() => {
    setMode(
      mode === 'system'
        ? (isDark ? 'light' : 'dark')
        : mode === 'dark' ? 'light' : 'dark'
    );
  }, [isDark, mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, isDark, toggleTheme, setTheme: setMode }),
    [theme, isDark, toggleTheme, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
