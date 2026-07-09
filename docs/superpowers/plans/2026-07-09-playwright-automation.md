# Playwright Web Automation Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-TOOL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript Playwright framework that can discover interactive elements and APIs on unknown websites, generate candidate JSON test cases, and execute confirmed JSON/TS test cases while writing progress to JSON.

**Architecture:** A CLI-driven discovery pipeline (`DiscoveryEngine` + `HeuristicFinder` + `NetworkRecorder` + `CandidateGenerator`) produces draft test cases under `discovered/`. A separate execution pipeline (`JsonCaseEngine` + `ActionRegistry` + `ProgressTracker`) runs confirmed cases from `cases/` and writes progress to `data/runs/`. Both pipelines share environment config and page abstractions.

**Tech Stack:** TypeScript 5, Node 20 LTS, Playwright Test, npm, ESLint, Prettier.

## Global Constraints

- Node version: `20 LTS`
- Package manager: `npm`
- Language: `TypeScript 5`
- Test runner: `Playwright Test`
- Browsers: `Chromium` only for first version
- No LLM parsing in first version
- `discovered/` candidate cases are never executed automatically
- Progress JSON `runId` format: `YYYY-MM-DD_HH-mm-ss_{8-char-uuid}`
- All data dirs (`discovered/`, `data/`, `test-results/`) are `.gitignore`d
- Frequent commits; each task ends with a working, testable deliverable

---

## File Structure

```
playwright-web-automation/
├── src/
│   ├── core/
│   │   ├── BasePage.ts
│   │   ├── DiscoveryEngine.ts
│   │   ├── HeuristicFinder.ts
│   │   ├── NetworkRecorder.ts
│   │   ├── CandidateGenerator.ts
│   │   ├── JsonCaseEngine.ts
│   │   ├── ProgressTracker.ts
│   │   └── ActionRegistry.ts
│   ├── cli/
│   │   └── discover.ts
│   ├── fixtures/
│   │   └── index.ts
│   ├── reporters/
│   │   └── ProgressReporter.ts
│   ├── types/
│   │   ├── case.ts
│   │   └── discovery.ts
│   ├── utils/
│   │   ├── env.ts
│   │   ├── caseLoader.ts
│   │   └── retry.ts
│   └── index.ts
├── cases/
│   └── examples/
│       ├── login.json
│       ├── crud-task.json
│       └── api-mock.json
├── specs/
│   └── examples/
│       └── sample.spec.ts
├── tests/
│   ├── unit/
│   │   ├── env.spec.ts
│   │   ├── heuristicFinder.spec.ts
│   │   ├── actionRegistry.spec.ts
│   │   ├── candidateGenerator.spec.ts
│   │   └── progressTracker.spec.ts
│   └── integration/
│       └── discover.spec.ts
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── .prettierrc
├── .env.example
├── .gitignore
└── README.md
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `playwright.config.ts`
- Create: `eslint.config.mjs`
- Create: `.prettierrc`
- Create: `.env.example`
- Create: `.gitignore`
- Create: directory tree `src/core`, `src/cli`, `src/fixtures`, `src/reporters`, `src/types`, `src/utils`, `cases/examples`, `specs/examples`, `tests/unit`, `tests/integration`

**Interfaces:**
- Produces: npm scripts `test:ts`, `test:json`, `discover`, `report`, `lint`
- Produces: `playwright.config.ts` exporting standard Playwright config with `cases/**/*.json` ignored from normal Playwright test discovery

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "playwright-web-automation",
  "version": "0.1.0",
  "description": "Generic Playwright automation framework with JSON-driven discovery and execution",
  "private": true,
  "scripts": {
    "build": "tsc --noEmit",
    "lint": "eslint src tests specs",
    "format": "prettier --write \"src/**/*.ts\" \"tests/**/*.ts\" \"specs/**/*.ts\"",
    "discover": "tsx src/cli/discover.ts",
    "test:ts": "playwright test specs",
    "test:json": "playwright test --config=playwright.json.config.ts",
    "test:unit": "playwright test tests/unit",
    "report": "playwright show-report"
  },
  "devDependencies": {
    "@eslint/js": "^9.5.0",
    "@playwright/test": "^1.45.0",
    "@types/node": "^20.14.0",
    "eslint": "^9.5.0",
    "prettier": "^3.3.0",
    "tsx": "^4.15.0",
    "typescript": "^5.5.0",
    "typescript-eslint": "^7.14.0"
  },
  "dependencies": {}
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*", "specs/**/*", "cases/**/*.json"],
  "exclude": ["node_modules", "dist", "test-results", "data", "discovered"]
}
```

