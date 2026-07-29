import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent') return NextResponse.json({ error: 'Only parents can update curfews.' }, { status: 403 });

  const db = getDb();

  try {
    const body = await request.json();
    const { custom_curfews } = body;
    const now = new Date().toISOString();

    // Serialize custom_curfews to string
    const curfewsStr = typeof custom_curfews === 'object' ? JSON.stringify(custom_curfews) : '{}';

    await db.execute({
      sql: `UPDATE family_circles SET custom_curfews = ?, updated_at = ? WHERE family_code = ?`,
      args: [curfewsStr, now, user.family_code],
    });

    return NextResponse.json({ success: true, custom_curfews: custom_curfews || {} });
  } catch (e) {
    console.error('Circle curfews POST error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
