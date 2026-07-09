export interface CaseTarget {
  baseUrl?: string;
  entry?: string;
}

export interface CaseStep {
  action: string;
  params: Record<string, unknown>;
}

export interface CaseAssertion {
  type: string;
  selector?: string;
  expected?: unknown;
}

export interface ApiMock {
  url: string;
  method?: string;
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface Case {
  id: string;
  name?: string;
  target?: CaseTarget;
  mocks?: ApiMock[];
  steps: CaseStep[];
  assertions?: CaseAssertion[];
}

export interface StepResult {
  index: number;
  action: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
  screenshot?: string;
}

export interface CaseResult {
  status: 'running' | 'passed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  steps: StepResult[];
  error?: string;
  screenshots: string[];
}
