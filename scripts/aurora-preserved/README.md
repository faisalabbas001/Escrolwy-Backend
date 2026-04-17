# Aurora Scripts (Preserved for Stage/Prod)

These scripts are preserved for future use when deploying to AWS Aurora (stage/production).

## Scripts

### `migrate-auth-aurora.js`
- Fetches database credentials from AWS Secrets Manager
- Applies Prisma migrations to Aurora database
- Use for stage/prod deployments

### `apply-constraints-aurora.js`
- Applies CHECK constraints and triggers to Aurora
- Use after migrations are deployed

## When to Use

1. When deploying to **staging** environment
2. When deploying to **production** environment
3. When Aurora is re-enabled for development

## Setup Required

Before using these scripts:

1. Deploy Aurora infrastructure (CDK)
2. Update `.env` with:
   - `DATABASE_URL_AURORA` - Aurora endpoint with placeholders
   - `DB_SECRET_ARN` - Secrets Manager ARN for credentials

## Adding to package.json

When ready to use Aurora:

```json
{
  "scripts": {
    "prisma:auth:migrate:deploy:aurora": "node scripts/aurora-preserved/migrate-auth-aurora.js",
    "prisma:auth:apply-constraints:aurora": "node scripts/aurora-preserved/apply-constraints-aurora.js"
  }
}
```

## Previous Dev Aurora (Reference)

- Endpoint: `dev-escrowly-stack-devescrowlyaurora1fe3167f-axctyp74niwg.cluster-cih2ysk041lq.us-east-1.rds.amazonaws.com`
- Secret ARN: `arn:aws:secretsmanager:us-east-1:956926660360:secret:devescrowlyauroraSecretABD7-ySylRYB32Hk5-ZoBmIA`

---

**Last Updated:** December 2025

