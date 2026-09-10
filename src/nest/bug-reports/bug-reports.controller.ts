import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { BugReportService } from "../../modules/bug-reports/services/BugReportService.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { PrismaService } from "../prisma/prisma.service.js";

const reportSchema = z.object({ title: z.string().trim().min(3).max(160), description: z.string().trim().min(10).max(10_000), pageUrl: z.string().trim().max(2_000).optional() });

@Controller("/api/bug-reports")
@UseGuards(RequestContextAuthGuard)
export class BugReportsController {
  public constructor(@Inject(BugReportService) private readonly service: BugReportService, @Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post()
  public async submit(@Body() body: unknown, @CurrentRequestContext() context: RequestContext) {
    const data = reportSchema.parse(body);
    const [user, workspace] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: context.workspace.userId }, select: { first_name: true, last_name: true, email: true } }),
      this.prisma.workspace.findUniqueOrThrow({ where: { id: context.workspace.workspaceId }, select: { name: true } }),
    ]);
    await this.service.submit({ title: data.title, description: data.description, pageUrl: data.pageUrl ?? "", userName: [user.first_name, user.last_name].filter(Boolean).join(" "), userEmail: user.email, workspaceName: workspace.name });
    return { ok: true };
  }
}
