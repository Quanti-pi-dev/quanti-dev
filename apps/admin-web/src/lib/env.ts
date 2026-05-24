// ─── Environment Variable Types ──────────────────────────────
// Centralized type-safe access to all NEXT_PUBLIC_ variables.

export const env = {
  adminApiUrl: process.env['NEXT_PUBLIC_ADMIN_API_URL'] ?? 'http://localhost:3001',
  firebase: {
    apiKey:            process.env['NEXT_PUBLIC_FIREBASE_API_KEY'] ?? '',
    authDomain:        process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? '',
    projectId:         process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] ?? '',
    storageBucket:     process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'] ?? '',
    messagingSenderId: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] ?? '',
    appId:             process.env['NEXT_PUBLIC_FIREBASE_APP_ID'] ?? '',
  },
} as const;
