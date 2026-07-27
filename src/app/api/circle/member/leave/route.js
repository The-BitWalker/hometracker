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
    // Delete all user data
    await db.execute({ sql: 'DELETE FROM session_tokens WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM member_status WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });

    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  } catch (e) {
    console.error('Leave circle error:', e);
    return NextResponse.json({ error: 'Server error while leaving circle' }, { status: 500 });
  }
}
