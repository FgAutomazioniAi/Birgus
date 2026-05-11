export class ModuleAgentEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly moduleId: number;
  public readonly moduleKey: string;
  public readonly moduleName: string;
  public readonly key: string;
  public readonly name: string;
  public readonly label: string;
  public readonly originalPrompt: string;
  public readonly activePrompt: string;
  public readonly isEnabled: boolean;
  public readonly createdByUserId: string | null;
  public readonly updatedByUserId: string | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    moduleId: number;
    moduleKey: string;
    moduleName: string;
    key: string;
    name: string;
    label: string;
    originalPrompt: string;
    activePrompt: string;
    isEnabled: boolean;
    createdByUserId: string | null;
    updatedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.moduleId = params.moduleId;
    this.moduleKey = params.moduleKey;
    this.moduleName = params.moduleName;
    this.key = params.key;
    this.name = params.name;
    this.label = params.label;
    this.originalPrompt = params.originalPrompt;
    this.activePrompt = params.activePrompt;
    this.isEnabled = params.isEnabled;
    this.createdByUserId = params.createdByUserId;
    this.updatedByUserId = params.updatedByUserId;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}
