import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession, generateFamilyCode } from '@/lib/db';

export async function POST(request) {
  await ensureSchema();
  const user = await validateSession(request.headers.get('cookie'));
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent') return NextResponse.json({ error: 'Only parents can delete a family circle' }, { status: 403 });

  const db = getDb();

  try {
    const familyCode = user.family_code;

    // 1. Find all children in this family circle
    const childrenRes = await db.execute({
      sql: "SELECT id FROM users WHERE family_code = ? AND role = 'child'",
      args: [familyCode]
    });

    const childIds = childrenRes.rows.map(r => r.id);

    // 2. Orphan all children and notify them
    const now = new Date().toISOString();
    for (const id of childIds) {
      await db.execute({ sql: "UPDATE users SET family_code = '' WHERE id = ?", args: [id] });
      await db.execute({ sql: 'DELETE FROM member_status WHERE user_id = ?', args: [id] });
      
      const notificationId = crypto.randomUUID();
      const message = `The family circle has been deleted by a parent.`;
      await db.execute({
        sql: 'INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [notificationId, id, message, 0, now]
      });
    }

    // 3. Delete family_circles settings
    await db.execute({
      sql: 'DELETE FROM family_circles WHERE family_code = ?',
      args: [familyCode]
    });

    // 4. Generate new family code for parent to start fresh
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

    // 5. Update parent's family code
    await db.execute({
      sql: 'UPDATE users SET family_code = ? WHERE id = ?',
      args: [newFamilyCode, user.id]
    });

    return NextResponse.json({ success: true, new_family_code: newFamilyCode });
  } catch (e) {
    console.error('Delete circle error:', e);
    return NextResponse.json({ error: 'Server error while deleting circle' }, { status: 500 });
  }
}