- [ ] **Step 3: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
import { env } from './src/utils/env';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: env.BASE_URL,
    trace: env.TRACE ? 'on' : 'on-first-retry',
    video: env.VIDEO ? 'on' : 'off',
    screenshot: env.SCREENSHOT as 'on' | 'off' | 'only-on-failure',
    headless: env.HEADLESS,
    launchOptions: {
      slowMo: env.SLOW_MO,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [ ] **Step 4: Create `playwright.json.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
import { env } from './src/utils/env';

export default defineConfig({
  testDir: './tests/json-runner',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: env.BASE_URL,
    trace: env.TRACE ? 'on' : 'on-first-retry',
    video: env.VIDEO ? 'on' : 'off',
    screenshot: env.SCREENSHOT as 'on' | 'off' | 'only-on-failure',
    headless: env.HEADLESS,
    launchOptions: {
      slowMo: env.SLOW_MO,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [ ] **Step 5: Create `eslint.config.mjs`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  }
);
```

- [ ] **Step 6: Create `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 7: Create `.env.example`**

```bash
BASE_URL=http://127.0.0.1:3000
API_URL=http://127.0.0.1:8000
HEADLESS=true
SLOW_MO=0
TRACE=0
VIDEO=0
SCREENSHOT=only-on-failure
USERNAME=test@example.com
PASSWORD=test123
```

- [ ] **Step 8: Create `.gitignore`**

```gitignore
node_modules/
dist/
test-results/
data/
discovered/
.env
.env.local
*.log
.DS_Store
.vscode/
.idea/
```

- [ ] **Step 9: Create directories**

Run:

```bash
mkdir -p src/core src/cli src/fixtures src/reporters src/types src/utils
mkdir -p cases/examples specs/examples tests/unit tests/integration tests/json-runner
```

- [ ] **Step 10: Install dependencies**

Run:

```bash
npm install
npx playwright install chromium
```

Expected: `node_modules/` exists, `package-lock.json` created.

- [ ] **Step 11: Verify TypeScript compiles**

Run:

```bash
npm run build
```

Expected: no output (success), exit code 0.

- [ ] **Step 12: Commit**

```bash
git add .
git commit -m "chore: scaffold TypeScript Playwright project

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Environment Utilities and Shared Types

**Files:**
- Create: `src/types/case.ts`
- Create: `src/types/discovery.ts`
- Create: `src/utils/env.ts`
- Create: `tests/unit/env.spec.ts`

**Interfaces:**
- Consumes: nothing (foundational)
- Produces: `Case`, `CaseStep`, `CaseAssertion`, `DiscoveredForm`, `DiscoveredApi`, `ProgressRun`, `ProgressCase` types
- Produces: `env` object with typed environment variables

- [ ] **Step 1: Create `src/types/case.ts`**

```ts
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
  status: 'passed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  steps: StepResult[];
  error?: string;
  screenshots: string[];
}
```

- [ ] **Step 2: Create `src/types/discovery.ts`**

```ts
export interface DiscoveredField {
  role: string;
  selector: string;
  label?: string;
  confidence: number;
}

export interface DiscoveredForm {
  id: string;
  pageUrl: string;
  formSelector?: string;
  confidence: number;
  fields: DiscoveredField[];
  submitSelector?: string;
}

export interface DiscoveredApi {
  url: string;
  method: string;
  seenCount: number;
  sampleRequest?: unknown;
  sampleResponse?: unknown;
}

export interface DiscoveredPage {
  url: string;
  title?: string;
  links: string[];
}

export interface CandidateCase {
  id: string;
  name: string;
  confidence: number;
  target: { baseUrl: string; entry: string };
  steps: { action: string; params: Record<string, unknown> }[];
  assertions: { type: string; selector?: string; expected?: unknown }[];
  source: string;
}
```

- [ ] **Step 3: Create `src/utils/env.ts`**

```ts
export const env = {
  BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:3000',
  API_URL: process.env.API_URL || 'http://127.0.0.1:8000',
  HEADLESS: process.env.HEADLESS !== 'false',
  SLOW_MO: Number(process.env.SLOW_MO || 0),
  TRACE: process.env.TRACE === '1',
  VIDEO: process.env.VIDEO === '1',
  SCREENSHOT: process.env.SCREENSHOT || 'only-on-failure',
  USERNAME: process.env.USERNAME || '',
  PASSWORD: process.env.PASSWORD || '',
};
```

- [ ] **Step 4: Create `tests/unit/env.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { env } from '../../src/utils/env';

test('env provides defaults', () => {
  expect(env.BASE_URL).toBe('http://127.0.0.1:3000');
  expect(env.HEADLESS).toBe(true);
  expect(env.SCREENSHOT).toBe('only-on-failure');
});
```

- [ ] **Step 5: Run unit test**

Run:

```bash
npm run test:unit
```

Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add src/types src/utils env.spec.ts
git commit -m "feat: add shared types and environment utilities

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: ActionRegistry

**Files:**
- Create: `src/core/ActionRegistry.ts`
- Create: `tests/unit/actionRegistry.spec.ts`

**Interfaces:**
- Consumes: `Page` from Playwright, `CaseStep` from `src/types/case`
- Produces: `ActionContext`, `ActionHandler`, `ActionRegistry` class with `register(name, handler)` and `execute(name, page, params)`

- [ ] **Step 1: Create `src/core/ActionRegistry.ts`**

```ts
import { Page, Locator } from '@playwright/test';

export interface ActionContext {
  page: Page;
  log: (message: string) => void;
}

export type ActionHandler = (ctx: ActionContext, params: Record<string, unknown>) => Promise<void>;

export class ActionRegistry {
  private actions: Map<string, ActionHandler> = new Map();

  constructor() {
    this.registerBuiltIns();
  }

  register(name: string, handler: ActionHandler): void {
    this.actions.set(name, handler);
  }

  async execute(name: string, ctx: ActionContext, params: Record<string, unknown>): Promise<void> {
    const handler = this.actions.get(name);
    if (!handler) {
      throw new Error(`Unknown action: ${name}`);
    }
    await handler(ctx, params);
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  private registerBuiltIns(): void {
    this.register('goto', async ({ page }, params) => {
      const url = String(params.url);
      await page.goto(url);
    });

    this.register('click', async ({ page }, params) => {
      const selector = String(params.selector);
      await page.locator(selector).click();
    });

    this.register('fill', async ({ page }, params) => {
      const selector = String(params.selector);
      const value = String(params.value);
      await page.locator(selector).fill(value);
    });

    this.register('type', async ({ page }, params) => {
      const selector = String(params.selector);
      const value = String(params.value);
      await page.locator(selector).pressSequentially(value);
    });

    this.register('select', async ({ page }, params) => {
      const selector = String(params.selector);
      const value = String(params.value);
      await page.locator(selector).selectOption(value);
    });

    this.register('hover', async ({ page }, params) => {
      const selector = String(params.selector);
      await page.locator(selector).hover();
    });

    this.register('scroll', async ({ page }, params) => {
      const selector = String(params.selector);
      await page.locator(selector).scrollIntoViewIfNeeded();
    });

    this.register('waitForState', async ({ page }, params) => {
      const selector = String(params.selector);
      const state = String(params.state || 'visible') as 'visible' | 'hidden' | 'attached' | 'detached';
      const timeout = Number(params.timeout || 30000);
      await page.locator(selector).waitFor({ state, timeout });
    });

    this.register('waitForText', async ({ page }, params) => {
      const selector = String(params.selector);
      const text = String(params.text);
      const timeout = Number(params.timeout || 30000);
      await page.locator(selector).filter({ hasText: text }).waitFor({ timeout });
    });

    this.register('screenshot', async ({ page }, params) => {
      const name = String(params.name || 'screenshot');
      await page.screenshot({ path: `test-results/screenshots/${name}.png` });
    });

    this.register('mockApi', async ({ page }, params) => {
      const url = String(params.url);
      const method = String(params.method || 'GET');
      const status = Number(params.status || 200);
      const body = params.body;
      await page.route(url, async (route, request) => {
        if (request.method() === method) {
          await route.fulfill({ status, body: JSON.stringify(body) });
        } else {
          await route.continue();
        }
      });
    });
  }
}
```

- [ ] **Step 2: Create `tests/unit/actionRegistry.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { ActionRegistry } from '../../src/core/ActionRegistry';

test('ActionRegistry has built-in actions', () => {
  const registry = new ActionRegistry();
  expect(registry.has('goto')).toBe(true);
  expect(registry.has('click')).toBe(true);
  expect(registry.has('fill')).toBe(true);
});

test('ActionRegistry supports custom actions', () => {
  const registry = new ActionRegistry();
  registry.register('custom', async () => {});
  expect(registry.has('custom')).toBe(true);
});
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test:unit
```

Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add src/core/ActionRegistry.ts tests/unit/actionRegistry.spec.ts
git commit -m "feat: add ActionRegistry with built-in actions and custom registration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: ProgressTracker

**Files:**
- Create: `src/core/ProgressTracker.ts`
- Create: `tests/unit/progressTracker.spec.ts`

**Interfaces:**
- Consumes: `CaseResult`, `Case` from `src/types/case`
- Produces: `ProgressTracker` class with `startRun()`, `startCase(id)`, `recordStep(...)`, `finishCase(id, result)`, `save()`

- [ ] **Step 1: Create `src/core/ProgressTracker.ts`**

```ts
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

  finishRun(status: 'completed' | 'failed' = 'completed'): void {
    this.run.status = status;
    this.run.completedAt = new Date().toISOString();
    this.save();
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
```

- [ ] **Step 2: Create `tests/unit/progressTracker.spec.ts`**

```ts
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
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test:unit
```

Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add src/core/ProgressTracker.ts tests/unit/progressTracker.spec.ts
git commit -m "feat: add ProgressTracker with JSON persistence

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: JsonCaseEngine and Case Loader

**Files:**
- Create: `src/utils/caseLoader.ts`
- Create: `src/core/JsonCaseEngine.ts`
- Create: `tests/json-runner/run-json-cases.spec.ts`
- Create: `tests/unit/caseLoader.spec.ts`

**Interfaces:**
- Consumes: `Case`, `ActionRegistry`, `ProgressTracker`, `Page`
- Produces: `JsonCaseEngine` class with `runCase(page, case)` returning `CaseResult`
- Produces: `loadCases(dir)` and `substituteEnvVars(obj)` in `caseLoader.ts`

- [ ] **Step 1: Create `src/utils/caseLoader.ts`**

```ts
import * as fs from 'fs';
import * as path from 'path';
import { Case } from '../types/case';

export function substituteEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => process.env[name] || '');
  }
  if (Array.isArray(value)) {
    return value.map(substituteEnvVars);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, substituteEnvVars(v)]),
    );
  }
  return value;
}

export function loadCases(dir: string): Case[] {
  const cases: Case[] = [];
  if (!fs.existsSync(dir)) return cases;

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const parsed = JSON.parse(raw);
    const substituted = substituteEnvVars(parsed);
    if (Array.isArray(substituted)) {
      cases.push(...(substituted as Case[]));
    } else {
      cases.push(substituted as Case);
    }
  }
  return cases;
}
```

- [ ] **Step 2: Create `src/core/JsonCaseEngine.ts`**

```ts
import { Page } from '@playwright/test';
import { Case, CaseResult, StepResult } from '../types/case';
import { ActionRegistry, ActionContext } from './ActionRegistry';
import { ProgressTracker } from './ProgressTracker';

export class JsonCaseEngine {
  constructor(
    private registry: ActionRegistry,
    private tracker: ProgressTracker,
  ) {}

  async runCase(page: Page, testCase: Case): Promise<CaseResult> {
    this.tracker.startCase(testCase.id);
    const screenshots: string[] = [];
    const startedAt = Date.now();

    const ctx: ActionContext = {
      page,
      log: (msg) => console.log(`[${testCase.id}] ${msg}`),
    };

    if (testCase.target?.entry) {
      await page.goto(testCase.target.entry);
    }

    for (const mock of testCase.mocks || []) {
      await page.route(mock.url, async (route, request) => {
        if (mock.method && request.method() !== mock.method) {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: mock.status || 200,
          headers: mock.headers,
          body: mock.body ? JSON.stringify(mock.body) : undefined,
        });
      });
    }

    for (let i = 0; i < testCase.steps.length; i++) {
      const step = testCase.steps[i];
      const stepStarted = Date.now();
      try {
        await this.registry.execute(step.action, ctx, step.params);
        this.tracker.recordStep(testCase.id, {
          index: i,
          action: step.action,
          status: 'passed',
          durationMs: Date.now() - stepStarted,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.tracker.recordStep(testCase.id, {
          index: i,
          action: step.action,
          status: 'failed',
          durationMs: Date.now() - stepStarted,
          error: errorMsg,
        });
        const result: CaseResult = {
          status: 'failed',
          completedAt: new Date().toISOString(),
          steps: this.tracker.getRun().cases[testCase.id].steps,
          error: errorMsg,
          screenshots,
        };
        this.tracker.finishCase(testCase.id, result);
        return result;
      }
    }

    for (const assertion of testCase.assertions || []) {
      try {
        await this.runAssertion(page, assertion);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const result: CaseResult = {
          status: 'failed',
          completedAt: new Date().toISOString(),
          steps: this.tracker.getRun().cases[testCase.id].steps,
          error: `Assertion failed: ${errorMsg}`,
          screenshots,
        };
        this.tracker.finishCase(testCase.id, result);
        return result;
      }
    }

    const result: CaseResult = {
      status: 'passed',
      completedAt: new Date().toISOString(),
      steps: this.tracker.getRun().cases[testCase.id].steps,
      screenshots,
    };
    this.tracker.finishCase(testCase.id, result);
    return result;
  }

  private async runAssertion(
    page: Page,
    assertion: { type: string; selector?: string; expected?: unknown },
  ): Promise<void> {
    switch (assertion.type) {
      case 'visible': {
        if (!assertion.selector) throw new Error('visible assertion requires selector');
        await page.locator(assertion.selector).waitFor({ state: 'visible', timeout: 5000 });
        break;
      }
      case 'notVisible': {
        if (!assertion.selector) throw new Error('notVisible assertion requires selector');
        await page.locator(assertion.selector).waitFor({ state: 'hidden', timeout: 5000 });
        break;
      }
      case 'urlContains': {
        if (!assertion.expected) throw new Error('urlContains assertion requires expected');
        await page.waitForURL(String(assertion.expected), { timeout: 5000 });
        break;
      }
      case 'textContains': {
        if (!assertion.selector || !assertion.expected) {
          throw new Error('textContains assertion requires selector and expected');
        }
        await page
          .locator(assertion.selector)
          .filter({ hasText: String(assertion.expected) })
          .waitFor({ timeout: 5000 });
        break;
      }
      default:
        throw new Error(`Unknown assertion type: ${assertion.type}`);
    }
  }
}
```

- [ ] **Step 3: Create `tests/unit/caseLoader.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { substituteEnvVars } from '../../src/utils/caseLoader';

test('substituteEnvVars replaces placeholders', () => {
  process.env.TEST_VAR = 'hello';
  const result = substituteEnvVars('${TEST_VAR} world');
  expect(result).toBe('hello world');
});
```

- [ ] **Step 4: Create `tests/json-runner/run-json-cases.spec.ts`**

```ts
import { test as base, expect } from '@playwright/test';
import { ActionRegistry } from '../../src/core/ActionRegistry';
import { JsonCaseEngine } from '../../src/core/JsonCaseEngine';
import { ProgressTracker } from '../../src/core/ProgressTracker';
import { loadCases } from '../../src/utils/caseLoader';

const test = base.extend<{
  engine: JsonCaseEngine;
  tracker: ProgressTracker;
}>({
  engine: async ({ page }, use) => {
    const tracker = new ProgressTracker('test-results/json-runs');
    const registry = new ActionRegistry();
    const engine = new JsonCaseEngine(registry, tracker);
    await use(engine);
    tracker.finishRun();
  },
  tracker: async ({ engine }, use) => {
    // tracker is internal to engine fixture; expose via page-level tracking if needed
    await use(new ProgressTracker('test-results/json-runs'));
  },
});

for (const testCase of loadCases('cases/examples')) {
  test(`json case: ${testCase.id}`, async ({ page, engine }) => {
    const result = await engine.runCase(page, testCase);
    expect(result.status).toBe('passed');
  });
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test:unit
npm run test:json
```

Expected: unit tests pass; JSON tests may fail until example cases are created, but the runner infrastructure loads.

- [ ] **Step 6: Commit**

```bash
git add src/utils/caseLoader.ts src/core/JsonCaseEngine.ts tests/unit/caseLoader.spec.ts tests/json-runner/run-json-cases.spec.ts
git commit -m "feat: add JsonCaseEngine and case loader

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: BasePage

**Files:**
- Create: `src/core/BasePage.ts`
- Create: `specs/examples/base-page-demo.spec.ts`

**Interfaces:**
- Consumes: `Page` from Playwright
- Produces: `BasePage` abstract class with common helper methods

- [ ] **Step 1: Create `src/core/BasePage.ts`**

```ts
import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  constructor(
    protected page: Page,
    protected baseUrl: string,
  ) {}

  async goto(path: string): Promise<void> {
    await this.page.goto(`${this.baseUrl}${path}`);
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async screenshot(name: string): Promise<string> {
    const path = `test-results/screenshots/${name}.png`;
    await this.page.screenshot({ path });
    return path;
  }

  async click(selector: string): Promise<void> {
    await this.page.locator(selector).click();
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).fill(value);
  }

  async waitForVisible(selector: string, timeout = 10000): Promise<void> {
    await this.page.locator(selector).waitFor({ state: 'visible', timeout });
  }

  async waitForHidden(selector: string, timeout = 10000): Promise<void> {
    await this.page.locator(selector).waitFor({ state: 'hidden', timeout });
  }

  getLocator(selector: string): Locator {
    return this.page.locator(selector);
  }
}
```

- [ ] **Step 2: Create `specs/examples/base-page-demo.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { BasePage } from '../../src/core/BasePage';

