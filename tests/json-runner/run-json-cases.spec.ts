import { test as base, expect } from '@playwright/test';
import { ActionRegistry } from '../../src/core/ActionRegistry';
import { JsonCaseEngine } from '../../src/core/JsonCaseEngine';
import { ProgressTracker } from '../../src/core/ProgressTracker';
import { loadCases } from '../../src/utils/caseLoader';

const test = base.extend<{
  engine: JsonCaseEngine;
}>({
  engine: async ({}, use) => {
    const tracker = new ProgressTracker('test-results/json-runs');
    const registry = new ActionRegistry();
    const engine = new JsonCaseEngine(registry, tracker);
    await use(engine);
    tracker.finishRun();
  },
});

for (const testCase of loadCases('cases/examples')) {
  test(`json case: ${testCase.id}`, async ({ page, engine }) => {
    const result = await engine.runCase(page, testCase);
    expect(result.status).toBe('passed');
  });
}
