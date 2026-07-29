import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession, logLifecycle } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const startTime = Date.now();
  logLifecycle('API_NOTIFICATIONS_START');

  try {
    await ensureSchema();
    const user = await validateSession(request.headers.get('cookie'));
    
    if (!user) {
      logLifecycle('API_NOTIFICATIONS_UNAUTHENTICATED', { durationMs: Date.now() - startTime });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();

    const notifications = await db.execute({
      sql: 'SELECT id, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      args: [user.id]
    });

    logLifecycle('API_NOTIFICATIONS_SUCCESS', { count: notifications.rows.length, durationMs: Date.now() - startTime });

    return NextResponse.json({ notifications: notifications.rows });
  } catch (e) {
    logLifecycle('API_NOTIFICATIONS_ERROR', { error: e.message, stack: e.stack, durationMs: Date.now() - startTime });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  await ensureSchema();
  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'remind_parent_survey') {
      const parentRes = await db.execute({
        sql: `SELECT id FROM users WHERE family_code = ? AND role = 'parent'`,
        args: [user.family_code],
      });

      const now = new Date().toISOString();
      const msg = `⏳ Reminder: ${user.name} is waiting for you to complete the monthly HomeTracker Pro feedback review to unblock circle access!`;

      for (const p of parentRes.rows) {
        await db.execute({
          sql: `INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
          args: [crypto.randomUUID(), p.id, msg, now],
        });
      }

      return NextResponse.json({ success: true, message: 'Notification sent to circle parent.' });
    }

    if (action === 'remind_parent_upgrade') {
      const parentRes = await db.execute({
        sql: `SELECT id FROM users WHERE family_code = ? AND role = 'parent'`,
        args: [user.family_code],
      });

      const now = new Date().toISOString();
      const msg = `⚡ Reminder: ${user.name}'s account is temporarily paused because your circle is on Basic plan. Upgrade back to HomeTracker Pro within 7 days to automatically reactivate them!`;

      for (const p of parentRes.rows) {
        await db.execute({
          sql: `INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
          args: [crypto.randomUUID(), p.id, msg, now],
        });
      }

      return NextResponse.json({ success: true, message: 'Upgrade reminder sent to circle parent.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('Post notification error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
