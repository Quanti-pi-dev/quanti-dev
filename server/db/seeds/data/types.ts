// ─── Question Definition Types ─────────────────────────────────────────────
// Shared type used across all data/questions/*.ts files.

import type { SubjectLevel } from './taxonomy.js';

export interface QuestionDef {
  topicSlug: string;        // must match a TopicDef.slug in taxonomy.ts
  level?: SubjectLevel;     // omit → inserted into every level for this topic
  question: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;  // must match one of options[].id
  explanation: string;
  tags: string[];           // [subjectName, topicSlug, ...examTags]
}
