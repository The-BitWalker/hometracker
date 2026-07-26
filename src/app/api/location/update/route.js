import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

export async function POST(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'child') return NextResponse.json({ error: 'Only children broadcast location.' }, { status: 403 });

  const db = getDb();

  try {
    const { lat, lng } = await request.json();

    if (lat == null || lng == null) {
      return NextResponse.json({ error: 'lat and lng are required.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO member_status (user_id, family_code, current_lat, current_lng, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
            current_lat=excluded.current_lat, current_lng=excluded.current_lng, updated_at=excluded.updated_at`,
      args: [user.id, user.family_code, lat, lng, now],
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Location update error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
