-- Create enums if they don't exist
DO $$ BEGIN
    CREATE TYPE "inquiry_db"."InquiryStatus" AS ENUM ('open', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "inquiry_db"."MessageSenderRole" AS ENUM ('buyer', 'seller', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "inquiry_db"."OutboxStatus" AS ENUM ('pending', 'sent', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Drop defaults before converting types
ALTER TABLE "inquiry_db"."inquiries" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "inquiry_db"."inquiry_outbox" ALTER COLUMN "status" DROP DEFAULT;

-- Convert status column from TEXT to InquiryStatus enum
ALTER TABLE "inquiry_db"."inquiries" 
ALTER COLUMN "status" TYPE "inquiry_db"."InquiryStatus" 
USING "status"::"inquiry_db"."InquiryStatus";

-- Set default for status
ALTER TABLE "inquiry_db"."inquiries" 
ALTER COLUMN "status" SET DEFAULT 'open'::"inquiry_db"."InquiryStatus";

-- Convert sender_role column from TEXT to MessageSenderRole enum
ALTER TABLE "inquiry_db"."inquiry_messages" 
ALTER COLUMN "sender_role" TYPE "inquiry_db"."MessageSenderRole" 
USING "sender_role"::"inquiry_db"."MessageSenderRole";

-- Convert outbox status column from TEXT to OutboxStatus enum
ALTER TABLE "inquiry_db"."inquiry_outbox" 
ALTER COLUMN "status" TYPE "inquiry_db"."OutboxStatus" 
USING "status"::"inquiry_db"."OutboxStatus";

-- Set default for outbox status
ALTER TABLE "inquiry_db"."inquiry_outbox" 
ALTER COLUMN "status" SET DEFAULT 'pending'::"inquiry_db"."OutboxStatus";

-- Migrate attachment_url data to inquiry_attachments table before dropping
-- First, insert any existing attachment_url values into the attachments table
INSERT INTO "inquiry_db"."inquiry_attachments" ("id", "inquiry_id", "message_id", "file_url", "file_type", "created_at")
SELECT 
    gen_random_uuid()::text,
    "inquiry_id",
    "id",
    "attachment_url",
    'unknown',
    "created_at"
FROM "inquiry_db"."inquiry_messages"
WHERE "attachment_url" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Now drop the attachment_url column
ALTER TABLE "inquiry_db"."inquiry_messages" DROP COLUMN IF EXISTS "attachment_url";

-- Drop extra indexes that may not exist in new schema
DROP INDEX IF EXISTS "inquiry_db"."inquiries_created_by_idx";
DROP INDEX IF EXISTS "inquiry_db"."inquiries_assigned_admin_id_idx";
DROP INDEX IF EXISTS "inquiry_db"."inquiries_status_idx";
DROP INDEX IF EXISTS "inquiry_db"."inquiries_created_at_idx";
DROP INDEX IF EXISTS "inquiry_db"."inquiry_messages_sender_id_idx";
DROP INDEX IF EXISTS "inquiry_db"."inquiry_attachments_inquiry_id_created_at_idx";
DROP INDEX IF EXISTS "inquiry_db"."inquiry_attachments_message_id_idx";
DROP INDEX IF EXISTS "inquiry_db"."inquiry_outbox_status_idx";
DROP INDEX IF EXISTS "inquiry_db"."inquiry_outbox_created_at_idx";
