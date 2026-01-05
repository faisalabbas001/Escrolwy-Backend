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
exports.Ec2EscrowlyStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
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
class Ec2EscrowlyStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const envName = "dev";
        const prefix = `${envName}-escrowly-ec2`;
        // --------------------------------------------------
        // VPC - Simple public subnet setup
        // --------------------------------------------------
        const vpc = new ec2.Vpc(this, `${prefix}-vpc`, {
            maxAzs: 1,
            natGateways: 0,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: "public",
                    subnetType: ec2.SubnetType.PUBLIC,
                },
            ],
        });
        // --------------------------------------------------
        // SECURITY GROUP
        // --------------------------------------------------
        const securityGroup = new ec2.SecurityGroup(this, `${prefix}-sg`, {
            vpc,
            description: "Security group for Escrowly backend services",
            allowAllOutbound: true,
        });
        // Allow SSH (for debugging - can be removed in production)
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), "Allow SSH access");
        // Allow BFF service (main entry point for frontend)
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3001), "Allow BFF service access from frontend");
        // Allow HTTP/HTTPS (for future nginx/ALB setup)
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow HTTP");
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Allow HTTPS");
        // --------------------------------------------------
        // IAM ROLE for EC2 (S3 access for image uploads)
        // --------------------------------------------------
        const role = new iam.Role(this, `${prefix}-role`, {
            assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
            description: "IAM role for Escrowly EC2 instance",
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
            ],
        });
        // Add S3 access for the existing bucket
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket",
            ],
            resources: [
                "arn:aws:s3:::dev-escrowly-stack-devescrowlyfilesd7d0fc74-nlzj6dxdllaf",
                "arn:aws:s3:::dev-escrowly-stack-devescrowlyfilesd7d0fc74-nlzj6dxdllaf/*",
            ],
        }));
        // --------------------------------------------------
        // EC2 INSTANCE
        // --------------------------------------------------
        const userData = ec2.UserData.forLinux();
        userData.addCommands(
        // Update system
        "yum update -y", 
        // Install Docker
        "yum install -y docker", "systemctl start docker", "systemctl enable docker", "usermod -aG docker ec2-user", 
        // Install Docker Compose
        'curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose', "chmod +x /usr/local/bin/docker-compose", 
        // Install Git
        "yum install -y git", 
        // Create app directory
        "mkdir -p /home/ec2-user/app", "chown ec2-user:ec2-user /home/ec2-user/app", 
        // Signal that setup is complete
        "echo 'EC2 setup complete!' > /home/ec2-user/setup-complete.txt");
        const instance = new ec2.Instance(this, `${prefix}-instance`, {
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM // 2 vCPU, 4 GB RAM - Production ready
            ),
            machineImage: ec2.MachineImage.latestAmazonLinux2023(),
            securityGroup,
            role,
            userData,
            keyName: "escrowly-key", // EC2 Key Pair for SSH access
            blockDevices: [
                {
                    deviceName: "/dev/xvda",
                    volume: ec2.BlockDeviceVolume.ebs(30, {
                        volumeType: ec2.EbsDeviceVolumeType.GP3,
                        encrypted: true,
                    }),
                },
            ],
        });
        // --------------------------------------------------
        // ELASTIC IP (Static public IP)
        // --------------------------------------------------
        const eip = new ec2.CfnEIP(this, `${prefix}-eip`, {
            instanceId: instance.instanceId,
        });
        // --------------------------------------------------
        // OUTPUTS
        // --------------------------------------------------
        new cdk.CfnOutput(this, "InstanceId", {
            value: instance.instanceId,
            description: "EC2 Instance ID",
        });
        new cdk.CfnOutput(this, "PublicIP", {
            value: eip.attrPublicIp,
            description: "EC2 Public IP (Elastic IP)",
        });
        new cdk.CfnOutput(this, "BFFEndpoint", {
            value: `http://${eip.attrPublicIp}:3001`,
            description: "BFF Service Endpoint (for frontend)",
        });
        new cdk.CfnOutput(this, "SSHCommand", {
            value: `ssh -i <your-key.pem> ec2-user@${eip.attrPublicIp}`,
            description: "SSH command to connect to instance",
        });
        new cdk.CfnOutput(this, "DeployInstructions", {
            value: `
1. SSH into instance: ssh -i <key.pem> ec2-user@${eip.attrPublicIp}
2. Clone repo: git clone <repo-url> ~/app/escrowly
3. cd ~/app/escrowly/escrowly-backend
4. cp .env.example .env && nano .env
5. docker-compose build && docker-compose up -d
      `.trim(),
            description: "Deployment instructions",
        });
    }
}
exports.Ec2EscrowlyStack = Ec2EscrowlyStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWMyLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWMyLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQyx5REFBMkM7QUFDM0MseURBQTJDO0FBRTNDOzs7Ozs7Ozs7O0dBVUc7QUFDSCxNQUFhLGdCQUFpQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzdDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLE1BQU0sTUFBTSxHQUFHLEdBQUcsT0FBTyxlQUFlLENBQUM7UUFFekMscURBQXFEO1FBQ3JELG1DQUFtQztRQUNuQyxxREFBcUQ7UUFDckQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLE1BQU0sTUFBTSxFQUFFO1lBQzdDLE1BQU0sRUFBRSxDQUFDO1lBQ1QsV0FBVyxFQUFFLENBQUM7WUFDZCxtQkFBbUIsRUFBRTtnQkFDbkI7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTTtpQkFDbEM7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILHFEQUFxRDtRQUNyRCxpQkFBaUI7UUFDakIscURBQXFEO1FBQ3JELE1BQU0sYUFBYSxHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxNQUFNLEtBQUssRUFBRTtZQUNoRSxHQUFHO1lBQ0gsV0FBVyxFQUFFLDhDQUE4QztZQUMzRCxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILDJEQUEyRDtRQUMzRCxhQUFhLENBQUMsY0FB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QUM1QyxLQUFLLEVBQUU7a0RBQ3FDLEdBQUcsQ0FBQyxZQUFZOzs7OztPQUszRCxDQUFDLElBQUksRUFBRTtZQUNSLFdBQVcsRUFBRSx5QkFBeUI7U0FDdkMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBcExELDRDQW9MQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiYXdzLWNkay1saWJcIjtcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSBcImNvbnN0cnVjdHNcIjtcclxuaW1wb3J0ICogYXMgZWMyIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZWMyXCI7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWlhbVwiO1xyXG5cclxuLyoqXHJcbiAqIEVDMiBTdGFjayBmb3IgRXNjcm93bHkgQmFja2VuZCBTZXJ2aWNlc1xyXG4gKlxyXG4gKiBDcmVhdGVzOlxyXG4gKiAtIFZQQyB3aXRoIHB1YmxpYyBzdWJuZXRcclxuICogLSBFQzIgaW5zdGFuY2Ugd2l0aCBEb2NrZXIgJiBEb2NrZXIgQ29tcG9zZVxyXG4gKiAtIFNlY3VyaXR5IGdyb3VwIGFsbG93aW5nIEJGRiBhY2Nlc3MgKHBvcnQgMzAwMSlcclxuICogLSBJQU0gcm9sZSBmb3IgUzMgYWNjZXNzXHJcbiAqXHJcbiAqIERvZXMgTk9UIHRvdWNoIGV4aXN0aW5nIHJlc291cmNlcyAoS01TLCBTMywgU2VjcmV0cyBNYW5hZ2VyKVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEVjMkVzY3Jvd2x5U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIGNvbnN0IGVudk5hbWUgPSBcImRldlwiO1xyXG4gICAgY29uc3QgcHJlZml4ID0gYCR7ZW52TmFtZX0tZXNjcm93bHktZWMyYDtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gVlBDIC0gU2ltcGxlIHB1YmxpYyBzdWJuZXQgc2V0dXBcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCBgJHtwcmVmaXh9LXZwY2AsIHtcclxuICAgICAgbWF4QXpzOiAxLFxyXG4gICAgICBuYXRHYXRld2F5czogMCxcclxuICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcclxuICAgICAgICAgIG5hbWU6IFwicHVibGljXCIsXHJcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBTRUNVUklUWSBHUk9VUFxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIGNvbnN0IHNlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgYCR7cHJlZml4fS1zZ2AsIHtcclxuICAgICAgdnBjLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJTZWN1cml0eSBncm91cCBmb3IgRXNjcm93bHkgYmFja2VuZCBzZXJ2aWNlc1wiLFxyXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQWxsb3cgU1NIIChmb3IgZGVidWdnaW5nIC0gY2FuIGJlIHJlbW92ZWQgaW4gcHJvZHVjdGlvbilcclxuICAgIHNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXHJcbiAgICAgIGVjMi5QZWVyLmFueUlwdjQoKSxcclxuICAgICAgZWMyLlBvcnQudGNwKDIyKSxcclxuICAgICAgXCJBbGxvdyBTU0ggYWNjZXNzXCJcclxuICAgICk7XHJcblxyXG4gICAgLy8gQWxsb3cgQkZGIHNlcnZpY2UgKG1haW4gZW50cnkgcG9pbnQgZm9yIGZyb250ZW5kKVxyXG4gICAgc2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcclxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxyXG4gICAgICBlYzIuUG9ydC50Y3AoMzAwMSksXHJcbiAgICAgIFwiQWxsb3cgQkZGIHNlcnZpY2UgYWNjZXNzIGZyb20gZnJvbnRlbmRcIlxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBBbGxvdyBIVFRQL0hUVFBTIChmb3IgZnV0dXJlIG5naW54L0FMQiBzZXR1cClcclxuICAgIHNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXHJcbiAgICAgIGVjMi5QZWVyLmFueUlwdjQoKSxcclxuICAgICAgZWMyLlBvcnQudGNwKDgwKSxcclxuICAgICAgXCJBbGxvdyBIVFRQXCJcclxuICAgICk7XHJcbiAgICBzZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxyXG4gICAgICBlYzIuUGVlci5hbnlJcHY0KCksXHJcbiAgICAgIGVjMi5Qb3J0LnRjcCg0NDMpLFxyXG4gICAgICBcIkFsbG93IEhUVFBTXCJcclxuICAgICk7XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgIC8vIElBTSBST0xFIGZvciBFQzIgKFMzIGFjY2VzcyBmb3IgaW1hZ2UgdXBsb2FkcylcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBjb25zdCByb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIGAke3ByZWZpeH0tcm9sZWAsIHtcclxuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJlYzIuYW1hem9uYXdzLmNvbVwiKSxcclxuICAgICAgZGVzY3JpcHRpb246IFwiSUFNIHJvbGUgZm9yIEVzY3Jvd2x5IEVDMiBpbnN0YW5jZVwiLFxyXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcclxuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXHJcbiAgICAgICAgICBcIkFtYXpvblNTTU1hbmFnZWRJbnN0YW5jZUNvcmVcIlxyXG4gICAgICAgICksXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBZGQgUzMgYWNjZXNzIGZvciB0aGUgZXhpc3RpbmcgYnVja2V0XHJcbiAgICByb2xlLmFkZFRvUG9saWN5KFxyXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgIFwiczM6R2V0T2JqZWN0XCIsXHJcbiAgICAgICAgICBcInMzOlB1dE9iamVjdFwiLFxyXG4gICAgICAgICAgXCJzMzpEZWxldGVPYmplY3RcIixcclxuICAgICAgICAgIFwiczM6TGlzdEJ1Y2tldFwiLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgcmVzb3VyY2VzOiBbXHJcbiAgICAgICAgICBcImFybjphd3M6czM6OjpkZXYtZXNjcm93bHktc3RhY2stZGV2ZXNjcm93bHlmaWxlc2Q3ZDBmYzc0LW5semo2ZHhkbGxhZlwiLFxyXG4gICAgICAgICAgXCJhcm46YXdzOnMzOjo6ZGV2LWVzY3Jvd2x5LXN0YWNrLWRldmVzY3Jvd2x5ZmlsZXNkN2QwZmM3NC1ubHpqNmR4ZGxsYWYvKlwiLFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBFQzIgSU5TVEFOQ0VcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBjb25zdCB1c2VyRGF0YSA9IGVjMi5Vc2VyRGF0YS5mb3JMaW51eCgpO1xyXG4gICAgdXNlckRhdGEuYWRkQ29tbWFuZHMoXHJcbiAgICAgIC8vIFVwZGF0ZSBzeXN0ZW1cclxuICAgICAgXCJ5dW0gdXBkYXRlIC15XCIsXHJcblxyXG4gICAgICAvLyBJbnN0YWxsIERvY2tlclxyXG4gICAgICBcInl1bSBpbnN0YWxsIC15IGRvY2tlclwiLFxyXG4gICAgICBcInN5c3RlbWN0bCBzdGFydCBkb2NrZXJcIixcclxuICAgICAgXCJzeXN0ZW1jdGwgZW5hYmxlIGRvY2tlclwiLFxyXG4gICAgICBcInVzZXJtb2QgLWFHIGRvY2tlciBlYzItdXNlclwiLFxyXG5cclxuICAgICAgLy8gSW5zdGFsbCBEb2NrZXIgQ29tcG9zZVxyXG4gICAgICAnY3VybCAtTCBcImh0dHBzOi8vZ2l0aHViLmNvbS9kb2NrZXIvY29tcG9zZS9yZWxlYXNlcy9sYXRlc3QvZG93bmxvYWQvZG9ja2VyLWNvbXBvc2UtJCh1bmFtZSAtcyktJCh1bmFtZSAtbSlcIiAtbyAvdXNyL2xvY2FsL2Jpbi9kb2NrZXItY29tcG9zZScsXHJcbiAgICAgIFwiY2htb2QgK3ggL3Vzci9sb2NhbC9iaW4vZG9ja2VyLWNvbXBvc2VcIixcclxuXHJcbiAgICAgIC8vIEluc3RhbGwgR2l0XHJcbiAgICAgIFwieXVtIGluc3RhbGwgLXkgZ2l0XCIsXHJcblxyXG4gICAgICAvLyBDcmVhdGUgYXBwIGRpcmVjdG9yeVxyXG4gICAgICBcIm1rZGlyIC1wIC9ob21lL2VjMi11c2VyL2FwcFwiLFxyXG4gICAgICBcImNob3duIGVjMi11c2VyOmVjMi11c2VyIC9ob21lL2VjMi11c2VyL2FwcFwiLFxyXG5cclxuICAgICAgLy8gU2lnbmFsIHRoYXQgc2V0dXAgaXMgY29tcGxldGVcclxuICAgICAgXCJlY2hvICdFQzIgc2V0dXAgY29tcGxldGUhJyA+IC9ob21lL2VjMi11c2VyL3NldHVwLWNvbXBsZXRlLnR4dFwiXHJcbiAgICApO1xyXG5cclxuICAgIGNvbnN0IGluc3RhbmNlID0gbmV3IGVjMi5JbnN0YW5jZSh0aGlzLCBgJHtwcmVmaXh9LWluc3RhbmNlYCwge1xyXG4gICAgICB2cGMsXHJcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDIH0sXHJcbiAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihcclxuICAgICAgICBlYzIuSW5zdGFuY2VDbGFzcy5UMyxcclxuICAgICAgICBlYzIuSW5zdGFuY2VTaXplLk1FRElVTSAvLyAyIHZDUFUsIDQgR0IgUkFNIC0gUHJvZHVjdGlvbiByZWFkeVxyXG4gICAgICApLFxyXG4gICAgICBtYWNoaW5lSW1hZ2U6IGVjMi5NYWNoaW5lSW1hZ2UubGF0ZXN0QW1hem9uTGludXgyMDIzKCksXHJcbiAgICAgIHNlY3VyaXR5R3JvdXAsXHJcbiAgICAgIHJvbGUsXHJcbiAgICAgIHVzZXJEYXRhLFxyXG4gICAgICBrZXlOYW1lOiBcImVzY3Jvd2x5LWtleVwiLCAvLyBFQzIgS2V5IFBhaXIgZm9yIFNTSCBhY2Nlc3NcclxuICAgICAgYmxvY2tEZXZpY2VzOiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgZGV2aWNlTmFtZTogXCIvZGV2L3h2ZGFcIixcclxuICAgICAgICAgIHZvbHVtZTogZWMyLkJsb2NrRGV2aWNlVm9sdW1lLmVicygzMCwge1xyXG4gICAgICAgICAgICB2b2x1bWVUeXBlOiBlYzIuRWJzRGV2aWNlVm9sdW1lVHlwZS5HUDMsXHJcbiAgICAgICAgICAgIGVuY3J5cHRlZDogdHJ1ZSxcclxuICAgICAgICAgIH0pLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gRUxBU1RJQyBJUCAoU3RhdGljIHB1YmxpYyBJUClcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICBjb25zdCBlaXAgPSBuZXcgZWMyLkNmbkVJUCh0aGlzLCBgJHtwcmVmaXh9LWVpcGAsIHtcclxuICAgICAgaW5zdGFuY2VJZDogaW5zdGFuY2UuaW5zdGFuY2VJZCxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBPVVRQVVRTXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJJbnN0YW5jZUlkXCIsIHtcclxuICAgICAgdmFsdWU6IGluc3RhbmNlLmluc3RhbmNlSWQsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkVDMiBJbnN0YW5jZSBJRFwiLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJQdWJsaWNJUFwiLCB7XHJcbiAgICAgIHZhbHVlOiBlaXAuYXR0clB1YmxpY0lwLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJFQzIgUHVibGljIElQIChFbGFzdGljIElQKVwiLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJCRkZFbmRwb2ludFwiLCB7XHJcbiAgICAgIHZhbHVlOiBgaHR0cDovLyR7ZWlwLmF0dHJQdWJsaWNJcH06MzAwMWAsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkJGRiBTZXJ2aWNlIEVuZHBvaW50IChmb3IgZnJvbnRlbmQpXCIsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCBcIlNTSENvbW1hbmRcIiwge1xyXG4gICAgICB2YWx1ZTogYHNzaCAtaSA8eW91ci1rZXkucGVtPiBlYzItdXNlckAke2VpcC5hdHRyUHVibGljSXB9YCxcclxuICAgICAgZGVzY3JpcHRpb246IFwiU1NIIGNvbW1hbmQgdG8gY29ubmVjdCB0byBpbnN0YW5jZVwiLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgXCJEZXBsb3lJbnN0cnVjdGlvbnNcIiwge1xyXG4gICAgICB2YWx1ZTogYFxyXG4xLiBTU0ggaW50byBpbnN0YW5jZTogc3NoIC1pIDxrZXkucGVtPiBlYzItdXNlckAke2VpcC5hdHRyUHVibGljSXB9XHJcbjIuIENsb25lIHJlcG86IGdpdCBjbG9uZSA8cmVwby11cmw+IH4vYXBwL2VzY3Jvd2x5XHJcbjMuIGNkIH4vYXBwL2VzY3Jvd2x5L2VzY3Jvd2x5LWJhY2tlbmRcclxuNC4gY3AgLmVudi5leGFtcGxlIC5lbnYgJiYgbmFubyAuZW52XHJcbjUuIGRvY2tlci1jb21wb3NlIGJ1aWxkICYmIGRvY2tlci1jb21wb3NlIHVwIC1kXHJcbiAgICAgIGAudHJpbSgpLFxyXG4gICAgICBkZXNjcmlwdGlvbjogXCJEZXBsb3ltZW50IGluc3RydWN0aW9uc1wiLFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==