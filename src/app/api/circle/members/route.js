import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

export async function GET(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  try {
    const res = await db.execute({
      sql: `SELECT users.id, users.name, users.email, users.role, users.is_deactivated,
                   member_status.current_lat, member_status.current_lng
            FROM users
            LEFT JOIN member_status ON users.id = member_status.user_id
            WHERE users.family_code = ?`,
      args: [user.family_code],
    });

    const activeMembers = [];
    const deactivatedMembers = [];

    for (const r of res.rows) {
      const memberObj = {
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        is_deactivated: Boolean(r.is_deactivated),
        current_lat: r.current_lat || null,
        current_lng: r.current_lng || null,
      };

      if (r.is_deactivated) {
        deactivatedMembers.push(memberObj);
      } else {
        activeMembers.push(memberObj);
      }
    }

    return NextResponse.json({
      members: activeMembers,
      deactivated_members: deactivatedMembers,
      deactivated_count: deactivatedMembers.length,
    });
  } catch (e) {
    console.error('Members GET error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
