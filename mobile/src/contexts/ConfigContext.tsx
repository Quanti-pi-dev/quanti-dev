// ─── Platform Config Context ────────────────────────────────
// Fetches admin-editable config from `/api/v1/config` on launch,
// caches in AsyncStorage, refreshes every 5 minutes while foregrounded.
// Components use `useConfig('key')` to read values.

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

// ─── Types ───────────────────────────────────────────────────

type ConfigMap = Record<string, unknown>;

interface ConfigContextValue {
  config: ConfigMap;
  loading: boolean;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = '@platform_config';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ─── Context ─────────────────────────────────────────────────

const ConfigContext = createContext<ConfigContextValue>({
  config: {},
  loading: true,
  refresh: async () => {},
});

// ─── Provider ────────────────────────────────────────────────

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ConfigMap>({});
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const { data } = await api.get('/config');
      if (data?.success && data.data) {
        const map = data.data as ConfigMap;
        setConfig(map);
        // Persist for offline/cold-start
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map)).catch(() => {});
      }
    } catch {
      // Network failure — keep using cached/current config
    } finally {
      setLoading(false);
    }
  }, []);

  // Load cached config immediately, then fetch fresh
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached) {
          setConfig(JSON.parse(cached) as ConfigMap);
          setLoading(false);
        }
      } catch {
        // No cache — will load from network
      }
      await fetchConfig();
    })();
  }, [fetchConfig]);

  // Refresh every 5 minutes while app is foregrounded
  useEffect(() => {
    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchConfig, REFRESH_INTERVAL);
    };

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        fetchConfig();
        startInterval();
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    };

    startInterval();
    const sub = AppState.addEventListener('change', handleAppState);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [fetchConfig]);

  const value = useMemo(() => ({ config, loading, refresh: fetchConfig }), [config, loading, fetchConfig]);

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

// ─── Hooks ───────────────────────────────────────────────────

/** Access the full config context. */
export function useConfigContext(): ConfigContextValue {
  return useContext(ConfigContext);
}

/** Get a single config value by key. Returns fallback if missing. */
export function useConfig<T = string>(key: string, fallback?: T): T {
  const { config } = useContext(ConfigContext);
  const value = config[key];
  if (value === undefined || value === null) return fallback as T;
  return value as T;
}

/** Get a number config value with a fallback. */
export function useConfigNumber(key: string, fallback: number): number {
  const { config } = useContext(ConfigContext);
  const val = config[key];
  return typeof val === 'number' ? val : fallback;
}

/** Get a boolean config value with a fallback. */
export function useConfigBool(key: string, fallback: boolean): boolean {
  const { config } = useContext(ConfigContext);
  const val = config[key];
  return typeof val === 'boolean' ? val : fallback;
}