class DemoPage extends BasePage {
  async open(): Promise<void> {
    await this.goto('/');
  }
}

test('BasePage can navigate to base URL', async ({ page }) => {
  const demo = new DemoPage(page, 'https://example.com');
  await demo.open();
  await expect(page).toHaveURL('https://example.com/');
});
```

- [ ] **Step 3: Run test**

Run:

```bash
npx playwright test specs/examples/base-page-demo.spec.ts
```

Expected: 1 passed (external site reachable) or skipped if offline.

- [ ] **Step 4: Commit**

```bash
git add src/core/BasePage.ts specs/examples/base-page-demo.spec.ts
git commit -m "feat: add BasePage abstraction

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: NetworkRecorder

**Files:**
- Create: `src/core/NetworkRecorder.ts`
- Create: `tests/unit/networkRecorder.spec.ts`

**Interfaces:**
- Consumes: `Page` from Playwright
- Produces: `NetworkRecorder` class with `attach(page)`, `getApis()`, `save(dir)`

- [ ] **Step 1: Create `src/core/NetworkRecorder.ts`**

```ts
import { Page, Request, Response } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { DiscoveredApi } from '../types/discovery';

export class NetworkRecorder {
  private apis: Map<string, DiscoveredApi> = new Map();

  attach(page: Page): void {
    page.on('request', (request: Request) => this.handleRequest(request));
  }

  getApis(): DiscoveredApi[] {
    return Array.from(this.apis.values()).sort((a, b) => b.seenCount - a.seenCount);
  }

  save(dir: string): string {
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'apis.json');
    fs.writeFileSync(filePath, JSON.stringify(this.getApis(), null, 2), 'utf-8');
    return filePath;
  }

  private handleRequest(request: Request): void {
    const url = request.url();
    const method = request.method();
    const key = `${method} ${url}`;
    const existing = this.apis.get(key);
    if (existing) {
      existing.seenCount += 1;
      return;
    }

    this.apis.set(key, {
      url,
      method,
      seenCount: 1,
    });
  }
}
```

