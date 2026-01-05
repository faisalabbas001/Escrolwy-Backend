-- CreateEnum
CREATE TYPE "admin_db"."BlogCategory" AS ENUM ('CRYPTO_ESCROW', 'SECURITY', 'REAL_ESTATE_ESCROW', 'DOMAIN_NAME_ESCROW', 'BLOCKCHAIN_SECURITY', 'CRYPTO_TRANSACTIONS', 'FINANCE_SECURITY');

-- CreateTable
CREATE TABLE "admin_db"."blogs" (
    "id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "slug" VARCHAR(500) NOT NULL,
    "category" "admin_db"."BlogCategory" NOT NULL,
    "image_url" TEXT NOT NULL,
    "excerpt" TEXT,
    "read_time" INTEGER NOT NULL DEFAULT 4,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" VARCHAR(255),
    "content_sections" JSONB NOT NULL,

    CONSTRAINT "blogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_db"."help_categories" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_db"."help_questions" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "help_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_db"."outbox" (
    "id" UUID NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blogs_slug_key" ON "admin_db"."blogs"("slug");

-- CreateIndex
CREATE INDEX "blogs_category_idx" ON "admin_db"."blogs"("category");

-- CreateIndex
CREATE INDEX "blogs_is_published_idx" ON "admin_db"."blogs"("is_published");

-- CreateIndex
CREATE INDEX "blogs_created_at_idx" ON "admin_db"."blogs"("created_at");

-- CreateIndex
CREATE INDEX "blogs_slug_idx" ON "admin_db"."blogs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "help_categories_slug_key" ON "admin_db"."help_categories"("slug");

-- CreateIndex
CREATE INDEX "help_categories_slug_idx" ON "admin_db"."help_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "help_questions_slug_key" ON "admin_db"."help_questions"("slug");

-- CreateIndex
CREATE INDEX "help_questions_categoryId_idx" ON "admin_db"."help_questions"("categoryId");

-- CreateIndex
CREATE INDEX "help_questions_slug_idx" ON "admin_db"."help_questions"("slug");

-- CreateIndex
CREATE INDEX "outbox_processed_at_idx" ON "admin_db"."outbox"("processed_at");

-- AddForeignKey
ALTER TABLE "admin_db"."help_questions" ADD CONSTRAINT "help_questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "admin_db"."help_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
