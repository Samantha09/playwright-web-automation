import { PromptDefinition } from './types';

/**
 * 渲染核心逻辑（纯函数，无 I/O）。
 *
 * 占位符替换 + 组合。I/O（加载 partials、解析语言）由 registry 负责，
 * 这里只做字符串变换，便于单独单测。
 */

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/**
 * 将 `{{var}}` 替换为 params 中的值；缺值时抛出明确错误（强于 str.format 的静默行为）。
 */
export function substitutePlaceholders(
  body: string,
  params: Record<string, unknown>,
  promptId: string,
): string {
  return body.replace(PLACEHOLDER_RE, (match, name: string) => {
    const has = Object.prototype.hasOwnProperty.call(params, name);
    const value = has ? params[name] : undefined;
    if (value === undefined) {
      throw new Error(`Prompt <${promptId}> missing variable: {{${name}}}`);
    }
    return String(value);
  });
}

/**
 * 应用组合逻辑：
 * - 提供 compose 则用 compose；
 * - 否则有 partials 时按顺序拼接 partials + 主体；
 * - 否则直接返回主体。
 *
 * `partials` 是已渲染（已替换占位符）的子 prompt 文本，按 id 索引。
 */
export function composeBody(
  body: string,
  partials: Record<string, string>,
  def: PromptDefinition,
): string {
  if (def.compose) {
    return def.compose(body, partials);
  }
  const ids = def.partials ?? [];
  if (ids.length > 0) {
    const head = ids.map((id) => partials[id] ?? '').join('\n\n');
    return head ? `${head}\n\n${body}` : body;
  }
  return body;
}
