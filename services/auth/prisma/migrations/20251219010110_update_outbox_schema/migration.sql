-- Update outbox_events table to match new schema
-- This migration removes event_id and event_type columns and renames snake_case columns to camelCase

-- Step 1: Rename columns from snake_case to camelCase
ALTER TABLE "auth_db"."outbox_events" 
  RENAME COLUMN "partition_key" TO "partitionKey";

ALTER TABLE "auth_db"."outbox_events" 
  RENAME COLUMN "retry_count" TO "retryCount";

ALTER TABLE "auth_db"."outbox_events" 
  RENAME COLUMN "last_error" TO "lastError";

ALTER TABLE "auth_db"."outbox_events" 
  RENAME COLUMN "next_retry_at" TO "nextRetryAt";

ALTER TABLE "auth_db"."outbox_events" 
  RENAME COLUMN "created_at" TO "createdAt";

ALTER TABLE "auth_db"."outbox_events" 
  RENAME COLUMN "published_at" TO "publishedAt";

-- Step 2: Drop unused columns
ALTER TABLE "auth_db"."outbox_events" 
  DROP COLUMN IF EXISTS "event_id";

ALTER TABLE "auth_db"."outbox_events" 
  DROP COLUMN IF EXISTS "event_type";

-- Step 3: Update indexes to use new column names
DROP INDEX IF EXISTS "auth_db"."idx_outbox_status";
DROP INDEX IF EXISTS "auth_db"."idx_outbox_created_at";
DROP INDEX IF EXISTS "auth_db"."idx_outbox_next_retry_at";

CREATE INDEX "outbox_events_status_idx" ON "auth_db"."outbox_events"("status");
CREATE INDEX "outbox_events_createdAt_idx" ON "auth_db"."outbox_events"("createdAt");
CREATE INDEX "outbox_events_nextRetryAt_idx" ON "auth_db"."outbox_events"("nextRetryAt");
CREATE INDEX "outbox_events_topic_idx" ON "auth_db"."outbox_events"("topic");
