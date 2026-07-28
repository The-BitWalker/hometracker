import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

// GET: Fetch current user's Pro request status
export async function GET(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  try {
    const res = await db.execute({
      sql: `SELECT * FROM pro_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      args: [user.id],
    });

    const activeRequest = res.rows.length > 0 ? res.rows[0] : null;

    return NextResponse.json({
      request: activeRequest,
      status: activeRequest ? activeRequest.status : 'none',
    });
  } catch (e) {
    console.error('Pro request GET error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Submit a new HomeTracker Pro Beta request
export async function POST(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'parent') {
    return NextResponse.json({ error: 'Only parent accounts can request Pro access.' }, { status: 403 });
  }

  const db = getDb();

  try {
    const body = await request.json();
    const { family_size, why_pro, problems_to_solve, valuable_features } = body;

    if (!why_pro || !why_pro.trim() || !problems_to_solve || !problems_to_solve.trim()) {
      return NextResponse.json({ error: 'Please answer all required questions in the request form.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const requestId = crypto.randomUUID();

    // Insert new Pro request
    await db.execute({
      sql: `INSERT INTO pro_requests 
            (id, user_id, family_code, user_name, email, family_size, why_pro, problems_to_solve, valuable_features, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      args: [
        requestId,
        user.id,
        user.family_code,
        user.name,
        user.email,
        Number(family_size) || 1,
        why_pro.trim(),
        problems_to_solve.trim(),
        (valuable_features || '').trim(),
        now,
        now,
      ],
    });

    // Update user's pro status to 'requested'
    await db.execute({
      sql: `UPDATE users SET pro_status = 'requested' WHERE id = ?`,
      args: [user.id],
    });

    // Notify user
    await db.execute({
      sql: `INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
      args: [
        crypto.randomUUID(),
        user.id,
        `📋 Your HomeTracker Pro Beta Program application has been received! Our team will review your submission shortly.`,
        now,
      ],
    });

    return NextResponse.json({
      success: true,
      message: 'Your Pro Beta application has been submitted for admin review.',
      request_id: requestId,
    });
  } catch (e) {
    console.error('Pro request POST error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
