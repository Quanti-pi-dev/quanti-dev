// ─── Subject Icon Registry ──────────────────────────────────
// Single source of truth for subject icon mapping.
// Used by:
//   • Admin IconPickerGrid (visual picker)
//   • getSubjectIcon() fallback when subject.iconName is not set
//   • Onboarding emoji map alignment

import { Ionicons } from '@expo/vector-icons';

export type IoniconName = keyof typeof Ionicons['glyphMap'];

export interface SubjectIconOption {
  name: IoniconName;
  label: string;       // human-readable, e.g. "Leaf (Botany)"
  keywords: string[];  // for search filtering in picker + regex fallback
}

// Curated list of subject-relevant icons
export const SUBJECT_ICON_OPTIONS: SubjectIconOption[] = [
  { name: 'planet-outline',         label: 'Physics',          keywords: ['physics', 'planet', 'space', 'force'] },
  { name: 'flask-outline',          label: 'Chemistry',        keywords: ['chemistry', 'chem', 'flask', 'lab'] },
  { name: 'leaf-outline',           label: 'Botany',           keywords: ['botany', 'botan', 'plant', 'leaf'] },
  { name: 'paw-outline',            label: 'Zoology',          keywords: ['zoology', 'zoo', 'animal', 'paw'] },
  { name: 'fitness-outline',        label: 'Biology',          keywords: ['biology', 'bio', 'body', 'dna'] },
  { name: 'calculator-outline',     label: 'Mathematics',      keywords: ['math', 'calc', 'number', 'algebra', 'quant', 'numer', 'statistic'] },
  { name: 'book-outline',           label: 'English',          keywords: ['english', 'verbal', 'grammar', 'language', 'reading'] },
  { name: 'bar-chart-outline',      label: 'Data & Analytics', keywords: ['data', 'analytic', 'interpret', 'chart', 'statistics'] },
  { name: 'git-network-outline',    label: 'Reasoning',        keywords: ['reason', 'logic', 'critical'] },
  { name: 'create-outline',         label: 'Writing',          keywords: ['writing', 'essay', 'compos'] },
  { name: 'telescope-outline',      label: 'Science',          keywords: ['science', 'telescope', 'research'] },
  { name: 'earth-outline',          label: 'Social Studies',   keywords: ['history', 'social', 'geo', 'earth'] },
  { name: 'text-outline',           label: 'Vocabulary',       keywords: ['vocab', 'word', 'dictionary'] },
  { name: 'school-outline',         label: 'General',          keywords: ['school', 'education', 'general'] },
  { name: 'hardware-chip-outline',  label: 'Computer Science', keywords: ['computer', 'cs', 'tech', 'programming'] },
  { name: 'musical-notes-outline',  label: 'Music',            keywords: ['music', 'notes', 'sound'] },
  { name: 'color-palette-outline',  label: 'Art',              keywords: ['art', 'design', 'creative', 'palette'] },
  { name: 'language-outline',       label: 'Languages',        keywords: ['language', 'translation', 'foreign'] },
  { name: 'pulse-outline',          label: 'Health Science',   keywords: ['health', 'medical', 'pulse'] },
  { name: 'construct-outline',      label: 'Engineering',      keywords: ['engineering', 'construct', 'build'] },
  { name: 'cash-outline',           label: 'Economics',        keywords: ['economics', 'economy', 'finance', 'commerce'] },
  { name: 'briefcase-outline',      label: 'Business',         keywords: ['business', 'management', 'accounting'] },
  { name: 'people-outline',         label: 'Psychology',       keywords: ['psychology', 'psych', 'sociology'] },
  { name: 'hammer-outline',         label: 'Workshop',         keywords: ['workshop', 'practical', 'skill'] },
];

/** Default icon when nothing matches */
export const DEFAULT_SUBJECT_ICON: IoniconName = 'school-outline';

/**
 * Resolve an icon name from a subject name using keyword matching.
 * This is the centralized fallback when `subject.iconName` is not set in the DB.
 */
export function resolveSubjectIcon(subjectName: string): IoniconName {
  const lower = subjectName.toLowerCase();
  for (const opt of SUBJECT_ICON_OPTIONS) {
    if (opt.keywords.some((kw) => lower.includes(kw))) {
      return opt.name;
    }
  }
  return DEFAULT_SUBJECT_ICON;
}
