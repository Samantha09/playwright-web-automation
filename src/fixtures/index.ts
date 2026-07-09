import { test as base } from '@playwright/test';
import { ActionRegistry } from '../core/ActionRegistry';
import { JsonCaseEngine } from '../core/JsonCaseEngine';
import { ProgressTracker } from '../core/ProgressTracker';

export type TestFixtures = {
  registry: ActionRegistry;
  tracker: ProgressTracker;
  engine: JsonCaseEngine;
};

export const test = base.extend<TestFixtures>({
  registry: async ({}, use) => {
    await use(new ActionRegistry());
  },
  tracker: async ({}, use) => {
    await use(new ProgressTracker('test-results/fixture-runs'));
  },
  engine: async ({ registry, tracker }, use) => {
    const engine = new JsonCaseEngine(registry, tracker);
    await use(engine);
    tracker.finishRun();
  },
});

export { expect } from '@playwright/test';
