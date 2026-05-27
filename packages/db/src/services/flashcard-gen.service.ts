// ─── Flashcard Generation Service ────────────────────────────
// AI-powered flashcard creation from topic descriptions.
// Uses the model configured under `ai_model_flashcard_gen` in admin AI settings.
//
// Usage:
//   - Admin dashboard: bulk-generate flashcards for a deck
//   - Educator dashboard: generate questions for a topic
//
// The service generates structured JSON from the AI provider,
// validates it, and returns ready-to-insert flashcard data.

import { aiGenerateJSON } from '../lib/ai-client.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('FlashcardGen');

// ─── Types ──────────────────────────────────────────────────

export interface GeneratedFlashcard {
  question: string;
  options: { id: string; text: string; misconception?: string }[];
  correctAnswerId: string;
  explanation: string;
}

export interface FlashcardGenerationRequest {
  /** Topic or concept to generate cards about */
  topic: string;
  /** Subject context (e.g. 'Physics', 'Mathematics') */
  subject: string;
  /** Difficulty level */
  level: 'Emerging' | 'Developing' | 'Proficient' | 'Master';
  /** Number of flashcards to generate (1–20) */
  count: number;
  /** Target exam context (e.g. 'JEE', 'NEET') */
  examContext?: string;
  /** Additional instructions for the AI */
  instructions?: string;
}

export interface FlashcardGenerationResult {
  cards: GeneratedFlashcard[];
  model: string;
  generatedAt: string;
}

// ─── System Prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert question designer for competitive exams (JEE, NEET, GATE).
Generate high-quality multiple-choice questions (MCQs) for the given topic and difficulty level.

RULES:
1. Each question must have exactly 4 options (ids: "a", "b", "c", "d")
2. Exactly one option must be correct
3. Wrong options should be plausible distractors that test common misconceptions
4. Include a clear, concise explanation for the correct answer
5. For each wrong option, include a "misconception" field explaining what mistake would lead to choosing it
6. Use LaTeX ($...$) for all mathematical expressions
7. Questions should be exam-style: clear, unambiguous, and testing conceptual understanding
8. Vary question types: conceptual, numerical, application-based

Difficulty guide:
- Emerging: Basic recall and straightforward application
- Developing: Multi-step problems requiring understanding of connections
- Proficient: Complex problems requiring synthesis of multiple concepts
- Master: Competition-level problems requiring deep insight and creative approaches

Respond with ONLY valid JSON in this exact format:
{
  "cards": [
    {
      "question": "The question text",
      "options": [
        { "id": "a", "text": "Option A text", "misconception": "Why a student might wrongly choose this" },
        { "id": "b", "text": "Option B text", "misconception": "Why a student might wrongly choose this" },
        { "id": "c", "text": "Option C text" },
        { "id": "d", "text": "Option D text", "misconception": "Why a student might wrongly choose this" }
      ],
      "correctAnswerId": "c",
      "explanation": "Clear explanation of why the correct answer is right"
    }
  ]
}
Do NOT include the misconception field on the correct option. Only wrong options get misconceptions.`;

// ─── Service ─────────────────────────────────────────────────

/**
 * Generate flashcards using the AI model configured for flashcard generation.
 */
export async function generateFlashcards(
  request: FlashcardGenerationRequest,
): Promise<FlashcardGenerationResult> {
  const count = Math.min(20, Math.max(1, request.count));

  const userPrompt = [
    `Subject: ${request.subject}`,
    `Topic: ${request.topic}`,
    `Difficulty Level: ${request.level}`,
    `Number of questions: ${count}`,
    request.examContext ? `Target Exam: ${request.examContext}` : '',
    request.instructions ? `Additional Instructions: ${request.instructions}` : '',
  ].filter(Boolean).join('\n');

  log.info(
    { topic: request.topic, subject: request.subject, level: request.level, count },
    'Generating flashcards',
  );

  const result = await aiGenerateJSON<{ cards: GeneratedFlashcard[] }>({
    featureConfigKey: 'ai_model_flashcard_gen',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxOutputTokens: count * 350, // ~350 tokens per card
    temperature: 0.6,
  });

  // Validate and sanitize
  const cards = (result.cards ?? [])
    .filter(c => c.question && c.options?.length === 4 && c.correctAnswerId && c.explanation)
    .map(c => ({
      question: c.question.trim(),
      options: c.options.map(o => ({
        id: o.id,
        text: o.text.trim(),
        ...(o.misconception ? { misconception: o.misconception.trim() } : {}),
      })),
      correctAnswerId: c.correctAnswerId,
      explanation: c.explanation.trim(),
    }));

  if (cards.length === 0) {
    throw new Error('AI generated no valid flashcards. Try adjusting the topic or instructions.');
  }

  log.info({ generated: cards.length, requested: count }, 'Flashcards generated successfully');

  return {
    cards,
    model: 'ai_model_flashcard_gen', // The actual model is resolved internally
    generatedAt: new Date().toISOString(),
  };
}
