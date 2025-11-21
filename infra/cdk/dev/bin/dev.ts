#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DevEscrowlyStack } from "../dev-stack";

const app = new cdk.App();

new DevEscrowlyStack(app, "dev-escrowly-stack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
