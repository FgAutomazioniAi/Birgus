import { createHash } from "node:crypto";

export const INSTALLATION_PROFILE_SCHEMA_VERSION = 1;

export type InstallationProfile = {
  schema_version: number;
  workspaces: Array<{
    workspace_code: string;
    enabled_modules: string[];
  }>;
  workflow_standard_tool_keys: string[] | null;
};

function configuredWorkflowToolKeys(): string[] | null {
  const values = [...new Set((process.env.WORKFLOW_STANDARD_TOOL_KEYS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean))].sort();
  return values.length > 0 ? values : null;
}

export function createInstallationProfile(workspaces: InstallationProfile["workspaces"]): InstallationProfile {
  return {
    schema_version: INSTALLATION_PROFILE_SCHEMA_VERSION,
    workspaces: workspaces
      .map((workspace) => ({
        workspace_code: workspace.workspace_code.trim().toLowerCase(),
        enabled_modules: [...new Set(workspace.enabled_modules)].sort(),
      }))
      .sort((left, right) => left.workspace_code.localeCompare(right.workspace_code)),
    // null means that every bundled standard workflow tool is enabled.
    workflow_standard_tool_keys: configuredWorkflowToolKeys(),
  };
}

export function hashInstallationProfile(profile: InstallationProfile): string {
  return createHash("sha256").update(JSON.stringify(profile)).digest("hex");
}
