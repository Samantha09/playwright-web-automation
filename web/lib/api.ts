export interface TargetSummary {
  name: string;
  pageCount: number;
  formCount: number;
  apiCount: number;
  candidateCount: number;
  discoveredAt?: string;
}

export interface TargetDetail {
  name: string;
  pages: any[];
  forms: any[];
  apis: any[];
  candidates: any[];
}

export interface DiscoverResult {
  ok: boolean;
  name: string;
  output?: string;
  error?: string;
}

export async function fetchTargets(): Promise<TargetSummary[]> {
  const r = await fetch('/api/targets', { cache: 'no-store' });
  if (!r.ok) throw new Error('加载 target 列表失败');
  const data = await r.json();
  return data.targets as TargetSummary[];
}

export async function fetchTarget(name: string): Promise<TargetDetail> {
  const r = await fetch(`/api/targets/${encodeURIComponent(name)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('加载 target 失败');
  return (await r.json()) as TargetDetail;
}

export async function startDiscovery(params: {
  url: string;
  name?: string;
  loginUser?: string;
  loginPass?: string;
  depth?: number;
}): Promise<DiscoverResult> {
  const r = await fetch('/api/discover', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  return (await r.json()) as DiscoverResult;
}
