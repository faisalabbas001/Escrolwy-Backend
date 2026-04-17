# 🏗️ Escrowly Dev Infrastructure - CDK Stack

AWS CDK stack for deploying minimal-cost infrastructure for local development.

---

## 📦 **What Gets Deployed**

1. **Aurora Serverless v2 PostgreSQL** (0.5-1 ACU) - ~$0.10/hour when active
2. **S3 Bucket** - For file/document storage
3. **KMS Key** - For encryption (S3, database encryption)
4. **VPC & Security Groups** - Network setup for Aurora

**Total Cost:** ~$5-10/month for minimal usage

---

## 🗄️ **Database Structure**

Single Aurora cluster with multiple schemas (logical databases):

```
escrowly (database)
├── auth_db          (Auth Service)
├── wallet_db         (Wallet Service)
├── ledger_db         (Ledger Service)
├── escrow_db         (Escrow Service)
├── inquiry_db        (Inquiry Service)
├── compliance_db     (Compliance Service)
├── admin_db          (Admin Service)
├── reporting_db      (Reporting Service)
├── notification_db   (Notification Service)
└── landing_db        (Landing Service)
```

**Each service connects to its own schema** using connection strings like:

```
postgresql://USERNAME:PASSWORD@HOST:5432/escrowly?schema=auth_db
```

---

## 🚀 **Quick Start**

### **1. Prerequisites**

```bash
# Install AWS CLI
# Download from: https://aws.amazon.com/cli/

# Install CDK
npm install -g aws-cdk

# Configure AWS credentials
aws configure
```

### **2. Deploy**

```bash
cd infra/cdk/dev
npm install
npm run build
cdk bootstrap    # First time only
cdk deploy
```

### **3. Initialize Schemas**

After deployment, connect to Aurora and run:

```sql
-- Copy from: ../../scripts/init-schemas.sql
```

### **4. Get Connection Strings**

```powershell
.\generate-connection-strings.ps1
```

Or see: `CONNECTION_STRINGS.md`

---

## 📚 **Documentation**

- **`QUICK_START.md`** - Fast deployment guide
- **`CDK_DEPLOYMENT_GUIDE.md`** - Detailed step-by-step guide with explanations
- **`CONNECTION_STRINGS.md`** - All service connection strings reference

---

## 📁 **Project Structure**

```
infra/cdk/dev/
├── bin/
│   └── dev.ts                    # CDK app entry point
├── dev-stack.ts                  # Infrastructure definition
├── cdk.json                      # CDK configuration
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── generate-connection-strings.ps1  # Helper script
└── README.md                     # This file
```

---

## 🔧 **CDK Commands**

```bash
npm run build      # Compile TypeScript
cdk synth          # Preview CloudFormation template
cdk diff           # See what will change
cdk deploy         # Deploy to AWS
cdk destroy        # Delete everything (careful!)
```

---

## 📊 **After Deployment**

CDK will output:

- Database host endpoint
- S3 bucket name
- KMS key ARN
- Secrets Manager ARN (for DB credentials)

**Save these values!** You'll need them for `.env` files.

---

## 🔐 **Getting Database Credentials**

Aurora automatically stores credentials in AWS Secrets Manager:

```bash
# Get secret ARN from CDK outputs, then:
aws secretsmanager get-secret-value \
  --secret-id <secret-arn> \
  --query SecretString \
  --output text
```

---

## ✅ **Next Steps**

1. ✅ Deploy infrastructure (`cdk deploy`)
2. ✅ Get database credentials (Secrets Manager)
3. ✅ Initialize schemas (`scripts/init-schemas.sql`)
4. ✅ Update service `.env` files with connection strings
5. ✅ Test connections from your services

---

**Ready to deploy? See `QUICK_START.md` or `CDK_DEPLOYMENT_GUIDE.md`!** 🚀
