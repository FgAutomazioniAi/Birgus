export interface WorkflowGraphNode {
  id: string;
  node_key: string;
  is_enabled: boolean;
  is_required: boolean;
}

export interface WorkflowGraphEdge {
  source_node_id: string;
  target_node_id: string;
  is_enabled: boolean;
  order_no?: number;
  condition_payload: unknown;
}

export type WorkflowConditionEvaluator = (payload: unknown) => boolean;

export class WorkflowGraphPlanner {
  public buildIncomingNodeKeyMap<TNode extends WorkflowGraphNode>(
    nodes: TNode[],
    edges: WorkflowGraphEdge[],
    evaluateCondition: WorkflowConditionEvaluator,
  ): Map<string, string[]> {
    const eligibleNodes = this.filterEligibleNodes(nodes);
    const byId = new Map(eligibleNodes.map((node) => [node.id, node]));
    const incomingByNodeKey = new Map<string, string[]>();

    for (const edge of edges) {
      if (!edge.is_enabled || !evaluateCondition(edge.condition_payload)) {
        continue;
      }
      const source = byId.get(edge.source_node_id);
      const target = byId.get(edge.target_node_id);
      if (!source || !target) {
        continue;
      }
      const current = incomingByNodeKey.get(target.node_key) ?? [];
      current.push(source.node_key);
      incomingByNodeKey.set(target.node_key, current);
    }

    return incomingByNodeKey;
  }

  public buildExecutionOrder<TNode extends WorkflowGraphNode>(
    nodes: TNode[],
    edges: WorkflowGraphEdge[],
    evaluateCondition: WorkflowConditionEvaluator,
  ): TNode[] {
    const eligibleNodes = this.filterEligibleNodes(nodes);
    const eligibleNodeIds = new Set(eligibleNodes.map((node) => node.id));
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const node of eligibleNodes) {
      incoming.set(node.id, 0);
      outgoing.set(node.id, []);
    }

    for (const edge of edges) {
      if (!edge.is_enabled) {
        continue;
      }
      if (!eligibleNodeIds.has(edge.source_node_id) || !eligibleNodeIds.has(edge.target_node_id)) {
        continue;
      }
      if (!evaluateCondition(edge.condition_payload)) {
        continue;
      }

      outgoing.get(edge.source_node_id)?.push(edge.target_node_id);
      incoming.set(edge.target_node_id, (incoming.get(edge.target_node_id) ?? 0) + 1);
    }

    const ordered: TNode[] = [];
    const queue = eligibleNodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
    const byId = new Map(eligibleNodes.map((node) => [node.id, node]));

    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      const current = byId.get(currentId);
      if (!current) {
        continue;
      }
      ordered.push(current);
      for (const targetId of outgoing.get(currentId) ?? []) {
        const next = (incoming.get(targetId) ?? 0) - 1;
        incoming.set(targetId, next);
        if (next === 0) {
          queue.push(targetId);
        }
      }
    }

    for (const node of eligibleNodes) {
      if (!ordered.some((item) => item.id === node.id)) {
        ordered.push(node);
      }
    }

    return ordered;
  }

  private filterEligibleNodes<TNode extends WorkflowGraphNode>(nodes: TNode[]): TNode[] {
    return nodes.filter((node) => node.is_enabled || node.is_required);
  }
}
