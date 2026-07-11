# Web Console

网站发现与自动化测试的可视化控制台。技术栈:Next.js(app router)+ React + Tailwind v4 + lucide-react。设计参考 VideoClaw `frontend/`。

## 启动

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

> 若 3000 被占,用 `npx next dev -p 3002`。

## 功能

- **仪表盘 `/`** :列出已发现的 target(`projects/*/discovered`)及页面/表单/API/候选计数。
- **新建发现 `/discover`** :填目标 URL、target 名、登录凭据、爬取深度 → 触发 `DiscoveryEngine` → 跳转详情。
- **target 详情 `/targets/[name]`** :Tab 切换 页面 / 表单 / API / 候选。

## 架构

| 路由 | 实现 |
| --- | --- |
| `GET /api/targets` | fs 读 `projects/*/discovered/*.json`,聚合 target 列表 |
| `GET /api/targets/[name]` | 读单个 target 全量数据 |
| `POST /api/discover` | 子进程调仓库根的 `src/cli/discover.ts`(避免把 Playwright 打进 Next 包) |

仓库根 = `path.resolve(cwd, '..')`(Next 从 `web/` 启动);`projects/` 与 `src/` 均相对仓库根。前端不直接 import 框架,只通过 CLI + JSON 交互。
