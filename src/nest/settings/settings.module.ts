import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AiProviderSettingsController } from "./ai-provider-settings.controller.js";
import { MailProviderSettingsController } from "./mail-provider-settings.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [AiProviderSettingsController, MailProviderSettingsController],
})
export class SettingsNestModule {}