- [ ] **Step 2: Create `tests/unit/networkRecorder.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { NetworkRecorder } from '../../src/core/NetworkRecorder';

test('NetworkRecorder records API requests', async ({ page }) => {
  const recorder = new NetworkRecorder();
  recorder.attach(page);
  await page.route('https://api.example.com/test', async (route) => {
    await route.fulfill({ status: 200, body: '{}' });
  });
  await page.goto('https://api.example.com/test');
  const apis = recorder.getApis();
  expect(apis.length).toBeGreaterThan(0);
  expect(apis.some((a) => a.url.includes('api.example.com/test'))).toBe(true);
});
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test:unit
```

Expected: 6 passed.

- [ ] **Step 4: Commit**

```bash
git add src/core/NetworkRecorder.ts tests/unit/networkRecorder.spec.ts
git commit -m "feat: add NetworkRecorder for API interception

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: HeuristicFinder

**Files:**
- Create: `src/core/HeuristicFinder.ts`
- Create: `tests/unit/heuristicFinder.spec.ts`

**Interfaces:**
- Consumes: `Page` from Playwright
- Produces: `HeuristicFinder` class with `findForms(page)` returning `DiscoveredForm[]`

- [ ] **Step 1: Create `src/core/HeuristicFinder.ts`**

```ts
import { Page, Locator } from '@playwright/test';
import { DiscoveredForm, DiscoveredField } from '../types/discovery';

