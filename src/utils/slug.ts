/**
 * Slug 工具:把任意字符串变成文件系统安全的目录/文件名片段。
 * 用于 target 目录名、候选 id 等场景。
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 推导 target 目录名:
 * - 显式 name → slugify(name);
 * - 否则按 URL 主机名(+端口)派生。
 *   http://127.0.0.1:8080 → 127-0-0-1-8080
 *   https://example.com → example-com
 */
export function targetSlug(url: string, name?: string): string {
  if (name) return slugify(name) || 'target';
  try {
    const u = new URL(url);
    const port = u.port ? `-${u.port}` : '';
    return slugify(`${u.hostname}${port}`) || 'target';
  } catch {
    return 'target';
  }
}
