'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Loader2, FileText, FormInput, Globe, FileCode2, Play } from 'lucide-react';
import clsx from 'clsx';
import { fetchTarget, fetchRuns, runTests, type TargetDetail } from '@/lib/api';

const TABS = [
  { id: 'pages', label: '页面', icon: FileText },
  { id: 'forms', label: '表单', icon: FormInput },
  { id: 'apis', label: 'API', icon: Globe },
  { id: 'candidates', label: '候选', icon: FileCode2 },
  { id: 'test', label: '测试', icon: Play },
] as const;
type TabId = (typeof TABS)[number]['id'];

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/** 通用标签丸 */
function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: Tone }) {
  const cls: Record<Tone, string> = {
    gray: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };
  return <span className={clsx('rounded-md px-2 py-0.5 text-xs font-medium', cls[tone])}>{children}</span>;
}
type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'purple' | 'red';

/** 字段角色 → 颜色 */
function roleTone(role: string): Tone {
  switch (role) {
    case 'password': return 'amber';
    case 'username': return 'blue';
    case 'captcha': return 'purple';
    case 'search': return 'green';
    default: return 'gray';
  }
}

/** HTTP 方法 → 颜色 */
function methodTone(method: string): Tone {
  switch ((method || '').toUpperCase()) {
    case 'GET': return 'gray';
    case 'POST': return 'green';
    case 'PUT':
    case 'PATCH': return 'amber';
    case 'DELETE': return 'red';
    default: return 'gray';
  }
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">{text}</div>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{children}</div>;
}

