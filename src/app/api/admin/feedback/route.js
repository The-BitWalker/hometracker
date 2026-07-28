import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

// GET: List monthly feedback submissions
export async function GET(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const db = getDb();
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') || 'all';

  try {
    let sql = `
      SELECT pro_feedback.*, users.name as user_name, users.email as user_email
      FROM pro_feedback
      JOIN users ON pro_feedback.user_id = users.id
    `;
    let args = [];

    if (statusFilter !== 'all') {
      sql += ` WHERE pro_feedback.status = ?`;
      args = [statusFilter];
    }

    sql += ` ORDER BY pro_feedback.created_at DESC LIMIT 100`;

    const res = await db.execute({ sql, args });

    return NextResponse.json({ feedback: res.rows });
  } catch (e) {
    console.error('Admin feedback GET error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Update feedback review status (flag / reviewed)
export async function POST(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const db = getDb();

  try {
    const body = await request.json();
    const { feedback_id, status = 'reviewed' } = body;

    if (!feedback_id || !['reviewed', 'flagged', 'submitted'].includes(status)) {
      return NextResponse.json({ error: 'Valid feedback_id and status required.' }, { status: 400 });
    }

    await db.execute({
      sql: `UPDATE pro_feedback SET status = ? WHERE id = ?`,
      args: [status, feedback_id],
    });

    return NextResponse.json({ success: true, message: `Feedback marked as ${status}.` });
  } catch (e) {
    console.error('Admin feedback POST error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE: Clear all monthly feedback reviews
export async function DELETE(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const db = getDb();

  try {
    await db.execute(`DELETE FROM pro_feedback`);
    return NextResponse.json({ success: true, message: 'All monthly feedback reviews cleared successfully.' });
  } catch (e) {
    console.error('Admin feedback DELETE error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
