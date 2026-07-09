# Playwright Web Automation Framework Design

> 设计日期:2026-07-09
> 项目位置:`../playwright-web-automation/`(与 VideoClaw 同级)
> 目标:一个 TypeScript 编写的通用 Web 自动化测试框架,参考 VideoClaw 的"JSON 配置 + JSON 状态"理念,支持用 JSON 声明测试用例、用 JSON 记录测试进度。

## 1. 项目目标

创建一个**与业务解耦的通用 Playwright 测试框架**,使测试人员能够对**未知源码的网站**完成:

1. **自动发现**(Discover)——通过 Playwright 爬取页面、识别交互元素、拦截 API,输出候选素材。
2. **候选用例生成**(Generate)——把发现结果转成 JSON 测试用例草稿,供人工确认。
3. **JSON 文件声明测试用例**(`cases/*.json`)——确认后的用例无需编写 TypeScript 即可执行。
4. **JSON 文件记录测试进度**(`data/runs/*.json`)——每次运行生成可解析、可恢复的状态文件。
5. **TypeScript 扩展自定义能力**——当 JSON 表达力不足时,通过自定义 action 和 spec 文件扩展。

核心闭环:

```
Discover → Generate Candidate Cases → Human Review → Execute → Report
```

VideoClaw 作为设计参考(尤其是 JSON 状态持久化理念),但首版框架本身不绑定任何 VideoClaw 业务逻辑。

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
│   │   ├── DiscoveryEngine.ts        # 页面发现与元素/API 识别引擎
│   │   ├── HeuristicFinder.ts        # 启发式元素识别(登录/搜索表单等)
│   │   ├── NetworkRecorder.ts        # 网络请求拦截与记录
│   │   ├── CandidateGenerator.ts     # 把发现结果转成 JSON case 草稿
│   │   ├── JsonCaseEngine.ts         # JSON 用例解析与执行引擎
│   │   ├── ProgressTracker.ts        # 进度 JSON 创建与更新
│   │   ├── ActionRegistry.ts         # Action 注册表(内置 + 自定义)
│   │   ├── StreamingWaiter.ts        # SSE / WebSocket / 长轮询等待(可选高级)
│   │   └── InterventionPoint.ts      # 人在回路确认点抽象(可选高级)
│   ├── cli/
│   │   └── discover.ts               # Discovery CLI 入口
│   ├── fixtures/
│   │   └── index.ts                  # Playwright test.extend
│   ├── reporters/
│   │   └── ProgressReporter.ts       # 把进度写入 data/runs/*.json
│   ├── utils/
│   │   ├── env.ts                    # 环境变量读取
│   │   ├── caseLoader.ts             # 加载/校验 JSON case
│   │   └── retry.ts                  # 通用重试工具
│   └── index.ts                      # 对外导出
├── cases/                            # 已确认可执行的 JSON 测试用例
│   └── examples/                     # 通用示例(不绑业务)
│       ├── login.json
│       ├── crud-task.json
│       └── api-mock.json
├── discovered/                       # 自动发现产出的候选素材(.gitignore)
│   └── {domain}/
│       ├── pages.json
│       ├── forms.json
│       ├── apis.json
│       └── candidates/
│           ├── login.json            # 未确认的候选 case 草稿
│           └── search.json
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

### 4.2 DiscoveryEngine

对目标网站进行受控爬取与交互探测,输出候选测试素材:

- 从入口 URL 开始,按配置深度(默认 2 层)遍历内链。
- 对每个页面调用 `HeuristicFinder` 识别登录/搜索/表单等元素。
- 启用 `NetworkRecorder` 拦截并记录所有 XHR/fetch。
- 输出到 `discovered/{domain}/`。

### 4.3 HeuristicFinder

基于规则 + 启发式识别常见交互元素,不依赖源码:

| 识别目标 | 规则示例 |
|---|---|
| 登录表单 | 含 `input[type=password]` 的 form |
| 用户名/邮箱 | `input[type=email]`, `input[name*=user\|email\|phone]`, `aria-label` 含 "用户名/邮箱" |
| 搜索/查询 | `input[type=search]`, placeholder 含 "搜索/Search", `name*=q\|keyword\|query` |
| 提交按钮 | `button[type=submit]`, `input[type=submit]` |

每个识别结果带 `confidence` 分数(0-1),低于阈值的进入人工 review。

### 4.4 NetworkRecorder

通过 Playwright `page.route('**/*')` 拦截所有请求:

- 记录 URL、method、headers、request payload、response status。
- 对重复 API 做去重,保留典型样本。
- 输出 `apis.json`,供 CandidateGenerator 生成 API 断言或 mock。

### 4.5 CandidateGenerator

把 `DiscoveryEngine` + `HeuristicFinder` + `NetworkRecorder` 的结果转成 JSON case 草稿:

- 登录表单 → `candidates/login.json`
- 搜索框 → `candidates/search.json`
- 表单提交后触发的 API → 在 case 中生成 `mocks` 或 `assertions` 占位

