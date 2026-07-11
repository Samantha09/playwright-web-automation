import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(process.cwd(), '..');
const PROJECTS_DIR = path.join(REPO_ROOT, 'projects');

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string; file: string }> },
) {
  const { name, file } = await params;
  // 路径穿越防护:仅允许安全字符 + .png
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return notFound();
  if (!/^[a-zA-Z0-9_-]+\.png$/.test(file)) return notFound();

  const fp = path.join(PROJECTS_DIR, name, 'discovered', 'screenshots', file);
  if (!fs.existsSync(fp)) return notFound();

  const buf = fs.readFileSync(fp);
  return new NextResponse(buf, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=3600',
    },
  });
}

function notFound() {
  return new NextResponse('not found', { status: 404 });
}
