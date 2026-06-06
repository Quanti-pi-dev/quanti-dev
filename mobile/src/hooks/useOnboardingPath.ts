// ─── Adaptive Onboarding Path Hook ──────────────────────────
// Phase 4: Resolves which onboarding screens to show based on
// user type (new user, referred by friend, institute student).
//
// User Type Resolution:
//   1. Returning user  → Already handled by _layout.tsx guard
//   2. Referred user   → Show referrer's stats as social proof
//   3. Institute user  → Pre-fill exam/subject from institute config
//   4. New user        → Full default flow
//
// This hook is consumed by _layout.tsx to conditionally skip
// screens and inject referral/institute context into the flow.

import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';

export type OnboardingUserType =
  | 'new_user'
  | 'referred_user'
  | 'institute_student';

export interface ReferrerInfo {
  displayName: string;
  avatarUrl: string | null;
  /** e.g. "Studied 142 cards this week" */
  statLine: string;
}

export interface InstituteInfo {
  instituteId: string;
  instituteName: string;
  /** Pre-selected exam IDs from institute config */
  preSelectedExams: string[];
  /** Pre-selected subject IDs from institute config */
  preSelectedSubjects: string[];
}

export interface OnboardingContext {
  userType: OnboardingUserType;
  referrer: ReferrerInfo | null;
  institute: InstituteInfo | null;
  /** Whether exams should be pre-selected (skip exam screen) */
  skipExamSelection: boolean;
  /** Whether subjects should be pre-selected (skip subject screen) */
  skipSubjectSelection: boolean;
  /** Loading state while fetching context */
  isLoading: boolean;
}

/**
 * Resolves the onboarding context for the current user.
 *
 * Call this once in the onboarding layout or welcome screen to determine
 * which screens to show and what data to pre-fill.
 *
 * @param referralCode - Optional referral code from deep link (e.g. `ref` query param)
 */
export function useOnboardingPath(referralCode?: string | null): OnboardingContext {
  const [context, setContext] = useState<OnboardingContext>({
    userType: 'new_user',
    referrer: null,
    institute: null,
    skipExamSelection: false,
    skipSubjectSelection: false,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams();
        if (referralCode) params.set('ref', referralCode);

        const response = await api.get<{
          success: boolean;
          data: {
            userType: OnboardingUserType;
            referrer: ReferrerInfo | null;
            institute: InstituteInfo | null;
          };
        }>(`/users/onboarding-context?${params.toString()}`);

        if (cancelled) return;

        if (response.data?.success && response.data.data) {
          const { userType, referrer, institute } = response.data.data;
          setContext({
            userType,
            referrer,
            institute,
            skipExamSelection: !!institute?.preSelectedExams?.length,
            skipSubjectSelection: !!institute?.preSelectedSubjects?.length,
            isLoading: false,
          });
        } else {
          // API didn't return expected shape — default to new user
          setContext(prev => ({ ...prev, isLoading: false }));
        }
      } catch {
        // API unavailable — degrade gracefully to new user flow
        if (!cancelled) {
          setContext(prev => ({ ...prev, isLoading: false }));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [referralCode]);

  return context;
}
