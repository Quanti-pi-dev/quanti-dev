// ─── Admin Zod Schemas ───────────────────────────────────────
// Client-side validation schemas mirroring the backend Zod schemas.
// Used with react-hook-form's zodResolver for inline field validation.

import { z } from 'zod';

// ─── Exam ────────────────────────────────────────────────────

export const examFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  durationMinutes: z
    .string()
    .min(1, 'Duration is required')
    .refine((v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0, {
      message: 'Duration must be a positive number',
    }),
});

export type ExamFormValues = z.infer<typeof examFormSchema>;

// ─── Badge ───────────────────────────────────────────────────

export const badgeFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required'),
  iconUrl: z.string().min(1, 'Icon URL is required'),
  criteria: z.string().min(1, 'Criteria is required'),
});

export type BadgeFormValues = z.infer<typeof badgeFormSchema>;

// ─── Shop Item ───────────────────────────────────────────────

export const shopItemFormSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().min(1, 'Description is required'),
    imageUrl: z.string(),
    price: z
      .string()
      .min(1, 'Price is required')
      .refine((v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) >= 0, {
        message: 'Price must be a non-negative number',
      }),
    category: z.enum(['flashcard_pack', 'theme', 'power_up']),
    deckId: z.string(),
    cardCount: z.string(),
    themeKey: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.category === 'flashcard_pack' && !data.deckId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Deck ID is required for flashcard packs',
        path: ['deckId'],
      });
    }
    if (data.category === 'theme' && !data.themeKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Theme key is required for themes',
        path: ['themeKey'],
      });
    }
    // power_up: no extra fields required — just name, description, price
  });

export type ShopItemFormValues = z.infer<typeof shopItemFormSchema>;

// ─── Coupon ──────────────────────────────────────────────────

export const couponFormSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  discountType: z.enum(['percentage', 'fixed_amount']),
  discountValue: z
    .string()
    .min(1, 'Discount value is required')
    .refine((v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0, {
      message: 'Must be a positive number',
    }),
  maxDiscountPaise: z.string(),
  minOrderPaise: z.string(),
  maxUses: z.string(),
  maxUsesPerUser: z.string(),
  validUntil: z.string(),
  firstTimeOnly: z.boolean(),
});

export type CouponFormValues = z.infer<typeof couponFormSchema>;

// ─── Plan ────────────────────────────────────────────────────

export const planFormSchema = z.object({
  slug: z.string().min(1, 'Slug is required').max(50),
  displayName: z.string().min(1, 'Display name is required').max(100),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  billingCycle: z.enum(['weekly', 'monthly']),
  pricePaise: z
    .string()
    .min(1, 'Price is required')
    .refine((v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0, {
      message: 'Price must be a positive number (in paise)',
    }),
  trialDays: z.string(),
  sortOrder: z.string(),
  isActive: z.boolean(),
  features: z.object({
    max_decks: z.number().int(),
    max_exams_per_day: z.number().int(),
    max_subjects_per_exam: z.number().int(),
    max_level: z.number().int(),
    ai_explanations: z.boolean(),
    offline_access: z.boolean(),
    priority_support: z.boolean(),
    advanced_analytics: z.boolean(),
    deep_insights: z.boolean(),
    mastery_radar: z.boolean(),
  }),
});

export type PlanFormValues = z.infer<typeof planFormSchema>;

// ─── Flashcard ───────────────────────────────────────────────

export const flashcardFormSchema = z
  .object({
    question: z.string().min(1, 'Question is required'),
    options: z.object({
      A: z.string(),
      B: z.string(),
      C: z.string(),
      D: z.string(),
    }),
    correctKey: z.enum(['A', 'B', 'C', 'D']),
    explanation: z.string(),
    imageUrl: z.string(),
  })
  .superRefine((data, ctx) => {
    const filled = (['A', 'B', 'C', 'D'] as const).filter((k) => data.options[k].trim());
    if (filled.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least 2 options are required',
        path: ['options'],
      });
    }
    if (!data.options[data.correctKey].trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The selected correct answer option cannot be empty',
        path: ['correctKey'],
      });
    }
  });

export type FlashcardFormValues = z.infer<typeof flashcardFormSchema>;
