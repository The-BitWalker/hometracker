import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

export async function POST(request) {
  await ensureSchema();
  const user = await validateSession(request.headers.get('cookie'));
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  try {
    const { family_code } = await request.json();

    if (!family_code || family_code.trim().length < 4) {
      return NextResponse.json({ error: 'Invalid family code' }, { status: 400 });
    }

    const parentCheck = await db.execute({
      sql: 'SELECT id FROM users WHERE family_code = ? AND role = ?',
      args: [family_code.trim(), 'parent'],
    });

    if (parentCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Family code not found' }, { status: 404 });
    }

    // Join the circle, forcing role to 'child' just to be safe for joiners.
    await db.execute({
      sql: "UPDATE users SET family_code = ?, role = 'child' WHERE id = ?",
      args: [family_code.trim(), user.id]
    });

    const members = await db.execute({
      sql: 'SELECT id FROM users WHERE family_code = ?',
      args: [family_code.trim()],
    });

    const now = new Date().toISOString();
    for (const m of members.rows) {
      const notificationId = crypto.randomUUID();
      const msg = m.id === user.id ? 'You have joined the family circle!' : `${user.name} has joined the family circle!`;
      await db.execute({
        sql: 'INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [notificationId, m.id, msg, 0, now]
      });
    }

    return NextResponse.json({ success: true, role: 'child', family_code: family_code.trim() });
  } catch (e) {
    console.error('Join circle error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
