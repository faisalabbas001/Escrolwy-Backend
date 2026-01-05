/*
  Warnings:

  - You are about to drop the `failed_events` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "failed_events";

-- CreateTable
CREATE TABLE "kafka_failures" (
    "id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "partition" INTEGER,
    "offset" TEXT,
    "error" TEXT NOT NULL,
    "payload" JSONB DEFAULT '{}',
    "source_service" TEXT,
    "status" TEXT NOT NULL DEFAULT 'FAILED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kafka_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_kafka_failures_topic" ON "kafka_failures"("topic");

-- CreateIndex
CREATE INDEX "idx_kafka_failures_created" ON "kafka_failures"("created_at");
