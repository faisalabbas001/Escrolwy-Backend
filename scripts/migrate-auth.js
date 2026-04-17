/**
 * Migration Helper Script - Local PostgreSQL
 *
 * Creates Prisma migration file (without applying) so you can add CHECK constraints and triggers.
 * After editing, run: npm run prisma:auth:migrate:apply
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Load .env file manually
require("dotenv").config({
  path: path.join(__dirname, "../services/auth/.env"),
});

function findLatestMigration() {
  const migrationsPath = path.join(
    __dirname,
    "../services/auth/prisma/migrations"
  );
  if (!fs.existsSync(migrationsPath)) {
    return null;
  }

  const migrations = fs
    .readdirSync(migrationsPath)
    .filter((dir) => {
      const dirPath = path.join(migrationsPath, dir);
      return (
        fs.statSync(dirPath).isDirectory() &&
        fs.existsSync(path.join(dirPath, "migration.sql"))
      );
    })
    .sort()
    .reverse();

  return migrations.length > 0 ? migrations[0] : null;
}

function runMigration() {
  try {
    // Use database URL (local PostgreSQL in development)
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL not found in environment variables. Make sure local PostgreSQL is configured."
      );
    }

    console.log("📦 Creating Prisma migration...\n");
    console.log(`📍 Database: ${databaseUrl.split('@')[1]?.split('/')[0] || 'local'}\n`);

    const schemaPath = path.join(
      __dirname,
      "../services/auth/prisma/schema.prisma"
    );
    const args = process.argv.slice(2); // Get migration name and other args

    // Step 1: Create migration file (without applying)
    console.log("📝 Step 1: Creating migration file...\n");
    
    // Build the command with all args (including --name if provided)
    let command = `prisma migrate dev --create-only --schema=${schemaPath}`;
    if (args.length > 0) {
      command += ` ${args.join(" ")}`;
    } else {
      command += ` --name migration`;
    }

    execSync(command, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });

    // Step 2: Find the created migration file
    const latestMigration = findLatestMigration();
    if (!latestMigration) {
      throw new Error("Migration file not found after creation");
    }

    const migrationFilePath = path.join(
      __dirname,
      "../services/auth/prisma/migrations",
      latestMigration,
      "migration.sql"
    );

    console.log("\n" + "=".repeat(60));
    console.log("✅ Migration file created successfully!");
    console.log("=".repeat(60));
    console.log(`\n📄 Migration file location:`);
    console.log(`   ${migrationFilePath}\n`);
    console.log("💡 Next steps:");
    console.log("   1. Edit the migration.sql file to add CHECK constraints and triggers");
    console.log("   2. If you don't need constraints/triggers, skip to step 3");
    console.log(
      `   3. Run: npm run prisma:auth:migrate:apply\n`
    );
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("❌ Migration creation failed:", error.message);
    process.exit(1);
  }
}

runMigration();
