-- Replace inquiry_outbox with outbox_events
-- This migration:
-- 1. Drops the legacy OutboxStatus enum
-- 2. Drops the legacy inquiry_outbox table
-- 3. Creates the new outbox_events table following the Transactional Outbox Pattern

-- Drop the legacy inquiry_outbox table
DROP TABLE IF EXISTS "inquiry_db"."inquiry_outbox";

-- Drop the legacy OutboxStatus enum
DROP TYPE IF EXISTS "inquiry_db"."OutboxStatus";

-- Create the new outbox_events table
CREATE TABLE "inquiry_db"."outbox_events" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "partitionKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- Create indexes for efficient querying
CREATE INDEX "outbox_events_status_idx" ON "inquiry_db"."outbox_events"("status");
CREATE INDEX "outbox_events_createdAt_idx" ON "inquiry_db"."outbox_events"("createdAt");
CREATE INDEX "outbox_events_nextRetryAt_idx" ON "inquiry_db"."outbox_events"("nextRetryAt");
CREATE INDEX "outbox_events_topic_idx" ON "inquiry_db"."outbox_events"("topic");
