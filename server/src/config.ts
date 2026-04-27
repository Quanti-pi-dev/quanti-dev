// ─── Server Configuration ───────────────────────────────────
// Centralized config with validation. All env vars read once here.

import { logger } from './lib/logger.js';

export const config = {
  env: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  host: process.env['HOST'] ?? '0.0.0.0',
  logLevel: process.env['LOG_LEVEL'] ?? 'info',

  cors: {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:8081',
  },

  postgres: {
    url: process.env['POSTGRES_URL'] ?? 'postgresql://kd_user:kd_secret_dev@localhost:5432/kd_study',
  },

  mongo: {
    url: process.env['MONGO_URL'] ?? 'mongodb://kd_user:kd_secret_dev@localhost:27017/kd_content?authSource=admin',
    dbName: process.env['MONGO_DB'] ?? 'kd_content',
  },

  redis: {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  },

  firebase: {
    // Path to the Firebase service account JSON file (shared with FCM)
    serviceAccountPath: process.env['FIREBASE_SERVICE_ACCOUNT_PATH'] ?? process.env['FCM_SERVICE_ACCOUNT_PATH'] ?? '',
    projectId: process.env['FIREBASE_PROJECT_ID'] ?? '',
  },

  sentry: {
    dsn: process.env['SENTRY_DSN'] ?? '',
    environment: process.env['SENTRY_ENVIRONMENT'] ?? 'development',
  },

  razorpay: {
    keyId: process.env['RAZORPAY_KEY_ID'] ?? '',
    keySecret: process.env['RAZORPAY_KEY_SECRET'] ?? '',
    webhookSecret: process.env['RAZORPAY_WEBHOOK_SECRET'] ?? '',
  },

  storage: {
    // Cloudflare R2 S3-compatible endpoint: https://<account-id>.r2.cloudflarestorage.com
    endpoint:        process.env['R2_ENDPOINT']          ?? '',
    accessKeyId:     process.env['R2_ACCESS_KEY_ID']     ?? '',
    secretAccessKey: process.env['R2_SECRET_ACCESS_KEY'] ?? '',
    // Bucket name (matches the bucket created in the R2 dashboard)
    bucket:          process.env['R2_BUCKET']            ?? process.env['STORAGE_BUCKET'] ?? '',
    // Public CDN base URL — either the R2 public bucket URL or your custom domain
    // e.g. https://pub-<hash>.r2.dev  or  https://assets.yourdomain.com
    cdnBaseUrl:      process.env['CDN_BASE_URL']         ?? '',
  },

  // Resend (email delivery) — https://resend.com/docs
  resend: {
    apiKey:   process.env['RESEND_API_KEY']   ?? '',
    fromEmail: process.env['RESEND_FROM_EMAIL'] ?? 'QuantiPi <support@quantipi.in>',
  },

  // Firebase Cloud Messaging (push notifications)
  fcm: {
    // Path to the Firebase service account JSON file
    serviceAccountPath: process.env['FCM_SERVICE_ACCOUNT_PATH'] ?? '',
  },

  // Master flag to disable all notifications (useful for staging)
  notifications: {
    enabled: process.env['NOTIFICATIONS_ENABLED'] === 'true',
  },
} as const;

export type Config = typeof config;

// ─── Startup Validation ────────────────────────────────────
// Ensures all critical env vars are present. In development, warns.
// In production, throws to prevent silent misconfiguration.

const REQUIRED_PRODUCTION_VARS = [
  'FIREBASE_SERVICE_ACCOUNT_PATH',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'POSTGRES_URL',
  'MONGO_URL',
  'REDIS_URL',
] as const;

export function validateConfig(): void {
  const missing: string[] = [];
  for (const key of REQUIRED_PRODUCTION_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    if (config.env === 'production') {
      throw new Error(msg);
    }
    logger.warn({ missing }, msg);
  }
}
