import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession, logLifecycle } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Fetch home address + curfew for the user's family
export async function GET(request) {
  const startTime = Date.now();
  logLifecycle('API_CIRCLE_HOME_START');

  try {
    await ensureSchema();

    const user = await validateSession(request.headers.get('cookie'));
    if (!user) {
      logLifecycle('API_CIRCLE_HOME_UNAUTHENTICATED', { durationMs: Date.now() - startTime });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();

    const res = await db.execute({
      sql: 'SELECT home_address, home_lat, home_lng, target_home_time FROM family_circles WHERE family_code = ?',
      args: [user.family_code],
    });

    logLifecycle('API_CIRCLE_HOME_SUCCESS', { durationMs: Date.now() - startTime });

    if (res.rows.length > 0) {
      return NextResponse.json({ home: res.rows[0] });
    }

    return NextResponse.json({ home: null });
  } catch (e) {
    logLifecycle('API_CIRCLE_HOME_ERROR', { error: e.message, stack: e.stack, durationMs: Date.now() - startTime });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Save/update home address or curfew time (parent only)
export async function POST(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent') return NextResponse.json({ error: 'Only parents can update home settings.' }, { status: 403 });

  const db = getDb();

  try {
    const body = await request.json();
    const now = new Date().toISOString();
    let updated = false;

    // Check if we need to update address
    if (body.home_address !== undefined) {
      let lat = body.home_lat || 51.5074;
      let lng = body.home_lng || -0.1278;

      if (body.home_address) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(body.home_address)}`,
            { 
              headers: { 'User-Agent': 'HOMETRACKER/1.0' },
              signal: AbortSignal.timeout(5000)
            }
          );
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            lat = parseFloat(geoData[0].lat);
            lng = parseFloat(geoData[0].lon);
          }
        } catch (geoErr) {
          console.warn('Geocoding failed, using fallback coords:', geoErr);
        }
      }

      await db.execute({
        sql: `INSERT INTO family_circles (family_code, home_address, home_lat, home_lng, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(family_code) DO UPDATE SET
              home_address=excluded.home_address, home_lat=excluded.home_lat, home_lng=excluded.home_lng, updated_at=excluded.updated_at`,
        args: [user.family_code, body.home_address, lat, lng, now],
      });
      updated = true;
    }

    // Check if we need to update curfew
    if (body.target_home_time !== undefined) {
      await db.execute({
        sql: `INSERT INTO family_circles (family_code, target_home_time, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(family_code) DO UPDATE SET
              target_home_time=excluded.target_home_time, updated_at=excluded.updated_at`,
        args: [user.family_code, body.target_home_time, now],
      });
      updated = true;
    }

    if (updated) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'No valid field provided.' }, { status: 400 });
  } catch (e) {
    console.error('Circle home POST error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
