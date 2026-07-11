'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Loader2, FileText, FormInput, Globe, FileCode2 } from 'lucide-react';
import clsx from 'clsx';
import { fetchTarget, type TargetDetail } from '@/lib/api';

const TABS = [
  { id: 'pages', label: '页面', icon: FileText },
  { id: 'forms', label: '表单', icon: FormInput },
  { id: 'apis', label: 'API', icon: Globe },
  { id: 'candidates', label: '候选', icon: FileCode2 },
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
function PagesTab({ pages }: { pages: any[] }) {
  if (pages.length === 0) return <Empty text="无页面" />;
  return (
    <div className="space-y-2.5">
      {pages.map((p, i) => {
        const st = p.structure || {};
        const nav = st.nav || [];
        const actions = st.actions || [];
        const headings = st.headings || [];
        const url = String(p.url || '').replace(/^https?:\/\/[^/]+/, '') || '/';
        return (
          <Card key={i}>
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
            {tab === 'pages' && <PagesTab pages={data.pages} />}
            {tab === 'forms' && <FormsTab forms={data.forms} />}
            {tab === 'apis' && <ApisTab apis={data.apis} />}
            {tab === 'candidates' && <CandidatesTab candidates={data.candidates} />}
          </>
        ) : null}
      </div>
    </>
  );
}
