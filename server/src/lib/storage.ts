// ─── Cloudflare R2 Storage Client ────────────────────────────
// Generates short-lived presigned PUT URLs so the mobile client
// can upload avatar images directly to R2 — files never transit
// the server. Uses the S3-compatible API via @aws-sdk.

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

// ─── Singleton ───────────────────────────────────────────────

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto', // R2 uses 'auto' — region is selected by Cloudflare
      endpoint: config.storage.endpoint,
      credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
      },
    });
  }
  return _client;
}

// ─── Presigned URL Generator ─────────────────────────────────

export interface PresignedUploadResult {
  /** Presigned PUT URL the mobile client should upload to directly. Expires in 5 min. */
  uploadUrl: string;
  /** Final public CDN URL that will serve the avatar after upload completes. */
  cdnUrl: string;
  /** Object key in the bucket (for reference / audit logs). */
  key: string;
}

/**
 * Generate a presigned PUT URL for uploading an avatar image to R2.
 *
 * The mobile client should:
 *   1. Call this endpoint to get { uploadUrl, cdnUrl }
 *   2. PUT the file binary to uploadUrl (directly to R2, not via our server)
 *   3. Call PUT /users/avatar { avatarUrl: cdnUrl } to persist the URL in the DB
 *
 * @param userId  The user's internal UUID (used to namespace the object key)
 * @param mimeType  Must be one of the allowed image MIME types
 */
export async function generateAvatarPresignedUrl(
  userId: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<PresignedUploadResult> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  // e.g. avatars/abc123/1711638493210.jpg
  const key = `avatars/${userId}/${Date.now()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    ContentType: mimeType,
    // NOTE: CacheControl is intentionally omitted from the signed command.
    // Including it would require the mobile client to send the exact same
    // Cache-Control header in its PUT, which React Native's fetch (Hermes/Blob)
    // doesn't reliably do — causing a SignatureDoesNotMatch 403 from R2.
    // Cache lifetime is configured at the CDN/bucket level instead.
  });

  // URL expires in 5 minutes — plenty for a mobile app to complete the upload
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: 300 });

  // Construct the public CDN URL that R2 will serve after the upload completes
  const cdnUrl = `${config.storage.cdnBaseUrl}/${key}`;

  return { uploadUrl, cdnUrl, key };
}

/**
 * Generate a presigned PUT URL for uploading admin content images to R2.
 * Admin images are stored under content/ to separate them from user avatars.
 */
export async function generateAdminPresignedUrl(
  adminId: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<PresignedUploadResult> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const key = `content/${adminId}/${Date.now()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: 300 });
  const cdnUrl = `${config.storage.cdnBaseUrl}/${key}`;

  return { uploadUrl, cdnUrl, key };
}
