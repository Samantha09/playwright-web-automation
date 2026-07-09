/**
 * 文本归一化（参考 OpenClaw `normalizeStructuredPromptSection`）
 *
 * 目的：让 prompt 文本在「哈希 / 快照比较」时稳定，剔除无意义的空白噪声；
 * 但保留 markdown 语义上有意义的空行（不折叠连续空行）。
 */

/**
 * 归一化 prompt 文本：
 * - 统一换行为 LF
 * - 去除每行行尾空白
 * - 整体去除首尾空白
 */
export function normalizePromptText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .trim();
}
