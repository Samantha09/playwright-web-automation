import { NextRequest, NextResponse } from 'next/server';
import { getTarget } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const detail = getTarget(name);
  if (!detail) return NextResponse.json({ error: 'target not found' }, { status: 404 });
  return NextResponse.json(detail);
}
