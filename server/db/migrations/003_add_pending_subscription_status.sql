-- Add pending status to subscription_status enum
ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'pending';
