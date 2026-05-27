// ─── Unified AI Client ──────────────────────────────────────
// Multi-provider wrapper that dispatches to Google Gemini, OpenAI,
// or Anthropic based on the selected model prefix.
//
// Provider detection rules:
//   - Model starts with 'gpt', 'o1', 'o3', 'o4' → OpenAI
//   - Model starts with 'claude'                 → Anthropic
//   - Everything else (gemini-*, custom)          → Google Gemini (default)
//
// API key resolution order (per provider):
//   1. platform_config DB key  (e.g. `ai_api_key_openai`)
//   2. Environment variable    (e.g. `OPENAI_API_KEY`)
//
// Model resolution order (per feature):
//   1. Caller-supplied `model` param
//   2. platform_config key for the feature (e.g. `ai_model_tutor`)
//   3. Hard-coded default `gemini-2.0-flash`

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { configRepository } from '../repositories/config.repository.js';
import { createServiceLogger } from './logger.js';

const log = createServiceLogger('AIClient');

// ─── Provider Detection ─────────────────────────────────────

export type AIProvider = 'openai' | 'anthropic' | 'google';

export function detectProvider(model: string): AIProvider {
  const m = model.toLowerCase();
  if (m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) {
    return 'openai';
  }
  if (m.startsWith('claude')) {
    return 'anthropic';
  }
  return 'google';
}

// ─── API Key Resolution ─────────────────────────────────────

const API_KEY_CONFIG: Record<AIProvider, { dbKey: string; envVar: string; label: string }> = {
  openai:    { dbKey: 'ai_api_key_openai',    envVar: 'OPENAI_API_KEY',    label: 'OpenAI' },
  anthropic: { dbKey: 'ai_api_key_anthropic',  envVar: 'ANTHROPIC_API_KEY', label: 'Anthropic' },
  google:    { dbKey: 'ai_api_key_google',     envVar: 'GEMINI_API_KEY',    label: 'Google AI' },
};

async function resolveApiKey(provider: AIProvider): Promise<string> {
  const cfg = API_KEY_CONFIG[provider];

  // Try DB first (live updates without restart)
  try {
    const dbKey = await configRepository.getString(cfg.dbKey, '');
    if (dbKey) return dbKey;
  } catch {
    // DB unavailable — fall through
  }

  const envKey = process.env[cfg.envVar] ?? '';
  if (envKey) return envKey;

  throw new Error(
    `${cfg.label} API key is not configured. ` +
    `Set it in Admin → AI Settings or add ${cfg.envVar} to your .env file.`,
  );
}

// ─── Model Resolution ───────────────────────────────────────

const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * Resolve the model to use for a given feature config key.
 * Falls back to `gemini-2.0-flash` if not configured.
 */
export async function resolveModel(featureConfigKey?: string): Promise<string> {
  if (!featureConfigKey) return DEFAULT_MODEL;
  try {
    const model = await configRepository.getString(featureConfigKey, '');
    if (model) return model;
  } catch { /* ignore */ }
  return DEFAULT_MODEL;
}

// ─── Client Singletons ──────────────────────────────────────

const _geminiClients = new Map<string, GoogleGenAI>();
const _openaiClients = new Map<string, OpenAI>();
const _anthropicClients = new Map<string, Anthropic>();

async function getGeminiClient(): Promise<GoogleGenAI> {
  const apiKey = await resolveApiKey('google');
  if (!_geminiClients.has(apiKey)) {
    _geminiClients.set(apiKey, new GoogleGenAI({ apiKey }));
  }
  return _geminiClients.get(apiKey)!;
}

async function getOpenAIClient(): Promise<OpenAI> {
  const apiKey = await resolveApiKey('openai');
  if (!_openaiClients.has(apiKey)) {
    _openaiClients.set(apiKey, new OpenAI({ apiKey }));
  }
  return _openaiClients.get(apiKey)!;
}

async function getAnthropicClient(): Promise<Anthropic> {
  const apiKey = await resolveApiKey('anthropic');
  if (!_anthropicClients.has(apiKey)) {
    _anthropicClients.set(apiKey, new Anthropic({ apiKey }));
  }
  return _anthropicClients.get(apiKey)!;
}

// ─── Generation Parameters ──────────────────────────────────

export interface AIGenerateParams {
  /** Model ID. If omitted, resolved from `featureConfigKey` or defaults to gemini-2.0-flash. */
  model?: string;
  /** Config key for this feature (e.g. 'ai_model_tutor'). Used to resolve model from DB. */
  featureConfigKey?: string;
  systemPrompt?: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}

// ─── Provider-Specific Generators ───────────────────────────

async function generateWithGemini(params: AIGenerateParams & { model: string }): Promise<string> {
  const client = await getGeminiClient();
  const result = await client.models.generateContent({
    model: params.model,
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

async function generateWithOpenAI(params: AIGenerateParams & { model: string }): Promise<string> {
  const client = await getOpenAIClient();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  if (params.systemPrompt) {
    messages.push({ role: 'system', content: params.systemPrompt });
  }
  messages.push({ role: 'user', content: params.userPrompt });

  const result = await client.chat.completions.create({
    model: params.model,
    messages,
    max_tokens: params.maxOutputTokens ?? 512,
    temperature: params.temperature ?? 0.4,
  });

  const text = result.choices[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned an empty response');
  return text;
}

async function generateWithAnthropic(params: AIGenerateParams & { model: string }): Promise<string> {
  const client = await getAnthropicClient();

  const result = await client.messages.create({
    model: params.model,
    max_tokens: params.maxOutputTokens ?? 512,
    system: params.systemPrompt ?? undefined,
    messages: [{ role: 'user', content: params.userPrompt }],
  });

  // Anthropic returns content blocks
  const textBlock = result.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('Anthropic returned an empty response');
  return textBlock.text;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Generate text from any configured AI provider.
 *
 * Resolution:
 *   1. If `params.model` is set, use it directly.
 *   2. Else, resolve from DB via `params.featureConfigKey`.
 *   3. Detect provider from model prefix → dispatch.
 */
export async function aiGenerate(params: AIGenerateParams): Promise<string> {
  const model = params.model ?? await resolveModel(params.featureConfigKey);
  const provider = detectProvider(model);
  const fullParams = { ...params, model };

  log.debug({ model, provider, featureConfigKey: params.featureConfigKey }, 'AI generate');

  switch (provider) {
    case 'openai':
      return generateWithOpenAI(fullParams);
    case 'anthropic':
      return generateWithAnthropic(fullParams);
    case 'google':
    default:
      return generateWithGemini(fullParams);
  }
}

/**
 * Generate structured JSON from any configured AI provider.
 * The prompt must instruct the model to return ONLY valid JSON.
 */
export async function aiGenerateJSON<T>(params: AIGenerateParams): Promise<T> {
  const raw = await aiGenerate({
    ...params,
    maxOutputTokens: params.maxOutputTokens ?? 1024,
  });

  // Strip markdown code fences if present
  const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(stripped) as T;
}
