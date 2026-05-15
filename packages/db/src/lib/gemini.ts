// ─── Gemini AI Client ────────────────────────────────────────
// Singleton wrapper around Google Gemini SDK.
// Uses `gemini-2.0-flash` for fast, cost-effective inference.
//
// SETUP: Add GEMINI_API_KEY to server/.env
// Get your key at: https://aistudio.google.com/app/apikey

import { GoogleGenAI } from '@google/genai';

let _client: GoogleGenAI | null = null;

/** Get the singleton Gemini client. Throws if GEMINI_API_KEY is not set. */
export function getGeminiClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set. Add it to server/.env to enable AI features.');
    }
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

/**
 * Generate text from Gemini with a system prompt + user prompt.
 * Returns the response text or throws on failure.
 */
export async function geminiGenerate(params: {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<string> {
  const client = getGeminiClient();
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
