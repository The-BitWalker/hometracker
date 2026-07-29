import { NextResponse } from 'next/server';
import { getDb, ensureSchema, verifyPassword, hashPassword, generateToken, sessionCookieHeader } from '@/lib/db';

export async function POST(request) {
  await ensureSchema();
  const db = getDb();

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const res = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email.trim().toLowerCase()],
    });

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const user = res.rows[0];
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    // Auto-upgrade legacy unsalted SHA-256 hashes to PBKDF2 on successful login
    if (!user.password_hash.startsWith('pbkdf2:')) {
      try {
        const newHash = await hashPassword(password);
        await db.execute({
          sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
          args: [newHash, user.id],
        });
      } catch (upgradeErr) {
        console.warn('Password hash auto-upgrade error:', upgradeErr);
      }
    }


    // Create session token
    const token = generateToken();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    await db.execute({
      sql: 'INSERT INTO session_tokens (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      args: [token, user.id, now, expiresAt],
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        family_code: user.family_code,
      },
    });

    response.headers.set('Set-Cookie', sessionCookieHeader(token));
    return response;
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Server error during login.' }, { status: 500 });
  }
}
