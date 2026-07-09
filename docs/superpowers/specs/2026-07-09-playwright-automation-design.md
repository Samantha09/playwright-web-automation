# Playwright Web Automation Framework Design

> 设计日期:2026-07-09
> 项目位置:`../playwright-web-automation/`(与 VideoClaw 同级)
> 目标:一个 TypeScript 编写的通用 Web 自动化测试框架,参考 VideoClaw 的"JSON 配置 + JSON 状态"理念,支持用 JSON 声明测试用例、用 JSON 记录测试进度。

## 1. 项目目标

创建一个**与业务解耦的通用 Playwright 测试框架**,使测试人员能够通过:

1. **JSON 文件声明测试用例**(`cases/*.json`)——无需编写 TypeScript 即可覆盖常见 Web 测试场景。
2. **JSON 文件记录测试进度**(`data/runs/*.json`)——每次运行生成可解析、可恢复的状态文件。
3. **TypeScript 扩展自定义能力**——当 JSON 表达力不足时,通过自定义 action 和 spec 文件扩展。

VideoClaw 作为首个参考应用,但首版框架本身不绑定任何 VideoClaw 业务逻辑。

## 2. 技术选型

| 项 | 选择 | 理由 |
|---|---|---|
| 语言 | TypeScript | Playwright 原生;类型安全;与 Next.js 前端生态一致 |
| 测试框架 | Playwright Test | 官方 test runner;支持 parallel、trace、video、screenshot |
| 包管理 | npm | 通用;CI 友好 |
| 代码风格 | ESLint + Prettier | 与 VideoClaw 前端一致 |
| 配置读取 | dotenv + 环境变量 | BASE_URL、HEADLESS、SLOW_MO 等走 `.env` |

## 3. 目录结构

```
playwright-web-automation/
├── src/                              # 框架核心(通用、可复用)
│   ├── core/
│   │   ├── BasePage.ts               # Page Object 基类
│   │   ├── JsonCaseEngine.ts         # JSON 用例解析与执行引擎
│   │   ├── ProgressTracker.ts        # 进度 JSON 创建与更新
│   │   ├── ActionRegistry.ts         # Action 注册表(内置 + 自定义)
│   │   ├── StreamingWaiter.ts        # SSE / WebSocket / 长轮询等待(可选高级)
│   │   └── InterventionPoint.ts      # 人在回路确认点抽象(可选高级)
│   ├── fixtures/
│   │   └── index.ts                  # Playwright test.extend
│   ├── reporters/
│   │   └── ProgressReporter.ts       # 把进度写入 data/runs/*.json
│   ├── utils/
│   │   ├── env.ts                    # 环境变量读取
│   │   ├── caseLoader.ts             # 加载/校验 JSON case
│   │   └── retry.ts                  # 通用重试工具
│   └── index.ts                      # 对外导出
├── cases/                            # JSON 声明式测试用例
│   └── examples/                     # 通用示例(不绑业务)
│       ├── login.json
│       ├── crud-task.json
│       └── api-mock.json
├── specs/                            # TypeScript 编程式测试用例
│   └── examples/
│       └── sample.spec.ts
├── data/                             # 运行时数据(.gitignore)
│   └── runs/
│       └── 2026-07-09_14-30-00_a3f9c2.json
├── test-results/                     # 截图/视频/trace(.gitignore)
├── .env.example
├── playwright.config.ts
├── package.json
├── tsconfig.json
├── eslint.config.mjs
└── README.md
```

## 4. 核心抽象

### 4.1 BasePage

所有 Page Object 的基类,封装通用操作与等待:

```ts
export abstract class BasePage {
  constructor(protected page: Page, protected baseUrl: string) {}
  async goto(path: string): Promise<void>;
  async waitForLoad(): Promise<void>;
  async screenshot(name: string): Promise<void>;
  async click(locator: Locator, options?: { retry?: number }): Promise<void>;
  async waitForVisible(selector: string, timeout?: number): Promise<void>;
}
```

### 4.2 JsonCaseEngine

读取 `cases/*.json`,按步骤调度执行,并把结果交给 `ProgressTracker`:

- 支持环境变量替换(`${BASE_URL}` / `${USERNAME}`)。
- 支持参数化(`cases/*.json` 可引用外部数据)。
- 每个 step 的 `action` 从 `ActionRegistry` 查找。
- 失败即停止当前 case,但隔离不影响其他 case。

### 4.3 ProgressTracker

每次测试 run 生成唯一 `runId`,格式为 `YYYY-MM-DD_HH-mm-ss_{short-uuid}`,并维护一个 JSON 状态文件:

```json
{
  "runId": "2026-07-09_14-30-00_a3f9c2",
  "startedAt": "2026-07-09T14:30:00.000Z",
  "completedAt": "2026-07-09T14:30:12.000Z",
  "status": "completed",
  "summary": { "total": 3, "passed": 3, "failed": 0, "skipped": 0 },
  "cases": {
    "login": { "status": "passed", "steps": [...] },
    "crud-task": { "status": "passed", "steps": [...] }
  }
}
```

