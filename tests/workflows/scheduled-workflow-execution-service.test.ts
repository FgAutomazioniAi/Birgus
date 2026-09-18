import assert from "node:assert/strict";
import test from "node:test";

import { ScheduledWorkflowExecutionService } from "../../src/modules/workflows/services/ScheduledWorkflowExecutionService.js";

test("ScheduledWorkflowExecutionService advances past missed occurrences after downtime", () => {
  const service = new ScheduledWorkflowExecutionService(
    {} as never,
  ) as unknown as {
    nextRunAfter: (
      previous: Date,
      repeatEverySeconds: number,
      now: Date,
    ) => Date;
  };

  const next = service.nextRunAfter(
    new Date("2026-09-17T08:00:00.000Z"),
    3_600,
    new Date("2026-09-17T11:15:00.000Z"),
  );

  assert.equal(next.toISOString(), "2026-09-17T12:00:00.000Z");
});
