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
const dev_stack_1 = require("../lib/dev-stack");
const app = new cdk.App();
// Get AWS account and region from environment or use defaults
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || "us-east-1";
if (!account) {
    console.error("❌ Error: AWS Account ID not found!");
    console.error("Set CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID environment variable");
    console.error("Or run: aws configure");
    process.exit(1);
}
new dev_stack_1.DevEscrowlyStack(app, "dev-escrowly-stack", {
    env: {
        account: account,
        region: region,
    },
    description: "Escrowly Dev Environment - Aurora, S3, KMS (Minimal Cost)",
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGV2LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLGlEQUFtQztBQUNuQyxnREFBb0Q7QUFFcEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsOERBQThEO0FBQzlELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUM7QUFDOUUsTUFBTSxNQUFNLEdBQ1YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxXQUFXLENBQUM7QUFFMUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO0lBQ3BELE9BQU8sQ0FBQyxLQUFLLENBQ1gsZ0VBQWdFLENBQ2pFLENBQUM7SUFDRixPQUFPLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFDdkMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsQixDQUFDO0FBRUQsSUFBSSw0QkFBZ0IsQ0FBQyxHQUFHLEVBQUUsb0JBQW9CLEVBQUU7SUFDOUMsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU87UUFDaEIsTUFBTSxFQUFFLE1BQU07S0FDZjtJQUNELFdBQVcsRUFBRSwyREFBMkQ7Q0FDekUsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0IHsgRGV2RXNjcm93bHlTdGFjayB9IGZyb20gXCIuLi9saWIvZGV2LXN0YWNrXCI7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIEdldCBBV1MgYWNjb3VudCBhbmQgcmVnaW9uIGZyb20gZW52aXJvbm1lbnQgb3IgdXNlIGRlZmF1bHRzXG5jb25zdCBhY2NvdW50ID0gcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCB8fCBwcm9jZXNzLmVudi5BV1NfQUNDT1VOVF9JRDtcbmNvbnN0IHJlZ2lvbiA9XG4gIHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCBwcm9jZXNzLmVudi5BV1NfUkVHSU9OIHx8IFwidXMtZWFzdC0xXCI7XG5cbmlmICghYWNjb3VudCkge1xuICBjb25zb2xlLmVycm9yKFwi4p2MIEVycm9yOiBBV1MgQWNjb3VudCBJRCBub3QgZm91bmQhXCIpO1xuICBjb25zb2xlLmVycm9yKFxuICAgIFwiU2V0IENES19ERUZBVUxUX0FDQ09VTlQgb3IgQVdTX0FDQ09VTlRfSUQgZW52aXJvbm1lbnQgdmFyaWFibGVcIlxuICApO1xuICBjb25zb2xlLmVycm9yKFwiT3IgcnVuOiBhd3MgY29uZmlndXJlXCIpO1xuICBwcm9jZXNzLmV4aXQoMSk7XG59XG4gICAgICAgICAgICAgICAgICBcbm5ldyBEZXZFc2Nyb3dseVN0YWNrKGFwcCwgXCJkZXYtZXNjcm93bHktc3RhY2tcIiwge1xuICBlbnY6IHtcbiAgICBhY2NvdW50OiBhY2NvdW50LFxuICAgIHJlZ2lvbjogcmVnaW9uLFxuICB9LFxuICBkZXNjcmlwdGlvbjogXCJFc2Nyb3dseSBEZXYgRW52aXJvbm1lbnQgLSBBdXJvcmEsIFMzLCBLTVMgKE1pbmltYWwgQ29zdClcIixcbn0pO1xuIl19