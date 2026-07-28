import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

// GET: Fetch all extra locations for the user's family circle
export async function GET(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  try {
    const res = await db.execute({
      sql: 'SELECT id, family_code, name, address, lat, lng, created_at FROM family_locations WHERE family_code = ? ORDER BY created_at ASC',
      args: [user.family_code],
    });

    return NextResponse.json({ locations: res.rows });
  } catch (e) {
    console.error('Locations GET error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Add a new location (parent only, maximum 3 locations total including home)
export async function POST(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent') return NextResponse.json({ error: 'Only parents can add extra locations.' }, { status: 403 });

  const db = getDb();

  try {
    const body = await request.json();
    const { name, address } = body;

    if (!name || !name.trim() || !address || !address.trim()) {
      return NextResponse.json({ error: 'Location name and address are required.' }, { status: 400 });
    }

    // 1. Check current locations count (Home + Extra Locations)
    const homeRes = await db.execute({
      sql: 'SELECT home_address FROM family_circles WHERE family_code = ?',
      args: [user.family_code],
    });
    const hasHome = homeRes.rows.length > 0 && homeRes.rows[0].home_address && homeRes.rows[0].home_address.trim() !== '';

    const locationsRes = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM family_locations WHERE family_code = ?',
      args: [user.family_code],
    });
    const extraCount = Number(locationsRes.rows[0]?.count || 0);
    const totalCount = (hasHome ? 1 : 0) + extraCount;

    if (totalCount >= 2) {
      return NextResponse.json({ error: 'Maximum of 2 locations (including Home) allowed.' }, { status: 400 });
    }

    // 2. Geocode address via OpenStreetMap Nominatim
    let lat = 51.5074;
    let lng = -0.1278;

    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address.trim())}`,
        { headers: { 'User-Agent': 'HOMETRACKER/1.0' } }
      );
      const geoData = await geoRes.json();
      if (geoData && geoData.length > 0) {
        lat = parseFloat(geoData[0].lat);
        lng = parseFloat(geoData[0].lon);
      }
    } catch (geoErr) {
      console.warn('Geocoding failed for extra location, using fallback coords:', geoErr);
    }

    // 3. Insert into family_locations
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO family_locations (id, family_code, name, address, lat, lng, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, user.family_code, name.trim(), address.trim(), lat, lng, now],
    });

    const newLocation = {
      id,
      family_code: user.family_code,
      name: name.trim(),
      address: address.trim(),
      lat,
      lng,
      created_at: now,
    };

    return NextResponse.json({ success: true, location: newLocation });
  } catch (e) {
    console.error('Locations POST error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT: Edit an existing location (parent only)
export async function PUT(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent') return NextResponse.json({ error: 'Only parents can edit locations.' }, { status: 403 });

  const db = getDb();

  try {
    const body = await request.json();
    const { id, name, address } = body;

    if (!id || !name || !name.trim() || !address || !address.trim()) {
      return NextResponse.json({ error: 'Location ID, name, and address are required.' }, { status: 400 });
    }

    // Geocode updated address
    let lat = 51.5074;
    let lng = -0.1278;

    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address.trim())}`,
        { headers: { 'User-Agent': 'HOMETRACKER/1.0' } }
      );
      const geoData = await geoRes.json();
      if (geoData && geoData.length > 0) {
        lat = parseFloat(geoData[0].lat);
        lng = parseFloat(geoData[0].lon);
      }
    } catch (geoErr) {
      console.warn('Geocoding failed for edited location, using fallback coords:', geoErr);
    }

    await db.execute({
      sql: `UPDATE family_locations SET name = ?, address = ?, lat = ?, lng = ? WHERE id = ? AND family_code = ?`,
      args: [name.trim(), address.trim(), lat, lng, id, user.family_code],
    });

    return NextResponse.json({ success: true, location: { id, name: name.trim(), address: address.trim(), lat, lng } });
  } catch (e) {
    console.error('Locations PUT error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE: Remove an extra location (parent only)
export async function DELETE(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent') return NextResponse.json({ error: 'Only parents can delete locations.' }, { status: 403 });

  const db = getDb();

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Location ID is required.' }, { status: 400 });
    }

    await db.execute({
      sql: 'DELETE FROM family_locations WHERE id = ? AND family_code = ?',
      args: [id, user.family_code],
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Locations DELETE error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
