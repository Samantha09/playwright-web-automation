import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { CaseResult } from '../types/case';

export interface ProgressRun {
  runId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  summary: { total: number; passed: number; failed: number; skipped: number };
  cases: Record<string, CaseResult>;
}

export class ProgressTracker {
  private run: ProgressRun;
  private outputDir: string;

  constructor(outputDir = 'data/runs') {
    this.outputDir = outputDir;
    const now = new Date();
    const datePart = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
    const runId = `${datePart}_${randomUUID().slice(0, 8)}`;
    this.run = {
      runId,
      startedAt: now.toISOString(),
      status: 'running',
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      cases: {},
    };
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  getRunId(): string {
    return this.run.runId;
  }

  startCase(caseId: string): void {
    this.run.cases[caseId] = {
      status: 'running',
      startedAt: new Date().toISOString(),
      steps: [],
      screenshots: [],
    };
  }

  recordStep(caseId: string, stepResult: CaseResult['steps'][number]): void {
    const caseResult = this.run.cases[caseId];
    if (!caseResult) return;
    caseResult.steps.push(stepResult);
  }

  finishCase(caseId: string, result: Partial<CaseResult>): void {
    const caseResult = this.run.cases[caseId];
    if (!caseResult) return;
    caseResult.status = result.status || 'failed';
    caseResult.completedAt = new Date().toISOString();
    caseResult.error = result.error;
    caseResult.screenshots = result.screenshots || caseResult.screenshots || [];
    this.updateSummary();
  }

  finishRun(status: 'completed' | 'failed' = 'completed'): string {
    this.run.status = status;
    this.run.completedAt = new Date().toISOString();
    return this.save();
  }

  save(): string {
    const filePath = path.join(this.outputDir, `${this.run.runId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(this.run, null, 2), 'utf-8');
    return filePath;
  }

  getRun(): ProgressRun {
    return this.run;
  }

  private updateSummary(): void {
    const cases = Object.values(this.run.cases);
    this.run.summary = {
      total: cases.length,
      passed: cases.filter((c) => c.status === 'passed').length,
      failed: cases.filter((c) => c.status === 'failed').length,
      skipped: cases.filter((c) => c.status === 'skipped').length,
    };
  }
}
