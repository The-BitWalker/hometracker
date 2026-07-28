import { NextResponse } from 'next/server';
import { getDb, ensureSchema, hashPassword, generateToken, generateFamilyCode, sessionCookieHeader } from '@/lib/db';

export async function POST(request) {
  await ensureSchema();
  const db = getDb();

  try {
    const { name, email, password, role, familyCode } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    if (role !== 'parent' && role !== 'child') {
      return NextResponse.json({ error: 'Invalid account role.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ error: 'Password must be at least 8 characters and contain letters and numbers.' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email.trim().toLowerCase()],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    let assignedFamilyCode = '';

    if (role === 'parent') {
      let isUnique = false;
      while (!isUnique) {
        assignedFamilyCode = generateFamilyCode();
        const codeCheck = await db.execute({
          sql: 'SELECT id FROM users WHERE family_code = ? AND role = ?',
          args: [assignedFamilyCode, 'parent'],
        });
        if (codeCheck.rows.length === 0) {
          isUnique = true;
        }
      }
    } else {
      // Child: verify parent family code
      if (!familyCode) {
        return NextResponse.json({ error: 'Family code is required for child accounts.' }, { status: 400 });
      }
      const parentCheck = await db.execute({
        sql: 'SELECT id FROM users WHERE family_code = ? AND role = ?',
        args: [familyCode.trim().toUpperCase(), 'parent'],
      });
      if (parentCheck.rows.length === 0) {
        return NextResponse.json({ error: 'No parent account found with that family code.' }, { status: 404 });
      }
      assignedFamilyCode = familyCode.trim().toUpperCase();
    }

    const userId = 'usr_' + crypto.randomUUID();
    const createdAt = new Date().toISOString();


    await db.execute({
      sql: 'INSERT INTO users (id, name, email, password_hash, role, family_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [userId, name.trim(), email.trim().toLowerCase(), passwordHash, role, assignedFamilyCode, createdAt],
    });

    // Create session token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.execute({
      sql: 'INSERT INTO session_tokens (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      args: [token, userId, createdAt, expiresAt],
    });

    const response = NextResponse.json({
      success: true,
      user: { id: userId, name: name.trim(), email: email.trim().toLowerCase(), role, family_code: assignedFamilyCode },
    });

    response.headers.set('Set-Cookie', sessionCookieHeader(token));
    return response;
  } catch (e) {
    console.error('Signup error:', e);
    return NextResponse.json({ error: 'Server error during signup.' }, { status: 500 });
  }
}
