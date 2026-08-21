import { Module } from "@nestjs/common";

import { ConnectedAppsService } from "../../modules/connected-apps/services/ConnectedAppsService.js";
import { TelegramLinkPollingService } from "../../modules/connected-apps/services/TelegramLinkPollingService.js";
import { AuthModule } from "../auth/auth.module.js";
import { ConnectedAppsController } from "./connected-apps.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [ConnectedAppsController],
  providers: [ConnectedAppsService, TelegramLinkPollingService],
  exports: [ConnectedAppsService, TelegramLinkPollingService],
})
export class ConnectedAppsNestModule {}
