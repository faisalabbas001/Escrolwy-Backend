/*
  Warnings:

  - You are about to drop the column `category` on the `blogs` table. All the data in the column will be lost.
  - You are about to drop the `help_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `help_questions` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `category_id` to the `blogs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "help_questions" DROP CONSTRAINT "help_questions_categoryId_fkey";

-- DropIndex
DROP INDEX "blogs_category_idx";

-- AlterTable
ALTER TABLE "admin_db"."blogs" DROP COLUMN "category",
ADD COLUMN     "category_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "help_categories";

-- DropTable
DROP TABLE "help_questions";

-- DropEnum
DROP TYPE "BlogCategory";

-- CreateTable
CREATE TABLE "admin_db"."blog_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_db"."help_desk_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_desk_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_db"."help_desk_items" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_desk_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_db"."help_desk_questions" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_desk_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_name_key" ON "admin_db"."blog_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "admin_db"."blog_categories"("slug");

-- CreateIndex
CREATE INDEX "blog_categories_slug_idx" ON "admin_db"."blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "help_desk_categories_name_key" ON "admin_db"."help_desk_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "help_desk_categories_slug_key" ON "admin_db"."help_desk_categories"("slug");

-- CreateIndex
CREATE INDEX "help_desk_categories_slug_idx" ON "admin_db"."help_desk_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "help_desk_items_slug_key" ON "admin_db"."help_desk_items"("slug");

-- CreateIndex
CREATE INDEX "help_desk_items_categoryId_idx" ON "admin_db"."help_desk_items"("categoryId");

-- CreateIndex
CREATE INDEX "help_desk_items_slug_idx" ON "admin_db"."help_desk_items"("slug");

-- CreateIndex
CREATE INDEX "help_desk_questions_itemId_idx" ON "admin_db"."help_desk_questions"("itemId");

-- CreateIndex
CREATE INDEX "blogs_category_id_idx" ON "admin_db"."blogs"("category_id");

-- AddForeignKey
ALTER TABLE "admin_db"."blogs" ADD CONSTRAINT "blogs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "admin_db"."blog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_db"."help_desk_items" ADD CONSTRAINT "help_desk_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "admin_db"."help_desk_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_db"."help_desk_questions" ADD CONSTRAINT "help_desk_questions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "admin_db"."help_desk_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
