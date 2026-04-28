import { WorkspaceContext } from "./WorkspaceContext.js";

export class RequestContext {
  public readonly workspace: WorkspaceContext;
  public readonly sessionId: string;
  public readonly token: string;

  public constructor(params: {
    workspace: WorkspaceContext;
    sessionId: string;
    token: string;
  }) {
    this.workspace = params.workspace;
    this.sessionId = params.sessionId;
    this.token = params.token;
  }
}
