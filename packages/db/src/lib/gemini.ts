// ─── Gemini AI Client ────────────────────────────────────────
// Singleton wrapper around Google Gemini SDK.
//
// Key resolution order (checked at each call so admin changes take effect
// without a server restart):
//   1. platform_config DB key `ai_api_key_google`  (set via AI Settings page)
//   2. GEMINI_API_KEY environment variable          (fallback / legacy)
//
// Model resolution order:
//   1. Caller-supplied `model` param
//   2. platform_config key for the feature (e.g. `ai_model_tutor`)
//   3. Hard-coded default `gemini-2.0-flash`
//
// Get your key at: https://aistudio.google.com/app/apikey

import { GoogleGenAI } from '@google/genai';
import { configRepository } from '../repositories/config.repository.js';

// Cache client per API key so we don't reconstruct on every call
const _clients = new Map<string, GoogleGenAI>();

/**
 * Resolve the Google AI API key.
 * Prefers the DB-stored value (set via AI Settings page) over env var.
 * Throws if neither is available.
 */
async function resolveApiKey(): Promise<string> {
  // Try DB first (allows live updates without restart)
  try {
    const dbKey = await configRepository.getString('ai_api_key_google', '');
    if (dbKey) return dbKey;
  } catch {
    // DB unavailable — fall through to env var
  }

  const envKey = process.env['GEMINI_API_KEY'] ?? '';
  if (envKey) return envKey;

  throw new Error(
    'Google AI API key is not configured. ' +
    'Set it in the Admin → AI Settings page or add GEMINI_API_KEY to your .env file.',
  );
}

/**
 * Resolve the model to use for a given feature config key.
 * Falls back to `gemini-2.0-flash` if not configured.
 */
export async function resolveGeminiModel(featureKey: string): Promise<string> {
  try {
    const model = await configRepository.getString(featureKey, '');
    if (model) return model;
  } catch { /* ignore */ }
  return 'gemini-2.0-flash';
}

/** Get a Gemini client, re-created if the API key has changed. */
async function getGeminiClient(): Promise<GoogleGenAI> {
  const apiKey = await resolveApiKey();
  if (!_clients.has(apiKey)) {
    _clients.set(apiKey, new GoogleGenAI({ apiKey }));
  }
  return _clients.get(apiKey)!;
}

/**
 * Generate text from Gemini with a system prompt + user prompt.
 * `model` defaults to `gemini-2.0-flash` if not supplied.
 */
export async function geminiGenerate(params: {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<string> {
  const client = await getGeminiClient();
  const model = params.model ?? 'gemini-2.0-flash';

  const result = await client.models.generateContent({
    model,
    contents: params.userPrompt,
    config: {
      systemInstruction: params.systemPrompt,
      maxOutputTokens: params.maxOutputTokens ?? 512,
      temperature: params.temperature ?? 0.4,
    },
  });

  const text = result.text;
  if (!text) throw new Error('Gemini returned an empty response');
  return text;
}

/**
 * Generate structured JSON from Gemini.
 * The response is parsed and returned as T.
 * Prompt must instruct Gemini to return ONLY valid JSON.
 */
export async function geminiGenerateJSON<T>(params: {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<T> {
  const raw = await geminiGenerate({
    ...params,
    maxOutputTokens: params.maxOutputTokens ?? 1024,
  });

  // Strip markdown code fences if present
  const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(stripped) as T;
}
