import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter } from './frontmatter';
import { PromptFile } from './types';

/**
 * 递归读取 contentDir 下的 .md 文件，解析为 PromptFile[]。
 *
 * 每个 prompt 文件必须包含 frontmatter，且含必填字段 id / version / lang，
 * 否则抛出带文件路径的明确错误。
 */
export function loadPrompts(contentDir: string): PromptFile[] {
  if (!fs.existsSync(contentDir)) {
    throw new Error(`Prompts content directory not found: ${contentDir}`);
  }

  const files: PromptFile[] = [];
  walk(contentDir, (filePath) => {
    if (!filePath.endsWith('.md')) return;
    files.push(parsePromptFile(filePath));
  });
  return files;
}

/** 检查重复 id+lang，便于 registry 调用前做整体校验。 */
export function assertNoDuplicates(files: PromptFile[]): void {
  const seen = new Map<string, string>();
  for (const f of files) {
    const key = `${f.id}@${f.lang}`;
    const prev = seen.get(key);
    if (prev) {
      throw new Error(
        `Duplicate prompt ${key}:\n  ${prev}\n  ${f.filePath}`,
      );
    }
    seen.set(key, f.filePath);
  }
}

function parsePromptFile(filePath: string): PromptFile {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, body } = parseFrontmatter(raw, filePath);

  const id = data.id;
  const version = data.version;
  const lang = data.lang;

  const missing: string[] = [];
  if (!id) missing.push('id');
  if (!version) missing.push('version');
  if (!lang) missing.push('lang');
  if (missing.length > 0) {
    throw new Error(
      `Prompt file ${filePath} is missing required frontmatter field(s): ${missing.join(', ')}`,
    );
  }

  return {
    id,
    version,
    lang,
    title: data.title,
    body,
    filePath,
  };
}

function walk(dir: string, visit: (filePath: string) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, visit);
    } else if (entry.isFile()) {
      visit(full);
    }
  }
}
