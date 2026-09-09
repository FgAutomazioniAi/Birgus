import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { BrainywareController } from "./brainyware.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [BrainywareController],
})
export class BrainywareNestModule {}
