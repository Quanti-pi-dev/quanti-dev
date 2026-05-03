// ─── Targeted Feedback Service ───────────────────────────────
// Generates misconception-aware explanations by telling Gemini
// WHAT the student chose and WHY that choice reveals a specific
// misunderstanding. This is the Socratic layer of the educator brain.
//
// Falls back to the generic card explanation when:
//   - The student answered correctly
//   - Gemini is unavailable
//   - The wrong option has no misconception mapping

import { geminiGenerate } from '../lib/gemini.js';
import { createServiceLogger } from '../lib/logger.js';
import type { Flashcard, TargetedFeedback } from '@kd/shared';

const log = createServiceLogger('TargetedFeedback');

// ─── Targeted Explanation Generator ──────────────────────────

/**
 * Generate a targeted explanation that addresses the student's
 * specific wrong answer and misconception.
 *
 * This is what makes the app an educator instead of a quiz:
 * instead of saying "The answer is A because X", it says
 * "You chose B, which suggests you confused X with Y. Here's why..."
 *
 * @param card          The flashcard that was answered
 * @param selectedId    The option ID the student selected
 * @param correct       Whether they got it right
 * @returns             Targeted feedback, or null if not applicable
 */
export async function generateTargetedFeedback(
  card: Flashcard,
  selectedId: string,
  correct: boolean,
): Promise<TargetedFeedback | null> {
  // No targeted feedback needed for correct answers
  if (correct) return null;

  const selectedOption = card.options.find(o => o.id === selectedId);
  const correctOption = card.options.find(o => o.id === card.correctAnswerId);

  if (!selectedOption || !correctOption) return null;

  // If the option has a misconception mapping, use it
  const misconception = selectedOption.misconception ??
    `Chose "${selectedOption.text}" instead of "${correctOption.text}"`;

  try {
    const prompt = buildTargetedPrompt({
      question: card.question,
      selectedOptionText: selectedOption.text,
      correctOptionText: correctOption.text,
      misconception,
      seedExplanation: card.explanation ?? '',
    });

    const response = await geminiGenerate({
      systemPrompt: TARGETED_SYSTEM_PROMPT,
      userPrompt: prompt,
      maxOutputTokens: 400,
      temperature: 0.4,
    });

    // Parse the response (structured text, not JSON for readability)
    return {
      selectedOptionText: selectedOption.text,
      misconception,
      explanation: response.trim(),
      memoryTrick: extractSection(response, 'Memory Trick'),
      reviewConcept: extractSection(response, 'Review'),
    };
  } catch (err) {
    log.warn({ err }, 'Targeted feedback generation failed');

    // Fall back to structured misconception without AI enrichment
    return {
      selectedOptionText: selectedOption.text,
      misconception,
      explanation: buildFallbackExplanation(
        selectedOption.text,
        correctOption.text,
        misconception,
        card.explanation ?? '',
      ),
    };
  }
}

// ─── Prompt Building ─────────────────────────────────────────

const TARGETED_SYSTEM_PROMPT = `You are a patient, encouraging tutor for competitive exam preparation (NEET/JEE).
A student just answered a question WRONG. Your job is to:
1. Acknowledge their specific choice without being condescending
2. Explain WHY their choice seems reasonable but is incorrect
3. Walk through the correct reasoning step-by-step
4. End with a short memory trick to avoid this mistake

Format your response as clear paragraphs. Use LaTeX ($...$) for math.
Include "Memory Trick:" on its own line before the trick.
Keep your total response under 150 words. Be warm and specific.`;

function buildTargetedPrompt(data: {
  question: string;
  selectedOptionText: string;
  correctOptionText: string;
  misconception: string;
  seedExplanation: string;
}): string {
  return `Question: "${data.question}"

Student chose: "${data.selectedOptionText}" (INCORRECT)
Correct answer: "${data.correctOptionText}"
Likely misconception: ${data.misconception}

${data.seedExplanation ? `Reference explanation: ${data.seedExplanation}` : ''}

Address their specific error. Don't just explain the right answer — explain why their choice was wrong.`;
}

// ─── Fallback (no Gemini) ────────────────────────────────────

function buildFallbackExplanation(
  selectedText: string,
  correctText: string,
  misconception: string,
  seedExplanation: string,
): string {
  const parts: string[] = [];

  parts.push(`You selected "${selectedText}", but the correct answer is "${correctText}".`);

  if (misconception && !misconception.startsWith('Chose "')) {
    parts.push(`This suggests: ${misconception}.`);
  }

  if (seedExplanation) {
    parts.push(seedExplanation);
  }

  return parts.join('\n\n');
}

// ─── Helpers ─────────────────────────────────────────────────

function extractSection(text: string, label: string): string | undefined {
  const regex = new RegExp(`${label}:?\\s*(.+?)(?:\\n|$)`, 'i');
  const match = text.match(regex);
  return match?.[1]?.trim() || undefined;
}
