import { NextResponse } from 'next/server';
import { getDb, ensureSchema, validateSession } from '@/lib/db';

// GET: List Pro Beta applications for admin review
export async function GET(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const db = getDb();

  try {
    const res = await db.execute(`
      SELECT pro_requests.*, users.role as user_role
      FROM pro_requests
      JOIN users ON pro_requests.user_id = users.id
      ORDER BY pro_requests.created_at DESC
    `);

    return NextResponse.json({ requests: res.rows });
  } catch (e) {
    console.error('Admin requests GET error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST: Approve or reject a Pro Beta request
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
    const { request_id, action, notes = '' } = body; // action: 'approve' | 'reject'

    if (!request_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Valid request_id and action (approve/reject) required.' }, { status: 400 });
    }

    const reqRes = await db.execute({
      sql: `SELECT * FROM pro_requests WHERE id = ?`,
      args: [request_id],
    });

    if (reqRes.rows.length === 0) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }

    const proReq = reqRes.rows[0];
    const now = new Date().toISOString();

    if (action === 'approve') {
      // Update request status
      await db.execute({
        sql: `UPDATE pro_requests SET status = 'approved', admin_notes = ?, updated_at = ? WHERE id = ?`,
        args: [notes.trim(), now, request_id],
      });

      // Update pro_status for all members in the family circle
      await db.execute({
        sql: `UPDATE users SET pro_status = 'approved', pro_approved_at = ?, pro_approval_reason = ? WHERE family_code = ?`,
        args: [now, notes.trim() || 'Approved by HomeTracker Admin Team', proReq.family_code],
      });

      // Grant lifetime Plus tier to the user's family circle
      await db.execute({
        sql: `INSERT INTO family_circles (family_code, subscription_tier, pro_granted_at, updated_at)
              VALUES (?, 'plus', ?, ?)
              ON CONFLICT(family_code) DO UPDATE SET
              subscription_tier = 'plus',
              pro_granted_at = excluded.pro_granted_at,
              updated_at = excluded.updated_at`,
        args: [proReq.family_code, now, now],
      });

      // Reactivate any soft-deactivated members in the circle
      await db.execute({
        sql: `UPDATE users SET is_deactivated = 0, deactivated_at = NULL WHERE family_code = ?`,
        args: [proReq.family_code],
      });

      // Send congratulations notification to all circle members
      const members = await db.execute({
        sql: `SELECT id FROM users WHERE family_code = ?`,
        args: [proReq.family_code],
      });

      const msg = `🎉 Congratulations! Your Family Circle has been accepted into the HomeTracker Pro Beta Program with lifetime Pro access. Enjoy 10 members, unlimited places & dynamic ETAs!`;

      for (const m of members.rows) {
        await db.execute({
          sql: `INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
          args: [crypto.randomUUID(), m.id, msg, now],
        });
      }

      return NextResponse.json({
        success: true,
        message: `Approved Pro access for ${proReq.user_name} (${proReq.family_code}).`,
      });
    } else {
      // Reject request
      await db.execute({
        sql: `UPDATE pro_requests SET status = 'rejected', admin_notes = ?, updated_at = ? WHERE id = ?`,
        args: [notes.trim(), now, request_id],
      });

      await db.execute({
        sql: `UPDATE users SET pro_status = 'rejected' WHERE id = ?`,
        args: [proReq.user_id],
      });

      await db.execute({
        sql: `INSERT INTO notifications (id, user_id, message, is_read, created_at) VALUES (?, ?, ?, 0, ?)`,
        args: [
          crypto.randomUUID(),
          proReq.user_id,
          `Notice regarding your HomeTracker Pro Beta application: ${notes.trim() || 'Application was not approved at this time.'}`,
          now,
        ],
      });

      return NextResponse.json({
        success: true,
        message: `Rejected request for ${proReq.user_name}.`,
      });
    }
  } catch (e) {
    console.error('Admin requests POST error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE: Clear all Pro applications
export async function DELETE(request) {
  await ensureSchema();

  const user = await validateSession(request.headers.get('cookie'));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const db = getDb();

  try {
    await db.execute(`DELETE FROM pro_requests`);
    return NextResponse.json({ success: true, message: 'All Pro applications cleared successfully.' });
  } catch (e) {
    console.error('Admin requests DELETE error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
