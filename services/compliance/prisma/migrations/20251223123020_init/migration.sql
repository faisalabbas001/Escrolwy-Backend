-- CreateTable
CREATE TABLE "kyc_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "persona_inquiry_id" TEXT,
    "reference_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "kyc_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kyc_record_id" UUID NOT NULL,
    "risk_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'persona',
    "details" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kyc_record_id" UUID NOT NULL,
    "escrow_limit" DECIMAL(18,2) NOT NULL,
    "ledger_limit" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
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

-- CreateIndex
CREATE UNIQUE INDEX "kyc_records_user_id_key" ON "kyc_records"("user_id");

-- CreateIndex
CREATE INDEX "idx_kyc_records_user" ON "kyc_records"("user_id");

-- CreateIndex
CREATE INDEX "idx_kyc_records_status" ON "kyc_records"("status");

-- CreateIndex
CREATE INDEX "idx_kyc_records_persona_inquiry" ON "kyc_records"("persona_inquiry_id");

-- CreateIndex
CREATE INDEX "idx_risks_user" ON "risks"("user_id");

-- CreateIndex
CREATE INDEX "idx_risks_kyc_record" ON "risks"("kyc_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "limits_user_id_key" ON "limits"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "limits_kyc_record_id_key" ON "limits"("kyc_record_id");

-- CreateIndex
CREATE INDEX "idx_limits_user" ON "limits"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_event_id_key" ON "webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "idx_webhook_events_event_id" ON "webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "idx_webhook_events_inquiry" ON "webhook_events"("inquiry_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_idx" ON "outbox_events"("status");

-- CreateIndex
CREATE INDEX "outbox_events_createdAt_idx" ON "outbox_events"("createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_nextRetryAt_idx" ON "outbox_events"("nextRetryAt");

-- CreateIndex
CREATE INDEX "outbox_events_topic_idx" ON "outbox_events"("topic");

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_kyc_record_id_fkey" FOREIGN KEY ("kyc_record_id") REFERENCES "kyc_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limits" ADD CONSTRAINT "limits_kyc_record_id_fkey" FOREIGN KEY ("kyc_record_id") REFERENCES "kyc_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
