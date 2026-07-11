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

function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'blue' | 'green' | 'amber' }) {
  const cls = {
    gray: 'bg-gray-100 text-gray-500',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
  }[tone];
  return <span className={clsx('rounded px-1.5 py-0.5 text-[10px] font-medium', cls)}>{children}</span>;
}

function PagesTab({ pages }: { pages: any[] }) {
  if (pages.length === 0) return <Empty text="无页面" />;
  return (
    <div className="space-y-2">
      {pages.map((p, i) => {
        const st = p.structure || {};
        const url = String(p.url || '').replace(/^https?:\/\/[^/]+/, '');
        return (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-800">{url || '/'}</span>
              {p.title && <span className="text-xs text-gray-400">{p.title}</span>}
              <div className="ml-auto flex gap-1.5">
                <Badge tone="blue">nav {(st.nav || []).length}</Badge>
                <Badge tone="gray">动作 {(st.actions || []).length}</Badge>
                <Badge tone="gray">标题 {(st.headings || []).length}</Badge>
              </div>
            </div>
            {(st.nav || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(st.nav || []).map((n: any, j: number) => (
                  <span key={j} className="rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500">
                    {n.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormsTab({ forms }: { forms: any[] }) {
  if (forms.length === 0) return <Empty text="无表单" />;
  return (
    <div className="space-y-2">
      {forms.map((f, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{f.id}</span>
            <Badge tone="green">{Math.round((f.confidence || 0) * 100)}%</Badge>
            <span className="ml-auto font-mono text-[10px] text-gray-400">{f.submitSelector || '(无提交按钮)'}</span>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="py-1 pr-3 font-medium">角色</th>
                  <th className="py-1 pr-3 font-medium">选择器</th>
                  <th className="py-1 font-medium">标签</th>
                </tr>
              </thead>
              <tbody>
                {(f.fields || []).map((fl: any, j: number) => (
                  <tr key={j} className="border-t border-gray-50">
                    <td className="py-1 pr-3"><Badge tone="blue">{fl.role}</Badge></td>
                    <td className="py-1 pr-3 font-mono text-gray-600">{fl.selector}</td>
                    <td className="py-1 text-gray-400">{fl.label || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ApisTab({ apis }: { apis: any[] }) {
  if (apis.length === 0) return <Empty text="无 API" />;
  return (
    <div className="space-y-2">
      {apis.map((a, i) => {
        const path = String(a.url || '').replace(/^https?:\/\/[^/]+/, '');
        const body = a.sampleResponse?.body;
        return (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <Badge tone={a.method === 'GET' ? 'gray' : 'amber'}>{a.method}</Badge>
              <span className="font-mono text-sm text-gray-800">{truncate(path, 80)}</span>
              {a.sampleResponse?.status && <Badge tone="green">{a.sampleResponse.status}</Badge>}
              <span className="ml-auto text-[10px] text-gray-400">×{a.seenCount}</span>
            </div>
            {body && (
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-[10px] text-gray-600">{truncate(String(body), 600)}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CandidatesTab({ candidates }: { candidates: any[] }) {
  if (candidates.length === 0) return <Empty text="无候选用例" />;
  return (
    <div className="space-y-2">
      {candidates.map((c, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{c.name || c.id}</span>
            <Badge tone="gray">{c.source}</Badge>
            <span className="ml-auto font-mono text-[10px] text-gray-400">{c.id}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(c.steps || []).map((s: any, j: number) => (
              <span key={j} className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] text-blue-600">
                {j + 1}.{s.action}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-xs text-gray-400">{text}</div>;
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
        <Link href="/" className="mr-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
          <ChevronLeft className="h-4 w-4" />
          仪表盘
        </Link>
        <h1 className="text-base font-semibold text-gray-800">{name}</h1>
        {data && (
          <div className="ml-4 flex gap-1.5">
            <Badge tone="blue">页面 {data.pages.length}</Badge>
            <Badge tone="blue">表单 {data.forms.length}</Badge>
            <Badge tone="blue">API {data.apis.length}</Badge>
            <Badge tone="blue">候选 {data.candidates.length}</Badge>
          </div>
        )}
      </header>

      <div className="p-6">
        {err && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{err}</div>}
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
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors',
                      active ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
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