export class HeuristicFinder {
  async findForms(page: Page, pageUrl: string): Promise<DiscoveredForm[]> {
    const forms: DiscoveredForm[] = [];
    const formLocators = page.locator('form');
    const count = await formLocators.count();

    for (let i = 0; i < count; i++) {
      const form = formLocators.nth(i);
      const fields = await this.findFields(form);
      const hasPassword = fields.some((f) => f.role === 'password');
      if (!hasPassword && fields.length === 0) continue;

      const submitSelector = await this.findSubmitSelector(form);
      forms.push({
        id: `form-${i}`,
        pageUrl,
        formSelector: await this.getSelector(form),
        confidence: hasPassword ? 0.95 : 0.7,
        fields,
        submitSelector,
      });
    }

    // Also look for standalone password inputs (e.g. div-based forms)
    const standalonePasswords = page.locator('input[type="password"]');
    const pwCount = await standalonePasswords.count();
    for (let i = 0; i < pwCount; i++) {
      const pw = standalonePasswords.nth(i);
      const alreadyInForm = forms.some((f) =>
        f.fields.some((field) => field.role === 'password'),
      );
      if (alreadyInForm) continue;

      const fields = await this.findFieldsForPassword(pw, page);
      forms.push({
        id: `standalone-form-${i}`,
        pageUrl,
        confidence: 0.85,
        fields,
        submitSelector: await this.findSubmitSelector(page.locator('body')),
      });
    }

    return forms;
  }

  private async findFields(form: Locator): Promise<DiscoveredField[]> {
    const fields: DiscoveredField[] = [];
    const inputs = form.locator('input, select, textarea');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const role = await this.inferFieldRole(input);
      if (!role) continue;
      const selector = await this.getSelector(input);
      const label = await this.getLabel(input);
      fields.push({ role, selector, label, confidence: 0.8 });
    }

    return fields;
  }

  private async findFieldsForPassword(passwordInput: Locator, page: Page): Promise<DiscoveredField[]> {
    const fields: DiscoveredField[] = [];
    const pwSelector = await this.getSelector(passwordInput);
    fields.push({ role: 'password', selector: pwSelector, confidence: 0.95 });

    // Heuristic: look for nearby username/email input
    const nearbyInputs = page.locator('input[type="email"], input[type="text"], input[name*="user"], input[name*="email"]');
    const count = await nearbyInputs.count();
    if (count > 0) {
      const selector = await this.getSelector(nearbyInputs.nth(0));
      fields.push({ role: 'username', selector, confidence: 0.7 });
    }

    return fields;
  }

  private async inferFieldRole(input: Locator): Promise<string | null> {
    const type = await input.getAttribute('type').catch(() => null);
    const name = await input.getAttribute('name').catch(() => null);
    const placeholder = await input.getAttribute('placeholder').catch(() => null);
    const ariaLabel = await input.getAttribute('aria-label').catch(() => null);

    const text = `${type || ''} ${name || ''} ${placeholder || ''} ${ariaLabel || ''}`.toLowerCase();

    if (type === 'password') return 'password';
    if (type === 'email' || text.includes('email') || text.includes('用户名') || text.includes('账号')) return 'username';
    if (text.includes('search') || text.includes('搜索') || text.includes('query')) return 'search';
    if (type === 'text') return 'text';
    if (type === 'textarea') return 'textarea';
    if (input.toString().includes('select')) return 'select';

    return null;
  }

  private async findSubmitSelector(scope: Locator): Promise<string | undefined> {
    const candidates = scope.locator('button[type="submit"], input[type="submit"], button:has-text("登录"), button:has-text("Login"), button:has-text("提交"), button:has-text("Submit")');
    const count = await candidates.count();
    if (count === 0) return undefined;
    return this.getSelector(candidates.nth(0));
  }

  private async getLabel(input: Locator): Promise<string | undefined> {
    const id = await input.getAttribute('id').catch(() => null);
    if (id) {
      const label = input.page().locator(`label[for="${id}"]`);
      if ((await label.count()) > 0) {
        return label.textContent().catch(() => undefined) || undefined;
      }
    }
    const ariaLabel = await input.getAttribute('aria-label').catch(() => null);
    const placeholder = await input.getAttribute('placeholder').catch(() => null);
    return ariaLabel || placeholder || undefined;
  }

  private async getSelector(locator: Locator): Promise<string> {
    const id = await locator.getAttribute('id').catch(() => null);
    if (id) return `#${id}`;
    const name = await locator.getAttribute('name').catch(() => null);
    if (name) return `[name="${name}"]`;
    const type = await locator.getAttribute('type').catch(() => null);
    if (type) return `input[type="${type}"]`;
    return locator.toString();
  }
}
```

- [ ] **Step 2: Create `tests/unit/heuristicFinder.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { HeuristicFinder } from '../../src/core/HeuristicFinder';

