import { test, expect } from '@playwright/test';
import { ProgressTracker } from '../../src/core/ProgressTracker';
import * as fs from 'fs';
import * as path from 'path';

test('ProgressTracker creates run and saves JSON', () => {
  const tracker = new ProgressTracker('test-results/progress-test');
  const runId = tracker.getRunId();
  expect(runId).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}_[a-f0-9]{8}$/);

  tracker.startCase('login');
  tracker.recordStep('login', { index: 0, action: 'goto', status: 'passed', durationMs: 100 });
  tracker.finishCase('login', { status: 'passed', screenshots: [] });
  const filePath = tracker.finishRun();

  expect(fs.existsSync(filePath)).toBe(true);
  const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  expect(saved.status).toBe('completed');
  expect(saved.summary.passed).toBe(1);
});

test.afterAll(() => {
  // Cleanup test progress dir
  const testDir = 'test-results/progress-test';
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
