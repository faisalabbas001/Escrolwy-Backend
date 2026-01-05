-- CreateTable
CREATE TABLE "failed_events" (
    "id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "source_service" TEXT NOT NULL,
    "failure_reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error_stack" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "failed_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_failed_events_name" ON "failed_events"("event_name");

-- CreateIndex
CREATE INDEX "idx_failed_events_source" ON "failed_events"("source_service");

-- CreateIndex
CREATE INDEX "idx_failed_events_status" ON "failed_events"("status");

-- CreateIndex
CREATE INDEX "idx_failed_events_created" ON "failed_events"("created_at");