test('HeuristicFinder finds login form', async ({ page }) => {
  await page.setContent(`
    <form>
      <input type="email" name="email" placeholder="Email" />
      <input type="password" name="password" />
      <button type="submit">Login</button>
    </form>
  `);
  const finder = new HeuristicFinder();
  const forms = await finder.findForms(page, 'http://localhost/login');
  expect(forms.length).toBe(1);
  expect(forms[0].confidence).toBeGreaterThan(0.9);
  expect(forms[0].fields.some((f) => f.role === 'password')).toBe(true);
});
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test:unit
```

Expected: 7 passed.

- [ ] **Step 4: Commit**

```bash
git add src/core/HeuristicFinder.ts tests/unit/heuristicFinder.spec.ts
git commit -m "feat: add HeuristicFinder for login/search form detection

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: CandidateGenerator

**Files:**
- Create: `src/core/CandidateGenerator.ts`
- Create: `tests/unit/candidateGenerator.spec.ts`

**Interfaces:**
- Consumes: `DiscoveredForm`, `DiscoveredApi`, `Case` shape
- Produces: `CandidateGenerator` class with `generateLoginCase(form)`, `generateSearchCase(form)`

- [ ] **Step 1: Create `src/core/CandidateGenerator.ts`**

```ts
import { DiscoveredForm, CandidateCase, DiscoveredApi } from '../types/discovery';

export class CandidateGenerator {
  generateFromForm(form: DiscoveredForm, baseUrl: string): CandidateCase[] {
    const cases: CandidateCase[] = [];
    const hasPassword = form.fields.some((f) => f.role === 'password');
    const hasSearch = form.fields.some((f) => f.role === 'search');

    if (hasPassword) {
      cases.push(this.generateLoginCase(form, baseUrl));
    }

    if (hasSearch) {
      cases.push(this.generateSearchCase(form, baseUrl));
    }

    return cases;
  }

  private generateLoginCase(form: DiscoveredForm, baseUrl: string): CandidateCase {
    const usernameField = form.fields.find((f) => f.role === 'username') || form.fields[0];
    const passwordField = form.fields.find((f) => f.role === 'password');
    const entry = new URL(form.pageUrl).pathname;

    return {
      id: `${form.id}-login`,
      name: `Login via ${form.id}`,
      confidence: form.confidence,
      target: { baseUrl, entry },
      steps: [
        { action: 'goto', params: { url: entry } },
        ...(usernameField
          ? [{ action: 'fill', params: { selector: usernameField.selector, value: '${USERNAME}' } }]
          : []),
        ...(passwordField
          ? [{ action: 'fill', params: { selector: passwordField.selector, value: '${PASSWORD}' } }]
          : []),
        ...(form.submitSelector
          ? [{ action: 'click', params: { selector: form.submitSelector } }]
          : []),
      ],
      assertions: [{ type: 'urlNotContains', expected: '/login' }],
      source: 'heuristic-login',
    };
  }

  private generateSearchCase(form: DiscoveredForm, baseUrl: string): CandidateCase {
    const searchField = form.fields.find((f) => f.role === 'search');
    const entry = new URL(form.pageUrl).pathname;

    return {
      id: `${form.id}-search`,
      name: `Search via ${form.id}`,
      confidence: form.confidence * 0.9,
      target: { baseUrl, entry },
      steps: [
        { action: 'goto', params: { url: entry } },
        ...(searchField
          ? [
              { action: 'fill', params: { selector: searchField.selector, value: 'test query' } },
              ...(form.submitSelector
                ? [{ action: 'click', params: { selector: form.submitSelector } }]
                : []),
            ]
          : []),
      ],
      assertions: [{ type: 'visible', selector: 'body' }],
      source: 'heuristic-search',
    };
  }
}
```

- [ ] **Step 2: Create `tests/unit/candidateGenerator.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { CandidateGenerator } from '../../src/core/CandidateGenerator';
import { DiscoveredForm } from '../../src/types/discovery';

test('CandidateGenerator generates login case', () => {
  const generator = new CandidateGenerator();
  const form: DiscoveredForm = {
    id: 'login-form',
    pageUrl: 'http://localhost/login',
    confidence: 0.95,
    fields: [
      { role: 'username', selector: 'input[name="email"]', confidence: 0.8 },
      { role: 'password', selector: 'input[type="password"]', confidence: 0.95 },
    ],
    submitSelector: 'button[type="submit"]',
  };
  const cases = generator.generateFromForm(form, 'http://localhost');
  expect(cases.some((c) => c.id === 'login-form-login')).toBe(true);
});
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test:unit
```

Expected: 8 passed.

- [ ] **Step 4: Commit**

