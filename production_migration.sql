-- ============================================================
-- Production Migration Script
-- Run this on the production PostgreSQL database
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks)
-- ============================================================

-- 1. society_media_rate_cards: missing columns
ALTER TABLE society_media_rate_cards
  ADD COLUMN IF NOT EXISTS availability_days JSON DEFAULT '[]' NOT NULL;

ALTER TABLE society_media_rate_cards
  ADD COLUMN IF NOT EXISTS availability_month_days JSON DEFAULT '[]' NOT NULL;

ALTER TABLE society_media_rate_cards
  ADD COLUMN IF NOT EXISTS whatsapp_details JSON DEFAULT NULL;

-- submission_stage ENUM column (requires creating ENUM type first)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_society_media_rate_cards_submission_stage') THEN
    CREATE TYPE "enum_society_media_rate_cards_submission_stage" AS ENUM ('draft', 'submitted');
  END IF;
END$$;

ALTER TABLE society_media_rate_cards
  ADD COLUMN IF NOT EXISTS submission_stage "enum_society_media_rate_cards_submission_stage" DEFAULT 'submitted' NOT NULL;

-- 2. society_profile: missing columns (added in commit 352b9dd)
ALTER TABLE society_profile
  ADD COLUMN IF NOT EXISTS billing_qr_code_path VARCHAR(255) DEFAULT NULL;

ALTER TABLE society_profile
  ADD COLUMN IF NOT EXISTS billing_qr_code_name VARCHAR(255) DEFAULT NULL;

-- 3. society_registration: agreement timestamp (fixes signup email/mobile checks)
ALTER TABLE society_registration
  ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ DEFAULT NULL;

-- 4. company_campaigns_logs: missing columns
ALTER TABLE company_campaigns_logs
  ADD COLUMN IF NOT EXISTS selected_assets TEXT DEFAULT NULL;

ALTER TABLE company_campaigns_logs
  ADD COLUMN IF NOT EXISTS subtotal FLOAT DEFAULT NULL;

-- Verify (optional - shows columns added)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('society_media_rate_cards', 'company_campaigns_logs', 'society_profile', 'society_registration')
  AND column_name IN (
    'availability_days', 'availability_month_days', 'whatsapp_details',
    'submission_stage', 'selected_assets', 'subtotal',
    'billing_qr_code_path', 'billing_qr_code_name',
    'agreement_accepted_at'
  )
ORDER BY table_name, column_name;
