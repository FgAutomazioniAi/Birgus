import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { BugReportService } from "../../modules/bug-reports/services/BugReportService.js";
import { BugReportsController } from "./bug-reports.controller.js";

@Module({ imports: [AuthModule], controllers: [BugReportsController], providers: [BugReportService] })
export class BugReportsNestModule {}
