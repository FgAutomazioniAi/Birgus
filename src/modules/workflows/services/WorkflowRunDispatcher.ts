export interface WorkflowRunDispatcher {
  dispatch(runId: string): Promise<void>;
}
