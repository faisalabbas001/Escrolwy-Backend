/**
 * Apply Existing Migrations
 *
 * Applies all existing migrations to the database.
 * Use this when setting up a new development environment.
 */

const { execSync } = require("child_process");
const path = require("path");

// Load .env file manually
require("dotenv").config({
  path: path.join(__dirname, "../services/auth/.env"),
});

function syncMigration() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL not found in environment variables");
    }

    console.log("🔄 Applying existing migrations to database...\n");
    console.log(`📍 Database: ${databaseUrl.split('@')[1]?.split('/')[0] || 'local'}\n`);

    const schemaPath = path.join(
      __dirname,
      "../services/auth/prisma/schema.prisma"
    );

    // Use migrate deploy to apply all pending migrations
    execSync(`prisma migrate deploy --schema=${schemaPath}`, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });

    console.log("\n✅ All migrations applied successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error("\n💡 Make sure:");
    console.error("   1. Local PostgreSQL is running (npm run docker:up)");
    console.error("   2. The migration files exist in prisma/migrations/");
    process.exit(1);
  }
}

syncMigration();
