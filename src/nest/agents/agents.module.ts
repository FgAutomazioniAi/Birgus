import { Module } from "@nestjs/common";

import { PrismaModuleAgentRepository } from "../../modules/agents/infra/PrismaModuleAgentRepository.js";
import { ModuleAgentService } from "../../modules/agents/services/ModuleAgentService.js";
import { AuthModule } from "../auth/auth.module.js";
import { NestAgentsController } from "./agents.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [NestAgentsController],
  providers: [
    {
      provide: ModuleAgentService,
      useFactory: (repository: PrismaModuleAgentRepository) => new ModuleAgentService(repository),
      inject: [PrismaModuleAgentRepository],
    },
  ],
  exports: [ModuleAgentService],
})
export class AgentsNestModule {}
