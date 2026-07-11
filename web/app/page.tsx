'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Radar, FileText, FormInput, Globe, FileCode2, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { fetchTargets, type TargetSummary } from '@/lib/api';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <Icon className="w-3.5 h-3.5 text-gray-400" />
      <span>{value}</span>
      <span className="text-gray-400">{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const [targets, setTargets] = useState<TargetSummary[] | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      setTargets(await fetchTargets());
    } catch (e: any) {
      setErr(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-6 backdrop-blur">
        <div>
          <h1 className="text-base font-semibold text-gray-800">仪表盘</h1>
          <p className="text-xs text-gray-400">已发现的网站与生成的测试候选</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
            刷新
          </button>
          <Link
            href="/discover"
            className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
          >
            <Radar className="w-3.5 h-3.5" />
            新建发现
          </Link>
        </div>
      </header>

      <div className="p-6">
        {err && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{err}</div>}

        {targets === null ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中…
          </div>
        ) : targets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-24 text-center">
            <Radar className="mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">还没有已发现的网站</p>
            <Link href="/discover" className="mt-3 text-xs text-blue-600 hover:underline">
              去新建一次发现 →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {targets.map((t) => (
              <Link
                key={t.name}
                href={`/targets/${encodeURIComponent(t.name)}`}
                className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-gray-800 group-hover:text-blue-600">{t.name}</div>
                    <div className="mt-0.5 text-[10px] text-gray-400">{timeAgo(t.discoveredAt)}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-300 group-hover:text-blue-400" />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  <Stat icon={FileText} label="页面" value={t.pageCount} />
                  <Stat icon={FormInput} label="表单" value={t.formCount} />
                  <Stat icon={Globe} label="API" value={t.apiCount} />
                  <Stat icon={FileCode2} label="候选" value={t.candidateCount} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
