-- CreateTable
CREATE TABLE "inquiry_db"."inquiries" (
    "id" TEXT NOT NULL,
    "escrow_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "assigned_admin_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_db"."inquiry_messages" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_role" TEXT NOT NULL,
    "message" TEXT,
    "attachment_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_db"."inquiry_attachments" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_db"."inquiry_outbox" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT,
    "event_type" TEXT NOT NULL,
    "event_key" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inquiries_escrow_id_key" ON "inquiry_db"."inquiries"("escrow_id");

-- CreateIndex
CREATE INDEX "inquiries_escrow_id_idx" ON "inquiry_db"."inquiries"("escrow_id");

-- CreateIndex
CREATE INDEX "inquiries_created_by_idx" ON "inquiry_db"."inquiries"("created_by");

-- CreateIndex
CREATE INDEX "inquiries_assigned_admin_id_idx" ON "inquiry_db"."inquiries"("assigned_admin_id");

-- CreateIndex
CREATE INDEX "inquiries_status_idx" ON "inquiry_db"."inquiries"("status");

-- CreateIndex
CREATE INDEX "inquiries_created_at_idx" ON "inquiry_db"."inquiries"("created_at");

-- CreateIndex
CREATE INDEX "inquiry_messages_inquiry_id_created_at_idx" ON "inquiry_db"."inquiry_messages"("inquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "inquiry_messages_sender_id_idx" ON "inquiry_db"."inquiry_messages"("sender_id");

-- CreateIndex
CREATE INDEX "inquiry_attachments_inquiry_id_created_at_idx" ON "inquiry_db"."inquiry_attachments"("inquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "inquiry_attachments_message_id_idx" ON "inquiry_db"."inquiry_attachments"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_outbox_event_key_key" ON "inquiry_db"."inquiry_outbox"("event_key");

-- CreateIndex
CREATE INDEX "inquiry_outbox_status_idx" ON "inquiry_db"."inquiry_outbox"("status");

-- CreateIndex
CREATE INDEX "inquiry_outbox_created_at_idx" ON "inquiry_db"."inquiry_outbox"("created_at");

-- CreateIndex
CREATE INDEX "inquiry_outbox_event_type_idx" ON "inquiry_db"."inquiry_outbox"("event_type");

-- AddForeignKey
ALTER TABLE "inquiry_db"."inquiry_messages" ADD CONSTRAINT "inquiry_messages_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiry_db"."inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_db"."inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiry_db"."inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_db"."inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "inquiry_db"."inquiry_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
