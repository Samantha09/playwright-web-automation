# 提示词管理模块设计 (Prompt Management Module)

- 日期: 2026-07-09
- 状态: 已批准
- 参考: OpenClaw 提示词管理系统（分层装配流水线）；VideoClaw `backend/prompts/loader.py`（平面文件加载）

## 1. 目标与边界

为 `playwright-web-automation` 提供一个**纯基础设施**的提示词管理模块：加载、模板替换、版本、组合、文本归一化、快照契约测试。

**产出边界**：模块只负责组装出**最终的 prompt 字符串**（同步、纯函数、零 LLM 依赖）。模块输出 `LLM-ready` 的字符串与元数据，供（独立的、下一个 spec 的）provider 模块消费。**本模块不调用任何模型、不引入任何 LLM SDK**。

该边界与两个参考一致：OpenClaw 的 `buildAgentSystemPrompt` 是纯函数、输出字符串、执行在另一层；VideoClaw 的 `loader.py` 只产出字符串、agent 自行调模型。

## 2. 核心决策

- **内容与逻辑分离**：提示词正文是数据（`.md` 文件 + frontmatter），类型安全与组合逻辑在 `.ts` 定义层。对应 OpenClaw「代码管组装、文件管内容」。
- **占位符语法**：`{{var}}`（避免与 markdown 代码块里的花括号冲突）。
- **frontmatter**：极简、零依赖解析，仅扁平 `key: value`，承载内容身份元数据 `id` / `version` / `lang` / `title`。
- **借鉴的 OpenClaw 机制**：纯函数 Renderer、内容/逻辑分离、文本归一化、stable/dynamic 角色标记（仅标记，为未来缓存留口子）、快照契约测试、版本号。
- **砍掉的机制（YAGNI）**：Provider 贡献/overlay、Skill blob 外置存储、多 surface、LRU 缓存本身、配置解析层。

## 3. 架构

```
内容(.md, 数据) ──┐
                 ├─► Loader ──► Registry ──► Renderer(params) ──► RenderResult { text, meta }
定义(.ts, 逻辑) ──┘                  │                  │
   params schema + 组合              ├─ Normalizer      └─ 快照测试 vs .snap
   (类型安全)                         └─ 校验 id/版本匹配
```

## 4. 组件 (`src/prompts/`)

| 文件 | 职责 |
| --- | --- |
| `types.ts` | `PromptFile` / `PromptDefinition<T>` / `RenderResult` / `RenderOptions` |
| `frontmatter.ts` | 极简 frontmatter 解析（扁平 `key: value`，零依赖） |
| `normalize.ts` | 文本归一化：统一 LF、去行尾空白、整体 trim（保留有意义的空行） |
| `loader.ts` | 递归读取目录下 `.md` → `PromptFile[]`；要求 frontmatter 含 `id`/`version`/`lang` |
| `define.ts` | `definePrompt<TParams>(id, def)` 类型安全定义助手 |
| `registry.ts` | 按 `id` 索引内容（按语言分组）+ 定义；校验 id/版本；提供 `render` |
| `renderer.ts` | 占位符替换 + 组合（partials/compose）核心逻辑（纯函数） |
| `index.ts` | 对外导出 |

## 5. 内容文件格式

```markdown
---
id: script/generate
version: 1.0.0
lang: zh
title: 剧本生成
---

你是一名剧本编剧。基于以下设定生成剧本：
主题：{{topic}}
风格：{{style}}
```

- 每个 `.md` 文件 = 一个 prompt 的一个语言版本。
- frontmatter 字段：`id`（必填，全局唯一）、`version`（必填，语义化版本字符串）、`lang`（必填）、`title`（可选）。
- 正文使用 `{{var}}` 占位符。

## 6. 定义层（`.ts`，类型安全）

```ts
export const generateScript = definePrompt<{ topic: string; style: string }>(
  'script/generate',
  {
    partials: ['script/base'],          // 可选：要前置的子 prompt id
    compose: (body, partials) => `${partials['script/base']}\n\n${body}`, // 可选
    role: 'stable',                      // 可选：'stable' | 'dynamic'
    version: '1.0.0',                    // 可选：断言与内容 frontmatter 版本一致
  },
);
```

## 7. 公共 API

```ts
// 工厂创建 registry（无隐藏全局状态，便于测试）
const registry = createRegistry({ contentDir: 'src/prompts/content', definitions: [generateScript] });

// 类型安全渲染
const result = registry.render(generateScript, { topic: '复仇', style: '悬疑' });
// => { text: '...', id: 'script/generate', version: '1.0.0', lang: 'zh' }

// 动态按 id（弱类型，供 provider 等运行时调用）
registry.render('script/generate', params, { lang: 'en' });

registry.get('script/generate'); registry.has('script/generate'); registry.list();
```

`RenderResult = { text: string; id: string; version: string; lang: string }`。

## 8. 组合模型（最小版本）

- 定义可声明 `partials: string[]`（其它 prompt id）和/或 `compose(body, partialsMap) => string`。
- partials 用**相同 params** 渲染后，传入 compose；默认 compose（仅有 partials 无 compose 时）= `partials 依次拼接 + 主体`。
- 无 partials / 无 compose 时，直接返回主体。

## 9. 错误处理

- 占位符缺值 → 明确报「prompt `<id>` 缺少变量 `<var>`」（强于 VideoClaw `str.format` 的静默行为）。
- 未知 prompt id、frontmatter 解析失败、frontmatter 缺必填字段、定义与内容 id/版本不匹配 → 带文件路径或 id 的明确错误。
- 请求语言缺失 → 回退默认语言（可配置，默认 `zh`）并 `console.warn`。

## 10. 测试策略（复用 `@playwright/test` 单测）

- 单元：frontmatter 解析、loader 目录递归 + 必填校验、renderer 占位符替换与缺值报错、normalize 稳定性、registry 校验与语言回退、组合行为。
- 快照：用 fixture params 渲染每个示例 prompt，与提交的 `.snap` 比对（`expect(...).toMatchSnapshot()`），prompt 文本变更必须同步快照——即 OpenClaw 的漂移锁。

## 11. 约束

- **零运行时依赖**：frontmatter 解析、`{{var}}` 替换、归一化全部手写，不引入 npm 依赖，与项目现状（`dependencies: {}`）一致。
- 沿用项目 TS 约定（`NodeNext` + `strict`、相对导入无扩展名）与测试约定。
- 从 `src/index.ts` 导出公共 API。

## 12. 不在本次范围

- LLM provider / 执行模块（独立 spec）。
- LRU 缓存实现（无热消费方前不做；`role` 标记为未来预留）。
- Skill 式按需加载、多 surface、provider overlay。
