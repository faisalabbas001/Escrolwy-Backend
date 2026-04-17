# Auth Service Migrations

## Migration Template Usage

The `migration_template.sql` file contains:

- ✅ CHECK constraints for `role` and `kyc_status` fields
- ✅ Foreign key constraints with specific names
- ✅ `updated_at` triggers for all tables

## How to Apply

### Option 1: Add to Prisma Migration (Recommended)

1. **Generate the base migration:**

   ```bash
   npm run prisma:migrate:dev --name add_auth_models
   ```

2. **Edit the generated migration file:**
   - Navigate to `prisma/migrations/YYYYMMDDHHMMSS_add_auth_models/migration.sql`
   - Append the contents of `migration_template.sql` to the end of the file

3. **Apply the migration:**
   ```bash
   npm run prisma:migrate:deploy
   ```
   (Or Prisma will apply it automatically if you used `migrate:dev`)

### Option 2: Run as Separate SQL Script

If you prefer to run the constraints and triggers separately:

```bash
# Connect to your database
psql $DATABASE_URL

# Or using Prisma Studio
npm run prisma:studio

# Then execute the SQL from migration_template.sql
```

## What's Included

### CHECK Constraints

- `chk_users_role`: Ensures role is one of: `buyer`, `seller`, `broker`, `admin`
- `chk_users_kyc_status`: Ensures kyc_status is one of: `not_started`, `pending`, `approved`, `rejected`
- `chk_kyc_status_status`: Same constraint for the `kyc_status` table

### Foreign Keys

- `fk_authcred_user`: `auth_credentials.user_id` → `users.id`
- `fk_profiles_user`: `user_profiles.user_id` → `users.id`
- `fk_kyc_user`: `kyc_status.user_id` → `users.id`

All FKs use `ON DELETE CASCADE` to maintain referential integrity.

### Triggers

- `update_users_updated_at`: Auto-updates `updated_at` on `users` table
- `update_auth_credentials_updated_at`: Auto-updates `updated_at` on `auth_credentials` table
- `update_user_profiles_updated_at`: Auto-updates `updated_at` on `user_profiles` table
- `update_kyc_status_updated_at`: Auto-updates `updated_at` on `kyc_status` table

**Note:** Prisma's `@updatedAt` decorator handles `updated_at` at the application level, but these triggers ensure database-level consistency even for direct SQL updates.

## Verification

After applying the migration, verify constraints and triggers:

```sql
-- Check constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace = 'auth_db'::regnamespace
ORDER BY conname;

-- Check triggers
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth_db'
ORDER BY trigger_name;
```

## Rollback

If you need to rollback:

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON auth_db.users;
DROP TRIGGER IF EXISTS update_auth_credentials_updated_at ON auth_db.auth_credentials;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON auth_db.user_profiles;
DROP TRIGGER IF EXISTS update_kyc_status_updated_at ON auth_db.kyc_status;

-- Drop function
DROP FUNCTION IF EXISTS auth_db.update_updated_at_column();

-- Drop constraints (if needed)
ALTER TABLE auth_db.users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE auth_db.users DROP CONSTRAINT IF EXISTS chk_users_kyc_status;
ALTER TABLE auth_db.kyc_status DROP CONSTRAINT IF EXISTS chk_kyc_status_status;
```

Or use Prisma's migration rollback:

```bash
npm run prisma:migrate:reset  # ⚠️ WARNING: This will drop all data!
```
