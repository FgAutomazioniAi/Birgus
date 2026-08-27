import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AiProviderSettingsController } from "./ai-provider-settings.controller.js";
import { MailProviderSettingsController } from "./mail-provider-settings.controller.js";
import { VllmRuntimeController } from "./vllm-runtime.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [AiProviderSettingsController, MailProviderSettingsController, VllmRuntimeController],
})
export class SettingsNestModule {}
