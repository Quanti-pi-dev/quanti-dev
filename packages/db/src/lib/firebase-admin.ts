// ─── Firebase Admin SDK Singleton ───────────────────────────
// Lazy-initialized Firebase Admin instance.
// Shares the service account with FCM (push notifications).

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { config } from '../config.js';
import { logger } from './logger.js';

let _app: admin.app.App | null = null;

/**
 * Returns the singleton Firebase Admin app instance.
 * Initializes on first call using the service account JSON file
 * specified in config.firebase.serviceAccountPath.
 *
 * Falls back to Application Default Credentials if no path is set
 * (useful for local development with `gcloud auth application-default login`).
 */
export function getFirebaseAdmin(): admin.app.App {
  if (_app) return _app;

  const saPath = config.firebase.serviceAccountPath;

  if (saPath) {
    try {
      const serviceAccount = JSON.parse(readFileSync(saPath, 'utf-8'));
      _app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.firebase.projectId || serviceAccount.project_id,
      });
      logger.info('Firebase Admin initialized with service account');
    } catch (err) {
      logger.error({ err, saPath }, 'Failed to load Firebase service account — falling back to ADC');
      _app = admin.initializeApp({
        projectId: config.firebase.projectId || undefined,
      });
    }
  } else {
    // No service account path — use Application Default Credentials
    _app = admin.initializeApp({
      projectId: config.firebase.projectId || undefined,
    });
    logger.info('Firebase Admin initialized with Application Default Credentials');
  }

  return _app;
}
