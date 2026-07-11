import { NextRequest, NextResponse } from 'next/server';
import { listRuns } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return NextResponse.json({ runs: listRuns(name) });
}
