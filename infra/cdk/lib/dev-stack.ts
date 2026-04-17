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
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // dev only
      autoDeleteObjects: true,
    });

    // --------------------------------------------------
    // AURORA SERVERLESS V2 - COMMENTED OUT (using local PostgreSQL)
    // Uncomment when deploying to stage/prod
    // --------------------------------------------------
    /*
    const vpc = new ec2.Vpc(this, `${prefix}-vpc`, {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ],
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, `${prefix}-db-sg`, {
      vpc,
      allowAllOutbound: true,
    });

    dbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      "Allow Postgres access for dev"
    );

    const auroraCluster = new rds.DatabaseCluster(this, `${prefix}-aurora`, {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_13,
      }),
      writer: rds.ClusterInstance.serverlessV2(`${prefix}-writer`, {
        publiclyAccessible: true,
        autoMinorVersionUpgrade: true,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 1,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [dbSecurityGroup],
      defaultDatabaseName: "escrowly",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    auroraCluster.addRotationSingleUser();

    const dbSecret = auroraCluster.secret!;
    const dbHost = auroraCluster.clusterEndpoint.hostname;
    const dbPort = auroraCluster.clusterEndpoint.port;
    const dbName = "escrowly";
    */

    // --------------------------------------------------
    // OUTPUTS - Infra
    // --------------------------------------------------
    new cdk.CfnOutput(this, `${prefix}-bucket-arn`, {
      value: filesBucket.bucketArn,
    });

    new cdk.CfnOutput(this, `${prefix}-kms-key-arn`, {
      value: kmsKey.keyArn,
    });

    new cdk.CfnOutput(this, `${prefix}-app-secrets-arn`, {
      value: appSecret.secretArn,
    });

    // Aurora outputs commented out - using local PostgreSQL
    /*
    new cdk.CfnOutput(this, `${prefix}-db-host`, { value: dbHost });
    new cdk.CfnOutput(this, `${prefix}-db-port`, { value: dbPort.toString() });
    new cdk.CfnOutput(this, `${prefix}-db-name`, { value: dbName });
    new cdk.CfnOutput(this, `${prefix}-db-secret-arn`, { value: dbSecret.secretArn });
    
    const services = ["auth", "wallet", "ledger", "escrow", "inquiry", "compliance", "admin", "reporting", "notification", "landing"];
    services.forEach((svc) => {
      new cdk.CfnOutput(this, `${prefix}-${svc}-db-url`, {
        value: `postgresql://USERNAME:PASSWORD@${dbHost}:${dbPort}/escrowly?schema=${svc}_db`,
      });
    });
    */

    new cdk.CfnOutput(this, `${prefix}-setup-instructions`, {
      value: "S3 and KMS deployed. Using local PostgreSQL for development.",
    });
  }
}
