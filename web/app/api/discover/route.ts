import { NextRequest, NextResponse } from 'next/server';
import { runDiscover, type DiscoverParams } from '@/lib/projects';

export const dynamic = 'force-dynamic';
// discovery 耗时较长,关闭默认响应上限保护
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: Partial<DiscoverParams>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }
  const result = await runDiscover({
    url: body.url,
    name: body.name,
    loginUser: body.loginUser,
    loginPass: body.loginPass,
    depth: body.depth,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
