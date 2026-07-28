import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession, generateFamilyCode } from '@/lib/db';

export async function POST(request) {
  await ensureSchema();
  const user = await validateSession(request.headers.get('cookie'));
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  try {
    let newFamilyCode = '';
    let isUnique = false;
    while (!isUnique) {
      newFamilyCode = generateFamilyCode();
      const codeCheck = await db.execute({
        sql: 'SELECT id FROM users WHERE family_code = ? AND role = ?',
        args: [newFamilyCode, 'parent'],
      });
      if (codeCheck.rows.length === 0) {
        isUnique = true;
      }
    }

    // Create the circle and become parent
    await db.execute({
      sql: "UPDATE users SET family_code = ?, role = 'parent' WHERE id = ?",
      args: [newFamilyCode, user.id]
    });

    const nowIso = new Date().toISOString();
    await db.execute({
      sql: "INSERT OR IGNORE INTO family_circles (family_code, subscription_tier, created_at, updated_at) VALUES (?, 'basic', ?, ?)",
      args: [newFamilyCode, nowIso, nowIso]
    });

    return NextResponse.json({ success: true, role: 'parent', family_code: newFamilyCode });
  } catch (e) {
    console.error('Create circle error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
