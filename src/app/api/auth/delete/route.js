import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession, verifyPassword, clearSessionCookieHeader } from '@/lib/db';

export async function POST(request) {
  await ensureSchema();
  const db = getDb();

  const userSession = await validateSession(request.headers.get('cookie'));
  if (!userSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required to delete account.' }, { status: 400 });
    }

    const res = await db.execute({
      sql: 'SELECT password_hash FROM users WHERE id = ?',
      args: [userSession.id],
    });

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const isValid = await verifyPassword(password, res.rows[0].password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }

    // Delete user data
    await db.execute({ sql: 'DELETE FROM session_tokens WHERE user_id = ?', args: [userSession.id] });
    await db.execute({ sql: 'DELETE FROM member_status WHERE user_id = ?', args: [userSession.id] });
    await db.execute({ sql: 'DELETE FROM notifications WHERE user_id = ?', args: [userSession.id] });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userSession.id] });

    // Note: If they were a parent and the only one in the family circle, the circle becomes orphaned,
    // but the delete route should handle proper circle deletion. This is just an account deletion.

    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', clearSessionCookieHeader());
    return response;
  } catch (e) {
    console.error('Delete account error:', e);
    return NextResponse.json({ error: 'Server error during account deletion.' }, { status: 500 });
  }
}
