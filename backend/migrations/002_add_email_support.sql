-- Migration: Add email support and make phone optional
-- This converts the auth system from SMS to email-based magic links

-- 1. Make email column UNIQUE (column already exists from initial migration)
ALTER TABLE users
  ADD CONSTRAINT users_email_unique UNIQUE (email);

-- 2. Make phone_e164 nullable in users
ALTER TABLE users
  ALTER COLUMN phone_e164 DROP NOT NULL;

-- 3. Add email column to login_links table
ALTER TABLE login_links
  ADD COLUMN email TEXT;

-- 4. Make phone_e164 nullable in login_links
ALTER TABLE login_links
  ALTER COLUMN phone_e164 DROP NOT NULL;

-- 5. Add constraint: login_links must have either email OR phone
ALTER TABLE login_links
  ADD CONSTRAINT login_links_email_or_phone_check
  CHECK (
    (email IS NOT NULL AND phone_e164 IS NULL) OR
    (email IS NULL AND phone_e164 IS NOT NULL)
  );

-- 6. Add constraint: users must have either email OR phone
ALTER TABLE users
  ADD CONSTRAINT users_email_or_phone_check
  CHECK (
    (email IS NOT NULL AND phone_e164 IS NULL) OR
    (email IS NULL AND phone_e164 IS NOT NULL)
  );

-- 7. Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_login_links_email ON login_links(email);
