import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

export async function POST(req) {
  await ensureSchema();
  const cookieHeader = req.headers.get('cookie');
  const admin = await validateSession(cookieHeader);

  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const db = getDb();
    await db.execute('DELETE FROM pro_feedback');
    return NextResponse.json({ success: true, message: 'Monthly survey forced for all Pro users.' });
  } catch (e) {
    console.error('Admin force survey POST error:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
