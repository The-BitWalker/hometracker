import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

export async function POST(request) {
  await ensureSchema();
  const user = await validateSession(request.headers.get('cookie'));
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent') return NextResponse.json({ error: 'Only parents can kick members' }, { status: 403 });

  const db = getDb();

  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Verify the target user belongs to the parent's family code
    const target = await db.execute({
      sql: 'SELECT id, name, role FROM users WHERE id = ? AND family_code = ?',
      args: [user_id, user.family_code]
    });

    if (target.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found or not in your family circle' }, { status: 404 });
    }

    if (target.rows[0].role === 'parent') {
      return NextResponse.json({ error: 'Cannot kick another parent' }, { status: 403 });
    }

    // Instead of deleting the user, we orphan them by clearing the family_code
    await db.execute({ sql: "UPDATE users SET family_code = '' WHERE id = ?", args: [user_id] });
    await db.execute({ sql: 'DELETE FROM member_status WHERE user_id = ?', args: [user_id] });
    
    // Add a notification for the kicked user
    const notificationId = crypto.randomUUID();
    const message = `You have been removed from the family circle by a parent.`;
    const now = new Date().toISOString();
    await db.execute({
      sql: 'INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [notificationId, user_id, message, 0, now]
    });

    // Add a notification for everyone else still in the circle
    const remainingMembers = await db.execute({
      sql: "SELECT id FROM users WHERE family_code = ?",
      args: [user.family_code]
    });
    
    const kickedName = target.rows[0].name;
    for (const member of remainingMembers.rows) {
      const nid = crypto.randomUUID();
      await db.execute({
        sql: 'INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [nid, member.id, `${kickedName} has been removed from the family circle.`, 0, now]
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Kick member error:', e);
    return NextResponse.json({ error: 'Server error while kicking member' }, { status: 500 });
  }
}
