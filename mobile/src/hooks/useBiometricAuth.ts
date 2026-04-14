// ─── Biometric Authentication Hook ───────────────────────────
// Provides biometric (Face ID / Fingerprint) authentication support.
// Used on the Sign-In screen for returning users who have a saved session.

import { useState, useEffect, useCallback } from 'react';

// Biometric types for display labels
type BiometricType = 'Face ID' | 'Fingerprint' | 'Biometric' | null;

export function useBiometricAuth() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>(null);

  useEffect(() => {
    (async () => {
      try {
        // Dynamic import — expo-local-authentication may not be installed
        // @ts-ignore — optional dependency, handled by try/catch
        const LocalAuth = await import('expo-local-authentication');
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
        // expo-local-authentication not installed — biometrics unavailable
        setIsAvailable(false);
      }
    })();
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    try {
      // @ts-ignore — optional dependency, handled by try/catch
      const LocalAuth = await import('expo-local-authentication');
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
