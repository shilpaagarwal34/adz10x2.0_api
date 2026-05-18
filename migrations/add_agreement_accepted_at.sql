-- Run on PostgreSQL (local or production) to fix society signup validation errors.
ALTER TABLE society_registration
  ADD COLUMN IF NOT EXISTS agreement_accepted_at TIMESTAMPTZ DEFAULT NULL;
