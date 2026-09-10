import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { BrainyWorkspaceAgentService } from "../../modules/brainyware/services/BrainyWorkspaceAgentService.js";
import { BrainyChatService } from "../../modules/brainyware/services/BrainyChatService.js";
import { BrainyWorkspaceDatabaseConnectionService } from "../../modules/brainyware/services/BrainyWorkspaceDatabaseConnectionService.js";
import { BrainyChatsController } from "./brainy-chats.controller.js";
import { BrainyWorkspaceAgentsController } from "./brainy-workspace-agents.controller.js";
import { BrainywareController } from "./brainyware.controller.js";
import { BrainyWorkspaceDatabaseConnectionsController } from "./brainy-workspace-database-connections.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [BrainywareController, BrainyWorkspaceAgentsController, BrainyWorkspaceDatabaseConnectionsController, BrainyChatsController],
  providers: [BrainyWorkspaceAgentService, BrainyWorkspaceDatabaseConnectionService, BrainyChatService],
})
export class BrainywareNestModule {}
