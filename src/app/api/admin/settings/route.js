import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

export async function GET(req) {
  await ensureSchema();
  const cookieHeader = req.headers.get('cookie');
  const admin = await validateSession(cookieHeader);

  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = getDb();
  try {
    const res = await db.execute(`SELECT * FROM app_settings`);
    const settings = {};
    for (const row of res.rows) {
      settings[row.setting_key] = row.setting_value;
    }
    return NextResponse.json({ settings });
  } catch (e) {
    console.error('Admin settings GET error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  await ensureSchema();
  const cookieHeader = req.headers.get('cookie');
  const admin = await validateSession(cookieHeader);

  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { setting_key, setting_value } = body;

    if (!setting_key || !setting_value) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at`,
      args: [setting_key, setting_value, new Date().toISOString()]
    });

    return NextResponse.json({ success: true, message: 'Settings updated successfully' });
  } catch (e) {
    console.error('Admin settings POST error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
