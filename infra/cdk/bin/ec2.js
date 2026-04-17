#!/usr/bin/env node
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
const cdk = __importStar(require("aws-cdk-lib"));
const ec2_stack_1 = require("../lib/ec2-stack");
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
new ec2_stack_1.Ec2EscrowlyStack(app, "escrowly-ec2-stack", {
    env: {
        account: account,
        region: region,
    },
    description: "Escrowly EC2 Backend Services - Docker Compose deployment",
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWMyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWMyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLGlEQUFtQztBQUNuQyxnREFBb0Q7QUFFcEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsOERBQThEO0FBQzlELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUM7QUFDOUUsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxXQUFXLENBQUM7QUFFdkYsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO0lBQ3BELE9BQU8sQ0FBQyxLQUFLLENBQUMsZ0VBQWdFLENBQUMsQ0FBQztJQUNoRixPQUFPLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFDdkMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsQixDQUFDO0FBRUQsOEJBQThCO0FBQzlCLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDbkMsT0FBTyxDQUFDLElBQUksQ0FBQyxzRUFBc0UsQ0FBQyxDQUFDO0lBQ3JGLE9BQU8sQ0FBQyxJQUFJLENBQUMsa0VBQWtFLENBQUMsQ0FBQztBQUNuRixDQUFDO0FBRUQsSUFBSSw0QkFBZ0IsQ0FBQyxHQUFHLEVBQUUsb0JBQW9CLEVBQUU7SUFDOUMsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU87UUFDaEIsTUFBTSxFQUFFLE1BQU07S0FDZjtJQUNELFdBQVcsRUFBRSwyREFBMkQ7Q0FDekUsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxyXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSBcImF3cy1jZGstbGliXCI7XHJcbmltcG9ydCB7IEVjMkVzY3Jvd2x5U3RhY2sgfSBmcm9tIFwiLi4vbGliL2VjMi1zdGFja1wiO1xyXG5cclxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcclxuXHJcbi8vIEdldCBBV1MgYWNjb3VudCBhbmQgcmVnaW9uIGZyb20gZW52aXJvbm1lbnQgb3IgdXNlIGRlZmF1bHRzXHJcbmNvbnN0IGFjY291bnQgPSBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5UIHx8IHByb2Nlc3MuZW52LkFXU19BQ0NPVU5UX0lEO1xyXG5jb25zdCByZWdpb24gPSBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTiB8fCBcInVzLXdlc3QtMlwiO1xyXG5cclxuaWYgKCFhY2NvdW50KSB7XHJcbiAgY29uc29sZS5lcnJvcihcIuKdjCBFcnJvcjogQVdTIEFjY291bnQgSUQgbm90IGZvdW5kIVwiKTtcclxuICBjb25zb2xlLmVycm9yKFwiU2V0IENES19ERUZBVUxUX0FDQ09VTlQgb3IgQVdTX0FDQ09VTlRfSUQgZW52aXJvbm1lbnQgdmFyaWFibGVcIik7XHJcbiAgY29uc29sZS5lcnJvcihcIk9yIHJ1bjogYXdzIGNvbmZpZ3VyZVwiKTtcclxuICBwcm9jZXNzLmV4aXQoMSk7XHJcbn1cclxuXHJcbi8vIENoZWNrIGZvciBFQzIga2V5IHBhaXIgbmFtZVxyXG5pZiAoIXByb2Nlc3MuZW52LkVDMl9LRVlfUEFJUl9OQU1FKSB7XHJcbiAgY29uc29sZS53YXJuKFwi4pqg77iPICBXYXJuaW5nOiBFQzJfS0VZX1BBSVJfTkFNRSBub3Qgc2V0LiBTU0ggYWNjZXNzIHdpbGwgYmUgZGlzYWJsZWQuXCIpO1xyXG4gIGNvbnNvbGUud2FybihcIlNldCBFQzJfS0VZX1BBSVJfTkFNRSBlbnZpcm9ubWVudCB2YXJpYWJsZSB0byBlbmFibGUgU1NIIGFjY2Vzcy5cIik7XHJcbn1cclxuXHJcbm5ldyBFYzJFc2Nyb3dseVN0YWNrKGFwcCwgXCJlc2Nyb3dseS1lYzItc3RhY2tcIiwge1xyXG4gIGVudjoge1xyXG4gICAgYWNjb3VudDogYWNjb3VudCxcclxuICAgIHJlZ2lvbjogcmVnaW9uLFxyXG4gIH0sXHJcbiAgZGVzY3JpcHRpb246IFwiRXNjcm93bHkgRUMyIEJhY2tlbmQgU2VydmljZXMgLSBEb2NrZXIgQ29tcG9zZSBkZXBsb3ltZW50XCIsXHJcbn0pO1xyXG5cclxuIl19