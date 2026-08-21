import assert from "node:assert/strict";
import { test } from "node:test";

import { WorkflowGraphPlanner } from "../../src/modules/workflows/services/WorkflowGraphPlanner.js";

test("WorkflowGraphPlanner waits for every incoming branch before planning the merge node", () => {
  const planner = new WorkflowGraphPlanner();
  const nodes = [
    { id: "input-document", node_key: "document", is_enabled: true, is_required: true },
    { id: "input-context", node_key: "context", is_enabled: true, is_required: false },
    { id: "ocr", node_key: "ocr", is_enabled: true, is_required: false },
    { id: "agent", node_key: "agent", is_enabled: true, is_required: false },
    { id: "output", node_key: "output", is_enabled: true, is_required: true },
  ];
  const edges = [
    { source_node_id: "input-document", target_node_id: "ocr", is_enabled: true, condition_payload: null },
    { source_node_id: "ocr", target_node_id: "agent", is_enabled: true, condition_payload: null },
    { source_node_id: "input-context", target_node_id: "agent", is_enabled: true, condition_payload: null },
    { source_node_id: "agent", target_node_id: "output", is_enabled: true, condition_payload: null },
  ];

  const incoming = planner.buildIncomingNodeKeyMap(nodes, edges, () => true);
  const order = planner.buildExecutionOrder(nodes, edges, () => true).map((node) => node.node_key);

  assert.deepEqual(incoming.get("agent"), ["ocr", "context"]);
  assert.ok(order.indexOf("agent") > order.indexOf("ocr"));
  assert.ok(order.indexOf("agent") > order.indexOf("context"));
  assert.deepEqual(order, ["document", "context", "ocr", "agent", "output"]);
});

test("WorkflowGraphPlanner ignores disabled branches but keeps required nodes", () => {
  const planner = new WorkflowGraphPlanner();
  const nodes = [
    { id: "required", node_key: "required", is_enabled: false, is_required: true },
    { id: "disabled", node_key: "disabled", is_enabled: false, is_required: false },
    { id: "output", node_key: "output", is_enabled: true, is_required: true },
  ];
  const edges = [
    { source_node_id: "required", target_node_id: "output", is_enabled: true, condition_payload: null },
    { source_node_id: "disabled", target_node_id: "output", is_enabled: true, condition_payload: null },
  ];

  const order = planner.buildExecutionOrder(nodes, edges, () => true).map((node) => node.node_key);

  assert.deepEqual(order, ["required", "output"]);
});
