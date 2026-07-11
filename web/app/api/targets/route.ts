import { NextResponse } from 'next/server';
import { listTargets } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ targets: listTargets() });
}
