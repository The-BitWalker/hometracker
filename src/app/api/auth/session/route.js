import { NextResponse } from 'next/server';
import { ensureSchema, validateSession } from '@/lib/db';

export async function GET(request) {
  await ensureSchema();

  const cookieHeader = request.headers.get('cookie');
  const user = await validateSession(cookieHeader);

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      family_code: user.family_code,
    },
  });
}
