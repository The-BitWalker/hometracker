import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';
import { evaluateNotifications } from '@/app/api/notifications/check/route';

export async function POST(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'child') return NextResponse.json({ error: 'Only children broadcast location.' }, { status: 403 });

  const db = getDb();

  try {
    const { lat, lng } = await request.json();

    if (lat == null || lng == null) {
      return NextResponse.json({ error: 'lat and lng are required.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Upsert member_status (existing behaviour)
    await db.execute({
      sql: `INSERT INTO member_status (user_id, family_code, current_lat, current_lng, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
            current_lat=excluded.current_lat, current_lng=excluded.current_lng, updated_at=excluded.updated_at`,
      args: [user.id, user.family_code, lat, lng, now],
    });

    // Record breadcrumb ping to location_history
    try {
      await db.execute({
        sql: `INSERT INTO location_history (id, user_id, family_code, lat, lng, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [crypto.randomUUID(), user.id, user.family_code, lat, lng, now],
      });
    } catch (hErr) {
      console.warn('Failed to log location history (non-fatal):', hErr);
    }

    // Run notification checks
    try {
      const homeRes = await db.execute({
        sql: `SELECT home_lat, home_lng, target_home_time FROM family_circles WHERE family_code = ?`,
        args: [user.family_code],
      });
      const home = homeRes.rows.length > 0 ? homeRes.rows[0] : null;

      if (home && home.home_lat != null) {
        const member = {
          id: user.id,
          name: user.name,
          family_code: user.family_code,
          current_lat: lat,
          current_lng: lng,
        };
        await evaluateNotifications(db, member, home);
      }
    } catch (notifErr) {
      // Don't fail the location update if notification checks error
      console.error('Notification check error (non-fatal):', notifErr);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Location update error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
