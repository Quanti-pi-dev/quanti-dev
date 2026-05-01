// ─── Gemini MCQ Generator ────────────────────────────────────
// Generates 5 exam-calibrated MCQs per deck using Gemini 2.0 Flash.
// Each call produces one deck's worth of flashcards.

import { geminiGenerateJSON } from '../../../src/lib/gemini.js';
import type { Level } from './taxonomy.js';
import { LEVEL_HINTS } from './taxonomy.js';

export interface GeneratedCard {
  question: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string;
}

const OPTION_IDS = ['a', 'b', 'c', 'd'];

const SYSTEM_PROMPT = `You are an expert question setter for Indian competitive exams (JEE and NEET).
Your task is to generate high-quality multiple-choice questions (MCQs).
Rules:
- All 4 options must be plausible. Distractors should reflect common student misconceptions.
- Questions must be factually accurate.
- Explanations must be concise (1-2 sentences), mentioning the key concept.
- Do NOT use LaTeX. Write math inline as plain text (e.g. "v² = u² + 2as").
- Return ONLY valid JSON, no markdown, no extra text.`;

export async function generateDeckCards(params: {
  exam: string;        // 'jee' | 'neet'
  subject: string;     // 'Physics' | 'Chemistry' etc.
  topic: string;       // e.g. 'Kinematics'
  level: Level;
  style: string;       // topic-specific style hint
  count: number;       // number of cards (5)
}): Promise<GeneratedCard[]> {
  const { exam, subject, topic, level, style, count } = params;
  const examUpper = exam.toUpperCase();
  
  const levelHint = LEVEL_HINTS[exam]?.[level] ?? '';

  const userPrompt = `Generate ${count} MCQs for:
Exam: ${examUpper}
Subject: ${subject}
Topic: ${topic}
Difficulty Level: ${level}
Level Description: ${levelHint}
Question Style: ${style}

Return a JSON array of exactly ${count} objects, each with:
{
  "question": "Full question text",
  "options": [
    {"id": "a", "text": "Option A text"},
    {"id": "b", "text": "Option B text"},
    {"id": "c", "text": "Option C text"},
    {"id": "d", "text": "Option D text"}
  ],
  "correctAnswerId": "a",
  "explanation": "Brief explanation of why this answer is correct."
}

Important:
- Make all 4 options look plausible
- Vary the correct answer position (don't always use "a")
- Calibrate difficulty strictly to: ${level} level for ${examUpper}`;

  const cards = await geminiGenerateJSON<GeneratedCard[]>({
    model: 'gemini-2.0-flash',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxOutputTokens: 8192,
    temperature: 0.6,
  });

  // Validate and sanitize
  if (!Array.isArray(cards)) throw new Error('Gemini did not return an array');
  return cards.slice(0, count).map((card) => ({
    question: String(card.question ?? '').trim(),
    options: OPTION_IDS.map((id) => {
      const match = card.options?.find((o) => o.id === id);
      return { id, text: String(match?.text ?? `Option ${id}`).trim() };
    }),
    correctAnswerId: OPTION_IDS.includes(card.correctAnswerId) ? card.correctAnswerId : 'a',
    explanation: String(card.explanation ?? '').trim(),
  }));
}

/** Retry wrapper — retries up to maxRetries times with exponential backoff */
export async function generateWithRetry(
  params: Parameters<typeof generateDeckCards>[0],
  maxRetries = 3,
): Promise<GeneratedCard[]> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateDeckCards(params);
    } catch (err) {
      lastErr = err;
      const delay = attempt * 2000;
      console.warn(`    ⚠ Gemini attempt ${attempt}/${maxRetries} failed. Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
