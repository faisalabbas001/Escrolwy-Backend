#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Ec2EscrowlyStack } from "../lib/ec2-stack";

const app = new cdk.App();

// Get AWS account and region from environment or use defaults
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || "us-west-2";

if (!account) {
  console.error("❌ Error: AWS Account ID not found!");
  console.error("Set CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable");
  console.error("Or run: aws configure");
  process.exit(1);
}

// Check for EC2 key pair name
if (!process.env.EC2_KEY_PAIR_NAME) {
  console.warn("⚠️  Warning: EC2_KEY_PAIR_NAME not set. SSH access will be disabled.");
  console.warn("Set EC2_KEY_PAIR_NAME environment variable to enable SSH access.");
}

new Ec2EscrowlyStack(app, "escrowly-ec2-stack", {
  env: {
    account: account,
    region: region,
  },
  description: "Escrowly EC2 Backend Services - Docker Compose deployment",
});

