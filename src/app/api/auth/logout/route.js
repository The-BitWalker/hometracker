import { NextResponse } from 'next/server';
import { getDb, ensureSchema, clearSessionCookieHeader } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  await ensureSchema();

  const cookieHeader = request.headers.get('cookie');
  const match = cookieHeader?.match(/(?:^|;\s*)ht_session=([^;]+)/);
  const token = match?.[1];

  if (token) {
    try {
      const db = getDb();
      await db.execute({ sql: 'DELETE FROM session_tokens WHERE token = ?', args: [token] });
    } catch (e) {
      console.error('Logout DB error:', e);
    }
  }

  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', clearSessionCookieHeader());
  return response;
}
