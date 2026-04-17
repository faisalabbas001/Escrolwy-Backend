import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
/**
 * EC2 Stack for Escrowly Backend Services
 *
 * Creates:
 * - VPC with public subnet
 * - EC2 instance with Docker & Docker Compose
 * - Security group allowing BFF access (port 3001)
 * - IAM role for S3 access
 *
 * Does NOT touch existing resources (KMS, S3, Secrets Manager)
 */
export declare class Ec2EscrowlyStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps);
}
