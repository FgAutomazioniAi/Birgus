import { Module } from "@nestjs/common";

import { PrismaNotificationRepository } from "../../modules/notifications/infra/PrismaNotificationRepository.js";
import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { AuthModule } from "../auth/auth.module.js";
import { NestNotificationsController } from "./notifications.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [NestNotificationsController],
  providers: [
    {
      provide: NotificationService,
      useFactory: (repository: PrismaNotificationRepository) => new NotificationService(repository),
      inject: [PrismaNotificationRepository],
    },
  ],
  exports: [NotificationService],
})
export class NotificationsNestModule {}
