import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowRuleEngine } from "../../src/modules/workflows/services/WorkflowRuleEngine.js";

test("WorkflowRuleEngine validates deterministic field, numeric and regex rules", () => {
  const engine = new WorkflowRuleEngine();
  const result = engine.evaluate([
    { path: "email", operator: "regex", value: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    { path: "amount", operator: "between", min: 100, max: 500 },
    { path: "subject", operator: "not_empty" },
  ], {
    email: "operations@example.test",
    amount: 250,
    subject: "Offerta aggiornata",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.violations, []);
});

test("WorkflowRuleEngine reports violations and supports all/any/not groups", () => {
  const engine = new WorkflowRuleEngine();
  const result = engine.evaluate([
    {
      all: [
        { path: "recipient", operator: "not_empty" },
        { any: [
          { path: "priority", operator: "equals", value: "high" },
          { path: "amount", operator: "greater_than", value: 1000 },
        ] },
      ],
    },
    { not: { path: "body", operator: "regex", value: "\\{\\{[^}]+\\}\\}" } },
  ], {
    recipient: "",
    priority: "normal",
    amount: 50,
    body: "Gentile {{cliente}}",
  });

  assert.equal(result.valid, false);
  assert.equal(result.violations.length, 3);
  assert.equal(result.violations[0]?.operator, "not_empty");
  assert.equal(result.violations[2]?.operator, "not");
});
