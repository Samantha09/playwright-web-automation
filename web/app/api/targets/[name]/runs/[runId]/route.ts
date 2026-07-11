import { NextRequest, NextResponse } from 'next/server';
import { getRun } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string; runId: string }> },
) {
  const { name, runId } = await params;
  const run = getRun(name, runId);
  if (!run) return NextResponse.json({ error: 'run not found' }, { status: 404 });
  return NextResponse.json(run);
}
