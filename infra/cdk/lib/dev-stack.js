"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevEscrowlyStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
class DevEscrowlyStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.DevEscrowlyStack = DevEscrowlyStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGV2LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQywrRUFBaUU7QUFDakUsdURBQXlDO0FBQ3pDLHlEQUEyQztBQUkzQyxNQUFhLGdCQUFpQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzdDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLE1BQU0sTUFBTSxHQUFHLEdBQUcsT0FBTyxXQUFXLENBQUM7UUFFckMscURBQXFEO1FBQ3JELFVBQVU7UUFDVixxREFBcUQ7UUFDckQsTUFBTSxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLE1BQU0sVUFBVSxFQUFFO1lBQ3BELEtBQUssRUFBRSxHQUFHLE1BQU0sVUFBVTtZQUMxQixpQkFBaUIsRUFBRSxJQUFJO1NBQ3hCLENBQUMsQ0FBQztRQUVILHFEQUFxRDtRQUNyRCxrQkFBa0I7UUFDbEIscURBQXFEO1FBQ3JELE1BQU0sU0FBUyxHQUFHLElBQUksY0FBYyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsR0FBRyxNQUFNLGNBQWMsRUFBRTtZQUN6RSxVQUFVLEVBQUUsR0FBRyxNQUFNLGNBQWM7WUFDbkMsb0JBQW9CLEVBQUU7Z0JBQ3BCLG9CQUFvQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7b0JBQ25DLFVBQVUsRUFBRSxtQkFBbUI7aUJBQ2hDLENBQUM7Z0JBQ0YsaUJBQWlCLEVBQUUsWUFBWTthQUNoQztTQUNGLENBQUMsQ0FBQztRQUVILHFEQUFxRDtRQUNyRCxZQUFZO1FBQ1oscURBQXFEO1FBQ3JELE1BQU0sV0FBVyxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsR0FBRyxNQUFNLFFBQVEsRUFBRTtZQUN6RCxVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLEdBQUc7WUFDbkMsYUFBYSxFQUFFLE1BQU07WUFDckIsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLFdBQVc7WUFDckQsaUJBQWlCLEVBQUUsSUFBSTtTQUN4QixDQUFDLENBQUM7UUFFSCxxREFBcUQ7UUFDckQsZ0VBQWdFO1FBQ2hFLHlDQUF5QztRQUN6QyxxREFBcUQ7UUFDckQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O1VBK0NFO1FBRUYscURBQXFEO1FBQ3JELGtCQUFrQjtRQUNsQixxREFBcUQ7UUFDckQsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxHQUFHLE1BQU0sYUFBYSxFQUFFO1lBQzlDLEtBQUssRUFBRSxXQUFXLENBQUMsU0FBUztTQUM3QixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLEdBQUcsTUFBTSxjQUFjLEVBQUU7WUFDL0MsS0FBSyxFQUFFLE1BQU0sQ0FBQyxNQUFNO1NBQ3JCLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxNQUFNLGtCQUFrQixFQUFFO1lBQ25ELEtBQUssRUFBRSxTQUFTLENBQUMsU0FBUztTQUMzQixDQUFDLENBQUM7UUFFSCx3REFBd0Q7UUFDeEQ7Ozs7Ozs7Ozs7OztVQVlFO1FBRUYsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxHQUFHLE1BQU0scUJBQXFCLEVBQUU7WUFDdEQsS0FBSyxFQUFFLDhEQUE4RDtTQUN0RSxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE5SEQsNENBOEhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gXCJhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXJcIjtcbmltcG9ydCAqIGFzIHMzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtczNcIjtcbmltcG9ydCAqIGFzIGttcyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWttc1wiO1xuaW1wb3J0ICogYXMgcmRzIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtcmRzXCI7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1lYzJcIjtcblxuZXhwb3J0IGNsYXNzIERldkVzY3Jvd2x5U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBlbnZOYW1lID0gXCJkZXZcIjtcbiAgICBjb25zdCBwcmVmaXggPSBgJHtlbnZOYW1lfS1lc2Nyb3dseWA7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEtNUyBLRVlcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IGttc0tleSA9IG5ldyBrbXMuS2V5KHRoaXMsIGAke3ByZWZpeH0ta21zLWtleWAsIHtcbiAgICAgIGFsaWFzOiBgJHtwcmVmaXh9LWttcy1rZXlgLFxuICAgICAgZW5hYmxlS2V5Um90YXRpb246IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFNFQ1JFVFMgTUFOQUdFUlxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgYXBwU2VjcmV0ID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCBgJHtwcmVmaXh9LWFwcC1zZWNyZXRzYCwge1xuICAgICAgc2VjcmV0TmFtZTogYCR7cHJlZml4fS1hcHAtc2VjcmV0c2AsXG4gICAgICBnZW5lcmF0ZVNlY3JldFN0cmluZzoge1xuICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIEpXVF9TRUNSRVQ6IFwiY2hhbmdlLW1lLWluLXByb2RcIixcbiAgICAgICAgfSksXG4gICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiBcIkFQUF9TRUNSRVRcIixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFMzIEJVQ0tFVFxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgZmlsZXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIGAke3ByZWZpeH0tZmlsZXNgLCB7XG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLktNUyxcbiAgICAgIGVuY3J5cHRpb25LZXk6IGttc0tleSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBkZXYgb25seVxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEFVUk9SQSBTRVJWRVJMRVNTIFYyIC0gQ09NTUVOVEVEIE9VVCAodXNpbmcgbG9jYWwgUG9zdGdyZVNRTClcbiAgICAvLyBVbmNvbW1lbnQgd2hlbiBkZXBsb3lpbmcgdG8gc3RhZ2UvcHJvZFxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLypcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCBgJHtwcmVmaXh9LXZwY2AsIHtcbiAgICAgIG1heEF6czogMixcbiAgICAgIG5hdEdhdGV3YXlzOiAwLFxuICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6IFwicHVibGljXCIsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICB9XG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGJTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsIGAke3ByZWZpeH0tZGItc2dgLCB7XG4gICAgICB2cGMsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgZGJTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgZWMyLlBvcnQudGNwKDU0MzIpLFxuICAgICAgXCJBbGxvdyBQb3N0Z3JlcyBhY2Nlc3MgZm9yIGRldlwiXG4gICAgKTtcblxuICAgIGNvbnN0IGF1cm9yYUNsdXN0ZXIgPSBuZXcgcmRzLkRhdGFiYXNlQ2x1c3Rlcih0aGlzLCBgJHtwcmVmaXh9LWF1cm9yYWAsIHtcbiAgICAgIGVuZ2luZTogcmRzLkRhdGFiYXNlQ2x1c3RlckVuZ2luZS5hdXJvcmFQb3N0Z3Jlcyh7XG4gICAgICAgIHZlcnNpb246IHJkcy5BdXJvcmFQb3N0Z3Jlc0VuZ2luZVZlcnNpb24uVkVSXzE1XzEzLFxuICAgICAgfSksXG4gICAgICB3cml0ZXI6IHJkcy5DbHVzdGVySW5zdGFuY2Uuc2VydmVybGVzc1YyKGAke3ByZWZpeH0td3JpdGVyYCwge1xuICAgICAgICBwdWJsaWNseUFjY2Vzc2libGU6IHRydWUsXG4gICAgICAgIGF1dG9NaW5vclZlcnNpb25VcGdyYWRlOiB0cnVlLFxuICAgICAgfSksXG4gICAgICBzZXJ2ZXJsZXNzVjJNaW5DYXBhY2l0eTogMC41LFxuICAgICAgc2VydmVybGVzc1YyTWF4Q2FwYWNpdHk6IDEsXG4gICAgICB2cGMsXG4gICAgICB2cGNTdWJuZXRzOiB7IHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBVQkxJQyB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtkYlNlY3VyaXR5R3JvdXBdLFxuICAgICAgZGVmYXVsdERhdGFiYXNlTmFtZTogXCJlc2Nyb3dseVwiLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIGF1cm9yYUNsdXN0ZXIuYWRkUm90YXRpb25TaW5nbGVVc2VyKCk7XG5cbiAgICBjb25zdCBkYlNlY3JldCA9IGF1cm9yYUNsdXN0ZXIuc2VjcmV0ITtcbiAgICBjb25zdCBkYkhvc3QgPSBhdXJvcmFDbHVzdGVyLmNsdXN0ZXJFbmRwb2ludC5ob3N0bmFtZTtcbiAgICBjb25zdCBkYlBvcnQgPSBhdXJvcmFDbHVzdGVyLmNsdXN0ZXJFbmRwb2ludC5wb3J0O1xuICAgIGNvbnN0IGRiTmFtZSA9IFwiZXNjcm93bHlcIjtcbiAgICAqL1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBPVVRQVVRTIC0gSW5mcmFcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGAke3ByZWZpeH0tYnVja2V0LWFybmAsIHtcbiAgICAgIHZhbHVlOiBmaWxlc0J1Y2tldC5idWNrZXRBcm4sXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgJHtwcmVmaXh9LWttcy1rZXktYXJuYCwge1xuICAgICAgdmFsdWU6IGttc0tleS5rZXlBcm4sXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgJHtwcmVmaXh9LWFwcC1zZWNyZXRzLWFybmAsIHtcbiAgICAgIHZhbHVlOiBhcHBTZWNyZXQuc2VjcmV0QXJuLFxuICAgIH0pO1xuXG4gICAgLy8gQXVyb3JhIG91dHB1dHMgY29tbWVudGVkIG91dCAtIHVzaW5nIGxvY2FsIFBvc3RncmVTUUxcbiAgICAvKlxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGAke3ByZWZpeH0tZGItaG9zdGAsIHsgdmFsdWU6IGRiSG9zdCB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgJHtwcmVmaXh9LWRiLXBvcnRgLCB7IHZhbHVlOiBkYlBvcnQudG9TdHJpbmcoKSB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBgJHtwcmVmaXh9LWRiLW5hbWVgLCB7IHZhbHVlOiBkYk5hbWUgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYCR7cHJlZml4fS1kYi1zZWNyZXQtYXJuYCwgeyB2YWx1ZTogZGJTZWNyZXQuc2VjcmV0QXJuIH0pO1xuICAgIFxuICAgIGNvbnN0IHNlcnZpY2VzID0gW1wiYXV0aFwiLCBcIndhbGxldFwiLCBcImxlZGdlclwiLCBcImVzY3Jvd1wiLCBcImlucXVpcnlcIiwgXCJjb21wbGlhbmNlXCIsIFwiYWRtaW5cIiwgXCJyZXBvcnRpbmdcIiwgXCJub3RpZmljYXRpb25cIiwgXCJsYW5kaW5nXCJdO1xuICAgIHNlcnZpY2VzLmZvckVhY2goKHN2YykgPT4ge1xuICAgICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgYCR7cHJlZml4fS0ke3N2Y30tZGItdXJsYCwge1xuICAgICAgICB2YWx1ZTogYHBvc3RncmVzcWw6Ly9VU0VSTkFNRTpQQVNTV09SREAke2RiSG9zdH06JHtkYlBvcnR9L2VzY3Jvd2x5P3NjaGVtYT0ke3N2Y31fZGJgLFxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgKi9cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsIGAke3ByZWZpeH0tc2V0dXAtaW5zdHJ1Y3Rpb25zYCwge1xuICAgICAgdmFsdWU6IFwiUzMgYW5kIEtNUyBkZXBsb3llZC4gVXNpbmcgbG9jYWwgUG9zdGdyZVNRTCBmb3IgZGV2ZWxvcG1lbnQuXCIsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==