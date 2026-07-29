import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession, logLifecycle } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const startTime = Date.now();
  logLifecycle('API_SESSION_START');

  try {
    await ensureSchema();

    let maintenanceMode = false;
    try {
      const db = getDb();
      const settingsRes = await db.execute(`SELECT setting_value FROM app_settings WHERE setting_key = 'maintenance_mode'`);
      if (settingsRes.rows.length > 0 && settingsRes.rows[0].setting_value === 'true') {
        maintenanceMode = true;
      }
    } catch (e) {
      logLifecycle('API_SESSION_MAINTENANCE_CHECK_WARN', { error: e.message });
    }

    const cookieHeader = request.headers.get('cookie');
    const user = await validateSession(cookieHeader);

    if (!user) {
      logLifecycle('API_SESSION_UNAUTHENTICATED', { durationMs: Date.now() - startTime });
      return NextResponse.json({ authenticated: false, maintenanceMode }, { status: 401 });
    }

    logLifecycle('API_SESSION_SUCCESS', { userId: user.id, role: user.role, durationMs: Date.now() - startTime });

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
  } catch (err) {
    logLifecycle('API_SESSION_ERROR', { error: err.message, stack: err.stack, durationMs: Date.now() - startTime });
    return NextResponse.json({ authenticated: false, error: 'Server authentication error' }, { status: 500 });
  }
}

