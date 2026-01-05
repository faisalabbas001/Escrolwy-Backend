import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";

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
export class Ec2EscrowlyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH access"
    );

    // Allow BFF service (main entry point for frontend)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3001),
      "Allow BFF service access from frontend"
    );

    // Allow HTTP/HTTPS (for future nginx/ALB setup)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS"
    );

    // --------------------------------------------------
    // IAM ROLE for EC2 (S3 access for image uploads)
    // --------------------------------------------------
    const role = new iam.Role(this, `${prefix}-role`, {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description: "IAM role for Escrowly EC2 instance",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
    });

    // Add S3 access for the existing bucket
    role.addToPolicy(
      new iam.PolicyStatement({
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
      })
    );

    // --------------------------------------------------
    // EC2 INSTANCE
    // --------------------------------------------------
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      // Update system
      "yum update -y",

      // Install Docker
      "yum install -y docker",
      "systemctl start docker",
      "systemctl enable docker",
      "usermod -aG docker ec2-user",

      // Install Docker Compose
      'curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose',
      "chmod +x /usr/local/bin/docker-compose",

      // Install Git
      "yum install -y git",

      // Create app directory
      "mkdir -p /home/ec2-user/app",
      "chown ec2-user:ec2-user /home/ec2-user/app",

      // Signal that setup is complete
      "echo 'EC2 setup complete!' > /home/ec2-user/setup-complete.txt"
    );

    const instance = new ec2.Instance(this, `${prefix}-instance`, {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM // 2 vCPU, 4 GB RAM - Production ready
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
