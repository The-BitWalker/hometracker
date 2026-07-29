import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  await ensureSchema();
  const user = await validateSession(request.headers.get('cookie'));
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  try {
    const { notification_ids } = await request.json();

    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return NextResponse.json({ error: 'Invalid notification IDs' }, { status: 400 });
    }

    // Construct placeholders for IN clause
    const placeholders = notification_ids.map(() => '?').join(',');
    
    await db.execute({
      sql: `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`,
      args: [user.id, ...notification_ids]
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Mark read error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
