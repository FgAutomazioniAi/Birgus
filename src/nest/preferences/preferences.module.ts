import { Module } from "@nestjs/common";

import { PrismaUserPreferenceRepository } from "../../modules/preferences/infra/PrismaUserPreferenceRepository.js";
import { UserPreferenceService } from "../../modules/preferences/services/UserPreferenceService.js";
import { AuthModule } from "../auth/auth.module.js";
import { NestPreferencesController } from "./preferences.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [NestPreferencesController],
  providers: [
    {
      provide: UserPreferenceService,
      useFactory: (repository: PrismaUserPreferenceRepository) => new UserPreferenceService(repository),
      inject: [PrismaUserPreferenceRepository],
    },
  ],
})
export class PreferencesNestModule {}
