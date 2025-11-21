✅ PART 3 — What You Need to Change

Inside GitHub repo → Settings → Secrets → Actions, add:

Secret Example
AWS_ACCOUNT_ID 123456789012
AWS_DEV_ROLE_ARN arn:aws:iam::12345:role/GithubActionsRole_DEV

Pipeline env vars need these 3 updated:

AWS_REGION: ap-south-1 → your region
CLUSTER_NAME: dev-escrowly-eks
ECR_REPO: dev-escrowly-backend

Also ensure that in EKS dev:

Your deployment must be named:

dev-escrowly-backend

And container name inside Deployment YAML must be:

backend-container

If they differ, I’ll adapt the YAML for you.

✅ PART 4 — Important: What the Workflow Is Doing?
✔ Step 1 — Trigger only when merging into dev

Feature branch pushes — ignored

PR merges → triggers

Direct pushes to dev → triggers

This keeps CI disciplined.

✔ Step 2 — CI: Tests + Build

Ensures code is not breaking

Ensures build success before deployment

✔ Step 3 — Authenticate to AWS using OIDC

No secrets, no AWS keys.
Clean, enterprise-grade.

✔ Step 4 — Build + Push Docker image to ECR

ECR repo:
dev-escrowly-backend

This is THE image your dev cluster uses.

✔ Step 5 — Update EKS deployment

Connect to cluster:

kubectl set image deployment/dev-escrowly-backend backend-container=...

Rollout success ensures pod started correctly.
