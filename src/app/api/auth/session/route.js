import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

export async function GET(request) {
  await ensureSchema();

  let maintenanceMode = false;
  try {
    const db = getDb();
    const settingsRes = await db.execute(`SELECT setting_value FROM app_settings WHERE setting_key = 'maintenance_mode'`);
    if (settingsRes.rows.length > 0 && settingsRes.rows[0].setting_value === 'true') {
      maintenanceMode = true;
    }
  } catch (e) {
    // If table doesn't exist yet, ignore
  }

  const cookieHeader = request.headers.get('cookie');
  const user = await validateSession(cookieHeader);

  if (!user) {
    return NextResponse.json({ authenticated: false, maintenanceMode }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    maintenanceMode,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      family_code: user.family_code,
      is_deactivated: Boolean(user.is_deactivated),
      pro_status: user.pro_status || 'none',
      deactivated_at: user.deactivated_at || null,
    },
  });
}
