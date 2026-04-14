// ─── JWT Authentication Middleware ───────────────────────────
// Validates Auth0 JWTs using JWKS (JSON Web Key Sets).
// Attaches decoded user context to request for downstream handlers.

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import crypto from 'crypto';
import { config } from '../config.js';
import { getRedisClient } from '../lib/database.js';
import type { UserRole } from '@kd/shared';

// ─── User Context (attached to request) ─────────────────────

export interface RequestUser {
  id: string;        // Auth0 sub claim
  email: string;
  role: UserRole;
}

// Extend Fastify request type
declare module 'fastify' {
  interface FastifyRequest {
    user?: RequestUser;
  }
}

// ─── JWKS Client ────────────────────────────────────────────

const jwksClient = jwksRsa({
  jwksUri: `https://${config.auth0.domain}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000,   // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    jwksClient.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      if (!key) return reject(new Error('No signing key found'));
      const signingKey = key.getPublicKey();
      resolve(signingKey);
    });
  });
}

// ─── Token Verification ────────────────────────────────────

async function verifyToken(token: string): Promise<RequestUser> {
  // Decode header to get kid
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw new Error('Invalid token format');
  }

  const kid = decoded.header.kid;
  if (!kid) {
    throw new Error('Token missing kid header');
  }

  const signingKey = await getSigningKey(kid);

  const payload = jwt.verify(token, signingKey, {
    audience: config.auth0.audience,
    issuer: `https://${config.auth0.domain}/`,
    algorithms: ['RS256'],
  }) as jwt.JwtPayload;

  return {
    id: payload.sub ?? '',
    email: (payload.email as string) ?? '',
    role: ((payload['https://studyplatform.com/role'] as string) ?? 'student') as UserRole,
  };
}

// ─── Fastify Plugin ─────────────────────────────────────────

async function authPluginInner(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('user', undefined);

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for health/public routes and webhook endpoints.
    // Webhooks use signature-based authentication (e.g. x-razorpay-signature),
    // not Bearer tokens — their security is enforced inside the handler.
    //
    // Only the truly public auth sub-paths bypass JWT. Protected auth endpoints
    // (/me, /logout) are intentionally NOT listed here so that JWT parsing runs
    // and populates request.user before their route-level requireAuth() guard.
    const PUBLIC_AUTH_PATHS = [
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/callback',
      '/api/v1/auth/refresh',
      '/api/v1/auth/forgot-password',
    ];

    // Strip query string for clean path comparison
    const urlPath = request.url.split('?')[0]!;

    if (
      urlPath === '/health' ||
      urlPath === '/' ||
      urlPath.startsWith('/api/v1/webhooks/') ||
      PUBLIC_AUTH_PATHS.includes(urlPath)
    ) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.slice(7);

    // Check token blocklist (for logged-out tokens) — FIX H5
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const isBlocked = await getRedisClient().exists(`token_block:${tokenHash}`);
      if (isBlocked) {
        return reply.status(401).send({
          success: false,
          error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked' },
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Redis unavailable — skip blocklist check rather than blocking all requests
    }

    try {
      request.user = await verifyToken(token);
    } catch (err) {
      request.log.warn({ err }, 'JWT verification failed');
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Token verification failed' },
        timestamp: new Date().toISOString(),
      });
    }
  });
}

export const authPlugin = fp(authPluginInner);
