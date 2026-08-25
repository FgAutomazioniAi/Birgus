import { Prisma, PrismaClient } from "@prisma/client";

type Arguments = {
  adminEmail: string;
  code: string;
  name: string;
  organizationCode: string;
  templateCode: string;
};

const usage = `Usage: npm run workspace:provision -- --code <code> --name <name> --admin-email <email> [--organization-code birgus] [--template-code main]`;

function readArguments(): Arguments | null {
  const raw = process.argv.slice(2);
  if (raw.includes("--help") || raw.includes("-h")) {
    console.log(usage);
    return null;
  }

  const value = (key: string, fallback?: string): string => {
    const index = raw.indexOf(key);
    const candidate = index >= 0 ? raw[index + 1] : fallback;
    if (!candidate?.trim()) {
      throw new Error(`Missing ${key}.\n${usage}`);
    }
    return candidate.trim();
  };

  const code = value("--code").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(code)) {
    throw new Error("Workspace code must contain only lowercase letters, numbers, and hyphens.");
  }

  return {
    adminEmail: value("--admin-email").toLowerCase(),
    code,
    name: value("--name"),
    organizationCode: value("--organization-code", "birgus").toLowerCase(),
    templateCode: value("--template-code", "main").toLowerCase(),
  };
}

function copyJson(value: Prisma.JsonValue | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

async function main(): Promise<void> {
  const args = readArguments();
  if (!args) {
    return;
  }

  const prisma = new PrismaClient();
  try {
    const [organization, administrator, adminRole] = await Promise.all([
      prisma.organization.findFirst({
        where: { code: args.organizationCode, deleted_at: null },
        select: { id: true, code: true },
      }),
      prisma.user.findFirst({
        where: { email: args.adminEmail, is_active: true, deleted_at: null },
        select: { id: true, email: true },
      }),
      prisma.role.findUnique({ where: { key: "admin" }, select: { id: true } }),
    ]);

    if (!organization) {
      throw new Error(`Organization '${args.organizationCode}' not found.`);
    }
    if (!administrator) {
      throw new Error(`Active user '${args.adminEmail}' not found. Create the user first.`);
    }
    if (!adminRole) {
      throw new Error("System role 'admin' not found. Run the normal database seed first.");
    }

    const template = await prisma.workspace.findFirst({
      where: {
        organization_id: organization.id,
        code: args.templateCode,
        is_active: true,
        deleted_at: null,
      },
      include: {
        workspace_modules: { select: { module_id: true, is_enabled: true } },
        project_statuses: { select: { key: true, label: true } },
        shipment_statuses: { select: { key: true, label: true } },
        project_revisions: { select: { code: true } },
        module_agents: {
          where: { deleted_at: null },
          select: { id: true, module_id: true, key: true, name: true, label: true, original_prompt: true, active_prompt: true, is_enabled: true },
        },
        module_tools: {
          where: { deleted_at: null },
          select: { id: true, module_id: true, key: true, name: true, label: true, description: true, runtime_kind: true, handler_key: true, input_schema: true, output_schema: true, configuration: true, is_enabled: true },
        },
        module_workflows: {
          where: { deleted_at: null },
          select: {
            id: true, module_id: true, key: true, name: true, label: true, description: true, configuration: true, version_no: true, is_enabled: true, is_default: true,
            nodes: { select: { id: true, node_key: true, node_kind: true, label: true, position_x: true, position_y: true, module_agent_id: true, module_tool_id: true, input_kind: true, output_kind: true, configuration: true, input_schema: true, output_schema: true, is_enabled: true, is_required: true } },
            edges: { select: { source_node_id: true, target_node_id: true, source_handle: true, target_handle: true, label: true, condition_payload: true, order_no: true, is_enabled: true } },
          },
        },
      },
    });

    if (!template) {
      throw new Error(`Template workspace '${args.templateCode}' not found in organization '${organization.code}'.`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.workspace.findFirst({
        where: { organization_id: organization.id, code: args.code, deleted_at: null },
        select: { id: true },
      });
      if (existing) {
        throw new Error(`Workspace '${args.code}' already exists (${existing.id}). No changes were made.`);
      }

      const workspace = await tx.workspace.create({
        data: { organization_id: organization.id, code: args.code, name: args.name },
        select: { id: true },
      });

      await tx.workspaceModule.createMany({
        data: template.workspace_modules.map((item) => ({ workspace_id: workspace.id, module_id: item.module_id, is_enabled: item.is_enabled, configured_by_user_id: administrator.id })),
      });
      await tx.projectStatus.createMany({ data: template.project_statuses.map((item) => ({ workspace_id: workspace.id, key: item.key, label: item.label })) });
      await tx.shipmentStatus.createMany({ data: template.shipment_statuses.map((item) => ({ workspace_id: workspace.id, key: item.key, label: item.label })) });
      await tx.projectRevision.createMany({ data: template.project_revisions.map((item) => ({ workspace_id: workspace.id, code: item.code })) });

      await tx.workspaceMembership.create({ data: { workspace_id: workspace.id, user_id: administrator.id, status: "ACTIVE" } });
      await tx.userWorkspaceRole.create({ data: { workspace_id: workspace.id, user_id: administrator.id, role_id: adminRole.id } });
      await tx.userPreference.create({ data: { workspace_id: workspace.id, user_id: administrator.id, palette_id: "predefinito", language_code: "it" } });

      const agentIdMap = new Map<string, string>();
      for (const agent of template.module_agents) {
        const created = await tx.moduleAgent.create({
          data: {
            workspace_id: workspace.id, module_id: agent.module_id, key: agent.key, name: agent.name, label: agent.label,
            original_prompt: agent.original_prompt, active_prompt: agent.active_prompt, is_enabled: agent.is_enabled,
            created_by_user_id: administrator.id, updated_by_user_id: administrator.id,
          },
          select: { id: true },
        });
        agentIdMap.set(agent.id, created.id);
      }

      const toolIdMap = new Map<string, string>();
      for (const tool of template.module_tools) {
        const created = await tx.moduleTool.create({
          data: {
            workspace_id: workspace.id, module_id: tool.module_id, key: tool.key, name: tool.name, label: tool.label,
            description: tool.description, runtime_kind: tool.runtime_kind, handler_key: tool.handler_key,
            input_schema: copyJson(tool.input_schema), output_schema: copyJson(tool.output_schema), configuration: copyJson(tool.configuration),
            is_enabled: tool.is_enabled, created_by_user_id: administrator.id, updated_by_user_id: administrator.id,
          },
          select: { id: true },
        });
        toolIdMap.set(tool.id, created.id);
      }

      for (const workflow of template.module_workflows) {
        const createdWorkflow = await tx.moduleWorkflow.create({
          data: {
            workspace_id: workspace.id, module_id: workflow.module_id, key: workflow.key, name: workflow.name, label: workflow.label,
            description: workflow.description, configuration: copyJson(workflow.configuration), version_no: workflow.version_no,
            is_enabled: workflow.is_enabled, is_default: workflow.is_default, created_by_user_id: administrator.id, updated_by_user_id: administrator.id,
          },
          select: { id: true },
        });

        const nodeIdMap = new Map<string, string>();
        for (const node of workflow.nodes) {
          const createdNode = await tx.moduleWorkflowNode.create({
            data: {
              workspace_id: workspace.id, workflow_id: createdWorkflow.id, node_key: node.node_key, node_kind: node.node_kind, label: node.label,
              position_x: node.position_x, position_y: node.position_y, module_agent_id: node.module_agent_id ? agentIdMap.get(node.module_agent_id) ?? null : null,
              module_tool_id: node.module_tool_id ? toolIdMap.get(node.module_tool_id) ?? null : null, input_kind: node.input_kind, output_kind: node.output_kind,
              configuration: copyJson(node.configuration), input_schema: copyJson(node.input_schema), output_schema: copyJson(node.output_schema),
              is_enabled: node.is_enabled, is_required: node.is_required,
            },
            select: { id: true },
          });
          nodeIdMap.set(node.id, createdNode.id);
        }

        await tx.moduleWorkflowEdge.createMany({
          data: workflow.edges.map((edge) => ({
            workspace_id: workspace.id, workflow_id: createdWorkflow.id,
            source_node_id: nodeIdMap.get(edge.source_node_id)!, target_node_id: nodeIdMap.get(edge.target_node_id)!,
            source_handle: edge.source_handle, target_handle: edge.target_handle, label: edge.label,
            condition_payload: copyJson(edge.condition_payload), order_no: edge.order_no, is_enabled: edge.is_enabled,
          })),
        });
      }

      return { id: workspace.id, modules: template.workspace_modules.length, workflows: template.module_workflows.length };
    });

    console.log(JSON.stringify({ workspace: { id: result.id, code: args.code, name: args.name }, administrator: administrator.email, template: args.templateCode, modules: result.modules, workflows: result.workflows }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
