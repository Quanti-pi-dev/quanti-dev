// ─── Tutor Voice Utilities ───────────────────────────────────
// Personality-aware messaging helpers for the AI tutor experience.
// Consumes the studyPersonality, motivationType, and sessionPreference
// fields from UserPreferences to produce persona-aligned text.

import type { UserPreferences } from '@kd/shared';

// ─── Personality Emoji ──────────────────────────────────────

/** Extract the emoji pair for a personality archetype label. */
export function getPersonalityEmoji(personality: string | null | undefined): string {
  if (!personality) return '';
  if (personality.includes('Night Owl')) return '🦉';
  if (personality.includes('Morning')) return '🌅';
  if (personality.includes('Afternoon')) return '☀️';
  return '';
}

// ─── Peak Window Detection ──────────────────────────────────

/** Check if the current time falls within the student's preferred study window. */
export function isInPeakWindow(preferredTime: string | null | undefined): boolean {
  const hour = new Date().getHours();
  if (preferredTime === 'morning') return hour >= 5 && hour < 12;
  if (preferredTime === 'afternoon') return hour >= 12 && hour < 17;
  if (preferredTime === 'evening') return hour >= 17 || hour < 2;
  return false;
}

// ─── Tutor Greeting Subtitle ────────────────────────────────

/**
 * Generate a personality-aware greeting subtitle.
 * Falls back to generic streak/mastery messages if no personality data.
 */
export function getTutorSubtitle(
  prefs: Pick<UserPreferences, 'studyPersonality' | 'preferredStudyTime' | 'motivationType'> | null | undefined,
  streak: number,
  examName?: string,
): string {
  // If no personality data, fall back to generic
  if (!prefs?.studyPersonality) {
    if (streak >= 7) return `🔥 ${streak}-day streak — your consistency is building mastery!`;
    if (streak >= 3) return `${streak} days strong 💪 Your brain is forming connections`;
    if (examName) return `Let's build your ${examName} mastery today`;
    return 'Ready to grow your understanding?';
  }

  const emoji = getPersonalityEmoji(prefs.studyPersonality);
  const inPeak = isInPeakWindow(prefs.preferredStudyTime);
  const hour = new Date().getHours();

  // Time-context + personality messages
  if (inPeak) {
    if (prefs.preferredStudyTime === 'evening') {
      return `This is your zone ${emoji} — let's make it count`;
    }
    if (prefs.preferredStudyTime === 'morning') {
      return `Right on schedule ${emoji} — your best learning window is now`;
    }
    return `Peak focus time ${emoji} — let's channel it`;
  }

  // Out of peak window
  if (prefs.preferredStudyTime === 'evening' && hour < 12) {
    return `Early start today! ${emoji} Your brain adapts — let's warm up gently`;
  }
  if (prefs.preferredStudyTime === 'morning' && hour >= 17) {
    return `Evening session ${emoji} — a great way to reinforce today's learning`;
  }

  // Streak-augmented personality message
  if (streak >= 7) {
    return `🔥 ${streak}-day streak — your ${prefs.studyPersonality} rhythm is working ${emoji}`;
  }
  if (streak >= 3) {
    return `${streak} days strong ${emoji} — momentum building`;
  }

  return `Your ${prefs.studyPersonality} journey continues ${emoji}`;
}

// ─── Session Tip (Study Screen) ─────────────────────────────

/** Generate a personality-tuned session tip for the study screen. */
export function getSessionTip(
  prefs: Pick<UserPreferences, 'sessionPreference' | 'motivationType'> | null | undefined,
  topPriorityTopic?: string,
  topPriorityReason?: string,
): string {
  if (topPriorityTopic) {
    const reason = topPriorityReason === 'overdue'
      ? 'needs review before it decays'
      : topPriorityReason === 'declining'
        ? 'is trending down — a quick session would stabilize it'
        : topPriorityReason === 'new_topic'
          ? 'is ready for you to explore'
          : 'is up for reinforcement';
    return `Today's priority: ${topPriorityTopic} ${reason}`;
  }
  return 'Pick up where you left off or explore something new';
}

// ─── Focus Section Encouragement ────────────────────────────

/** Personality-tuned encouragement for TodaysFocusSection. */
export function getFocusEncouragement(
  prefs: Pick<UserPreferences, 'sessionPreference' | 'motivationType'> | null | undefined,
  cardsToday: number,
  dailyTarget: number,
  cardsYesterday?: number,
): string {
  const pref = prefs?.sessionPreference;
  const motive = prefs?.motivationType;
  const progress = dailyTarget > 0 ? Math.round((cardsToday / dailyTarget) * 100) : 0;

  // Session preference messages
  if (pref === 'quick' && dailyTarget > 0) {
    const remaining = Math.max(0, dailyTarget - cardsToday);
    if (remaining > 0 && remaining <= 10) return `⚡ Just ${remaining} more — quick burst!`;
    if (remaining === 0) return '⚡ Daily target smashed! Keep the momentum?';
  }
  if (pref === 'deep' && cardsToday < 5) {
    return '📚 Ready for a deep session? Block 25 minutes — full focus';
  }

  // Motivation-type messages
  if (motive === 'competing' && cardsYesterday !== undefined) {
    const diff = cardsToday - cardsYesterday;
    if (diff > 0) return `🏆 ${diff} cards ahead of yesterday's pace`;
    if (diff < 0) return `🏆 ${Math.abs(diff)} cards behind yesterday — close the gap!`;
  }
  if (motive === 'goals' && dailyTarget > 0) {
    if (progress >= 100) return `🎯 Daily goal complete! You're building a habit`;
    if (progress >= 50) return `🎯 ${cardsToday}/${dailyTarget} — ${100 - progress}% to go`;
    return `🎯 ${cardsToday}/${dailyTarget} done — keep pushing`;
  }
  if (motive === 'progress') {
    if (cardsToday > 0) return `📈 ${cardsToday} cards studied — your mastery is growing`;
  }

  // Default
  if (dailyTarget > 0 && cardsToday > 0) {
    return `${cardsToday}/${dailyTarget} cards — ${100 - progress}% to today's goal`;
  }
  return 'Start your first session to build today\'s momentum';
}
