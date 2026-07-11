'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Loader2, Radar, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import { startDiscovery } from '@/lib/api';

export default function DiscoverPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [depth, setDepth] = useState(2);
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const canStart = url.trim().length > 0 && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canStart) return;
    setBusy(true);
    setErr('');
    try {
      const result = await startDiscovery({
        url: url.trim(),
        name: name.trim() || undefined,
        loginUser: loginUser.trim() || undefined,
        loginPass: loginPass || undefined,
        depth,
      });
      if (result.ok) {
        router.push(`/targets/${encodeURIComponent(result.name)}`);
      } else {
        setErr(result.error || '发现失败');
      }
    } catch (e: any) {
      setErr(e.message || '请求失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center border-b border-gray-200 bg-white/80 px-6 backdrop-blur">
        <Link href="/" className="mr-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
          <ChevronLeft className="h-4 w-4" />
          返回
        </Link>
        <h1 className="text-base font-semibold text-gray-800">新建发现</h1>
      </header>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">目标 URL *</label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://127.0.0.1:8080"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-[10px] text-gray-400">要解析的网站入口地址</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">target 名称(可选)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="留空则用主机名"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">爬取深度</label>
              <input
                type="number"
                min={0}
                max={5}
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="mb-2 text-xs font-medium text-gray-600">登录凭据(可选,用于爬取登录后内容)</div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="用户名"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="密码"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-9 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{err}</div>}

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-400">发现会启动浏览器爬取,可能需要数十秒</p>
            <button
              type="submit"
              disabled={!canStart}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-colors',
                canStart ? 'bg-blue-500 text-white hover:bg-blue-600' : 'cursor-not-allowed bg-gray-100 text-gray-400',
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
              {busy ? '发现中…' : '开始发现'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
