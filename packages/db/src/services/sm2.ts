// ─── Response Quality Helper ──────────────────────────────────
// Maps a card answer (correct/incorrect + response time) to a
// speed quality label used as an HLR feature (x_speed).
//
// This is the only function retained from the original SM-2 module.
// The SM-2 algorithm itself, ease factors, and Ebbinghaus retention
// estimation have been replaced by Half-Life Regression (hlr.ts).

import type { ResponseQuality } from '@kd/shared';

/**
 * Maps a boolean correct/incorrect + response time to a speed quality label.
 * Used by HLR as the x_speed feature (fast=2, moderate=1, slow/wrong=0).
 *
 * Thresholds (milliseconds):
 *   Fast     < 3 000 ms  — instant recall
 *   Moderate 3 000–8 000 ms — recall with hesitation
 *   Slow     > 8 000 ms  — laboured recall
 *   Incorrect           — any wrong answer
 */
export function responseToQuality(correct: boolean, responseTimeMs: number): ResponseQuality {
  if (!correct) return 'incorrect';
  if (responseTimeMs < 3_000) return 'fast';
  if (responseTimeMs < 8_000) return 'moderate';
  return 'slow';
}
