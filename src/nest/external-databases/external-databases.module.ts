import { Module } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service.js";
import { ExternalDatabaseConnectionService } from "../../modules/external-databases/services/ExternalDatabaseConnectionService.js";
import { ExternalDatabaseCredentialCipherService } from "../../modules/external-databases/services/ExternalDatabaseCredentialCipherService.js";

@Module({
  providers: [
    ExternalDatabaseConnectionService,
    {
      provide: ExternalDatabaseCredentialCipherService,
      useFactory: (config: AppConfigService) =>
        new ExternalDatabaseCredentialCipherService(
          config.getString(
            "AUTH_TOTP_ENCRYPTION_KEY",
            config.getString("AUTH_PEPPER", ""),
          ),
        ),
      inject: [AppConfigService],
    },
  ],
  exports: [ExternalDatabaseConnectionService],
})
export class ExternalDatabasesNestModule {}
