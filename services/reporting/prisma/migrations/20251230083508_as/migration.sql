-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_deposits" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "total_withdrawals" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "total_internal_transfers" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "escrow_created" INTEGER NOT NULL DEFAULT 0,
    "escrow_completed" INTEGER NOT NULL DEFAULT 0,
    "escrow_disputed" INTEGER NOT NULL DEFAULT 0,
    "escrow_refunded" INTEGER NOT NULL DEFAULT 0,
    "fees_collected" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "volume_by_currency" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" UUID NOT NULL,
    "service_name" TEXT NOT NULL,
    "metric_type" TEXT NOT NULL,
    "metric_value" DECIMAL(20,8) NOT NULL,
    "chain" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "alert_type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL,
    "rule_type" TEXT NOT NULL,
    "condition_expression" TEXT NOT NULL,
    "threshold" DECIMAL(20,8) NOT NULL,
    "severity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_snapshots" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "user_id" UUID,
    "amount" DECIMAL(20,8),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_snapshots_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "daily_metrics_date_key" ON "daily_metrics"("date");

-- CreateIndex
CREATE INDEX "idx_daily_metrics_date" ON "daily_metrics"("date");

-- CreateIndex
CREATE INDEX "idx_system_metrics_service" ON "system_metrics"("service_name");

-- CreateIndex
CREATE INDEX "idx_system_metrics_type" ON "system_metrics"("metric_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_system_metrics" ON "system_metrics"("service_name", "metric_type", "chain");

-- CreateIndex
CREATE INDEX "idx_alerts_type" ON "alerts"("alert_type");

-- CreateIndex
CREATE INDEX "idx_alerts_status" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "idx_alerts_severity" ON "alerts"("severity");

-- CreateIndex
CREATE INDEX "idx_alerts_created" ON "alerts"("created_at");

-- CreateIndex
CREATE INDEX "idx_alert_rules_active" ON "alert_rules"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_alert_rules_type" ON "alert_rules"("rule_type");

-- CreateIndex
CREATE INDEX "idx_audit_snapshots_type" ON "audit_snapshots"("event_type");

-- CreateIndex
CREATE INDEX "idx_audit_snapshots_user" ON "audit_snapshots"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_snapshots_ref" ON "audit_snapshots"("reference_id");

-- CreateIndex
CREATE INDEX "idx_audit_snapshots_created" ON "audit_snapshots"("created_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_idx" ON "outbox_events"("status");

-- CreateIndex
CREATE INDEX "outbox_events_createdAt_idx" ON "outbox_events"("createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_nextRetryAt_idx" ON "outbox_events"("nextRetryAt");

-- CreateIndex
CREATE INDEX "outbox_events_topic_idx" ON "outbox_events"("topic");
