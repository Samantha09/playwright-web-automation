import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * 测试辅助：在临时目录写出一棵 prompt 文件树，返回目录路径。
 * @param files 相对路径 → 文件内容
 */
export function writePromptTree(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-prompts-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
  }
  return dir;
}
