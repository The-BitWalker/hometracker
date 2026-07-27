import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

export async function GET(request) {
  await ensureSchema();
  const user = await validateSession(request.headers.get('cookie'));
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  try {
    const notifications = await db.execute({
      sql: 'SELECT id, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      args: [user.id]
    });

    return NextResponse.json({ notifications: notifications.rows });
  } catch (e) {
    console.error('Fetch notifications error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
