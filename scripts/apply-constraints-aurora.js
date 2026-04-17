/**
 * Apply CHECK Constraints and Triggers to Aurora
 * 
 * Applies the constraints and triggers that were added to the migration
 * to the Aurora database (since they weren't in the original migration).
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');
const path = require('path');
const fs = require('fs');

// Load .env file manually
require('dotenv').config({ path: path.join(__dirname, '../services/auth/.env') });

async function getDatabaseCredentials() {
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error('DB_SECRET_ARN not found in environment variables');
  }

  const region = process.env.AWS_REGION || 'us-east-1';
  const client = new SecretsManagerClient({ region });

  try {
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error('Database secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);
    return {
      username: secret.username,
      password: secret.password,
    };
  } catch (error) {
    console.error('Failed to fetch database credentials:', error.message);
    throw error;
  }
}

async function applyConstraints() {
  try {
    console.log('🔐 Fetching database credentials from AWS Secrets Manager...');
    const { username, password } = await getDatabaseCredentials();

    // Get DATABASE_URL from .env
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not found in environment variables');
    }

    // Replace placeholders with actual credentials
    const finalUrl = databaseUrl
      .replace('USERNAME', encodeURIComponent(username))
      .replace('PASSWORD', encodeURIComponent(password));

    // Parse connection string
    const url = new URL(finalUrl.replace('postgresql://', 'http://'));
    const host = url.hostname;
    const port = parseInt(url.port || '5432');
    const database = url.pathname.split('/')[1];

    console.log('✅ Credentials fetched successfully');
    console.log('📦 Applying CHECK constraints and triggers to Aurora...\n');

    // Connect to database
    const client = new Client({
      host,
      port,
      database,
      user: username,
      password,
      ssl: { rejectUnauthorized: false }, // Aurora requires SSL
    });

    await client.connect();

    // Read constraints and triggers from migration file
    const migrationPath = path.join(__dirname, '../services/auth/prisma/migrations/20251127144457_add_auth_models/migration.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // Extract only the constraints and triggers part
    const constraintsStart = migrationSql.indexOf('-- ====================================');
    const constraintsSql = migrationSql.substring(constraintsStart);

    // Split into individual statements
    const statements = constraintsSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await client.query(statement + ';');
          console.log(`✅ Applied: ${statement.substring(0, 50)}...`);
        } catch (error) {
          // Ignore "already exists" errors
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log(`⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
          } else {
            throw error;
          }
        }
      }
    }

    await client.end();

    console.log('\n✅ All constraints and triggers applied to Aurora!');
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

applyConstraints();

