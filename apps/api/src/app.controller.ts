import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getRoot(): { service: string; status: string } {
    return { service: "lotus-desk-api", status: "ok" };
  }
}
