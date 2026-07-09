/**
 * 提示词管理模块 - 公共 API
 *
 * 纯基础设施：加载 .md 提示词 + 类型安全定义 + 纯函数渲染（占位符替换 / 组合 / 归一化）。
 * 只产出 LLM-ready 的字符串，不调用任何模型（provider 是独立模块）。
 */
export type {
  PromptFile,
  PromptDefinition,
  RenderOptions,
  RenderResult,
  RegistryOptions,
} from './types';
export { parseFrontmatter } from './frontmatter';
export { normalizePromptText } from './normalize';
export { loadPrompts, assertNoDuplicates } from './loader';
export { definePrompt } from './define';
export { substitutePlaceholders, composeBody } from './renderer';
export { PromptRegistry, createRegistry } from './registry';
