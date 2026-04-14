// ─── Plan Seed Script ─────────────────────────────────────────
// Seeds the `plans` table with 6 plans: Basic / Pro / Master × weekly / monthly.
// Run: npx tsx server/db/seeds/plans-seed.ts
// Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.

import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const plans = [
  // ─── Basic (Tier 1) ────────────────────────────────────
  {
    slug: 'basic-monthly',
    display_name: 'Basic',
    tier: 1,
    billing_cycle: 'monthly',
    price_paise: 9900, // ₹99
    currency: 'INR',
    trial_days: 7,
    is_active: true,
    sort_order: 1,
    features: {
      max_decks: -1,
      max_exams_per_day: -1,
      max_subjects_per_exam: 3,
      max_level: 2,            // Beginner + Rookie only
      ai_explanations: false,
      offline_access: false,
      priority_support: false,
      advanced_analytics: false,
    },
  },
  {
    slug: 'basic-weekly',
    display_name: 'Basic',
    tier: 1,
    billing_cycle: 'weekly',
    price_paise: 2900, // ₹29
    currency: 'INR',
    trial_days: 7,
    is_active: true,
    sort_order: 2,
    features: {
      max_decks: -1,
      max_exams_per_day: -1,
      max_subjects_per_exam: 3,
      max_level: 2,
      ai_explanations: false,
      offline_access: false,
      priority_support: false,
      advanced_analytics: false,
    },
  },

  // ─── Pro (Tier 2) ──────────────────────────────────────
  {
    slug: 'pro-monthly',
    display_name: 'Pro',
    tier: 2,
    billing_cycle: 'monthly',
    price_paise: 19900, // ₹199
    currency: 'INR',
    trial_days: 0,
    is_active: true,
    sort_order: 3,
    features: {
      max_decks: -1,
      max_exams_per_day: -1,
      max_subjects_per_exam: -1, // all subjects
      max_level: 4,              // up to Competent (index 3)
      ai_explanations: true,
      offline_access: false,
      priority_support: false,
      advanced_analytics: true,
    },
  },
  {
    slug: 'pro-weekly',
    display_name: 'Pro',
    tier: 2,
    billing_cycle: 'weekly',
    price_paise: 5900, // ₹59
    currency: 'INR',
    trial_days: 0,
    is_active: true,
    sort_order: 4,
    features: {
      max_decks: -1,
      max_exams_per_day: -1,
      max_subjects_per_exam: -1,
      max_level: 4,
      ai_explanations: true,
      offline_access: false,
      priority_support: false,
      advanced_analytics: true,
    },
  },

  // ─── Master (Tier 3) ───────────────────────────────────
  {
    slug: 'master-monthly',
    display_name: 'Master',
    tier: 3,
    billing_cycle: 'monthly',
    price_paise: 29900, // ₹299
    currency: 'INR',
    trial_days: 0,
    is_active: true,
    sort_order: 5,
    features: {
      max_decks: -1,
      max_exams_per_day: -1,
      max_subjects_per_exam: -1,
      max_level: -1,             // all 6 levels
      ai_explanations: true,
      offline_access: true,
      priority_support: true,
      advanced_analytics: true,
    },
  },
  {
    slug: 'master-weekly',
    display_name: 'Master',
    tier: 3,
    billing_cycle: 'weekly',
    price_paise: 8900, // ₹89
    currency: 'INR',
    trial_days: 0,
    is_active: true,
    sort_order: 6,
    features: {
      max_decks: -1,
      max_exams_per_day: -1,
      max_subjects_per_exam: -1,
      max_level: -1,
      ai_explanations: true,
      offline_access: true,
      priority_support: true,
      advanced_analytics: true,
    },
  },
];

async function seed() {
  console.log('🌱 Seeding plans...');

  for (const plan of plans) {
    const result = await pool.query(
      `INSERT INTO plans
         (slug, display_name, tier, billing_cycle, price_paise, currency, features, trial_days, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (slug) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         price_paise  = EXCLUDED.price_paise,
         features     = EXCLUDED.features,
         trial_days   = EXCLUDED.trial_days,
         is_active    = EXCLUDED.is_active,
         sort_order   = EXCLUDED.sort_order
       RETURNING id, slug`,
      [
        plan.slug,
        plan.display_name,
        plan.tier,
        plan.billing_cycle,
        plan.price_paise,
        plan.currency,
        JSON.stringify(plan.features),
        plan.trial_days,
        plan.is_active,
        plan.sort_order,
      ],
    );
    console.log(`  ✓ ${plan.slug} (${result.rows[0].id})`);
  }

  console.log(`\n✅ Seeded ${plans.length} plans.`);
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  pool.end();
  process.exit(1);
});
