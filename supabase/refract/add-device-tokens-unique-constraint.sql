-- Phase 5 hotfix #2: ensure unique constraint for device_tokens upsert
--
-- The vendor app uses ON CONFLICT (user_id, platform) for multi-device
-- push token management. This constraint may already exist in Ryan's
-- prod — if so, this is a no-op due to IF NOT EXISTS pattern.
--
-- Apply order: AFTER baseline device_tokens table
-- Status: STAGED FOR PROD APPLY (verify if already present first)
-- Rollback: ALTER TABLE device_tokens DROP CONSTRAINT device_tokens_user_platform_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'device_tokens'
      AND c.contype = 'u'
      AND EXISTS (
        SELECT 1 FROM unnest(c.conkey) AS col_num
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = col_num
        WHERE a.attname IN ('user_id', 'platform')
      )
  ) THEN
    ALTER TABLE device_tokens
    ADD CONSTRAINT device_tokens_user_platform_unique UNIQUE (user_id, platform);
  END IF;
END $$;
