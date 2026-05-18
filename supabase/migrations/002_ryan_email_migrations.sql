-- Migrations explicitly requested by Ryan in his email.
-- Safe to re-run against either dev schema or the official schema.

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