```bash
git add src/core/CandidateGenerator.ts tests/unit/candidateGenerator.spec.ts
git commit -m "feat: add CandidateGenerator to convert discovered forms into JSON cases

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: DiscoveryEngine and CLI

**Files:**
- Create: `src/core/DiscoveryEngine.ts`
- Create: `src/cli/discover.ts`
- Modify: `package.json` scripts for discover
- Create: `tests/integration/discover.spec.ts`

**Interfaces:**
- Consumes: `HeuristicFinder`, `NetworkRecorder`, `CandidateGenerator`, `Page`, `Browser`
- Produces: `DiscoveryEngine` class with `discover(url, options)` returning paths to output files
- Produces: `discover` CLI entry point

- [ ] **Step 1: Create `src/core/DiscoveryEngine.ts`**

```ts
import { chromium, Browser, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { HeuristicFinder } from './HeuristicFinder';
import { NetworkRecorder } from './NetworkRecorder';
import { CandidateGenerator } from './CandidateGenerator';
import { DiscoveredPage, DiscoveredForm, DiscoveredApi, CandidateCase } from '../types/discovery';

export interface DiscoveryOptions {
  url: string;
  depth?: number;
  maxPages?: number;
  outputDir?: string;
  headless?: boolean;
}

export interface DiscoveryResult {
  outputDir: string;
  pages: DiscoveredPage[];
  forms: DiscoveredForm[];
  apis: DiscoveredApi[];
  candidates: CandidateCase[];
}

export class DiscoveryEngine {
  private finder = new HeuristicFinder();
  private generator = new CandidateGenerator();

  async discover(options: DiscoveryOptions): Promise<DiscoveryResult> {
    const {
      url,
      depth = 2,
      maxPages = 50,
      outputDir = `discovered/${new URL(url).hostname}`,
      headless = true,
    } = options;

    const browser = await chromium.launch({ headless });
    const context = await browser.newContext();
    const page = await context.newPage();
    const recorder = new NetworkRecorder();
    recorder.attach(page);

    const visited = new Set<string>();
    const queue: { url: string; currentDepth: number }[] = [{ url, currentDepth: 0 }];
    const pages: DiscoveredPage[] = [];
    const allForms: DiscoveredForm[] = [];

    try {
      while (queue.length > 0 && visited.size < maxPages) {
        const { url: currentUrl, currentDepth } = queue.shift()!;
        if (visited.has(currentUrl)) continue;
        visited.add(currentUrl);

        try {
          await page.goto(currentUrl, { waitUntil: 'networkidle', timeout: 15000 });
          const title = await page.title().catch(() => undefined);
          const links = await this.extractLinks(page, new URL(url).origin);
          pages.push({ url: currentUrl, title, links });

          const forms = await this.finder.findForms(page, currentUrl);
          allForms.push(...forms);

          if (currentDepth < depth) {
            for (const link of links) {
              if (!visited.has(link)) {
                queue.push({ url: link, currentDepth: currentDepth + 1 });
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to process ${currentUrl}: ${error}`);
        }
      }
    } finally {
      await browser.close();
    }

    const apis = recorder.getApis();
    const candidates = allForms.flatMap((form) =>
      this.generator.generateFromForm(form, new URL(url).origin),
    );

    this.saveResults(outputDir, { pages, forms: allForms, apis, candidates });

    return { outputDir, pages, forms: allForms, apis, candidates };
  }

  private async extractLinks(page: Page, origin: string): Promise<string[]> {
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((anchors: HTMLAnchorElement[]) =>
        anchors.map((a) => a.href).filter((href) => href.startsWith('http')),
      );
    return [...new Set(hrefs)].filter((href) => href.startsWith(origin));
  }

  private saveResults(
    outputDir: string,
    data: { pages: DiscoveredPage[]; forms: DiscoveredForm[]; apis: DiscoveredApi[]; candidates: CandidateCase[] },
  ): void {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(path.join(outputDir, 'candidates'), { recursive: true });

    fs.writeFileSync(path.join(outputDir, 'pages.json'), JSON.stringify(data.pages, null, 2));
    fs.writeFileSync(path.join(outputDir, 'forms.json'), JSON.stringify(data.forms, null, 2));
    fs.writeFileSync(path.join(outputDir, 'apis.json'), JSON.stringify(data.apis, null, 2));

    for (const candidate of data.candidates) {
      fs.writeFileSync(
        path.join(outputDir, 'candidates', `${candidate.id}.json`),
        JSON.stringify(candidate, null, 2),
      );
    }
  }
}
```

- [ ] **Step 2: Create `src/cli/discover.ts`**

```ts
import { DiscoveryEngine } from '../core/DiscoveryEngine';

async function main() {
  const args = process.argv.slice(2);
  const urlArg = args.find((a) => a.startsWith('--url='));
  const depthArg = args.find((a) => a.startsWith('--depth='));
  const maxPagesArg = args.find((a) => a.startsWith('--max-pages='));
  const outputArg = args.find((a) => a.startsWith('--output='));
  const headlessArg = args.find((a) => a.startsWith('--headless='));

  if (!urlArg) {
    console.error('Usage: npm run discover -- --url=https://example.com [--depth=2] [--max-pages=50] [--output=discovered/example.com] [--headless=true]');
    process.exit(1);
  }

  const url = urlArg.split('=')[1];
  const depth = depthArg ? Number(depthArg.split('=')[1]) : undefined;
  const maxPages = maxPagesArg ? Number(maxPagesArg.split('=')[1]) : undefined;
  const outputDir = outputArg ? outputArg.split('=')[1] : undefined;
  const headless = headlessArg ? headlessArg.split('=')[1] !== 'false' : undefined;

  const engine = new DiscoveryEngine();
  const result = await engine.discover({ url, depth, maxPages, outputDir, headless });

  console.log(`Discovery complete: ${result.pages.length} pages, ${result.forms.length} forms, ${result.apis.length} APIs`);
  console.log(`Output: ${result.outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Update `package.json` discover script**

Change:

```json
"discover": "tsx src/cli/discover.ts"
```

- [ ] **Step 4: Create `tests/integration/discover.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { DiscoveryEngine } from '../../src/core/DiscoveryEngine';
import * as fs from 'fs';
import * as path from 'path';

test('DiscoveryEngine discovers forms on local static page', async () => {
  const outputDir = 'test-results/integration-discover';
  const engine = new DiscoveryEngine();
  // Use a known simple site or serve local HTML via file://
  // For this test we point to a local file URL containing a login form
  const htmlPath = path.resolve('test-results/test-login.html');
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(
    htmlPath,
    `<html><body>
      <form>
        <input type="email" name="email" />
        <input type="password" name="password" />
        <button type="submit">Login</button>
      </form>
    </body></html>`,
  );

  const result = await engine.discover({
    url: `file://${htmlPath}`,
    depth: 0,
    maxPages: 1,
    outputDir,
  });

  expect(result.forms.length).toBeGreaterThan(0);
  expect(fs.existsSync(path.join(outputDir, 'forms.json'))).toBe(true);
  expect(fs.existsSync(path.join(outputDir, 'candidates'))).toBe(true);
});
```

- [ ] **Step 5: Run CLI smoke test**

Run:

```bash
npm run discover -- --url=https://example.com --depth=0 --max-pages=1 --output=test-results/discover-example
```

Expected: CLI completes, outputs `test-results/discover-example/pages.json` and `forms.json`.

- [ ] **Step 6: Run integration test**

Run:

```bash
npx playwright test tests/integration/discover.spec.ts
```

Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add src/core/DiscoveryEngine.ts src/cli/discover.ts package.json tests/integration/discover.spec.ts
git commit -m "feat: add DiscoveryEngine and discover CLI

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Example Cases, Specs, and README

**Files:**
- Create: `cases/examples/login.json`
- Create: `cases/examples/crud-task.json`
- Create: `cases/examples/api-mock.json`
- Create: `specs/examples/sample.spec.ts`
- Create: `README.md`
- Create: `.github/workflows/playwright.yml`

**Interfaces:**
- Consumes: all prior framework modules
- Produces: runnable examples and documentation

- [ ] **Step 1: Create `cases/examples/login.json`**

```json
{
  "id": "example-login",
  "name": "Example login flow",
  "target": {
    "baseUrl": "${BASE_URL}",
    "entry": "/login"
  },
  "steps": [
    { "action": "goto", "params": { "url": "/login" } },
    { "action": "fill", "params": { "selector": "[data-testid=username]", "value": "${USERNAME}" } },
    { "action": "fill", "params": { "selector": "[data-testid=password]", "value": "${PASSWORD}" } },
    { "action": "click", "params": { "selector": "[data-testid=login-button]" } },
    { "action": "waitForState", "params": { "selector": "[data-testid=dashboard]", "state": "visible" } }
  ],
  "assertions": [
    { "type": "urlContains", "expected": "/dashboard" }
  ]
}
```

- [ ] **Step 2: Create `cases/examples/crud-task.json`**

```json
{
  "id": "example-crud-task",
  "name": "Example create and delete task",
  "target": {
    "baseUrl": "${BASE_URL}",
    "entry": "/dashboard"
  },
  "steps": [
    { "action": "goto", "params": { "url": "/dashboard" } },
    { "action": "fill", "params": { "selector": "[data-testid=new-task-input]", "value": "自动化测试任务" } },
    { "action": "click", "params": { "selector": "[data-testid=add-task]" } },
    { "action": "waitForText", "params": { "selector": "[data-testid=task-list]", "text": "自动化测试任务" } },
    { "action": "click", "params": { "selector": "[data-testid=delete-task]" } },
    { "action": "waitForState", "params": { "selector": "[data-testid=empty-state]", "state": "visible" } }
  ],
  "assertions": [
    { "type": "notVisible", "selector": "text=自动化测试任务" }
  ]
}
```

- [ ] **Step 3: Create `cases/examples/api-mock.json`**

```json
{
  "id": "example-api-mock",
  "name": "Example with mocked API",
  "target": {
    "baseUrl": "${BASE_URL}",
    "entry": "/dashboard"
  },
  "mocks": [
    {
      "url": "**/api/tasks",
      "method": "GET",
      "status": 200,
      "body": { "tasks": [{ "id": "1", "title": "Mocked Task" }] }
    }
  ],
  "steps": [
    { "action": "goto", "params": { "url": "/dashboard" } },
    { "action": "waitForText", "params": { "selector": "[data-testid=task-list]", "text": "Mocked Task" } }
  ],
  "assertions": [
    { "type": "visible", "selector": "text=Mocked Task" }
  ]
}
```

- [ ] **Step 4: Create `specs/examples/sample.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { BasePage } from '../../src/core/BasePage';

class ExampleHomePage extends BasePage {
  async open(): Promise<void> {
    await this.goto('/');
  }

  get heading() {
    return this.page.locator('h1');
  }
}

test('example TypeScript spec', async ({ page }) => {
  const home = new ExampleHomePage(page, 'https://example.com');
  await home.open();
  await expect(home.heading).toBeVisible();
});
```

- [ ] **Step 5: Create `README.md`**

```markdown
# Playwright Web Automation Framework

A TypeScript Playwright framework for testing web applications with JSON-driven test cases, automatic discovery, and JSON progress tracking.

## Quick Start

```bash
npm install
npx playwright install chromium
cp .env.example .env
# Edit .env with your target URL and credentials
```

## Discover

```bash
npm run discover -- --url=https://example.com --depth=2
```

Results are written to `discovered/example.com/`.

## Run JSON Cases

```bash
npm run test:json
```

## Run TypeScript Specs

```bash
npm run test:ts
```

## View Report

```bash
npm run report
```

## Project Structure

- `src/core/` — framework core (ActionRegistry, JsonCaseEngine, DiscoveryEngine, etc.)
- `cases/` — confirmed JSON test cases
- `discovered/` — auto-generated candidate cases (not executed automatically)
- `specs/` — TypeScript Playwright specs
- `data/runs/` — JSON progress files
```

- [ ] **Step 6: Create `.github/workflows/playwright.yml`**

```yaml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:unit
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: |
            data/runs/
            test-results/
```

- [ ] **Step 7: Run full verification**

Run:

```bash
npm run build
npm run test:unit
npm run test:json
npm run test:ts
```

Expected: build passes; unit tests pass; JSON tests load cases (may fail if example targets unreachable, but infrastructure works); TS tests pass.

- [ ] **Step 8: Commit**

```bash
git add cases/examples specs/examples README.md .github/workflows/playwright.yml
git commit -m "feat: add example cases, specs, README and CI workflow

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Section | Implementing Task |
|---|---|
| Discover unknown sites | Task 10 |
| Generate candidate JSON cases | Tasks 8-9 |
| JSON declaration of cases | Tasks 2, 5 |
| JSON progress tracking | Task 4 |
| TypeScript extension | Tasks 3, 6, 11 |
| Environment variables | Task 2 |
| Error handling / reporting | Tasks 4, 5, 10 |
| CI/CD | Task 11 |

### 2. Placeholder Scan

No `TBD`, `TODO`, or vague steps. Every step includes actual code or exact commands.

### 3. Type Consistency

- `Case`, `CaseStep`, `CaseAssertion`, `CaseResult` defined in Task 2 and used consistently in Tasks 4, 5.
- `DiscoveredForm`, `DiscoveredApi`, `CandidateCase` defined in Task 2 and used in Tasks 7-10.
- `ActionRegistry.execute(name, ctx, params)` signature matches usage in `JsonCaseEngine`.
- `ProgressTracker.startCase` / `finishCase` signatures match `JsonCaseEngine` usage.

### 4. Known Gaps / Notes

- Example JSON cases assume `data-testid` selectors. If the user wants to run them against a real site, the site must have those test IDs, OR the cases should be treated as templates.
- `run-json-cases.spec.ts` uses a fixture pattern that creates a new tracker per test; if progress consolidation is needed, it can be adjusted during implementation.
- `DiscoveryEngine` uses `file://` URLs in integration test; some Playwright features behave differently with file URLs. A local static server may be added if needed.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-09-playwright-automation.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach do you prefer?
