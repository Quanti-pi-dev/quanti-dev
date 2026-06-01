// ─── Biometric Authentication Hook ───────────────────────────
// Provides biometric (Face ID / Fingerprint) authentication support.
// Used on the Sign-In screen for returning users who have a saved session.
// Note: expo-local-authentication is an optional peer dep — may not be installed.

import { useState, useEffect, useCallback } from 'react';

// Minimal shape of expo-local-authentication (optional dependency).
interface LocalAuthModule {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  supportedAuthenticationTypesAsync(): Promise<number[]>;
  authenticateAsync(opts: { promptMessage: string; fallbackLabel?: string }): Promise<{ success: boolean }>;
}

/** Attempt to load expo-local-authentication at runtime. Returns null if not installed. */
async function loadLocalAuth(): Promise<LocalAuthModule | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-local-authentication') as LocalAuthModule;
  } catch {
    return null;
  }
}

// Biometric types for display labels
type BiometricType = 'Face ID' | 'Fingerprint' | 'Biometric' | null;

export function useBiometricAuth() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>(null);

  useEffect(() => {
    (async () => {
      const LocalAuth = await loadLocalAuth();
      if (!LocalAuth) return;

      try {
        const hasHardware = await LocalAuth.hasHardwareAsync();
        const isEnrolled = await LocalAuth.isEnrolledAsync();
        if (hasHardware && isEnrolled) {
          setIsAvailable(true);
          const types = await LocalAuth.supportedAuthenticationTypesAsync();
          // 1 = fingerprint, 2 = facial recognition, 3 = iris
          if (types.includes(2)) setBiometricType('Face ID');
          else if (types.includes(1)) setBiometricType('Fingerprint');
          else setBiometricType('Biometric');
        }
      } catch {
        setIsAvailable(false);
      }
    })();
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    const LocalAuth = await loadLocalAuth();
    if (!LocalAuth) return false;

    try {
      const result = await LocalAuth.authenticateAsync({
        promptMessage: 'Sign in to Quanti-pi',
        fallbackLabel: 'Use Password',
      });
      return result.success;
    } catch {
      return false;
    }
  }, []);

  return { isAvailable, biometricType, authenticate };
}
