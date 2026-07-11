import { NextRequest, NextResponse } from 'next/server';
import { runTests } from '@/lib/projects';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const result = await runTests(name);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
