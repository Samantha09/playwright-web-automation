import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// Next 从 web/ 启动(cwd=web/),仓库根 = 父目录;projects/ 与 src/ 都相对仓库根
const REPO_ROOT = path.resolve(process.cwd(), '..');
const PROJECTS_DIR = path.join(REPO_ROOT, 'projects');

export interface TargetSummary {
  name: string;
  pageCount: number;
  formCount: number;
  apiCount: number;
  candidateCount: number;
  discoveredAt?: string;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function safeName(name: string): string {
  if (/[^a-zA-Z0-9_-]/.test(name)) return '';
  return name;
}

export function listTargets(): TargetSummary[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const out: TargetSummary[] = [];
  for (const name of fs.readdirSync(PROJECTS_DIR)) {
    const dir = path.join(PROJECTS_DIR, name, 'discovered');
    if (!fs.existsSync(dir)) continue;
    const pages = readJson<unknown[]>(path.join(dir, 'pages.json')) || [];
    const forms = readJson<unknown[]>(path.join(dir, 'forms.json')) || [];
    const apis = readJson<unknown[]>(path.join(dir, 'apis.json')) || [];
    const cdir = path.join(dir, 'candidates');
    const candidateCount = fs.existsSync(cdir)
      ? fs.readdirSync(cdir).filter((f) => f.endsWith('.json')).length
      : 0;
    let discoveredAt: string | undefined;
    try {
      discoveredAt = fs.statSync(path.join(dir, 'pages.json')).mtime.toISOString();
    } catch {
      /* ignore */
    }
    out.push({
      name,
      pageCount: pages.length,
      formCount: forms.length,
      apiCount: apis.length,
      candidateCount,
      discoveredAt,
    });
  }
  return out.sort((a, b) => (b.discoveredAt || '').localeCompare(a.discoveredAt || ''));
}

export interface TargetDetail {
  name: string;
  pages: unknown[];
  forms: unknown[];
  apis: unknown[];
  candidates: unknown[];
}

export function getTarget(name: string): TargetDetail | null {
  if (!safeName(name)) return null;
  const dir = path.join(PROJECTS_DIR, name, 'discovered');
  if (!fs.existsSync(dir)) return null;
  const cdir = path.join(dir, 'candidates');
  const candidates: unknown[] = [];
  if (fs.existsSync(cdir)) {
    for (const f of fs.readdirSync(cdir)) {
      if (!f.endsWith('.json')) continue;
      const c = readJson<unknown>(path.join(cdir, f));
      if (c) candidates.push(c);
    }
  }
  return {
    name,
    pages: readJson<unknown[]>(path.join(dir, 'pages.json')) || [],
    forms: readJson<unknown[]>(path.join(dir, 'forms.json')) || [],
    apis: readJson<unknown[]>(path.join(dir, 'apis.json')) || [],
    candidates,
  };
}

export interface DiscoverParams {
  url: string;
  name?: string;
  loginUser?: string;
  loginPass?: string;
  depth?: number;
}

export interface DiscoverResult {
  ok: boolean;
  name: string;
  output?: string;
  error?: string;
}

function deriveName(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'target';
  }
}

/* ───────── 测试执行(runs) ───────── */

/** 列出某 target 的所有测试运行(最新在前) */
export function listRuns(name: string): any[] {
  if (!safeName(name)) return [];
  const dir = path.join(PROJECTS_DIR, name, 'runs');
  if (!fs.existsSync(dir)) return [];
  const runs: any[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const r = readJson<any>(path.join(dir, f));
    if (r) runs.push(r);
  }
  return runs.sort((a, b) => (b.runId || '').localeCompare(a.runId || ''));
}

/** 读取单次运行详情 */
export function getRun(name: string, runId: string): any | null {
  if (!safeName(name) || !/^[a-zA-Z0-9_-]+$/.test(runId)) return null;
  return readJson<any>(path.join(PROJECTS_DIR, name, 'runs', `${runId}.json`));
}

/** 子进程调 run-tests CLI,完成后返回最新一次运行 */
export function runTests(name: string): Promise<{ ok: boolean; run?: any; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', 'src/cli/run-tests.ts', `--target=${name}`], { cwd: REPO_ROOT });
    let err = '';
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => resolve({ ok: false, error: e.message }));
    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ ok: false, error: err || `exit ${code}` });
        return;
      }
      const runs = listRuns(name);
      resolve({ ok: true, run: runs[0] || null });
    });
  });
}

/** 子进程调既有 discover CLI(在仓库根运行,避免把 Playwright 打进 Next 包) */
export function runDiscover(params: DiscoverParams): Promise<DiscoverResult> {
  return new Promise((resolve) => {
    const args = ['tsx', 'src/cli/discover.ts', `--url=${params.url}`];
    if (params.name) args.push(`--name=${params.name}`);
    if (params.loginUser) args.push(`--login-user=${params.loginUser}`);
    if (params.loginPass) args.push(`--login-pass=${params.loginPass}`);
    if (params.depth != null) args.push(`--depth=${params.depth}`);

    const child = spawn('npx', args, { cwd: REPO_ROOT });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => resolve({ ok: false, name: params.name || deriveName(params.url), error: e.message }));
    child.on('close', (code) => {
      const name = params.name || deriveName(params.url);
      if (code === 0) resolve({ ok: true, name, output: out });
      else resolve({ ok: false, name, error: err || out || `exit ${code}` });
    });
  });
}
