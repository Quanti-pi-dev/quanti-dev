// ─── Gemini AI Client (Backward-Compatible Facade) ──────────
// This file now delegates to the unified multi-provider AI client.
// Existing callers of `geminiGenerate` and `geminiGenerateJSON`
// continue to work unchanged, but now support OpenAI and Anthropic
// models when configured via AI Settings.
//
// For new code, prefer importing from `./ai-client.js` directly.

import { aiGenerate, aiGenerateJSON, resolveModel } from './ai-client.js';

// Re-export for backward compatibility
export { resolveModel as resolveGeminiModel };

/**
 * Generate text from the configured AI provider.
 * Backward-compatible wrapper — delegates to the unified AI client.
 */
export async function geminiGenerate(params: {
  model?: string;
  featureConfigKey?: string;
  systemPrompt?: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<string> {
  return aiGenerate(params);
}

/**
 * Generate structured JSON from the configured AI provider.
 * Backward-compatible wrapper — delegates to the unified AI client.
 */
export async function geminiGenerateJSON<T>(params: {
  model?: string;
  featureConfigKey?: string;
  systemPrompt?: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<T> {
  return aiGenerateJSON<T>(params);
}
