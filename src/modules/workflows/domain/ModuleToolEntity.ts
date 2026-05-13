export class ModuleToolEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly moduleKey: string;
  public readonly key: string;
  public readonly name: string;
  public readonly label: string;
  public readonly description: string | null;
  public readonly runtimeKind: string;
  public readonly handlerKey: string;
  public readonly inputSchema: unknown | null;
  public readonly outputSchema: unknown | null;
  public readonly configuration: unknown | null;
  public readonly isEnabled: boolean;
  public readonly updatedAt: Date;

  public constructor(params: {
    id: string;
    workspaceId: string;
    moduleKey: string;
    key: string;
    name: string;
    label: string;
    description?: string | null;
    runtimeKind: string;
    handlerKey: string;
    inputSchema?: unknown | null;
    outputSchema?: unknown | null;
    configuration?: unknown | null;
    isEnabled: boolean;
    updatedAt: Date;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.moduleKey = params.moduleKey;
    this.key = params.key;
    this.name = params.name;
    this.label = params.label;
    this.description = params.description ?? null;
    this.runtimeKind = params.runtimeKind;
    this.handlerKey = params.handlerKey;
    this.inputSchema = params.inputSchema ?? null;
    this.outputSchema = params.outputSchema ?? null;
    this.configuration = params.configuration ?? null;
    this.isEnabled = params.isEnabled;
    this.updatedAt = params.updatedAt;
  }
}
