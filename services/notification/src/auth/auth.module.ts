import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { AuthService } from "./auth.service";

/**
 * Auth Module
 *
 * Provides AuthService for communicating with Auth service
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000, // 10 second timeout
      maxRedirects: 5,
    }),
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}


