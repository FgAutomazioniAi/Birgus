import { PrismaClientManager } from "../src/database/PrismaClientManager.js";
import { DEFAULT_MODULE_AGENT_PROMPTS } from "../src/modules/agents/domain/DefaultModuleAgentPrompts.js";

async function main(): Promise<void> {
  const prisma = PrismaClientManager.getClient();

  const [modules, workspaces, adminUser] = await Promise.all([
    prisma.module.findMany({
      where: {
        key: {
          in: DEFAULT_MODULE_AGENT_PROMPTS.map((item) => item.moduleKey),
        },
        is_active: true,
      },
      select: {
        id: true,
        key: true,
      },
    }),
    prisma.workspace.findMany({
      where: {
        deleted_at: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: {
        created_at: "asc",
      },
    }),
    prisma.user.findFirst({
      where: {
        email: "superuser@birgus.it",
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!adminUser) {
    throw new Error("Utente superuser@birgus.it non trovato.");
  }

  const moduleIdByKey = new Map(modules.map((item) => [item.key, item.id]));
  for (const prompt of DEFAULT_MODULE_AGENT_PROMPTS) {
    if (!moduleIdByKey.has(prompt.moduleKey)) {
      throw new Error(`Modulo ${prompt.moduleKey} non trovato o non attivo.`);
    }
  }

  const summary: Array<{
    workspaceName: string;
    moduleKey: string;
    agentKey: string;
    action: "created" | "updated";
  }> = [];

  for (const workspace of workspaces) {
    for (const prompt of DEFAULT_MODULE_AGENT_PROMPTS) {
      const moduleId = moduleIdByKey.get(prompt.moduleKey);
      if (!moduleId) {
        continue;
      }

      const existing = await prisma.moduleAgent.findFirst({
        where: {
          workspace_id: workspace.id,
          module_id: moduleId,
          key: prompt.agentKey,
        },
        select: {
          id: true,
          active_prompt: true,
        },
      });

      if (existing) {
        await prisma.moduleAgent.update({
          where: {
            id: existing.id,
          },
          data: {
            name: prompt.name,
            label: prompt.label,
            original_prompt: prompt.originalPrompt,
            active_prompt: existing.active_prompt?.trim() ? existing.active_prompt : prompt.originalPrompt,
            is_enabled: true,
            updated_by_user_id: adminUser.id,
            deleted_at: null,
          },
        });

        summary.push({
          workspaceName: workspace.name,
          moduleKey: prompt.moduleKey,
          agentKey: prompt.agentKey,
          action: "updated",
        });
        continue;
      }

      await prisma.moduleAgent.create({
        data: {
          workspace_id: workspace.id,
          module_id: moduleId,
          key: prompt.agentKey,
          name: prompt.name,
          label: prompt.label,
          original_prompt: prompt.originalPrompt,
          active_prompt: prompt.originalPrompt,
          is_enabled: true,
          created_by_user_id: adminUser.id,
          updated_by_user_id: adminUser.id,
        },
      });

      summary.push({
        workspaceName: workspace.name,
        moduleKey: prompt.moduleKey,
        agentKey: prompt.agentKey,
        action: "created",
      });
    }
  }

  console.log("Module agent prompts synchronized:");
  for (const item of summary) {
    console.log(`- [${item.action}] ${item.workspaceName} :: ${item.moduleKey} :: ${item.agentKey}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const prisma = PrismaClientManager.getClient();
    await prisma.$disconnect();
  });
