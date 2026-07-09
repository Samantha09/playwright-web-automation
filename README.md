# Playwright Web Automation Framework

A TypeScript Playwright framework for testing web applications with JSON-driven test cases, automatic discovery, and JSON progress tracking.

## Features

- **Automatic Discovery**: Crawl an unknown website, detect login/search forms, record APIs, and generate candidate JSON test cases.
- **JSON-Driven Tests**: Write test cases as JSON files without TypeScript.
- **Progress Tracking**: Every test run produces a JSON progress file under `data/runs/`.
- **Prompt Management**: A zero-dependency module assembles LLM-ready prompt strings from versioned `.md` templates, with type-safe definitions, composition, and snapshot contract tests.
- **TypeScript Extensibility**: Add custom actions and Page Objects when JSON is not enough.

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

Results are written to `discovered/example.com/`:

- `pages.json` — crawled pages
- `forms.json` — detected forms
- `apis.json` — recorded API requests
- `candidates/*.json` — draft test cases (must be reviewed before execution)

## Run JSON Cases

Review and copy candidate cases from `discovered/` to `cases/`, then:

```bash
npm run test:json
```

## Run TypeScript Specs

```bash
npm run test:ts
```

## Run Unit Tests

```bash
npm run test:unit
```

## View Report

```bash
npm run report
```

## Project Structure

```
playwright-web-automation/
├── src/core/           # Framework core
│   ├── ActionRegistry.ts
│   ├── BasePage.ts
│   ├── CandidateGenerator.ts
│   ├── DiscoveryEngine.ts
│   ├── HeuristicFinder.ts
│   ├── JsonCaseEngine.ts
│   ├── NetworkRecorder.ts
│   └── ProgressTracker.ts
├── src/cli/            # CLI tools
│   └── discover.ts
├── src/prompts/        # Prompt management (templates + registry + renderer)
├── src/types/          # Shared TypeScript types
├── src/utils/          # Utilities (env, caseLoader)
├── cases/              # Confirmed JSON test cases
├── discovered/         # Auto-generated candidate cases
├── specs/              # TypeScript Playwright specs
├── data/runs/          # JSON progress files
└── tests/              # Framework tests
```

## Writing a JSON Test Case

```json
{
  "id": "login",
  "target": { "baseUrl": "${BASE_URL}", "entry": "/login" },
  "steps": [
    { "action": "goto", "params": { "url": "/login" } },
    { "action": "fill", "params": { "selector": "[data-testid=username]", "value": "${USERNAME}" } },
    { "action": "fill", "params": { "selector": "[data-testid=password]", "value": "${PASSWORD}" } },
    { "action": "click", "params": { "selector": "[data-testid=login-button]" } }
  ],
  "assertions": [
    { "type": "urlContains", "expected": "/dashboard" }
  ]
}
```

## Custom Actions

```ts
import { ActionRegistry } from 'playwright-web-automation';

const registry = new ActionRegistry();
registry.register('customAction', async ({ page }, params) => {
  // your logic
});
```

## Prompt Management

A zero-dependency module for assembling LLM-ready prompt strings from versioned `.md` templates. It produces strings only (no model calls) — execution is handled by a separate provider module.

Prompt text lives in `.md` files with frontmatter; type-safe definitions live in TypeScript:

```ts
import { createRegistry, definePrompt } from 'playwright-web-automation';

const greet = definePrompt<{ name: string }>('example/hello');
const registry = createRegistry({ contentDir: 'src/prompts/content', definitions: [greet] });

const result = registry.render(greet, { name: 'world' });
console.log(result.text);     // the final prompt string
console.log(result.version);  // '1.0.0'
```

Prompt edits are locked by snapshot contract tests (drift detection). See `src/prompts/` and `docs/superpowers/specs/2026-07-09-prompt-management-design.md`.

## License

MIT
