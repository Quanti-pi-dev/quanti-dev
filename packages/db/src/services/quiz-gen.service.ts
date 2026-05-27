// ─── Quiz Generator Service ─────────────────────────────────
// AI-powered quiz question generation for institute custom tests.
// Uses the model configured under `ai_model_quiz_gen` in admin AI settings.
//
// Usage:
//   - Institute educators: auto-generate test questions via API
//   - Admin dashboard: preview quiz generation capability
//
// Generates structured JSON from the AI provider and returns
// questions in the CustomTestQuestion format.

import { aiGenerateJSON } from '../lib/ai-client.js';
import { createServiceLogger } from '../lib/logger.js';

const log = createServiceLogger('QuizGen');

// ─── Types ──────────────────────────────────────────────────

export interface GeneratedQuizQuestion {
  text: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string;
  marks: number;
}

export interface QuizGenerationRequest {
  /** Topic to generate questions about */
  topic: string;
  /** Subject context (e.g. 'Physics', 'Chemistry') */
  subject: string;
  /** Number of questions to generate (1–30) */
  count: number;
  /** Target exam context (e.g. 'JEE Mains', 'NEET') */
  examContext?: string;
  /** Difficulty: easy, medium, hard, mixed */
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  /** Marks per correct answer */
  marksPerQuestion?: number;
  /** Additional instructions for the AI */
  instructions?: string;
}

export interface QuizGenerationResult {
  questions: GeneratedQuizQuestion[];
  model: string;
  generatedAt: string;
}

// ─── System Prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert examiner creating quiz questions for competitive exam practice tests.
Generate high-quality multiple-choice questions (MCQs) suitable for timed assessments.

RULES:
1. Each question must have exactly 4 options (ids: "a", "b", "c", "d")
2. Exactly one option must be correct
3. Wrong options must be plausible and test common errors
4. Include a clear, detailed explanation for the correct answer
5. Use LaTeX ($...$) for mathematical expressions, chemical formulas, etc.
6. Questions should be appropriate for the specified exam level
7. Vary question types: theory, numerical, application, diagram-based descriptions
8. Each question should be self-contained and unambiguous

Difficulty guide:
- easy: Direct recall, formula application, straightforward problems
- medium: Multi-step reasoning, connecting two concepts
- hard: Complex multi-concept problems requiring deep understanding
- mixed: A balanced mix of all difficulty levels

Respond with ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "text": "The question text",
      "options": [
        { "id": "a", "text": "Option A text" },
        { "id": "b", "text": "Option B text" },
        { "id": "c", "text": "Option C text" },
        { "id": "d", "text": "Option D text" }
      ],
      "correctAnswerId": "b",
      "explanation": "Detailed explanation of the correct answer"
    }
  ]
}`;

// ─── Service ────────────────────────────────────────────────

/**
 * Generate quiz questions using the AI model configured for quiz generation.
 */
export async function generateQuizQuestions(
  request: QuizGenerationRequest,
): Promise<QuizGenerationResult> {
  const count = Math.min(30, Math.max(1, request.count));
  const marks = request.marksPerQuestion ?? 4;

  const userPrompt = [
    `Subject: ${request.subject}`,
    `Topic: ${request.topic}`,
    `Number of questions: ${count}`,
    `Difficulty: ${request.difficulty ?? 'mixed'}`,
    request.examContext ? `Target Exam: ${request.examContext}` : '',
    request.instructions ? `Additional Instructions: ${request.instructions}` : '',
    `Generate exactly ${count} questions.`,
  ].filter(Boolean).join('\n');

  log.info(
    { topic: request.topic, subject: request.subject, count, difficulty: request.difficulty },
    'Generating quiz questions',
  );

  const result = await aiGenerateJSON<{ questions: GeneratedQuizQuestion[] }>({
    featureConfigKey: 'ai_model_quiz_gen',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxOutputTokens: count * 300,
    temperature: 0.55,
  });

  // Validate and sanitize
  const questions = (result.questions ?? [])
    .filter(q => q.text && q.options?.length === 4 && q.correctAnswerId && q.explanation)
    .map(q => ({
      text: q.text.trim(),
      options: q.options.map(o => ({ id: o.id, text: o.text.trim() })),
      correctAnswerId: q.correctAnswerId,
      explanation: q.explanation.trim(),
      marks,
    }));

  if (questions.length === 0) {
    throw new Error('AI generated no valid questions. Try adjusting the topic or instructions.');
  }

  log.info({ generated: questions.length, requested: count }, 'Quiz questions generated successfully');

  return {
    questions,
    model: 'ai_model_quiz_gen',
    generatedAt: new Date().toISOString(),
  };
}
