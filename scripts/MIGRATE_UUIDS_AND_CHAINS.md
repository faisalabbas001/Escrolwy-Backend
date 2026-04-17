# Migration Script: Update UUIDs and Chain Values

This script updates existing database records to use valid UUIDs and change chain values from 'evm' to 'eth'.

## What This Script Does

1. **Auth DB Updates:**
   - Updates user IDs from invalid UUIDs (00000000-...) to valid UUIDs (11111111-...)
   - Updates related tables: `users`, `auth_credentials`, `user_profiles`, `kyc_status`

2. **Ledger DB Updates:**
   - Updates `ownerId` in accounts table
   - Updates `senderId` and `destinationUserId` in transfers table
   - Updates `userId` in journals, reservations, and external_transfers tables
   - Changes all `chain` values from 'evm' to 'eth'

3. **Escrow DB Updates:**
   - Updates `buyerId`, `sellerId`, `brokerId`, `createdBy`, `disputedBy` in escrows table
   - Updates `changedBy` in escrow_transitions table
   - Changes all `chain` values from 'evm' to 'eth'

## UUID Mapping

| Old UUID | New UUID | User |
|----------|----------|------|
| 00000000-0000-0000-0000-000000000001 | 11111111-1111-4111-8111-111111111111 | buyer_1 |
| 00000000-0000-0000-0000-000000000002 | 22222222-2222-4222-8222-222222222222 | buyer_2 |
| 00000000-0000-0000-0000-000000000003 | 33333333-3333-4333-8333-333333333333 | seller_1 |
| 00000000-0000-0000-0000-000000000004 | 44444444-4444-4444-8444-444444444444 | seller_2 |
| 00000000-0000-0000-0000-000000000005 | 55555555-5555-4555-8555-555555555555 | broker_1 |
| 00000000-0000-0000-0000-000000000010 | 99999999-9999-4999-8999-999999999999 | admin_1 |

## How to Run

### Option 1: Using psql command line

```bash
# Set your database connection string
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Run the migration
psql $DATABASE_URL -f scripts/migrate-update-uuids-and-chains.sql
```

### Option 2: Using psql interactively

```bash
psql -U your_username -d your_database
\i scripts/migrate-update-uuids-and-chains.sql
```

### Option 3: Using a database client (pgAdmin, DBeaver, etc.)

Open the SQL file and execute it against your database.

## Verification

After running the migration, verify the changes with these queries:

```sql
-- Check auth users
SELECT id, email FROM auth_db.users ORDER BY id;

-- Check ledger accounts
SELECT "ownerId", chain, COUNT(*) 
FROM ledger_db.accounts 
WHERE "ownerType" = 'user' 
GROUP BY "ownerId", chain;

-- Check chain values
SELECT chain, COUNT(*) FROM ledger_db.accounts GROUP BY chain;
SELECT chain, COUNT(*) FROM ledger_db.transfers GROUP BY chain;
SELECT chain, COUNT(*) FROM ledger_db.journals GROUP BY chain;

-- Check escrow records
SELECT "buyerId", "sellerId", chain, COUNT(*) 
FROM escrow_db.escrows 
GROUP BY "buyerId", "sellerId", chain;
```

## Important Notes

- **Backup First:** Always backup your database before running migrations
- **Transaction Safety:** The script uses BEGIN/COMMIT, so if any update fails, all changes will be rolled back
- **Test Environment:** Test this migration on a development/staging database first
- **No Data Loss:** This script only updates existing records - it does not delete or create new records

## Troubleshooting

If you encounter foreign key constraint errors:
1. Check that all referenced UUIDs exist in the parent tables
2. Ensure the migration runs in the correct order (auth → ledger → escrow)
3. Verify that the old UUIDs actually exist in your database

If some records don't update:
- The WHERE clauses only match exact old UUIDs
- Records with different UUIDs will not be affected
- Check your seed data to see which UUIDs were actually used

