# 前端控制台设计 (Web Console)

- 日期: 2026-07-11
- 状态: 已批准
- 范围: 为框架加一个 Web 控制台,可视化已发现的 target、触发 discovery。v1 = 查看器 + 触发发现(不含候选用例执行)。
- 参考: VideoClaw `frontend/`(Next.js + Tailwind v4 + lucide 设计语言)。

## 1. 技术栈(镜像 VideoClaw)

- Next.js(app router)+ React + Tailwind v4 + lucide-react + clsx + tailwind-merge
- 位于仓库根 `web/`,独立 `package.json`(deps: next/react/tailwind/lucide)
- 设计令牌复用 VideoClaw:`#4d6bfe` 蓝、浅色、灰边框、`rounded-xl`、可折叠左侧栏 + 顶部 TopBar、状态色映射

## 2. API 设计(关键决策)

本项目无 HTTP 后端,前端所需数据全部由 Next.js route handlers 提供。**读取走 fs,发现走子进程**,避免把 Playwright 打进 Next.js 包:

| 路由 | 方法 | 实现 |
| --- | --- | --- |
| `/api/targets` | GET | fs 读 `projects/*/discovered/pages.json` 等,聚合 target 列表 |
| `/api/targets/[name]` | GET | 读单个 target 的 pages/forms/apis/candidates JSON |
| `/api/discover` | POST | 子进程调既有 CLI:`npx tsx src/cli/discover.ts --url --name --login-user --login-pass --depth`(cwd=仓库根),等结束后返回结果 |

- 仓库根 = `path.resolve(process.cwd(), '..')`(Next 从 web/ 启动);`projects/` 与 `src/` 都相对仓库根。
- discovery 耗时较长(30s+),v1 用同步请求 + 前端 spinner;流式/SSE 留后续。

## 3. 页面

```
/                        仪表盘:target 卡片网格 + "新建发现"按钮
/targets/[name]          详情:Tab 切换 页面/表单/API/候选
/discover                新建发现表单:URL、name、登录凭据、depth → POST /api/discover → 跳回详情
```

- 仪表盘卡片:target 名、页面/表单/API/候选计数、发现时间,点击进详情。
- 详情 Tab:
  - 页面:URL + 标题 + nav/actions 数(可展开看菜单项)
  - 表单:字段(role/selector/label)+ 提交选择器 + 置信度
  - API:method + url + seenCount + 响应样本(截断)
  - 候选:id + source + 步骤数 + 断言,可复制 JSON

## 4. 目录结构

```
web/
  package.json / next.config.ts / tsconfig.json / postcss.config.mjs
  app/
    globals.css              (设计令牌)
    layout.tsx               (RootLayout + AppShell)
    page.tsx                 (仪表盘)
    targets/[name]/page.tsx  (详情)
    discover/page.tsx        (新建发现)
    api/
      targets/route.ts
      targets/[name]/route.ts
      discover/route.ts
  components/ AppShell.tsx / TargetCard.tsx / DiscoveryForm.tsx / tabs(...)
  lib/ api.ts(客户端 fetch) / projects.ts(服务端 fs + 子进程)
```

## 5. 约束 / 不在本次范围

- 不含候选用例执行(JsonCaseEngine 跑候选 → pass/fail),留 v2。
- 不含 discovery 进度流式(SSE/WebSocket),v1 同步等待。
- 不改动 `src/` 框架代码;前端只通过 CLI + JSON 与之交互。
- `web/node_modules`、`web/.next` 加入忽略。