/* ───────── 页面 Tab ───────── */
function PagesTab({ pages, name }: { pages: any[]; name: string }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (pages.length === 0) return <Empty text="无页面" />;
  return (
    <>
      <div className="space-y-2.5">
        {pages.map((p, i) => {
          const st = p.structure || {};
          const nav = st.nav || [];
          const actions = st.actions || [];
          const headings = st.headings || [];
          const url = String(p.url || '').replace(/^https?:\/\/[^/]+/, '') || '/';
          const shot = p.screenshot
            ? `/api/targets/${encodeURIComponent(name)}/screenshot/${encodeURIComponent(p.screenshot.split('/').pop() || '')}`
            : null;
          return (
            <Card key={i}>
              {shot && (
                <button
                  type="button"
                  onClick={() => setLightbox(shot)}
                  className="mb-3 block w-full overflow-hidden rounded-lg border border-gray-100 bg-gray-50"
                  title="点击查看大图"
                >
                  <img src={shot} alt={url} className="h-40 w-full object-top object-cover" />
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold text-gray-800">{url}</span>
                {p.title && <span className="text-xs text-gray-400">{p.title}</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  <Pill tone="blue">导航 {nav.length}</Pill>
                  <Pill tone="gray">动作 {actions.length}</Pill>
                  <Pill tone="gray">标题 {headings.length}</Pill>
                </div>
              </div>
              {(nav.length > 0 || actions.length > 0) && (
                <details className="mt-2 group">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                    展开菜单与动作
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {nav.map((n: any, j: number) => (
                      <span key={`n${j}`} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{n.text}</span>
                    ))}
                    {actions.map((a: any, j: number) => (
                      <span key={`a${j}`} className="rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
                        {a.kind === 'button' ? '🔘' : '🔗'} {a.text}
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </Card>
          );
        })}
      </div>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="截图" className="max-h-full max-w-full rounded-lg shadow-2xl" />
        </div>
      )}
    </>
  );
}

/* ───────── 表单 Tab ───────── */
function FormsTab({ forms }: { forms: any[] }) {
  if (forms.length === 0) return <Empty text="无表单" />;
  return (
    <div className="space-y-3">
      {forms.map((f, i) => (
        <Card key={i}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">表单 {f.id}</span>
            <Pill tone="green">置信度 {Math.round((f.confidence || 0) * 100)}%</Pill>
            {f.submitSelector && (
              <span className="text-xs text-gray-400">
                提交按钮 <code className="rounded bg-gray-50 px-1.5 py-0.5 font-mono text-gray-600">{f.submitSelector}</code>
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {(f.fields || []).map((fl: any, j: number) => (
              <div key={j} className="flex items-center gap-3 rounded-lg bg-gray-50/60 px-3 py-2">
                <Pill tone={roleTone(fl.role)}>{fl.role}</Pill>
                <code className="font-mono text-xs text-gray-700">{fl.selector}</code>
                {fl.label && <span className="ml-auto text-xs text-gray-400">{fl.label}</span>}
              </div>
            ))}
            {(!f.fields || f.fields.length === 0) && <div className="text-xs text-gray-400">无字段</div>}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ───────── API Tab ───────── */
function ApisTab({ apis }: { apis: any[] }) {
  if (apis.length === 0) return <Empty text="无 API" />;
  return (
    <div className="space-y-2">
      {apis.map((a, i) => {
        const path = String(a.url || '').replace(/^https?:\/\/[^/]+/, '') || '/';
        const resp = a.sampleResponse;
        const body = resp?.body;
        return (
          <Card key={i}>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={methodTone(a.method)}>{a.method}</Pill>
              <code className="font-mono text-sm text-gray-800">{truncate(path, 90)}</code>
              {resp?.status && <Pill tone="green">{resp.status}</Pill>}
              <span className="ml-auto text-xs text-gray-400">调用 {a.seenCount} 次</span>
            </div>
            {body && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">响应样本</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{truncate(String(body), 2000)}</pre>
              </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ───────── 候选 Tab ───────── */
function CandidatesTab({ candidates }: { candidates: any[] }) {
  if (candidates.length === 0) return <Empty text="无候选用例" />;
  return (
    <div className="space-y-3">
      {candidates.map((c, i) => {
        const steps: any[] = c.steps || [];
        const asserts: any[] = c.assertions || [];
        return (
          <Card key={i}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">{c.name || c.id}</span>
              <Pill tone="blue">{c.source}</Pill>
              <Pill tone="gray">置信度 {Math.round((c.confidence || 0) * 100)}%</Pill>
              <span className="ml-auto font-mono text-xs text-gray-400">{c.id}</span>
            </div>
            <div className="space-y-1">
              {steps.map((s, j) => {
                const p = s.params || {};
                const detail =
                  p.selector ? p.selector :
                  p.url ? p.url :
                  p.value !== undefined ? String(p.value) : '';
                return (
                  <div key={j} className="flex items-center gap-2 text-xs">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-600">{j + 1}</span>
                    <Pill tone="gray">{s.action}</Pill>
                    {detail && <code className="font-mono text-gray-600">{truncate(detail, 70)}</code>}
                  </div>
                );
              })}
            </div>
            {asserts.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2">
                <span className="text-[11px] text-gray-400">断言</span>
                {asserts.map((a, j) => (
                  <span key={j} className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-600">
                    {a.type}{a.expected != null ? ` = ${truncate(String(a.expected), 30)}` : ''}{a.selector ? ` (${truncate(a.selector, 24)})` : ''}
                  </span>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ───────── 测试 Tab ───────── */
function stepDetail(s: any): string {
  const p = s.params || {};
  if (p.selector && p.value !== undefined) return `${p.selector} = ${p.value}`;
  if (p.selector) return String(p.selector);
  if (p.url) return String(p.url);
  return '';
}

function RunResult({ run, candidates }: { run: any; candidates: any[] }) {
  const s = run.summary || {};
  const entries = Object.entries(run.cases || {}) as [string, any][];
  const candById = new Map(candidates.map((c: any) => [c.id, c]));
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">最新运行</span>
        <Pill tone="green">通过 {s.passed || 0}</Pill>
        <Pill tone="red">失败 {s.failed || 0}</Pill>
        <Pill tone="gray">共 {s.total || 0}</Pill>
        <span className="ml-auto font-mono text-xs text-gray-400">{run.runId}</span>
      </div>
      <div className="space-y-2">
        {entries.map(([id, c]) => {
          const cand = candById.get(id);
          const candSteps: any[] = cand?.steps || [];
          const runSteps: any[] = c.steps || [];
          const statusOf = (i: number) => runSteps[i]?.status;
          const asserts: any[] = cand?.assertions || [];
          return (
            <div key={id} className="rounded-lg bg-gray-50/60 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Pill tone={c.status === 'passed' ? 'green' : 'red'}>{c.status === 'passed' ? '通过' : '失败'}</Pill>
                <span className="text-xs font-medium text-gray-700">{cand?.name || id}</span>
                {cand?.source && <Pill tone="blue">{cand.source}</Pill>}
                {c.error && (
                  <span className="ml-auto truncate text-xs text-red-500" title={c.error}>⚠ {c.error.slice(0, 50)}</span>
                )}
              </div>
              <div className="mt-1.5 space-y-0.5">
                {candSteps.map((st, j) => {
                  const ss = statusOf(j);
                  const det = stepDetail(st);
                  return (
                    <div key={j} className="flex items-center gap-2 text-xs">
                      <span
                        className={clsx(
                          'h-2 w-2 flex-shrink-0 rounded-full',
                          ss === 'passed' ? 'bg-green-400' : ss === 'failed' ? 'bg-red-400' : 'bg-gray-300',
                        )}
                      />
                      <span className="w-14 flex-shrink-0 text-gray-500">{st.action}</span>
                      {det && <code className="truncate font-mono text-gray-600">{det}</code>}
                    </div>
                  );
                })}
              </div>
              {asserts.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-gray-200/60 pt-1.5">
                  <span className="text-[11px] text-gray-400">断言</span>
                  {asserts.map((a, k) => (
                    <span key={k} className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-600">
                      {a.type}{a.expected != null ? ` ${a.expected}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {entries.length === 0 && <div className="text-xs text-gray-400">无用例结果</div>}
      </div>
    </Card>
  );
}

function TestTab({ name, candidates }: { name: string; candidates: any[] }) {
  const [runs, setRuns] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      setRuns(await fetchRuns(name));
    } catch (e: any) {
      setErr(e.message);
    }
  };
  useEffect(() => {
    load();
  }, [name]);

  const handleRun = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await runTests(name);
      if (!res.ok) setErr(res.error || '执行失败');
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleRun}
          disabled={busy}
          className={clsx(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
            busy ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'bg-blue-500 text-white hover:bg-blue-600',
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {busy ? '执行中…(约 1 分钟)' : '执行测试'}
        </button>
        <span className="text-xs text-gray-400">用 config.json 中的登录凭据,跑全部候选(登录候选由认证前置覆盖,自动跳过)</span>
      </div>
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{err}</div>}
      {busy && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 py-10 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> 正在登录并执行候选用例…
        </div>
      )}
      {!busy && runs[0] && <RunResult run={runs[0]} candidates={candidates} />}
      {!busy && runs.length === 0 && <Empty text="暂无运行记录,点击「执行测试」开始" />}
    </div>
  );
}

export default function TargetDetailPage() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params.name);
  const [data, setData] = useState<TargetDetail | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<TabId>('pages');

  useEffect(() => {
    fetchTarget(name)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [name]);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center border-b border-gray-200 bg-white/80 px-6 backdrop-blur">
        <Link href="/" className="mr-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ChevronLeft className="h-4 w-4" />
          仪表盘
        </Link>
        <h1 className="text-lg font-semibold text-gray-800">{name}</h1>
        {data && (
          <div className="ml-4 flex gap-1.5">
            <Pill tone="blue">页面 {data.pages.length}</Pill>
            <Pill tone="blue">表单 {data.forms.length}</Pill>
            <Pill tone="blue">API {data.apis.length}</Pill>
            <Pill tone="blue">候选 {data.candidates.length}</Pill>
          </div>
        )}
      </header>

      <div className="p-6">
        {err && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
        {!data && !err ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中…
          </div>
        ) : data ? (
          <>
            <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={clsx(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors',
                      active ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
            {tab === 'pages' && <PagesTab pages={data.pages} name={name} />}
            {tab === 'forms' && <FormsTab forms={data.forms} />}
            {tab === 'apis' && <ApisTab apis={data.apis} />}
            {tab === 'candidates' && <CandidatesTab candidates={data.candidates} />}
            {tab === 'test' && <TestTab name={name} candidates={data.candidates} />}
          </>
        ) : null}
      </div>
    </>
  );
}
