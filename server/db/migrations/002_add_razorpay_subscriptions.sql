-- ============================================================
-- Migration 002: Add Razorpay Subscription Support
-- Quanti-pi Server — Auto-Debit / Recurring Billing
--
-- Adds:
--   • plans.razorpay_plan_id   — maps internal plans to Razorpay Plans API
--   • subscriptions.razorpay_subscription_id — links active subs to Razorpay
--   • subscriptions.razorpay_customer_id     — for customer mandate tracking
-- ============================================================

-- ─── plans: Razorpay plan reference ─────────────────────────
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS razorpay_plan_id VARCHAR(64) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_plans_razorpay_plan_id
  ON plans (razorpay_plan_id)
  WHERE razorpay_plan_id IS NOT NULL;

-- ─── subscriptions: Razorpay subscription + customer ────────
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(64) UNIQUE,
  ADD COLUMN IF NOT EXISTS razorpay_customer_id      VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_sub_id
  ON subscriptions (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_customer
  ON subscriptions (razorpay_customer_id)
  WHERE razorpay_customer_id IS NOT NULL;

-- ─── payments: track which Razorpay subscription cycle this payment belongs to ─
-- razorpay_subscription_id allows us to correlate subscription.charged events
-- to a specific local payments row without relying on order_id (which may differ
-- for recurring charges).
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_sub_id
  ON payments (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;
