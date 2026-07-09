import type {
  Reporter,
  FullResult,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { ProgressTracker } from '../core/ProgressTracker';

export class ProgressReporter implements Reporter {
  private tracker = new ProgressTracker();

  onTestBegin(test: TestCase): void {
    this.tracker.startCase(test.id);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const status = result.status === 'passed' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed';
    this.tracker.finishCase(test.id, {
      status,
      error: result.error?.message,
      screenshots: result.attachments.filter((a) => a.name === 'screenshot').map((a) => a.path || ''),
    });
  }

  onEnd(result: FullResult): void {
    this.tracker.finishRun(result.status === 'passed' ? 'completed' : 'failed');
  }
}
