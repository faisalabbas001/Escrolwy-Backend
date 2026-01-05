/**
 * Apply Pending Migration - Admin Service (Local PostgreSQL)
 *
 * Applies the migration file that was created with migrate:dev.
 * Use this after editing the migration.sql file to add constraints/triggers.
 */

const { execSync } = require("child_process");
const path = require("path");

// Load .env file manually
require("dotenv").config({
  path: path.join(__dirname, "../services/admin/.env"),
});

function applyMigration() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL not found in environment variables. Make sure local PostgreSQL is configured."
      );
    }

    console.log("📦 Applying migration to database (Admin service)...\n");
    console.log(`📍 Database: ${databaseUrl.split('@')[1]?.split('/')[0] || 'local'}\n`);

    const schemaPath = path.join(
      __dirname,
      "../services/admin/prisma/schema.prisma"
    );

    // Use migrate deploy to apply pending migrations
    // This will apply the migration file (with your constraints/triggers)
    execSync(`prisma migrate deploy --schema=${schemaPath}`, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });

    console.log("\n✅ Migration applied successfully!");
  } catch (error) {
    console.error("❌ Migration apply failed:", error.message);
    process.exit(1);
  }
}

applyMigration();

