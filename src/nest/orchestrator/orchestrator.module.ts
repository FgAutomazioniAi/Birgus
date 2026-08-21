import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { ProjectAssetsNestModule } from "../project-assets/project-assets.module.js";
import { WorkflowsNestModule } from "../workflows/workflows.module.js";
import { NestOrchestratorController } from "./orchestrator.controller.js";

@Module({
  imports: [AuthModule, ProjectAssetsNestModule, WorkflowsNestModule],
  controllers: [NestOrchestratorController],
})
export class OrchestratorNestModule {}