### 4.4 ActionRegistry

内置通用 action:

| Action | 说明 |
|---|---|
| `goto` | 跳转 URL |
| `click` | 点击元素 |
| `fill` | 填充输入框(先 clear) |
| `type` | 模拟键盘输入(不清除) |
| `select` | 选择下拉框 |
| `hover` | 悬停 |
| `scroll` | 滚动到元素 |
| `waitForState` | 等待元素状态(visible/hidden/enabled) |
| `waitForText` | 等待元素包含指定文本 |
| `screenshot` | 当前页截图 |
| `mockApi` | 拦截并 mock API 响应 |

支持通过 `registerAction(name, handler)` 注册自定义 action。

## 5. JSON 测试用例格式

```json
{
  "id": "crud-task",
  "name": "创建并删除任务",
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

### 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 用例唯一标识,也作为 progress JSON 里的 key |
| `name` | 否 | 人类可读名称 |
| `target.baseUrl` | 否 | 默认使用 `${BASE_URL}` |
| `target.entry` | 否 | 用例入口路径 |
| `mocks` | 否 | API mock 列表 |
| `steps` | 是 | 执行步骤数组 |
| `assertions` | 否 | 最终断言数组 |

## 6. 环境变量

通过 `.env` / `.env.local` 配置:

```bash
BASE_URL=http://127.0.0.1:3000
API_URL=http://127.0.0.1:8000
HEADLESS=true
SLOW_MO=0
TRACE=0
VIDEO=1
SCREENSHOT=on-failure
USERNAME=test@example.com
PASSWORD=test123
```

`env.ts` 读取并提供默认值:

```ts
export const env = {
  BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:3000',
  HEADLESS: process.env.HEADLESS !== 'false',
  SLOW_MO: Number(process.env.SLOW_MO || 0),
  TRACE: process.env.TRACE === '1',
  VIDEO: process.env.VIDEO === '1',
};
```

## 7. 错误处理与报告

### 7.1 Action 级重试

对 `click` / `fill` 等易 flaky 的操作,默认:

- 自动等待元素稳定(`stable`)。
- 失败时按配置重试 1-2 次。
- 重试仍失败则标记当前 step 为 `failed`。

### 7.2 失败快照

失败时自动捕获:

- 页面截图 → `test-results/screenshots/{case-id}-{step}.png`
- 页面视频片段 → Playwright 原生 video
- Playwright trace → `test-results/trace/`
- 当前进度 JSON 写入最新状态

### 7.3 报告输出

- **HTML 报告**:Playwright 原生 `html` reporter。
- **JSON 进度报告**:每个 run 产出 `data/runs/{runId}.json`,可被 CI 解析。
- **Console 摘要**:测试结束时输出通过/失败统计。

## 8. CI / CD

提供 GitHub Actions 示例 `.github/workflows/playwright.yml`:

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
      - run: npm test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: |
            data/runs/
            test-results/
```

## 9. 与 VideoClaw 的关系

- **首版不绑定 VideoClaw**:框架本身是通用的,示例用例使用虚构的 Todo/Admin 场景。
- **VideoClaw 作为后续示例**:在框架稳定后,可在 `cases/videoclaw/` 下添加针对 VideoClaw 工作流的 JSON case,用于验证 `StreamingWaiter` / `InterventionPoint` 等高级抽象。
- **设计参考**:JSON case + JSON progress 的模式直接参考 VideoClaw 的 `sessions/{session_id}.json` 状态持久化思路。

## 10. 首版范围(明确不做)

以下功能不在第一版实现,留作后续迭代:

- VideoClaw 专属示例用例
- 进度 JSON 的断点续跑(从失败 step 恢复)
- Web 可视化报告(UI dashboard)
- 多浏览器矩阵的复杂配置(先用 Chromium,后续加 Firefox/WebKit)
- 数据库集成或历史趋势分析

## 11. 成功标准

首版完成后,应能运行:

```bash
npm install
npx playwright install
npm run test:json    # 运行 cases/examples/*.json
npm run test:ts      # 运行 specs/examples/*.spec.ts
npm run report       # 打开 HTML 报告
```

并产生:

1. `data/runs/YYYY-MM-DD_HH-mm-ss_xxxx.json` 进度文件。
2. 清晰的 HTML / console 报告。
3. 至少 3 个可运行的 JSON 示例用例。
4. 1 个可运行的 TypeScript 编程式示例用例。

## 12. 待决策项

| 项 | 当前假设 | 备注 |
|---|---|---|
| Node 版本 | 20 LTS | 可在实现时调整 |
| 包名 | `playwright-web-automation` | 可在初始化时修改 |
| 是否发布 npm | 首版不发布 | 先在仓库内使用 |
| 进度文件 runId | `YYYY-MM-DD_HH-mm-ss_{short-uuid}` | 8 位 uuid 后缀 |

---

*Approved by user on 2026-07-09.*
