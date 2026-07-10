# 网站结构解析完善 · 设计 (Website Structure Parsing)

- 日期: 2026-07-10
- 状态: 已批准
- 范围: 把通用发现线从「表单 + 链接 + 请求计数」扩展为「页面结构 + 结构驱动候选 + API 载荷」,并把输出与中间数据统一收纳到 `projects/<target>/`。全程无站点专属代码。

## 1. 目标

让任意网站被解析为更完整的结构化数据,并直接驱动更多 JSON 测试候选。三块工作:

1. **页面结构建模** — 新增 `PageAnalyzer`,每页捕获导航、标题大纲、可交互动作。
2. **结构驱动候选** — `CandidateGenerator` 除 login/search 外,从导航生成导航冒烟候选。
3. **API 载荷录制** — `NetworkRecorder` 抓 request/response 载荷(过滤静态资源、截断)。

## 2. 输出与中间数据约定

每个待测目标(网站)一个独立目录,作为该 target 的单一工作区:

```
projects/
  <target>/                 ← 每个待测网站一个目录
    discovered/             ← 解析阶段产物
      pages.json            (含 structure)
      forms.json
      apis.json             (含载荷)
      candidates/
    (后续:runs/、generated/ 等"工作过程中的中间数据"按需落在这里)
```

- `projects/` 整体加入 `.gitignore`(生成数据不进版本控制)。
- 旧默认 `discovered/<host>/` 废弃;新解析统一走 `projects/<target>/discovered/`。

**target 目录名**:
- CLI 可选 `--name=<slug>`;不传则按 URL 主机名派生 slug。
- slug 规则:小写,非 `[a-z0-9]` 字符替换为 `-`,折叠连续 `-`,去掉首尾 `-`;端口以 `-` 拼接。
  - `http://127.0.0.1:8080` → `127-0-0-1-8080`
  - `https://example.com` → `example-com`
  - `https://app.foo.com:3000` → `app-foo-com-3000`
- 传 `--name` 时直接用(同样做 slug 化保安全),覆盖默认。

## 3. 数据模型增量 (`src/types/discovery.ts`)

```ts
export interface DiscoveredHeading { level: number; text: string }
export interface DiscoveredAction {
  kind: 'link' | 'button';
  text: string;
  selector: string;
  href?: string;           // 仅 link
}
export interface DiscoveredNavItem { text: string; href: string }
export interface PageStructure {
  title?: string;
  nav: DiscoveredNavItem[];
  headings: DiscoveredHeading[];
  actions: DiscoveredAction[];
}

// DiscoveredPage 增加:
//   structure?: PageStructure;
// (links 字段保留,向后兼容,仍用于同源爬取)

// DiscoveredApi 的 sampleRequest / sampleResponse 现在真正填充:
//   sampleRequest?:  { body?: unknown }
//   sampleResponse?: { status?: number; body?: unknown }
```

## 4. 组件

### 4.1 新增 `src/core/PageAnalyzer.ts`
- `analyze(page, pageUrl): Promise<PageStructure>`
- **nav**:取 `nav a[href]`、`[role="navigation"] a[href]`;按 href+text 去重;仅保留可见、有文本的项;封顶 ≤ 20。
- **headings**:`h1`–`h6` 文档序,可见、文本非空;封顶 ≤ 50。
- **actions**:可见的 `<button>` 与 `<a>`(排除 nav 内的);`kind` 按 tagName 判定;selector 复用 `HeuristicFinder` 同款策略(id/name/text);封顶 ≤ 20。
- 表单仍由 `HeuristicFinder` 负责(不变),`PageAnalyzer` 不重复抓表单。

### 4.2 `CandidateGenerator` 扩展
- 新增 `generateFromStructure(structure, pageUrl, baseUrl): CandidateCase[]`
- 对 `structure.nav` 每项(封顶 ≤ 8)生成**导航冒烟候选**:
  - steps:`goto` 入口页 → `click` 导航选择器
  - assertions:`urlContains`(导航 href 的 path)或回退 `visible: body`
  - `source: 'heuristic-nav'`,`confidence` 较低(如 0.5)
- 原 `generateFromForm`(login/search)不变。

### 4.3 `NetworkRecorder` 补载荷
- 同时监听 `page.on('response')`,抓 `status` 与 body。
- **过滤静态资源**:URL 后缀 ∈ {.js,.css,.png,.jpg,.jpeg,.svg,.gif,.woff,.woff2,.ttf,.ico,.map} 或响应 content-type 非 `json/text/xml`(跳过)。
- **截断**:body 序列化为字符串,长度 > 16KB 截断并标注 `(truncated)`。
- **首样本**:每个 method+url 首次出现时存 `sampleRequest`(取 request postData)与 `sampleResponse`(status+body);后续仅 `seenCount++`。
- 全程 try/catch,任何抓取失败不中断录制。

### 4.4 `DiscoveryEngine` 改动
- 每页多调 `PageAnalyzer.analyze`,把结果挂到 `DiscoveredPage.structure`。
- 候选 = `flatMap(forms → generateFromForm)` + `flatMap(pages → generateFromStructure(structure))`。
- 默认 `outputDir` 改为 `projects/<slug>/discovered`(接受 `name` 覆盖)。
- `saveResults` 路径随之调整。

### 4.5 `src/cli/discover.ts`
- 新增 `--name=<slug>` 参数;传入则用作 target 名(覆盖主机名 slug)。

## 5. 约束(YAGNI / 防膨胀)

- 不建整页 DOM 树;只取 nav/headings/actions/forms。
- 候选封顶:nav ≤ 8;login/search 维持每表单 ≤ 2。
- 响应载荷只抓 API 类 + 16KB 截断 + 首样本。
- 全程通用,零站点专属代码;沿用项目 TS/测试约定。

## 6. 测试

- `PageAnalyzer`:`setContent` 含 nav/heading/button 的页面 → 断言提取与封顶/去重。
- `CandidateGenerator`:新增 `generateFromStructure` 单测(nav 候选 shape + 封顶)。
- `NetworkRecorder`:扩展,断言 API 类请求抓到 body、静态资源被过滤、截断生效。
- 兼容:检查并按需更新 `tests/integration/discover.spec.ts`、`tests/unit/networkRecorder.spec.ts`、`tests/unit/candidateGenerator.spec.ts` 对输出形状的断言。
- build:`npm run build` 干净;`npm run test:unit` 全绿。

## 7. 不在本次范围

- 执行侧通用 captcha 策略(独立任务)。
- 登录后内容爬取 / SPA 路由发现(需要认证与 JS 导航,更大)。
- 按钮级"冒烟点击"候选(动作已入结构,候选化留后续)。
- `projects/<target>/` 下的 runs/、generated/ 等后续中间数据(留待对应阶段)。