候选 case 不会被 `JsonCaseEngine` 直接执行;必须人工 review 后复制/移动到 `cases/`。

### 4.6 JsonCaseEngine

读取 `cases/*.json`,按步骤调度执行,并把结果交给 `ProgressTracker`:

- 支持环境变量替换(`${BASE_URL}` / `${USERNAME}`)。
- 支持参数化(`cases/*.json` 可引用外部数据)。
- 每个 step 的 `action` 从 `ActionRegistry` 查找。
- 失败即停止当前 case,但隔离不影响其他 case。

### 4.7 ProgressTracker

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

### 4.8 ActionRegistry

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

## 6. Discovery CLI 工作流程

对未知网站,典型使用流程如下:

### 步骤 1:发现素材

```bash
npm run discover -- --url=https://example.com --depth=2 --output=discovered/example.com
```

参数:

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--url` | 必填 | 目标网站入口 |
| `--depth` | 2 | 爬取深度 |
| `--output` | `discovered/{hostname}` | 输出目录 |
| `--max-pages` | 50 | 最大爬取页面数,防止失控 |

### 步骤 2:查看发现产物

```bash
ls discovered/example.com/
# pages.json  forms.json  apis.json  candidates/login.json  candidates/search.json
```

### 步骤 3:人工 review 并确认

编辑 `discovered/example.com/candidates/*.json`:

- 修正不准确的 selector。
- 填入环境变量占位符(如 `${USERNAME}`、`${PASSWORD}`)。
- 调整断言预期。
- 确认后复制到 `cases/`。

### 步骤 4:执行

```bash
npm run test:json
```

### 设计约束

- `discovered/` 下的候选 case **永远不会被自动执行**,避免误操作(如点击删除)。
- 发现引擎只使用**规则 + 启发式**,不使用 LLM,保证可预测性。
- 对反爬强、需要 MFA、大量 iframe/Canvas 的网站,发现质量会下降,需人工补全。

## 7. 环境变量

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

## 8. 错误处理与报告

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

## 9. CI / CD

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

## 10. 与 VideoClaw 的关系

- **首版不绑定 VideoClaw**:框架本身是通用的,示例用例使用虚构的 Todo/Admin 场景。
- **VideoClaw 作为后续示例**:在框架稳定后,可在 `cases/videoclaw/` 下添加针对 VideoClaw 工作流的 JSON case,用于验证 `StreamingWaiter` / `InterventionPoint` 等高级抽象。
- **设计参考**:JSON case + JSON progress 的模式直接参考 VideoClaw 的 `sessions/{session_id}.json` 状态持久化思路。

## 11. 首版范围(明确不做)

以下功能不在第一版实现,留作后续迭代:

- VideoClaw 专属示例用例
- 自动执行未确认的候选 case(`discovered/` 下的 case 必须人工 review 后移入 `cases/`)
- 基于 LLM 的语义解析(如"猜出这个输入框是干什么的")
- 进度 JSON 的断点续跑(从失败 step 恢复)
- Web 可视化报告(UI dashboard)
- 多浏览器矩阵的复杂配置(先用 Chromium,后续加 Firefox/WebKit)
- 数据库集成或历史趋势分析
- 自动处理 CAPTCHA / 复杂反爬 / MFA

## 12. 成功标准

首版完成后,应能运行:

```bash
npm install
npx playwright install

# 1. 对任意网站执行发现
npm run discover -- --url=https://example.com --depth=2

# 2. 查看发现产物
cat discovered/example.com/forms.json
cat discovered/example.com/candidates/login.json

# 3. 把确认后的候选 case 放入 cases/ 并执行
npm run test:json    # 运行 cases/examples/*.json
npm run test:ts      # 运行 specs/examples/*.spec.ts
npm run report       # 打开 HTML 报告
```

并产生:

1. `discovered/{domain}/` 下的 `pages.json`、`forms.json`、`apis.json` 和 `candidates/*.json`。
2. `cases/examples/` 下至少 3 个人工确认后的 JSON 示例用例。
3. `data/runs/YYYY-MM-DD_HH-mm-ss_xxxx.json` 进度文件。
4. 清晰的 HTML / console 报告。
5. 1 个可运行的 TypeScript 编程式示例用例。
6. 对典型语义化网站(含明确 login form 和 search input),发现引擎能识别出登录和搜索表单。

## 13. 待决策项

| 项 | 当前假设 | 备注 |
|---|---|---|
| Node 版本 | 20 LTS | 可在实现时调整 |
| 包名 | `playwright-web-automation` | 可在初始化时修改 |
| 是否发布 npm | 首版不发布 | 先在仓库内使用 |
| 进度文件 runId | `YYYY-MM-DD_HH-mm-ss_{short-uuid}` | 8 位 uuid 后缀 |

---

*Approved by user on 2026-07-09.*
