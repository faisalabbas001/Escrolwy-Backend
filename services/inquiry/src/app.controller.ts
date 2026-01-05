import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AppService } from "./app.service";

/**
 * App Controller
 *
 * Root controller for the Inquiry microservice
 */
@ApiTags("root")
@Controller({
  version: "1",
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Root endpoint
   */
  @Get()
  @ApiOperation({ summary: "Service root endpoint" })
  getHello(): string {
    return this.appService.getHello();
  }
}
