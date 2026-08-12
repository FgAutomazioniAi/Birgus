import { Module } from "@nestjs/common";

import { NotificationService } from "../../modules/notifications/services/NotificationService.js";
import { PrismaShipmentRepository } from "../../modules/shipping/infra/PrismaShipmentRepository.js";
import { ShipmentService } from "../../modules/shipping/services/ShipmentService.js";
import { AuthModule } from "../auth/auth.module.js";
import { NotificationsNestModule } from "../notifications/notifications.module.js";
import { NestShippingController } from "./shipping.controller.js";

@Module({
  imports: [AuthModule, NotificationsNestModule],
  controllers: [NestShippingController],
  providers: [
    {
      provide: ShipmentService,
      useFactory: (
        repository: PrismaShipmentRepository,
        notificationService: NotificationService,
      ) => new ShipmentService(repository, notificationService),
      inject: [PrismaShipmentRepository, NotificationService],
    },
  ],
  exports: [ShipmentService],
})
export class ShippingNestModule {}
