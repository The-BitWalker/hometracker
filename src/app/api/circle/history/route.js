import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

// GET: Fetch location breadcrumb history for circle members
export async function GET(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('user_id');

  const db = getDb();

  try {
    // 1. Check circle subscription tier
    const circleRes = await db.execute({
      sql: `SELECT subscription_tier FROM family_circles WHERE family_code = ?`,
      args: [user.family_code],
    });
    const tier = (circleRes.rows[0]?.subscription_tier || 'basic').toLowerCase();
    const isPlus = tier !== 'basic' && tier !== 'free';

    // Calculate cutoff timestamp: 24h for Basic, 30 days for Plus
    const cutoffDate = new Date();
    if (isPlus) {
      cutoffDate.setDate(cutoffDate.getDate() - 30);
    } else {
      cutoffDate.setHours(cutoffDate.getHours() - 24);
    }
    const cutoffIso = cutoffDate.toISOString();

    let sql = `SELECT id, user_id, lat, lng, timestamp FROM location_history WHERE family_code = ? AND timestamp >= ?`;
    let args = [user.family_code, cutoffIso];

    if (targetUserId) {
      sql += ` AND user_id = ?`;
      args.push(targetUserId);
    }

    sql += ` ORDER BY timestamp ASC`;

    const res = await db.execute({ sql, args });

    return NextResponse.json({
      subscription_tier: tier,
      history_limit_days: isPlus ? 30 : 1,
      breadcrumbs: res.rows,
    });
  } catch (e) {
    console.error('Location history GET error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
