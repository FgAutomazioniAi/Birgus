import { Module } from "@nestjs/common";

import { OperationsInsightService } from "../../modules/operations/services/OperationsInsightService.js";
import { AuthModule } from "../auth/auth.module.js";
import { OperationsController } from "./operations.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [OperationsController],
  providers: [OperationsInsightService],
})
export class OperationsNestModule {}
