import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession, clearSessionCookieHeader } from '@/lib/db';

export async function POST(request) {
  await ensureSchema();
  const user = await validateSession(request.headers.get('cookie'));
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only children can "leave". Parents have to "delete" the circle.
  if (user.role !== 'child') {
    return NextResponse.json({ error: 'Parents cannot leave the circle. Use the delete circle option instead.' }, { status: 403 });
  }

  const db = getDb();
  const userId = user.id;

  try {
    const familyCode = user.family_code;
    const userName = user.name;
    
    // Orphan the user
    await db.execute({ sql: "UPDATE users SET family_code = '' WHERE id = ?", args: [userId] });
    await db.execute({ sql: 'DELETE FROM member_status WHERE user_id = ?', args: [userId] });

    // Notify everyone else in the circle
    const remainingMembers = await db.execute({
      sql: "SELECT id FROM users WHERE family_code = ?",
      args: [familyCode]
    });
    
    const now = new Date().toISOString();
    for (const member of remainingMembers.rows) {
      const notificationId = crypto.randomUUID();
      const message = `${userName} has left the family circle.`;
      await db.execute({
        sql: 'INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [notificationId, member.id, message, 0, now]
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Leave circle error:', e);
    return NextResponse.json({ error: 'Server error while leaving circle' }, { status: 500 });
  }
}
