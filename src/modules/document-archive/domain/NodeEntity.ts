export class NodeEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly parentId: string | null;
  public readonly name: string;
  public readonly pathCache: string;
  public readonly depth: number;

  public constructor(params: {
    id: string;
    workspaceId: string;
    parentId: string | null;
    name: string;
    pathCache: string;
    depth: number;
  }) {
    this.id = params.id;
    this.workspaceId = params.workspaceId;
    this.parentId = params.parentId;
    this.name = params.name;
    this.pathCache = params.pathCache;
    this.depth = params.depth;
  }
}
