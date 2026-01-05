/**
 * Migration Helper Script - AWS Aurora
 *
 * Fetches database credentials from AWS Secrets Manager and runs Prisma migrations on Aurora.
 * Use this only after testing migrations locally and confirming they work.
 */

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const { execSync } = require("child_process");
const path = require("path");

// Load .env file manually
require("dotenv").config({
  path: path.join(__dirname, "../services/auth/.env"),
});

async function getDatabaseCredentials() {
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error("DB_SECRET_ARN not found in environment variables");
  }

  const region = process.env.AWS_REGION || "us-east-1";
  const client = new SecretsManagerClient({ region });

  try {
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error("Database secret value is empty");
    }

    const secret = JSON.parse(response.SecretString);
    return {
      username: secret.username,
      password: secret.password,
    };
  } catch (error) {
    console.error("Failed to fetch database credentials:", error.message);
    throw error;
  }
}

async function runMigration() {
  try {
    console.log("🔐 Fetching database credentials from AWS Secrets Manager...");
    const { username, password } = await getDatabaseCredentials();

    // Get DATABASE_URL from .env
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL not found in environment variables");
    }

    // Replace placeholders with actual credentials
    const finalUrl = databaseUrl
      .replace("USERNAME", encodeURIComponent(username))
      .replace("PASSWORD", encodeURIComponent(password));

    console.log("✅ Credentials fetched successfully");
    console.log("📦 Running Prisma migration on AWS AURORA...\n");
    console.log("⚠️  WARNING: This will modify the production database!\n");

    // Run Prisma migrate deploy (for production)
    const schemaPath = path.join(
      __dirname,
      "../services/auth/prisma/schema.prisma"
    );

    execSync(`prisma migrate deploy --schema=${schemaPath}`, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: finalUrl },
    });

    console.log("\n✅ Migration deployed successfully to AWS AURORA!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

runMigration();
