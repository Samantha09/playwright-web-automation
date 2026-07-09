/**
 * 极简 frontmatter 解析器（零依赖）
 *
 * 仅支持扁平 `key: value` 行，值为字符串（自动去除首尾成对引号）。
 * 这是我们提示词元数据 (id/version/lang/title) 的全部需求；
 * 更复杂的结构（数组/嵌套）应放在 .ts 定义层。
 *
 * 格式：
 *   ---
 *   id: script/generate
 *   version: 1.0.0
 *   ---
 *   <body>
 */

export interface ParsedFrontmatter {
  data: Record<string, string>;
  body: string;
}

const FRONTMATTER_RE = /^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * 解析 frontmatter。
 * - 无 frontmatter 时返回空 data 与原始 body。
 * - frontmatter 存在但某行格式非法（无冒号）时抛错。
 */
export function parseFrontmatter(raw: string, filePath?: string): ParsedFrontmatter {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { data: {}, body: raw };
  }
  const [, fmBlock, body] = match;
  const data: Record<string, string> = {};
  const lines = fmBlock.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) {
      throw new Error(
        `Invalid frontmatter line${filePath ? ` in ${filePath}` : ''}: ${line.trim()}`,
      );
    }
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body };
}
