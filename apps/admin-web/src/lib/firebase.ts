// ─── Firebase Client ─────────────────────────────────────────
// Initialised once (singleton pattern) for use in client components.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { env } from './env';

const app = getApps().length === 0
  ? initializeApp(env.firebase)
  : getApps()[0]!;

export const auth = getAuth(app);
export default app;
