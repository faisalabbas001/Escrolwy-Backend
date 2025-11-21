import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as kms from "aws-cdk-lib/aws-kms";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export class DevEscrowlyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const envName = "dev";
    const prefix = `${envName}-escrowly`;

    // --------------------------------------------------
    // KMS KEY
    // --------------------------------------------------
    const kmsKey = new kms.Key(this, `${prefix}-kms-key`, {
      alias: `${prefix}-kms-key`,
      enableKeyRotation: true,
    });

    // --------------------------------------------------
    // SECRETS MANAGER
    // --------------------------------------------------
    const appSecret = new secretsmanager.Secret(this, `${prefix}-app-secrets`, {
      secretName: `${prefix}-app-secrets`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          JWT_SECRET: "change-me-in-prod",
        }),
        generateStringKey: "APP_SECRET",
      },
    });

    // --------------------------------------------------
    // S3 BUCKET
    // --------------------------------------------------
    const filesBucket = new s3.Bucket(this, `${prefix}-files`, {
      bucketName: `${prefix}-files`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // ok for dev
      autoDeleteObjects: true,
    });

    // --------------------------------------------------
    // AURORA SERVERLESS V2
    // --------------------------------------------------

    const vpc = new ec2.Vpc(this, `${prefix}-vpc`, {
      maxAzs: 2,
      natGateways: 0,
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, `${prefix}-db-sg`, {
      vpc,
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      "Allow Postgres access for dev",
    );

    const auroraCluster = new rds.DatabaseCluster(this, `${prefix}-aurora`, {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      writer: rds.ClusterInstance.serverlessV2(`${prefix}-writer`, {
        publiclyAccessible: true,
        autoMinorVersionUpgrade: true,
      }),
      serverlessV2MaxCapacity: 1,
      serverlessV2MinCapacity: 0.5,
      vpc,
      securityGroups: [dbSecurityGroup],
      defaultDatabaseName: "escrowly",
    });

    auroraCluster.addRotationSingleUser();

    // OUTPUTS
    new cdk.CfnOutput(this, `${prefix}-bucket-out`, {
      value: filesBucket.bucketArn,
    });

    new cdk.CfnOutput(this, `${prefix}-db-host-out`, {
      value: auroraCluster.clusterEndpoint.hostname,
    });

    new cdk.CfnOutput(this, `${prefix}-secret-out`, {
      value: appSecret.secretArn,
    });
  }
}
