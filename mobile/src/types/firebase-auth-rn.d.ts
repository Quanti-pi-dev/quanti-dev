// ─── Firebase Auth React Native Persistence Types ───────────
// In Firebase v11, the `getReactNativePersistence` function is only
// exported from the internal RN-specific build (`@firebase/auth/dist/rn`).
// Metro resolves it at runtime via the `"react-native"` field in
// `@firebase/auth/package.json`, but TypeScript uses the standard
// `"types"` entry which does not include this export.
//
// This ambient declaration patches the type gap.

import type { Persistence } from 'firebase/auth';
import type { ReactNativeAsyncStorage } from '@react-native-async-storage/async-storage';

declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: typeof ReactNativeAsyncStorage | { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> }
  ): Persistence;
}
