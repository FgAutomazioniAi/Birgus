import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { ProjectAssetsNestModule } from "../project-assets/project-assets.module.js";
import { NestOrchestratorController } from "./orchestrator.controller.js";

@Module({
  imports: [AuthModule, ProjectAssetsNestModule],
  controllers: [NestOrchestratorController],
})
export class OrchestratorNestModule {}
