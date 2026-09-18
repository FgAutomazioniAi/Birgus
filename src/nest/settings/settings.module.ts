import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AuditNestModule } from "../audit/audit.module.js";
import { AiProviderSettingsController } from "./ai-provider-settings.controller.js";
import { MailProviderSettingsController } from "./mail-provider-settings.controller.js";
import { VllmRuntimeController } from "./vllm-runtime.controller.js";
import { ExternalDatabaseConnectionsController } from "./external-database-connections.controller.js";
import { ExternalDatabasesNestModule } from "../external-databases/external-databases.module.js";

@Module({
  imports: [AuthModule, AuditNestModule, ExternalDatabasesNestModule],
  controllers: [
    AiProviderSettingsController,
    MailProviderSettingsController,
    VllmRuntimeController,
    ExternalDatabaseConnectionsController,
  ],
})
export class SettingsNestModule {}
