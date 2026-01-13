-- Migration: Add email OTP authentication
-- This converts the auth system from magic links to OTP codes

-- 1. Create email_otp_challenges table
CREATE TABLE email_otp_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  send_count INT NOT NULL DEFAULT 1,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ NULL,
  device_id TEXT NULL,
  ip_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX idx_email_otp_challenges_email_created ON email_otp_challenges(email, created_at DESC);
CREATE INDEX idx_email_otp_challenges_expires ON email_otp_challenges(expires_at);

-- 3. Ensure users.email is unique (if not already)
-- This is idempotent - will only add constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;
