#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DevEscrowlyStack } from "../lib/dev-stack";

const app = new cdk.App();

// Get AWS account and region from environment or use defaults
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region =
  process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || "us-east-1";

if (!account) {
  console.error("❌ Error: AWS Account ID not found!");
  console.error(
    "Set CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable"
  );
  console.error("Or run: aws configure");
  process.exit(1);
}
                  
new DevEscrowlyStack(app, "dev-escrowly-stack", {
  env: {
    account: account,
    region: region,
  },
  description: "Escrowly Dev Environment - Aurora, S3, KMS (Minimal Cost)",
});
