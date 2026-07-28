import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

export async function GET(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const db = getDb();

  try {
    const totalUsersRes = await db.execute(`SELECT COUNT(*) as count FROM users`);
    const freeUsersRes = await db.execute(`SELECT COUNT(*) as count FROM users WHERE pro_status IS NULL OR pro_status = 'none' OR pro_status = 'revoked'`);
    const proUsersRes = await db.execute(`SELECT COUNT(*) as count FROM users WHERE pro_status = 'approved'`);
    const pendingReqRes = await db.execute(`SELECT COUNT(*) as count FROM pro_requests WHERE status = 'pending'`);
    const feedbackRes = await db.execute(`SELECT COUNT(*) as count FROM pro_feedback`);
    const totalCirclesRes = await db.execute(`SELECT COUNT(*) as count FROM family_circles`);

    return NextResponse.json({
      stats: {
        total_users: Number(totalUsersRes.rows[0]?.count || 0),
        free_users: Number(freeUsersRes.rows[0]?.count || 0),
        pro_users: Number(proUsersRes.rows[0]?.count || 0),
        pending_requests: Number(pendingReqRes.rows[0]?.count || 0),
        total_feedback: Number(feedbackRes.rows[0]?.count || 0),
        total_circles: Number(totalCirclesRes.rows[0]?.count || 0),
      },
    });
  } catch (e) {
    console.error('Admin stats error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
